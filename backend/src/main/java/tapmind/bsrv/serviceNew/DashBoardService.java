package tapmind.bsrv.serviceNew;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.dto.DashBoardFilter;
import tapmind.bsrv.dto.UserGoalDataFilterRequestDTO;
import tapmind.bsrv.model.TAMAccount;
import tapmind.bsrv.model.TAMStatus;
import tapmind.bsrv.repository.TAMAccountRepository;
import java.util.function.Function;
import java.time.LocalDate;
import java.math.RoundingMode;

@Service
public class DashBoardService {

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @Autowired
  private TAMAccountRepository tamAccountRepository;

  // Effective goal: RevisedGoal.value if EL-approved, else FixedGoal
  private static final String EFFECTIVE_GOAL =
      "CASE WHEN ug.RevisedGoal IS NOT NULL AND ug.RevisedGoal != '' "
          + "AND JSON_UNQUOTE(JSON_EXTRACT(ug.RevisedGoal, '$.elApproved')) = 'true' "
          + "THEN CAST(JSON_EXTRACT(ug.RevisedGoal, '$.value') AS DECIMAL(10,2)) "
          + "ELSE ug.FixedGoal END";

  // Goal = Target users: for these users, goalEfficiencyPercent uses
  // TargetAchievedPercent
  private static final Map<Integer, Set<Integer>> GOAL_EQUALS_TARGET_USERS = new HashMap<>();
  static {
    GOAL_EQUALS_TARGET_USERS.put(135, Set.of(4, 5));
    GOAL_EQUALS_TARGET_USERS.put(122, Set.of(4, 5, 6));
    GOAL_EQUALS_TARGET_USERS.put(131, Set.of(4, 5, 6));
    GOAL_EQUALS_TARGET_USERS.put(112, Set.of(4));
    GOAL_EQUALS_TARGET_USERS.put(102, Set.of(4));
    GOAL_EQUALS_TARGET_USERS.put(121, Set.of(4, 5, 6));
    GOAL_EQUALS_TARGET_USERS.put(108, Set.of(4));
  }

  private boolean isGoalEqualsTargetUser(Integer userID) {
    return userID != null && GOAL_EQUALS_TARGET_USERS.containsKey(userID);
  }

  private BigDecimal computeAvgTargetPercentForDash(
      Integer userID, Integer departmentID, LocalDate startDate, LocalDate endDate) {
    String sql = """
            SELECT e.WorkDate, e.TargetAchievedPercent
            FROM EfficiencyUtilizationSummary e
            WHERE e.UserID = ?
              AND e.DayType = 'Working'
              AND e.WorkDate BETWEEN ? AND ?
              AND e.WorkDate NOT IN (
                  SELECT uwd.WorkDate FROM UserWorkData uwd
                  WHERE uwd.UserID = e.UserID AND uwd.LeaveType = 'FULL_DAY'
              )
            ORDER BY e.WorkDate
        """;
    List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, userID, startDate, endDate);
    BigDecimal total = BigDecimal.ZERO;
    for (Map<String, Object> row : rows) {
      LocalDate workDate;
      Object wd = row.get("WorkDate");
      if (wd instanceof java.sql.Date) {
        workDate = ((java.sql.Date) wd).toLocalDate();
      } else {
        workDate = LocalDate.parse(wd.toString());
      }
      BigDecimal raw = new BigDecimal(row.get("TargetAchievedPercent").toString());
      total = total.add(computeDashDeptTargetPercent(
          userID, departmentID, workDate, raw));
    }
    if (rows.isEmpty()) {
      return BigDecimal.ZERO;
    }
    return total.divide(BigDecimal.valueOf(rows.size()), 2, RoundingMode.HALF_UP);
  }

  private BigDecimal computeDashDeptTargetPercent(
      Integer userID, Integer departmentID, LocalDate workDate, BigDecimal rawValue) {
    if (departmentID != null && departmentID == 19
        && !workDate.isBefore(LocalDate.of(2026, 5, 22))
        && !workDate.isAfter(LocalDate.of(2026, 6, 30))) {
      Map<String, Object> taskMap = jdbcTemplate.queryForMap("""
          SELECT
            COALESCE(SUM(CASE WHEN TaskID = 68 THEN AchivedUnits ELSE 0 END),0) AS task68,
            COALESCE(SUM(CASE WHEN TaskID = 78 THEN AchivedUnits ELSE 0 END),0) AS task78,
            COALESCE(SUM(CASE WHEN TaskID = 68 THEN Units ELSE 0 END),0) AS units68,
            COALESCE(SUM(CASE WHEN TaskID = 78 THEN Units ELSE 0 END),0) AS units78,
            COALESCE(SUM(CASE WHEN TaskID = 196 THEN AchivedUnits ELSE 0 END),0) AS task196,
            COALESCE(SUM(CASE WHEN TaskID = 197 THEN AchivedUnits ELSE 0 END),0) AS task197,
            COALESCE(SUM(CASE WHEN TaskID = 196 THEN Units ELSE 0 END),0) AS units196,
            COALESCE(SUM(CASE WHEN TaskID = 197 THEN Units ELSE 0 END),0) AS units197
          FROM UserWorkData
          WHERE UserID = ? AND WorkDate = ? AND DepartmentID = 19
          """, userID, workDate);

      BigDecimal achieved68 = new BigDecimal(taskMap.get("task68").toString());
      BigDecimal achieved78 = new BigDecimal(taskMap.get("task78").toString());
      BigDecimal units68 = new BigDecimal(taskMap.get("units68").toString());
      BigDecimal units78 = new BigDecimal(taskMap.get("units78").toString());

      BigDecimal percent68 = BigDecimal.ZERO;
      BigDecimal percent78 = BigDecimal.ZERO;
      if (units68.compareTo(BigDecimal.ZERO) > 0) {
        percent68 = achieved68.divide(units68, 4, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100));
      }
      if (units78.compareTo(BigDecimal.ZERO) > 0) {
        percent78 = achieved78.divide(units78, 4, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100));
      }

      BigDecimal result = percent68.add(percent78)
          .divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP);

      if (result.compareTo(BigDecimal.ZERO) == 0) {
        BigDecimal achieved196 = new BigDecimal(taskMap.get("task196").toString());
        BigDecimal achieved197 = new BigDecimal(taskMap.get("task197").toString());
        BigDecimal units196 = new BigDecimal(taskMap.get("units196").toString());
        BigDecimal units197 = new BigDecimal(taskMap.get("units197").toString());

        BigDecimal percent196 = BigDecimal.ZERO;
        BigDecimal percent197 = BigDecimal.ZERO;
        if (units196.compareTo(BigDecimal.ZERO) > 0) {
          percent196 = achieved196.divide(units196, 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100));
        }
        if (units197.compareTo(BigDecimal.ZERO) > 0) {
          percent197 = achieved197.divide(units197, 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100));
        }
        result = percent196.add(percent197)
            .divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP);
      }
      return result;
    }
    return rawValue;
  }

  private String buildDepartmentFilter(String departmentType) {
    if ("business".equalsIgnoreCase(departmentType)) {
      return " AND e.DepartmentID IN (SELECT d2.DepartmentID FROM Department d2 JOIN PrimaryDepartment pd ON d2.PrimaryDepartmentId = pd.PrimaryDepartmentId WHERE pd.Type = 'business') ";
    } else if ("support".equalsIgnoreCase(departmentType)) {
      return " AND e.DepartmentID IN (SELECT d2.DepartmentID FROM Department d2 JOIN PrimaryDepartment pd ON d2.PrimaryDepartmentId = pd.PrimaryDepartmentId WHERE pd.Type = 'support') ";
    }
    return "";
  }

  private String buildDepartmentFilterForDeptTable(String departmentType) {
    if ("business".equalsIgnoreCase(departmentType)) {
      return " AND d.DepartmentID IN (SELECT d2.DepartmentID FROM Department d2 JOIN PrimaryDepartment pd ON d2.PrimaryDepartmentId = pd.PrimaryDepartmentId WHERE pd.Type = 'business') ";
    } else if ("support".equalsIgnoreCase(departmentType)) {
      return " AND d.DepartmentID IN (SELECT d2.DepartmentID FROM Department d2 JOIN PrimaryDepartment pd ON d2.PrimaryDepartmentId = pd.PrimaryDepartmentId WHERE pd.Type = 'support') ";
    }
    return "";
  }
  // -------------------------------------------------------------------
  // MAIN SUMMARY METHOD (OLD)
  // -------------------------------------------------------------------

  // =========================================
  // NEW HELPER: fetch per-user summary matching
  // EfficiencyReportService.listEfficiencySummary logic
  // =========================================
  private Map<String, Object> getUserEfficiencySummary(
      Integer userId,
      Integer departmentId,
      DashBoardFilter filter) {

    // Step 1: Fetch raw rows
    String fetchSql = """
        SELECT
            e.UserID,
            e.DepartmentID,
            e.WorkDate,
            e.TargetAchievedPercent,
            e.UtilizationPercent,
            e.AllocatedTimeHrs,
            e.TotalTimeOfWork,
            e.EfficiencyLevel
        FROM EfficiencyUtilizationSummary e
        WHERE e.DayType = 'Working'
          AND e.UserID = ?
          AND e.DepartmentID = ?
          AND e.WorkDate BETWEEN ? AND ?
        """;

    List<Map<String, Object>> rows = jdbcTemplate.queryForList(
        fetchSql,
        userId,
        departmentId,
        Date.valueOf(filter.getStartDate()),
        Date.valueOf(filter.getEndDate()));

    // Step 2: Attach leave type
    attachLeaveType(rows);

    // Step 3: Attach GoalPercent (dept 7 = 100, others from UserGoalData)
    attachGoalPercent(rows, departmentId);

    // Step 3b: Apply EfficiencyReportService target mutations (dept 19/23/22, user 158)
    attachTargetAchievedPercent(rows);

    // Step 4: Filter FULL_DAY leaves
    List<Map<String, Object>> filtered = rows.stream()
        .filter(row -> {
          Object lt = row.get("LeaveType");
          return lt == null || !lt.toString().trim().equalsIgnoreCase("FULL_DAY");
        })
        .collect(Collectors.toList());

    if (filtered.isEmpty()) {
      Map<String, Object> empty = new HashMap<>();
      empty.put("AvgTargetPercent", BigDecimal.ZERO);
      empty.put("AvgUtilizationPercent", BigDecimal.ZERO);
      empty.put("AvgAllocatedHrs", BigDecimal.ZERO);
      empty.put("AvgTotalWork", BigDecimal.ZERO);
      empty.put("EfficiencyLevel", "Low");
      return empty;
    }

    // Step 5: Compute averages + efficiency score
    // AvgTargetPercent only counts days with TargetAchievedPercent > 0
    // OR DepartmentID = 54 (matches EfficiencyReportService.computeRowAverages logic)
    BigDecimal totalTarget = BigDecimal.ZERO;
    BigDecimal totalUtil = BigDecimal.ZERO;
    BigDecimal totalAllocated = BigDecimal.ZERO;
    BigDecimal totalWork = BigDecimal.ZERO;
    int count = filtered.size();
    int targetCount = 0;

    for (Map<String, Object> row : filtered) {
      BigDecimal target = new BigDecimal(row.get("TargetAchievedPercent").toString());
      totalTarget = totalTarget.add(target);
      Object deptObj = row.get("DepartmentID");
      boolean isDept54 = deptObj != null && Integer.valueOf(54).equals(deptObj);
      if (isDept54 || target.compareTo(BigDecimal.ZERO) > 0) {
        targetCount++;
      }
      totalUtil = totalUtil.add(new BigDecimal(row.get("UtilizationPercent").toString()));
      totalAllocated = totalAllocated.add(new BigDecimal(row.get("AllocatedTimeHrs").toString()));
      totalWork = totalWork.add(new BigDecimal(row.get("TotalTimeOfWork").toString()));
    }

    BigDecimal avgTarget = targetCount > 0
        ? totalTarget.divide(BigDecimal.valueOf(targetCount), 2, RoundingMode.HALF_UP)
        : BigDecimal.ZERO;
    BigDecimal avgUtil = totalUtil.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
    BigDecimal avgAllocated = totalAllocated.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
    BigDecimal avgWork = totalWork.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);

    // Same scoring logic as EfficiencyReportService.listEfficiencySummary

    // double efficiencyScore = filtered.stream()
    // .mapToDouble(row -> {
    // BigDecimal target = new
    // BigDecimal(row.get("TargetAchievedPercent").toString());
    // BigDecimal util = new BigDecimal(row.get("UtilizationPercent").toString());
    // BigDecimal goal = row.get("GoalPercent") != null
    // ? new BigDecimal(row.get("GoalPercent").toString())
    // : BigDecimal.ZERO;

    // if (target.compareTo(BigDecimal.valueOf(100)) >= 0
    // && (util.compareTo(BigDecimal.valueOf(80)) >= 0
    // || goal.compareTo(BigDecimal.valueOf(80)) >= 0)) {
    // return 3; // High
    // } else if (target.compareTo(BigDecimal.valueOf(80)) >= 0
    // && (util.compareTo(BigDecimal.valueOf(50)) >= 0
    // || goal.compareTo(BigDecimal.valueOf(50)) >= 0)) {
    // return 2; // At Par
    // } else {
    // return 1; // Low
    // }
    // })
    // .average()
    // .orElse(0);

    double efficiencyScoreSum = 0;
    for (Map<String, Object> row : filtered) {
      String level = row.get("EfficiencyLevel") != null
          ? row.get("EfficiencyLevel").toString().trim().toLowerCase()
          : "";
      efficiencyScoreSum += switch (level) {
        case "high" -> 3;
        case "at par" -> 2;
        case "low" -> 1;
        default -> 0;
      };
    }
    double efficiencyScore = count > 0 ? efficiencyScoreSum / count : 0;

    String efficiencyLevel;
    if (efficiencyScore >= 2.5)
      efficiencyLevel = "High";
    else if (efficiencyScore >= 1.5)
      efficiencyLevel = "At Par";
    else
      efficiencyLevel = "Low";

    Map<String, Object> result = new HashMap<>();
    result.put("AvgTargetPercent", avgTarget);
    result.put("AvgUtilizationPercent", avgUtil);
    result.put("AvgAllocatedHrs", avgAllocated);
    result.put("AvgTotalWork", avgWork);
    result.put("EfficiencyLevel", efficiencyLevel);
    return result;
  }

  // =========================================
  // NEW HELPER: attach GoalPercent per row
  // (mirrors EfficiencyReportService.attachGoalPercent)
  // =========================================
  private void attachGoalPercent(
      List<Map<String, Object>> rows,
      Integer departmentId) {

    if (rows == null || rows.isEmpty())
      return;

    String sql = """
        SELECT
            COALESCE(
                ROUND(
                    AVG(
                        CASE
                            WHEN %s > 0
                            THEN (ug.AchievedGoal * 100.0) / %s
                            ELSE 0
                        END
                    ),
                    2
                ),
                0
            ) AS GoalPercent
        FROM UserGoalData ug
        WHERE ug.UserID = ?
          AND ug.WorkDate = ?
        """.formatted(EFFECTIVE_GOAL, EFFECTIVE_GOAL);

    for (Map<String, Object> row : rows) {
      BigDecimal goalPercent;

      if (departmentId != null && departmentId == 7) {
        goalPercent = BigDecimal.valueOf(100);
      } else if (departmentId != null && departmentId == 19) {

        Object dateObj = row.get("WorkDate");
        LocalDate workDate = (dateObj instanceof java.sql.Date)
            ? ((java.sql.Date) dateObj).toLocalDate()
            : LocalDate.parse(dateObj.toString());

        String sql19 = """
                SELECT
                    COALESCE(SUM(CASE WHEN GoalID = 67 THEN AchievedGoal ELSE 0 END),0) AS goal67,
                    COALESCE(SUM(CASE WHEN GoalID = 68 THEN AchievedGoal ELSE 0 END),0) AS goal68,
                    COALESCE(SUM(CASE WHEN GoalID = 67 THEN FixedGoal ELSE 0 END),0) AS fixed67,
                    COALESCE(SUM(CASE WHEN GoalID = 68 THEN FixedGoal ELSE 0 END),0) AS fixed68
                FROM UserGoalData
                WHERE UserID = ?
                  AND WorkDate = ?
            """;

        Map<String, Object> goalMap = jdbcTemplate.queryForMap(sql19, row.get("UserID"), workDate);

        BigDecimal fixed67 = new BigDecimal(goalMap.get("fixed67").toString());

        BigDecimal fixed68 = new BigDecimal(goalMap.get("fixed68").toString());

        // Old data → generic formula
        if (fixed67.add(fixed68).compareTo(BigDecimal.ZERO) == 0) {

          List<Map<String, Object>> result = jdbcTemplate.queryForList(sql, row.get("UserID"), workDate);

          goalPercent = (!result.isEmpty()
              && result.get(0).get("GoalPercent") != null)
                  ? new BigDecimal(result.get(0).get("GoalPercent").toString())
                  : BigDecimal.ZERO;

        } else {

          BigDecimal achieved67 = new BigDecimal(goalMap.get("goal67").toString());

          BigDecimal achieved68 = new BigDecimal(goalMap.get("goal68").toString());

          BigDecimal percent67 = fixed67.compareTo(BigDecimal.ZERO) > 0
              ? achieved67.divide(fixed67, 4, RoundingMode.HALF_UP)
                  .multiply(BigDecimal.valueOf(100))
              : BigDecimal.ZERO;

          BigDecimal percent68 = fixed68.compareTo(BigDecimal.ZERO) > 0
              ? achieved68.divide(fixed68, 4, RoundingMode.HALF_UP)
                  .multiply(BigDecimal.valueOf(100))
              : BigDecimal.ZERO;

          goalPercent = percent67.add(percent68);
        }
      } else {
        Object dateObj = row.get("WorkDate");
        java.time.LocalDate workDate = (dateObj instanceof java.sql.Date)
            ? ((java.sql.Date) dateObj).toLocalDate()
            : java.time.LocalDate.parse(dateObj.toString());

        List<Map<String, Object>> result = jdbcTemplate.queryForList(
            sql, row.get("UserID"), workDate);

        goalPercent = (!result.isEmpty() && result.get(0).get("GoalPercent") != null)
            ? new BigDecimal(result.get(0).get("GoalPercent").toString())
            : BigDecimal.ZERO;
      }

      row.put("GoalPercent", goalPercent);
      row.put("DepartmentID", departmentId); // ensure it's set for scoring
    }
  }

  // Mirrors EfficiencyReportService.attachTargetAchievedPercent
  private void attachTargetAchievedPercent(List<Map<String, Object>> dataList) {
    if (dataList == null || dataList.isEmpty())
      return;

    String sql = """
            SELECT
                COALESCE(SUM(CASE WHEN TaskID = 68 THEN AchivedUnits ELSE 0 END),0) AS task68,
                COALESCE(SUM(CASE WHEN TaskID = 78 THEN AchivedUnits ELSE 0 END),0) AS task78,
                COALESCE(SUM(CASE WHEN TaskID = 68 THEN Units ELSE 0 END),0) AS units68,
                COALESCE(SUM(CASE WHEN TaskID = 78 THEN Units ELSE 0 END),0) AS units78,
                COALESCE(SUM(CASE WHEN TaskID = 196 THEN AchivedUnits ELSE 0 END),0) AS task196,
                COALESCE(SUM(CASE WHEN TaskID = 197 THEN AchivedUnits ELSE 0 END),0) AS task197,
                COALESCE(SUM(CASE WHEN TaskID = 196 THEN Units ELSE 0 END),0) AS units196,
                COALESCE(SUM(CASE WHEN TaskID = 197 THEN Units ELSE 0 END),0) AS units197
            FROM UserWorkData
            WHERE UserID = ?
              AND WorkDate = ?
              AND DepartmentID = 19
        """;

    String sql23 = """
            SELECT
                COALESCE(SUM(CASE WHEN TaskID = 92 THEN AchivedUnits ELSE 0 END),0) AS task92,
                COALESCE(SUM(CASE WHEN TaskID = 92 THEN Units         ELSE 0 END),0) AS units92,
                COALESCE(SUM(CASE WHEN TaskID = 93 THEN AchivedUnits ELSE 0 END),0) AS task93,
                COALESCE(SUM(CASE WHEN TaskID = 93 THEN Units         ELSE 0 END),0) AS units93
            FROM UserWorkData
            WHERE UserID = ?
              AND WorkDate = ?
              AND DepartmentID = 23
        """;

    for (Map<String, Object> row : dataList) {
      Integer userId = (Integer) row.get("UserID");
      Integer departmentId = (Integer) row.get("DepartmentID");
      Object dateObj = row.get("WorkDate");
      LocalDate workDate = (dateObj instanceof Date)
          ? ((Date) dateObj).toLocalDate()
          : LocalDate.parse(dateObj.toString());

      if (departmentId != null && departmentId == 19
          && !workDate.isBefore(LocalDate.of(2026, 5, 22))
          && !workDate.isAfter(LocalDate.of(2026, 6, 30))) {

        Map<String, Object> taskMap = jdbcTemplate.queryForMap(sql, userId, workDate);

        BigDecimal achieved68 = new BigDecimal(taskMap.get("task68").toString());
        BigDecimal achieved78 = new BigDecimal(taskMap.get("task78").toString());
        BigDecimal units68 = new BigDecimal(taskMap.get("units68").toString());
        BigDecimal units78 = new BigDecimal(taskMap.get("units78").toString());
        BigDecimal achieved196 = new BigDecimal(taskMap.get("task196").toString());
        BigDecimal achieved197 = new BigDecimal(taskMap.get("task197").toString());
        BigDecimal units196 = new BigDecimal(taskMap.get("units196").toString());
        BigDecimal units197 = new BigDecimal(taskMap.get("units197").toString());

        BigDecimal percent68 = BigDecimal.ZERO;
        BigDecimal percent78 = BigDecimal.ZERO;

        if (units68.compareTo(BigDecimal.ZERO) > 0) {
          percent68 = achieved68.divide(units68, 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100));
        }
        if (units78.compareTo(BigDecimal.ZERO) > 0) {
          percent78 = achieved78.divide(units78, 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100));
        }

        BigDecimal result = percent68.add(percent78)
            .divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP);

        if (result.compareTo(BigDecimal.ZERO) == 0) {
          BigDecimal percent196 = BigDecimal.ZERO;
          BigDecimal percent197 = BigDecimal.ZERO;

          if (units196.compareTo(BigDecimal.ZERO) > 0) {
            percent196 = achieved196.divide(units196, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
          }
          if (units197.compareTo(BigDecimal.ZERO) > 0) {
            percent197 = achieved197.divide(units197, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
          }

          result = percent196.add(percent197)
              .divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP);
        }

        row.put("TargetAchievedPercent", result);
      }

      if (departmentId != null && departmentId == 23) {
        Map<String, Object> taskMap = jdbcTemplate.queryForMap(sql23, userId, workDate);

        BigDecimal achieved92 = new BigDecimal(taskMap.get("task92").toString());
        BigDecimal units92 = new BigDecimal(taskMap.get("units92").toString());
        BigDecimal achieved93 = new BigDecimal(taskMap.get("task93").toString());
        BigDecimal units93 = new BigDecimal(taskMap.get("units93").toString());

        BigDecimal task92Percent = BigDecimal.ZERO;
        if (units92.compareTo(BigDecimal.ZERO) > 0) {
          BigDecimal calculated = achieved92.divide(units92, 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100));
          int rounded = calculated.setScale(0, RoundingMode.HALF_UP).intValue();
          int target = rounded >= 90 ? 100 : 100 - (90 - rounded);
          task92Percent = BigDecimal.valueOf(Math.max(target, 0));
        }

        BigDecimal task93Percent = BigDecimal.ZERO;
        if (units93.compareTo(BigDecimal.ZERO) > 0) {
          BigDecimal calculated = achieved93.divide(units93, 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100));
          int rounded = calculated.setScale(0, RoundingMode.HALF_UP).intValue();
          int target = 100 - rounded;
          task93Percent = BigDecimal.valueOf(Math.max(target, 0));
        }

        BigDecimal tamPercent = BigDecimal.ZERO;
        List<TAMAccount> accounts = tamAccountRepository
            .findAllByCreatedByUserIDAndStatus(userId, TAMStatus.LIVE);

        for (TAMAccount account : accounts) {
          if (account.getEntryDate() == null || account.getLiveDate() == null)
            continue;
          long workingDays = getWorkingDays(account.getEntryDate(), account.getLiveDate());
          int target = workingDays <= 7 ? 100 : 100 - ((int) (workingDays - 7) * 5);
          target = Math.max(target, 0);
          tamPercent = tamPercent.add(BigDecimal.valueOf(target));
        }

        if (!accounts.isEmpty()) {
          tamPercent = tamPercent.divide(
              BigDecimal.valueOf(accounts.size()), 2, RoundingMode.HALF_UP);
        }

        BigDecimal total = task92Percent.add(task93Percent).add(tamPercent);
        int divisor = (units92.compareTo(BigDecimal.ZERO) == 0
            && units93.compareTo(BigDecimal.ZERO) == 0) ? 1 : 3;

        BigDecimal finalPercent = total.divide(BigDecimal.valueOf(divisor), 2, RoundingMode.HALF_UP);

        row.put("TargetAchievedPercent", finalPercent);
      }

      // Dept 22: TargetAchievedPercent = GoalPercent (dept-22 rule) — only Apr-Jun 2026
      if (departmentId != null && departmentId == 22
          && row.get("GoalPercent") != null
          && !workDate.isBefore(LocalDate.of(2026, 4, 1))
          && !workDate.isAfter(LocalDate.of(2026, 6, 30))) {
        row.put("TargetAchievedPercent", row.get("GoalPercent"));
      }

      // User 158 (dept 42): GoalPercent = TargetAchievedPercent — only Apr-Jun 2026
      if (userId != null && userId == 158 && departmentId != null && departmentId == 42
          && row.get("TargetAchievedPercent") != null
          && !workDate.isBefore(LocalDate.of(2026, 4, 1))
          && !workDate.isAfter(LocalDate.of(2026, 6, 30))) {
        row.put("GoalPercent", row.get("TargetAchievedPercent"));
      }
    }
  }

  private long getWorkingDays(LocalDate start, LocalDate end) {
    long days = 0;
    while (!start.isAfter(end)) {
      if (start.getDayOfWeek() != java.time.DayOfWeek.SATURDAY
          && start.getDayOfWeek() != java.time.DayOfWeek.SUNDAY) {
        days++;
      }
      start = start.plusDays(1);
    }
    return days;
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> listEfficiencySummary(
      DashBoardFilter filter) {
    try {
      StringBuilder sql = new StringBuilder();
      List<Object> params = new ArrayList<>();

      sql.append(
          """
                                SELECT
                                    ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
                                    ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
                                    ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
                                    ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
                                     CASE
                  WHEN
                      ROUND(AVG(e.TargetAchievedPercent),2) >= 100
                      AND ROUND(AVG(e.UtilizationPercent),2) >= 80
                      AND ROUND(AVG(e.TotalTimeOfWork),2)
                          <= ROUND(AVG(e.AllocatedTimeHrs),2)
                  THEN 'High'

                  WHEN
                      ROUND(AVG(e.TargetAchievedPercent),2) >= 80
                      AND ROUND(AVG(e.UtilizationPercent),2) >= 50
                      AND ROUND(AVG(e.TotalTimeOfWork),2)
                          <= ROUND(AVG(e.AllocatedTimeHrs),2)
                  THEN 'At Par'

                  ELSE 'Low'
              END AS EfficiencyLevel,
                            """);

      boolean isUser = filter.getUserID() != null && filter.getUserID() != 0;
      boolean isDept = filter.getDepartmentID() != null && filter.getDepartmentID() != 0;
      boolean isEL = filter.getElID() != null && filter.getElID() != 0;

      if (isUser) {
        sql.append(" e.UserID, u.UserName ");
      } else if (isEL || isDept) {
        sql.append(" e.DepartmentID, d.DepartmentName ");
      } else {
        sql.append(" 'COMPANY' AS Level ");
      }

      sql.append(
          """
                  FROM EfficiencyUtilizationSummary e
                  JOIN Users u ON e.UserID = u.UserID
                  JOIN Department d ON e.DepartmentID = d.DepartmentID
                  WHERE e.DayType = 'Working'
              """);

      sql.append(" AND e.WorkDate BETWEEN ? AND ? ");
      params.add(Date.valueOf(filter.getStartDate()));
      params.add(Date.valueOf(filter.getEndDate()));

      if (isUser) {
        sql.append(" AND e.UserID = ? ");
        params.add(filter.getUserID());
      }

      if (isDept && !isUser) {
        sql.append(" AND e.DepartmentID = ? ");
        params.add(filter.getDepartmentID());
      }

      if (isEL && !isUser) {
        sql.append(
            """
                    AND e.DepartmentID IN (
                        SELECT DepartmentID
                        FROM Department
                        WHERE ExecutiveLeaderID = ?
                    )
                """);
        params.add(filter.getElID());
      }

      if (isUser) {
        sql.append(" GROUP BY e.UserID, u.UserName ");
      } else if (isEL || isDept) {
        sql.append(" GROUP BY e.DepartmentID, d.DepartmentName ");
      }

      return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    } catch (Exception ex) {
      ex.printStackTrace();
      return Collections.emptyList();
    }
  }

  @Transactional(readOnly = true)
  public Map<String, Object> listEfficiencySummaryNewData(
      DashBoardFilter filter) {
    try {
      Map<String, Object> response = new HashMap<>();

      boolean isUser = filter.getUserID() != null && filter.getUserID() != 0;
      boolean isDept = filter.getDepartmentID() != null && filter.getDepartmentID() != 0;
      boolean isEL = filter.getElID() != null && filter.getElID() != 0;
      boolean isFL = filter.getFlID() != null && filter.getFlID() != 0;

      if (isUser && filter.getRoleID() == 2) {
        response.put("userSummary", getUserSummaryForUsers(filter));
        response.put("userGoalSummary", getUserGoalSummaryForUsers(filter));
        return response;
      }

      if (isUser) {
        response.put("userSummary", getUserSummary(filter));
        return response;
      }

      if (isDept) {
        response.put("departmentSummary", getDepartmentSummary(filter, true));
        response.put("departmentGoalSummary", getDepartmentGoalSummary(filter));
        return response;
      }

      if (isFL && filter.isHeFunctionalLeader()) {
        System.out.println("-----------------------FL------------------");
        response.put("flUsersSummary", getFLSummaryUsers(filter, true));
        response.put("flGoalSummary", getFLGoalSummary(filter));
        return response;
      }

      if (isFL) {
        response.put("flSummary", getFLSummary(filter, true));
        return response;
      }

      System.out.println("isHeExecutiveLeader " + filter.isHeExecutiveLeader());

      if (isEL && filter.isHeExecutiveLeader()) {
        response.put("elUsersSummary", getELSummaryUsers(filter, true));
        response.put("elGoalSummary", getELGoalSummaryAdmin(filter));
        return response;
      }

      if (isEL) {
        response.put("elSummary", getELSummary(filter, true));
        return response;
      }

      Map<String, Object> companyTargetGoalMap = getCompanySummary(filter);
      // Map<String, Object> goalMap = getCompanyGoalSummary(filter);

      // companyTargetGoalMap.put(
      // "AvgGoalEfficiency",
      // goalMap.get("AvgGoalEfficiency"));
      response.put("companySummary", companyTargetGoalMap);

      List<Map<String, Object>> elList = getELSummary(filter, false);
      List<Map<String, Object>> elGoalList = getELGoalSummaryAdmin(filter);

      Map<Integer, Object> elGoalMap = elGoalList.stream()
          .filter(m -> m.get("ELID") != null)
          .collect(Collectors.toMap(
              m -> (Integer) m.get("ELID"),
              m -> m.get("AvgGoalEfficiency") != null ? m.get("AvgGoalEfficiency") : 0, // ← null-safe
              (a, b) -> b));

      for (Map<String, Object> el : elList) {
        Integer elId = (Integer) el.get("ELID");
        el.put("AvgGoalEfficiency", elGoalMap.getOrDefault(elId, 0));
      }
      if (filter.getRoleID() != null && filter.getRoleID() == 1) {
        Map<String, Object> elSummaryAdmin = new HashMap<>();

        elSummaryAdmin.put("eldata", getELSummaryUsers(filter, false));
        // elSummaryAdmin.put("elGoalSummary", getELGoalSummaryAdmin(filter));

        response.put("elSummaryAdmin", elSummaryAdmin);
      }
      response.put("elSummary", elList);

      List<Map<String, Object>> flList = getFLSummary(filter, false);
      List<Map<String, Object>> flGoalList = getFLGoalSummary(filter);

      Map<Integer, Object> flGoalMap = flGoalList.stream()
          .filter(m -> m.get("FLID") != null)
          .collect(Collectors.toMap(
              m -> (Integer) m.get("FLID"),
              m -> m.get("AvgGoalEfficiency") != null ? m.get("AvgGoalEfficiency") : 0,
              (a, b) -> b));

      for (Map<String, Object> fl : flList) {
        Integer flId = (Integer) fl.get("FLID");
        fl.put("AvgGoalEfficiency", flGoalMap.getOrDefault(flId, 0));
      }

      response.put("flSummary", flList);

      List<Map<String, Object>> deptList = getDepartmentSummary(filter, false);
      List<Map<String, Object>> deptGoalList = getDepartmentGoalSummary(filter);

      Map<Integer, Object> deptGoalMap = deptGoalList.stream()
          .filter(m -> m.get("DepartmentID") != null)
          .collect(Collectors.toMap(
              m -> (Integer) m.get("DepartmentID"),
              m -> m.get("AvgGoalEfficiency") != null ? m.get("AvgGoalEfficiency") : 0,
              (a, b) -> b));

      for (Map<String, Object> dept : deptList) {
        Integer deptId = (Integer) dept.get("DepartmentID");
        dept.put("AvgGoalEfficiency", deptGoalMap.getOrDefault(deptId, 0));
      }

      response.put("departmentSummary", deptList);

      return response;
    } catch (Exception ex) {
      ex.printStackTrace();
      return new HashMap<>();
    }
  }

  // -------------------------------------------------------------------
  // FIX: Added AND e.DayType = 'Working' to all summary queries below
  // -------------------------------------------------------------------
  private void attachLeaveType(List<Map<String, Object>> rows) {
    if (rows == null || rows.isEmpty())
      return;

    for (Map<String, Object> row : rows) {
      Object userIdObj = row.get("UserID");
      Object workDateObj = row.get("WorkDate");

      if (userIdObj == null || workDateObj == null) {
        row.put("LeaveType", null);
        continue;
      }

      try {
        String sql = """
                SELECT LeaveType
                FROM UserWorkData
                WHERE UserID = ?
                  AND DATE(WorkDate) = DATE(?)
                LIMIT 1
            """;

        List<Map<String, Object>> result = jdbcTemplate.queryForList(
            sql, userIdObj, workDateObj);

        if (!result.isEmpty()) {
          row.put("LeaveType", result.get(0).get("LeaveType"));
        } else {
          row.put("LeaveType", null);
        }
      } catch (Exception e) {
        row.put("LeaveType", null);
      }
    }
  }
  // private Map<String, Object> getCompanySummary(DashBoardFilter filter) {

  // try {
  // String sql = """
  // SELECT
  // ROUND(AVG(e.TargetAchievedPercent), 2) AS AvgTargetPercent,
  // ROUND(AVG(e.UtilizationPercent), 2) AS AvgUtilizationPercent,

  // COALESCE(h.avgAllocated, 0) AS AvgAllocatedHrs,
  // COALESCE(h.avgWork, 0) AS AvgTotalWork,

  // CASE
  // WHEN ROUND(AVG(
  // CASE
  // WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
  // WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
  // WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
  // ELSE 0
  // END
  // ), 1) >= 2.5 THEN 'High'

  // WHEN ROUND(AVG(
  // CASE
  // WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
  // WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
  // WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
  // ELSE 0
  // END
  // ), 1) >= 1.5 THEN 'At Par'

  // ELSE 'Low'
  // END AS EfficiencyLevel

  // FROM EfficiencyUtilizationSummary e

  // -- ✅ EXCLUDE FULL_DAY LEAVES (same logic as Performance Insights)
  // LEFT JOIN UserWorkData uwd
  // ON uwd.UserID = e.UserID
  // AND uwd.WorkDate = e.WorkDate

  // -- ✅ HOURS SUBQUERY (unchanged)
  // CROSS JOIN (
  // SELECT
  // ROUND(AVG(daily_allocated), 2) AS avgAllocated,
  // ROUND(AVG(daily_work), 2) AS avgWork
  // FROM (
  // SELECT
  // u.UserID,
  // DATE(u.WorkDate) AS work_day,
  // SUM(u.AllocatedTime) / 60 AS daily_allocated,
  // SUM(u.TimeTakenToWork) / 60 AS daily_work
  // FROM UserWorkData u
  // WHERE u.WorkDate BETWEEN ? AND ?
  // AND (u.LeaveType IS NULL OR u.LeaveType != 'FULL_DAY')
  // AND DAYOFWEEK(u.WorkDate) NOT IN (1, 7)
  // GROUP BY u.UserID, DATE(u.WorkDate)
  // ) t
  // ) h

  // WHERE e.DayType = 'Working'
  // AND e.WorkDate BETWEEN ? AND ?
  // AND (uwd.LeaveType IS NULL OR UPPER(TRIM(uwd.LeaveType)) != 'FULL_DAY')
  // """;

  // return jdbcTemplate.queryForMap(
  // sql,
  // Date.valueOf(filter.getStartDate()), // for UserWorkData subquery
  // Date.valueOf(filter.getEndDate()),
  // Date.valueOf(filter.getStartDate()), // for EfficiencyUtilizationSummary
  // Date.valueOf(filter.getEndDate()));
  // } catch (Exception ex) {
  // ex.printStackTrace();
  // return new HashMap<>();
  // }

  // }
  private Map<String, Object> getCompanySummary(DashBoardFilter filter) {
    try {

      // ✅ STEP 1: Fetch all rows (same as listEfficiencySummary mainList)
      String fetchSql = """
              SELECT
                  e.UserID,
                  e.WorkDate,
                  e.TargetAchievedPercent,
                  e.UtilizationPercent,
                  e.AllocatedTimeHrs,
                  e.TotalTimeOfWork,
                  e.EfficiencyLevel
              FROM EfficiencyUtilizationSummary e
              WHERE e.DayType = 'Working'
                AND e.WorkDate BETWEEN ? AND ?
          """;
      fetchSql += buildDepartmentFilter(filter.getDepartmentType());

      List<Map<String, Object>> mainList = jdbcTemplate.queryForList(
          fetchSql,
          Date.valueOf(filter.getStartDate()),
          Date.valueOf(filter.getEndDate()));

      // ✅ STEP 2: Attach LeaveType (same as Performance Insights)
      attachLeaveType(mainList);

      // ✅ STEP 3: Filter out FULL_DAY (same as Performance Insights)
      List<Map<String, Object>> filteredList = mainList.stream()
          .filter(row -> {
            Object lt = row.get("LeaveType");
            if (lt == null)
              return true;
            return !lt.toString().trim().equalsIgnoreCase("FULL_DAY");
          })
          .collect(Collectors.toList());

      // ✅ STEP 4: Compute averages in Java (same as Performance Insights)
      BigDecimal totalTarget = BigDecimal.ZERO;
      BigDecimal totalUtil = BigDecimal.ZERO;
      BigDecimal totalAllocated = BigDecimal.ZERO;
      BigDecimal totalWork = BigDecimal.ZERO;
      BigDecimal effScoreSum = BigDecimal.ZERO;
      int count = filteredList.size();
      int targetCount = 0;

      for (Map<String, Object> row : filteredList) {
        BigDecimal target = new BigDecimal(row.get("TargetAchievedPercent").toString());
        totalTarget = totalTarget.add(target);
        if (target.compareTo(BigDecimal.ZERO) > 0) {
          targetCount++;
        }
        totalUtil = totalUtil.add(new BigDecimal(row.get("UtilizationPercent").toString()));
        totalAllocated = totalAllocated.add(new BigDecimal(row.get("AllocatedTimeHrs").toString()));
        totalWork = totalWork.add(new BigDecimal(row.get("TotalTimeOfWork").toString()));

        String level = row.get("EfficiencyLevel").toString().trim().toLowerCase();
        int score = switch (level) {
          case "high" -> 3;
          case "at par" -> 2;
          case "medium" -> 2;
          case "low" -> 1;
          default -> 0;
        };
        effScoreSum = effScoreSum.add(BigDecimal.valueOf(score));
      }

      BigDecimal avgTarget = BigDecimal.ZERO;
      BigDecimal avgUtil = BigDecimal.ZERO;
      BigDecimal avgAllocated = BigDecimal.ZERO;
      BigDecimal avgWork = BigDecimal.ZERO;
      BigDecimal avgScore = BigDecimal.ZERO;

      if (count > 0) {
        avgTarget = targetCount > 0
            ? totalTarget.divide(BigDecimal.valueOf(targetCount), 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
        avgUtil = totalUtil.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
        avgAllocated = totalAllocated.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
        avgWork = totalWork.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
        avgScore = effScoreSum.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
      }

      // ✅ STEP 5: Efficiency level (same thresholds as Performance Insights)
      BigDecimal avgGoalEfficiency = BigDecimal.ZERO;

      Map<String, Object> goalMap = getCompanyGoalSummary(filter);

      if (goalMap.get("AvgGoalEfficiency") != null) {
        avgGoalEfficiency = new BigDecimal(
            goalMap.get("AvgGoalEfficiency").toString());
      }

      // String efficiencyLevel;

      // if (avgTarget.compareTo(BigDecimal.valueOf(100)) >= 0
      // && avgUtil.compareTo(BigDecimal.valueOf(80)) >= 0
      // && avgGoalEfficiency.compareTo(BigDecimal.valueOf(80)) >= 0
      // && avgWork.compareTo(avgAllocated) <= 0) {

      // efficiencyLevel = "High";

      // } else if (avgTarget.compareTo(BigDecimal.valueOf(80)) >= 0
      // && avgUtil.compareTo(BigDecimal.valueOf(50)) >= 0
      // && avgGoalEfficiency.compareTo(BigDecimal.valueOf(50)) >= 0
      // && avgWork.compareTo(avgAllocated) <= 0) {

      // efficiencyLevel = "At Par";

      // } else {

      // efficiencyLevel = "Low";
      // }

      double efficiencyScore = filteredList.stream()
          .mapToDouble(row -> {

            String level = String.valueOf(
                row.get("EfficiencyLevel")).trim().toLowerCase();

            return switch (level) {

              case "high" -> 3;

              case "at par" -> 2;

              case "low" -> 1;

              default -> 0;
            };
          })
          .average()
          .orElse(0);

      String efficiencyLevel;

      if (efficiencyScore >= 2.5) {

        efficiencyLevel = "High";

      } else if (efficiencyScore >= 1.5) {

        efficiencyLevel = "At Par";

      } else {

        efficiencyLevel = "Low";
      }

      // ✅ STEP 6: Also compute AvgAllocatedHrs + AvgTotalWork from UserWorkData
      // (keep your existing CROSS JOIN subquery for hours — unchanged)
      String hoursSql = """
              SELECT
                  ROUND(AVG(daily_allocated), 2) AS avgAllocated,
                  ROUND(AVG(daily_work), 2)      AS avgWork
              FROM (
                  SELECT
                      u.UserID,
                      DATE(u.WorkDate)            AS work_day,
                      SUM(u.AllocatedTime) / 60   AS daily_allocated,
                      SUM(u.TimeTakenToWork) / 60 AS daily_work
                  FROM UserWorkData u
                  WHERE u.WorkDate BETWEEN ? AND ?
                    AND (u.LeaveType IS NULL OR u.LeaveType != 'FULL_DAY')
                    AND DAYOFWEEK(u.WorkDate) NOT IN (1, 7)
                  GROUP BY u.UserID, DATE(u.WorkDate)
              ) t
          """;

      Map<String, Object> hoursRow = jdbcTemplate.queryForMap(
          hoursSql,
          Date.valueOf(filter.getStartDate()),
          Date.valueOf(filter.getEndDate()));

      // ✅ STEP 7: Build response map
      Map<String, Object> result = new HashMap<>();
      // result.put("AvgTargetPercent", avgTarget);
      // result.put("AvgUtilizationPercent", avgUtil);
      // result.put("AvgAllocatedHrs", hoursRow.getOrDefault("avgAllocated",
      // BigDecimal.ZERO));
      // result.put("AvgTotalWork", hoursRow.getOrDefault("avgWork",
      // BigDecimal.ZERO));
      result.put("EfficiencyLevel", efficiencyLevel);
      List<Map<String, Object>> elData = getELSummaryUsers(filter, false);
      BigDecimal companyGoal = calculateAverageFromELs(
          elData,
          "AvgGoalEfficiency");

      result.put(
          "AvgGoalEfficiency",
          companyGoal);

      result.put(
          "AvgTargetPercent",
          calculateTargetAverageFromELs(elData));

      result.put(
          "AvgUtilizationPercent",
          calculateAverageFromELs(
              elData,
              "AvgUtilizationPercent"));

      result.put(
          "AvgAllocatedHrs",
          calculateAverageFromELs(
              elData,
              "AvgAllocatedHrs"));

      result.put(
          "AvgTotalWork",
          calculateAverageFromELs(
              elData,
              "AvgTotalWork"));
      return result;

    } catch (Exception ex) {
      ex.printStackTrace();
      return new HashMap<>();
    }
  }

  private List<Map<String, Object>> getELSummary(
      DashBoardFilter filter,
      boolean onlyOne) {
    try {
      StringBuilder sql = new StringBuilder(
          """
                                SELECT
                                    d.ExecutiveLeaderID AS ELID,
                                    u.UserName AS ELName,
                                    ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
                                    ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
                                    ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
                                    ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
                                    CASE
                  WHEN
                      ROUND(AVG(e.TargetAchievedPercent),2) >= 100
                      AND ROUND(AVG(e.UtilizationPercent),2) >= 80
                      AND ROUND(AVG(e.TotalTimeOfWork),2)
                          <= ROUND(AVG(e.AllocatedTimeHrs),2)
                  THEN 'High'

                  WHEN
                      ROUND(AVG(e.TargetAchievedPercent),2) >= 80
                      AND ROUND(AVG(e.UtilizationPercent),2) >= 50
                      AND ROUND(AVG(e.TotalTimeOfWork),2)
                          <= ROUND(AVG(e.AllocatedTimeHrs),2)
                  THEN 'At Par'

                  ELSE 'Low'
              END AS EfficiencyLevel
                                FROM EfficiencyUtilizationSummary e
                                JOIN Department d ON e.DepartmentID = d.DepartmentID
                                JOIN Users u ON d.ExecutiveLeaderID = u.UserID
                                WHERE e.DayType = 'Working'
                                  AND u.RoleID = 3
                                  AND e.WorkDate BETWEEN ? AND ?
                            """);

      List<Object> params = new ArrayList<>();
      params.add(Date.valueOf(filter.getStartDate()));
      params.add(Date.valueOf(filter.getEndDate()));
      sql.append(buildDepartmentFilter(filter.getDepartmentType()));

      if (onlyOne) {
        sql.append(" AND d.ExecutiveLeaderID = ? ");
        params.add(filter.getElID());
      }

      sql.append(" GROUP BY d.ExecutiveLeaderID, u.UserName ");
      System.out.println(sql);
      return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    } catch (Exception ex) {
      ex.printStackTrace();
      return Collections.emptyList();
    }
  }

  private List<Map<String, Object>> getFLSummary(
      DashBoardFilter filter,
      boolean onlyOne) {
    try {
      StringBuilder sql = new StringBuilder(
          """
                                SELECT
                                    d.FunctionalLeaderID AS FLID,
                                    u.UserName AS FLName,
                                    ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
                                    ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
                                    ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
                                    ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
                                   CASE
                  WHEN
                      ROUND(AVG(e.TargetAchievedPercent),2) >= 100
                      AND ROUND(AVG(e.UtilizationPercent),2) >= 80
                      AND ROUND(AVG(e.TotalTimeOfWork),2)
                          <= ROUND(AVG(e.AllocatedTimeHrs),2)
                  THEN 'High'

                  WHEN
                      ROUND(AVG(e.TargetAchievedPercent),2) >= 80
                      AND ROUND(AVG(e.UtilizationPercent),2) >= 50
                      AND ROUND(AVG(e.TotalTimeOfWork),2)
                          <= ROUND(AVG(e.AllocatedTimeHrs),2)
                  THEN 'At Par'

                  ELSE 'Low'
              END AS EfficiencyLevel
                                FROM EfficiencyUtilizationSummary e
                                JOIN Department d ON e.DepartmentID = d.DepartmentID
                                JOIN Users u ON d.FunctionalLeaderID = u.UserID
                                WHERE e.DayType = 'Working'
                                  AND u.RoleID = 4
                                  AND e.WorkDate BETWEEN ? AND ?
                            """);

      List<Object> params = new ArrayList<>();
      params.add(Date.valueOf(filter.getStartDate()));
      params.add(Date.valueOf(filter.getEndDate()));

      if (onlyOne) {
        sql.append(" AND d.FunctionalLeaderID = ? ");
        params.add(filter.getFlID());
      }

      sql.append(" GROUP BY d.FunctionalLeaderID, u.UserName ");

      return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    } catch (Exception ex) {
      ex.printStackTrace();
      return Collections.emptyList();
    }
  }

  private List<Map<String, Object>> getDepartmentSummary(
      DashBoardFilter filter,
      boolean onlyOne) {
    try {
      StringBuilder sql = new StringBuilder(
          """
                                SELECT
                                    e.DepartmentID,
                                    d.DepartmentName,
                                    ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
                                    ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
                                    ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
                                    ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
                                    CASE
                  WHEN
                      ROUND(AVG(e.TargetAchievedPercent),2) >= 100
                      AND ROUND(AVG(e.UtilizationPercent),2) >= 80
                      AND ROUND(AVG(e.TotalTimeOfWork),2)
                          <= ROUND(AVG(e.AllocatedTimeHrs),2)
                  THEN 'High'

                  WHEN
                      ROUND(AVG(e.TargetAchievedPercent),2) >= 80
                      AND ROUND(AVG(e.UtilizationPercent),2) >= 50
                      AND ROUND(AVG(e.TotalTimeOfWork),2)
                          <= ROUND(AVG(e.AllocatedTimeHrs),2)
                  THEN 'At Par'

                  ELSE 'Low'
              END AS EfficiencyLevel
                                FROM EfficiencyUtilizationSummary e
                                JOIN Department d ON e.DepartmentID = d.DepartmentID
                                WHERE e.DayType = 'Working'
                                  AND d.DepartmentStatus = true
                                  AND e.WorkDate BETWEEN ? AND ?
                            """);

      List<Object> params = new ArrayList<>();
      params.add(Date.valueOf(filter.getStartDate()));
      params.add(Date.valueOf(filter.getEndDate()));
      sql.append(buildDepartmentFilter(filter.getDepartmentType()));

      if (onlyOne) {
        sql.append(" AND e.DepartmentID = ? ");
        params.add(filter.getDepartmentID());
      }

      sql.append(" GROUP BY e.DepartmentID, d.DepartmentName ");

      return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    } catch (Exception ex) {
      ex.printStackTrace();
      return Collections.emptyList();
    }
  }

  public List<Map<String, Object>> getUserSummary(DashBoardFilter filter) {
    try {
      Integer filterDeptId = (filter.getDepartmentID() != null && filter.getDepartmentID() != 0)
          ? filter.getDepartmentID()
          : null;

      // Step 1: get UserID + UserName + the DISTINCT departments each user
      // worked in during the range (respecting filters)
      StringBuilder sql = new StringBuilder("""
              SELECT DISTINCT e.UserID, u.UserName, e.DepartmentID
              FROM EfficiencyUtilizationSummary e
              JOIN Users u ON e.UserID = u.UserID
              WHERE e.DayType = 'Working'
                AND e.WorkDate BETWEEN ? AND ?
          """);
      sql.append(buildDepartmentFilter(filter.getDepartmentType()));

      List<Object> params = new ArrayList<>();
      params.add(Date.valueOf(filter.getStartDate()));
      params.add(Date.valueOf(filter.getEndDate()));

      if (filter.getUserID() != null && filter.getUserID() != 0) {
        sql.append(" AND e.UserID = ? ");
        params.add(filter.getUserID());
      }
      if (filterDeptId != null) {
        sql.append(" AND e.DepartmentID = ? ");
        params.add(filterDeptId);
      }
      if (filter.getElID() != null && filter.getElID() != 0) {
        sql.append("""
                AND e.DepartmentID IN (
                    SELECT DepartmentID FROM Department WHERE ExecutiveLeaderID = ?
                )
            """);
        params.add(filter.getElID());
      }

      List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params.toArray());

      // Step 2: group departments by user
      Map<Integer, String> userNames = new LinkedHashMap<>();
      Map<Integer, Set<Integer>> userDepts = new LinkedHashMap<>();

      for (Map<String, Object> row : rows) {
        Integer userId = (Integer) row.get("UserID");
        String userName = (String) row.get("UserName");
        Integer deptId = (Integer) row.get("DepartmentID");

        userNames.putIfAbsent(userId, userName);
        userDepts.computeIfAbsent(userId, k -> new LinkedHashSet<>()).add(deptId);
      }

      // Step 3: for each user, compute summary per department, then combine
      List<Map<String, Object>> result = new ArrayList<>();

      for (Map.Entry<Integer, String> entry : userNames.entrySet()) {
        Integer userId = entry.getKey();
        String userName = entry.getValue();
        Set<Integer> depts = userDepts.get(userId);

        Map<String, Object> user = new HashMap<>();
        user.put("UserID", userId);
        user.put("UserName", userName);

        if (depts.size() == 1) {
          // fast path — single department, same as before
          Integer deptId = depts.iterator().next();
          Map<String, Object> summary = getUserEfficiencySummary(userId, deptId, filter);
          user.putAll(summary);
        } else {
          // multi-department user — compute per dept, then average
          List<Map<String, Object>> deptSummaries = new ArrayList<>();
          for (Integer deptId : depts) {
            deptSummaries.add(getUserEfficiencySummary(userId, deptId, filter));
          }

          user.put("AvgTargetPercent",
              calculateAverageFromUsers(deptSummaries, "AvgTargetPercent"));
          user.put("AvgUtilizationPercent",
              calculateAverageFromUsers(deptSummaries, "AvgUtilizationPercent"));
          user.put("AvgAllocatedHrs",
              calculateAverageFromUsers(deptSummaries, "AvgAllocatedHrs"));
          user.put("AvgTotalWork",
              calculateAverageFromUsers(deptSummaries, "AvgTotalWork"));

          double scoreSum = 0;
          for (Map<String, Object> ds : deptSummaries) {
            String level = ds.get("EfficiencyLevel") != null
                ? ds.get("EfficiencyLevel").toString().trim().toLowerCase()
                : "";
            scoreSum += switch (level) {
              case "high" -> 3;
              case "at par" -> 2;
              case "low" -> 1;
              default -> 0;
            };
          }
          double avgScore = deptSummaries.isEmpty() ? 0 : scoreSum / deptSummaries.size();
          user.put("EfficiencyLevel", scoreToLevel(avgScore));
        }

        result.add(user);
      }

      result.sort(Comparator.comparing(m -> (String) m.get("UserName")));

      return result;
    } catch (Exception ex) {
      ex.printStackTrace();
      return Collections.emptyList();
    }
  }

  public List<Map<String, Object>> getUserGoalSummaryForUsers(
      DashBoardFilter filter) {

    try {
      List<Map<String, Object>> finalList = new ArrayList<>();
      List<Object> params = new ArrayList<>();

      StringBuilder sql = new StringBuilder(
          """
                  SELECT
                      ug.UserID,
                      u.UserName,
                      ROUND(
                          (SUM(ug.AchievedGoal) / SUM(%s)) * 100,
                          2
                      ) AS AvgGoalEfficiency
                  FROM UserGoalData ug
                  JOIN Users u ON ug.UserID = u.UserID
                  WHERE ug.WorkDate BETWEEN ? AND ?
                    AND %s > 0
              """.formatted(EFFECTIVE_GOAL, EFFECTIVE_GOAL));

      // Goal date range
      params.add(Date.valueOf(filter.getGoalStartDate()));
      params.add(Date.valueOf(filter.getGoalEndDate()));

      if (filter.getUserID() != null && filter.getUserID() != 0) {
        sql.append(" AND ug.UserID = ? ");
        params.add(filter.getUserID());
      }

      if (filter.getDepartmentID() != null && filter.getDepartmentID() != 0) {
        sql.append(" AND ug.DepartmentID = ? ");
        params.add(filter.getDepartmentID());
      }

      if (filter.getElID() != null && filter.getElID() != 0) {
        sql.append("""
                AND ug.DepartmentID IN (
                    SELECT DepartmentID
                    FROM Department
                    WHERE ExecutiveLeaderID = ?
                )
            """);
        params.add(filter.getElID());
      }

      sql.append(" GROUP BY ug.UserID, u.UserName ORDER BY u.UserName ASC ");

      List<Map<String, Object>> summaryList = jdbcTemplate.queryForList(
          sql.toString(),
          params.toArray());

      String dailySql = """
          SELECT
              e.WorkDate,
              e.TargetAchievedPercent,
              e.UtilizationPercent,
              e.AllocatedTimeHrs,
              e.TotalTimeOfWork,
              e.EfficiencyLevel
          FROM EfficiencyUtilizationSummary e
          WHERE e.DayType = 'Working'
            AND e.UserID = ?
            AND e.WorkDate BETWEEN ? AND ?

            AND NOT EXISTS (
                SELECT 1
                FROM UserWorkData uw
                WHERE uw.UserID = e.UserID
                  AND uw.WorkDate = e.WorkDate
                  AND UPPER(TRIM(uw.LeaveType)) = 'FULL_DAY'
            )

          ORDER BY e.WorkDate ASC
          """;

      for (Map<String, Object> summary : summaryList) {

        Integer userId = (Integer) summary.get("UserID");

        // Dashboard date range (Target/Utilization chart)
        List<Map<String, Object>> dailyData = jdbcTemplate.queryForList(
            dailySql,
            userId,
            Date.valueOf(filter.getStartDate()),
            Date.valueOf(filter.getEndDate()));

        for (Map<String, Object> daily : dailyData) {
          daily.put("UserID", userId);
        }

        summary.put("DailyGoalData", dailyData);

        finalList.add(summary);
      }

      return finalList;

    } catch (Exception ex) {
      ex.printStackTrace();
      return Collections.emptyList();
    }
  }

  public List<Map<String, Object>> getDepartmentGoalSummary(
      DashBoardFilter filter) {

    String sql = """
        SELECT
            ug.DepartmentID,
            d.DepartmentName,
            ROUND((SUM(ug.AchievedGoal) / SUM(%s)) * 100, 2) AS AvgGoalEfficiency
        FROM UserGoalData ug
        JOIN Department d ON ug.DepartmentID = d.DepartmentID
        WHERE ug.WorkDate BETWEEN ? AND ?
          AND %s > 0
        """.formatted(EFFECTIVE_GOAL, EFFECTIVE_GOAL)
        + buildDepartmentFilterForDeptTable(filter.getDepartmentType()) + """
        GROUP BY ug.DepartmentID, d.DepartmentName
        """;

    return jdbcTemplate.queryForList(
        sql,
        Date.valueOf(filter.getGoalStartDate()),
        Date.valueOf(filter.getGoalEndDate()));
  }

  public List<Map<String, Object>> getFLGoalSummary(DashBoardFilter filter) {
    return getFLGoalSummary(filter, null);
  }

  public List<Map<String, Object>> getFLGoalSummary(
      DashBoardFilter filter,
      Integer flID) {

    StringBuilder sql = new StringBuilder("""
        SELECT
            d.FunctionalLeaderID AS FLID,
            ROUND(
               SUM(
                   CASE WHEN ug.DepartmentID = 7 THEN 100 ELSE ug.AchievedGoal END
               ) * 100.0 /
               NULLIF(
                   SUM(
                       CASE WHEN ug.DepartmentID = 7 THEN 100 ELSE %s END
                   ),
                   0
               ),
               2
           ) AS AvgGoalEfficiency
       FROM UserGoalData ug
       JOIN Department d ON ug.DepartmentID = d.DepartmentID
        WHERE ug.WorkDate BETWEEN ? AND ?
        """.formatted(EFFECTIVE_GOAL));

    List<Object> params = new ArrayList<>();
    params.add(Date.valueOf(filter.getGoalStartDate()));
    params.add(Date.valueOf(filter.getGoalEndDate()));

    if (flID != null) {
      sql.append(" AND d.FunctionalLeaderID = ? ");
      params.add(flID);
    }

    sql.append(" GROUP BY d.FunctionalLeaderID ");

    return jdbcTemplate.queryForList(sql.toString(), params.toArray());
  }

  public List<Map<String, Object>> getELGoalSummary(
      DashBoardFilter filter) {

    String sql = """
        SELECT
            d.ExecutiveLeaderID AS ELID,
            ROUND((SUM(ug.AchievedGoal) / SUM(ug.FixedGoal)) * 100, 2) AS AvgGoalEfficiency
        FROM UserGoalData ug
        JOIN Department d ON ug.DepartmentID = d.DepartmentID
        WHERE ug.WorkDate BETWEEN ? AND ?
          AND ug.FixedGoal > 0
        GROUP BY d.ExecutiveLeaderID
        """;

    return jdbcTemplate.queryForList(
        sql,
        Date.valueOf(filter.getGoalStartDate()),
        Date.valueOf(filter.getGoalEndDate()));
  }

  public List<Map<String, Object>> getELGoalSummaryAdmin(
      DashBoardFilter filter) {

    String sql = """
        SELECT
            d.ExecutiveLeaderID AS ELID,
            ROUND(
               SUM(ug.AchievedGoal) * 100.0 /
               NULLIF(
                   SUM(%s),
                   0
               ),
               2
            ) AS AvgGoalEfficiency

        FROM UserGoalData ug

        JOIN Department d
            ON ug.DepartmentID = d.DepartmentID

        WHERE ug.WorkDate BETWEEN ? AND ?

        GROUP BY d.ExecutiveLeaderID
        """.formatted(EFFECTIVE_GOAL);

    return jdbcTemplate.queryForList(
        sql,
        Date.valueOf(filter.getGoalStartDate()),
        Date.valueOf(filter.getGoalEndDate()));
  }

  public Map<String, Object> getCompanyGoalSummary(
      DashBoardFilter filter) {

    String sql = """
        SELECT
            ROUND(
                (
                    SUM(ug.AchievedGoal) /
                    NULLIF(SUM(%s), 0)
                ) * 100,
                2
            ) AS AvgGoalEfficiency
        FROM UserGoalData ug
        WHERE ug.WorkDate BETWEEN ? AND ?
          AND %s > 0
        """.formatted(EFFECTIVE_GOAL, EFFECTIVE_GOAL);

    return jdbcTemplate.queryForMap(
        sql,
        Date.valueOf(filter.getGoalStartDate()),
        Date.valueOf(filter.getGoalEndDate()));
  }

  private Integer normalize(Integer value) {
    return (value != null && value == 0) ? null : value;
  }

  // public BigDecimal getAverageSum(
  // UserGoalDataFilterRequestDTO filter,
  // Integer userID) {
  // Integer departmentID = normalize(filter.getDepartmentID());
  // Integer elID = normalize(filter.getELID());
  // Integer flID = normalize(filter.getFLID());
  // StringBuilder sql = new StringBuilder(
  // """
  // SELECT
  // LEAST(
  // ROUND(
  // (SUM(ug.AchievedGoal) / NULLIF(SUM(ug.FixedGoal), 0)) * 100,
  // 2
  // ),
  // 100
  // ) AS AvgGoalEfficiency
  // FROM UserGoalData ug
  // WHERE ug.WorkDate BETWEEN ? AND ?
  // AND ug.FixedGoal > 0
  // """);
  // List<Object> params = new ArrayList<>();
  // params.add(Date.valueOf(filter.getStartDate()));
  // params.add(Date.valueOf(filter.getEndDate()));
  // if (filter.getRoleID() != null && filter.getRoleID() == 1) {
  // if (departmentID != null) {
  // sql.append(" AND ug.DepartmentID = ? ");
  // params.add(departmentID);
  // }
  // if (elID != null && elID > 0) {
  // sql.append(
  // """
  // AND ug.DepartmentID IN (
  // SELECT DepartmentID
  // FROM Department
  // WHERE ExecutiveLeaderID = ?
  // )
  // """);
  // params.add(elID);
  // }
  // if (userID != null) {
  // sql.append(" AND ug.UserID = ? ");
  // params.add(userID);
  // }
  // } else if (elID != null && elID > 0) {
  // sql.append(
  // """
  // AND ug.DepartmentID IN (
  // SELECT DepartmentID
  // FROM Department
  // WHERE ExecutiveLeaderID = ?
  // )
  // """);
  // params.add(elID);

  // if (departmentID != null) {
  // sql.append(" AND ug.DepartmentID = ? ");
  // params.add(departmentID);
  // }
  // } else if (flID != null && flID > 0) {
  // sql.append(
  // """
  // AND ug.DepartmentID IN (
  // SELECT DepartmentID
  // FROM Department
  // WHERE FunctionalLeaderID = ?
  // )
  // """);
  // params.add(flID);

  // if (departmentID != null) {
  // sql.append(" AND ug.DepartmentID = ? ");
  // params.add(departmentID);
  // }
  // } else if (userID != null) {
  // sql.append(" AND ug.UserID = ? ");
  // params.add(userID);

  // if (departmentID != null) {
  // sql.append(" AND ug.DepartmentID = ? ");
  // params.add(departmentID);
  // }
  // }

  // Map<String, Object> result = jdbcTemplate.queryForMap(
  // sql.toString(),
  // params.toArray());

  // return (BigDecimal) result.get("AvgGoalEfficiency");
  // }

  private BigDecimal getGoalEfficiencyByFilter(
      DashBoardFilter filter,
      Integer userId,
      Integer departmentId,
      Integer elId,
      Integer flId) {
    System.out.println("getGoalEfficiencyByFilter → goalStart=" + filter.getGoalStartDate()
        + " goalEnd=" + filter.getGoalEndDate());
    StringBuilder sql = new StringBuilder(
        """
                        SELECT
                            ROUND(
              AVG(
                CASE
                  WHEN ug.DepartmentID = 7 THEN 100
                  WHEN %s IS NULL OR %s = 0 THEN 0
                  ELSE ug.AchievedGoal / %s * 100
                END
              ), 2
            ) AS AvgGoalEfficiency
                        FROM UserGoalData ug
                        WHERE ug.WorkDate BETWEEN ? AND ?
                        """.formatted(EFFECTIVE_GOAL, EFFECTIVE_GOAL, EFFECTIVE_GOAL));

    List<Object> params = new ArrayList<>();

    // Goal date range
    params.add(Date.valueOf(filter.getGoalStartDate()));
    params.add(Date.valueOf(filter.getGoalEndDate()));

    if (userId != null) {
      sql.append(" AND ug.UserID = ? ");
      params.add(userId);
    }

    if (departmentId != null) {
      sql.append(" AND ug.DepartmentID = ? ");
      params.add(departmentId);
    }

    if (elId != null) {
      sql.append("""
              AND ug.DepartmentID IN (
                  SELECT DepartmentID
                  FROM Department
                  WHERE ExecutiveLeaderID = ?
              )
          """);
      params.add(elId);
    }

    if (flId != null) {
      sql.append("""
              AND ug.DepartmentID IN (
                  SELECT DepartmentID
                  FROM Department
                  WHERE FunctionalLeaderID = ?
              )
          """);
      params.add(flId);
    }

    Map<String, Object> result = jdbcTemplate.queryForMap(
        sql.toString(),
        params.toArray());

    Object value = result.get("AvgGoalEfficiency");

    if (value == null) {
      return BigDecimal.ZERO;
    }

    return new BigDecimal(value.toString())
        .setScale(2, RoundingMode.HALF_UP);
  }

  // department 22
  private BigDecimal getDept22GoalEfficiencyForUser(
      Integer userId,
      LocalDate start,
      LocalDate end) {

    String sql = """
        SELECT
            ROUND(AVG(e.TargetAchievedPercent), 2) AS AvgGoalEfficiency
        FROM EfficiencyUtilizationSummary e
        WHERE e.UserID = ?
          AND e.DepartmentID = 22
          AND e.WorkDate BETWEEN ? AND ?
          AND e.DayType = 'Working'
        """;

    try {
      Map<String, Object> result = jdbcTemplate.queryForMap(
          sql,
          userId,
          Date.valueOf(start),
          Date.valueOf(end));

      Object v = result.get("AvgGoalEfficiency");

      return v == null
          ? BigDecimal.ZERO
          : new BigDecimal(v.toString())
              .setScale(2, RoundingMode.HALF_UP);

    } catch (Exception e) {
      return BigDecimal.ZERO;
    }
  }

  // SDA users (153, 154): sum(AchievedGoal) / (0.35 * sum(task 65 units)) * 100
  private BigDecimal getSDASumAchievedBySumFixed(
      Integer userId,
      LocalDate start,
      LocalDate end) {
    BigDecimal achievedSum = jdbcTemplate.queryForObject("""
        SELECT COALESCE(SUM(ug.AchievedGoal), 0)
        FROM UserGoalData ug
        WHERE ug.UserID = ?
          AND ug.WorkDate BETWEEN ? AND ?
        """, BigDecimal.class, userId, start, end);

    BigDecimal task65Units = jdbcTemplate.queryForObject("""
        SELECT COALESCE(SUM(u.AchivedUnits), 0)
        FROM UserWorkData u
        WHERE u.UserID = ?
          AND u.DepartmentID = 37
          AND u.TaskID = 65
          AND u.IsForTarget = true
          AND u.WorkDate BETWEEN ? AND ?
        """, BigDecimal.class, userId, start, end);

    BigDecimal fixedSum = task65Units.multiply(BigDecimal.valueOf(0.35));

    if (fixedSum.compareTo(BigDecimal.ZERO) == 0) {
      return BigDecimal.ZERO;
    }
    return achievedSum
        .divide(fixedSum, 4, RoundingMode.HALF_UP)
        .multiply(BigDecimal.valueOf(100))
        .setScale(2, RoundingMode.HALF_UP);
  }

  // User 117: sum(AchievedGoal) / sum(FixedGoal) * 100
  private BigDecimal getSumAchievedBySumFixed(
      Integer userId,
      LocalDate start,
      LocalDate end) {
    BigDecimal achievedSum = jdbcTemplate.queryForObject("""
        SELECT COALESCE(SUM(ug.AchievedGoal), 0)
        FROM UserGoalData ug
        WHERE ug.UserID = ?
          AND ug.WorkDate BETWEEN ? AND ?
        """, BigDecimal.class, userId, start, end);

    BigDecimal fixedSum = jdbcTemplate.queryForObject("""
        SELECT COALESCE(SUM(%s), 0)
        FROM UserGoalData ug
        WHERE ug.UserID = ?
          AND ug.WorkDate BETWEEN ? AND ?
        """.formatted(EFFECTIVE_GOAL), BigDecimal.class, userId, start, end);

    if (fixedSum.compareTo(BigDecimal.ZERO) == 0) {
      return BigDecimal.ZERO;
    }
    return achievedSum
        .divide(fixedSum, 4, RoundingMode.HALF_UP)
        .multiply(BigDecimal.valueOf(100))
        .setScale(2, RoundingMode.HALF_UP);
  }

  // Dept 22: per-month avg of the dept-22 rule, missing months = 0,
  // divided by the full number of months in the range.
  private BigDecimal getDept22AvgPercent(
      Integer userId,
      LocalDate start,
      LocalDate end) {
    List<Map<String, Object>> monthRows = jdbcTemplate.queryForList("""
        SELECT
            YEAR(ug.WorkDate) AS y,
            MONTH(ug.WorkDate) AS m,
            ROUND(AVG(
                CASE
                  WHEN ug.AchievedGoal < 40 THEN 100
                  ELSE GREATEST(
                      100 - (FLOOR((ug.AchievedGoal - 40) / 10) * 10),
                      0
                  )
                END
            ), 2) AS monthAvg
        FROM UserGoalData ug
        WHERE ug.UserID = ?
          AND ug.DepartmentID = 22
          AND ug.WorkDate BETWEEN ? AND ?
        GROUP BY YEAR(ug.WorkDate), MONTH(ug.WorkDate)
        """, userId, start, end);

    Map<String, BigDecimal> byKey = new HashMap<>();
    for (Map<String, Object> row : monthRows) {
      byKey.put(row.get("y") + "-" + row.get("m"),
          new BigDecimal(row.get("monthAvg").toString()));
    }

    BigDecimal total = BigDecimal.ZERO;
    int monthCount = 0;
    LocalDate current = LocalDate.of(start.getYear(), start.getMonthValue(), 1);
    while (!current.isAfter(end)) {
      String key = current.getYear() + "-" + current.getMonthValue();
      total = total.add(byKey.getOrDefault(key, BigDecimal.ZERO));
      monthCount++;
      current = current.plusMonths(1);
    }

    if (monthCount == 0) {
      return BigDecimal.ZERO;
    }
    return total.divide(
        BigDecimal.valueOf(monthCount),
        2,
        RoundingMode.HALF_UP);
  }

  // Resolve whether the user belongs to department 22 from their goal data
  // within the queried goal range (used when the caller does not pass
  // departmentID).
  private boolean isDept22User(Integer userId, LocalDate start, LocalDate end) {
    if (userId == null) {
      return false;
    }
    try {
      List<Integer> depts;
      if (start != null && end != null) {
        depts = jdbcTemplate.queryForList("""
            SELECT DepartmentID
            FROM UserGoalData
            WHERE UserID = ?
              AND DepartmentID IS NOT NULL
              AND WorkDate BETWEEN ? AND ?
            ORDER BY WorkDate DESC
            LIMIT 1
            """, Integer.class, userId,
            Date.valueOf(start), Date.valueOf(end));
      } else {
        depts = jdbcTemplate.queryForList("""
            SELECT DepartmentID
            FROM UserGoalData
            WHERE UserID = ?
              AND DepartmentID IS NOT NULL
            ORDER BY WorkDate DESC
            LIMIT 1
            """, Integer.class, userId);
      }
      return !depts.isEmpty() && Integer.valueOf(22).equals(depts.get(0));
    } catch (Exception e) {
      e.printStackTrace();
      return false;
    }
  }

  // user
  private BigDecimal getUserGoalEfficiency(
      Integer userId,
      Integer departmentId,
      DashBoardFilter dbFilter) {

    if (userId != null && userId == 90) {
      return BigDecimal.valueOf(100);
    }

    // SDA users (153, 154): avgPercent = sum(AchievedGoal) / (0.35 * sum(task 65 units))
    if (userId != null && (userId == 153 || userId == 154)) {
      LocalDate goalStart = dbFilter.getGoalStartDate();
      LocalDate goalEnd = dbFilter.getGoalEndDate();
      if (goalStart != null
          && goalEnd != null
          && !goalStart.isBefore(LocalDate.of(2026, 4, 1))
          && !goalEnd.isAfter(LocalDate.of(2026, 6, 30))) {
        return getSDASumAchievedBySumFixed(userId, goalStart, goalEnd);
      }
    }

    // User 117: avgPercent = sum(AchievedGoal) / sum(FixedGoal)
    if (userId != null && userId == 117) {
      LocalDate goalStart = dbFilter.getGoalStartDate();
      LocalDate goalEnd = dbFilter.getGoalEndDate();
      if (goalStart != null
          && goalEnd != null) {
        return getSumAchievedBySumFixed(userId, goalStart, goalEnd);
      }
    }

    // GOAL_EQUALS_TARGET_USERS: use TargetAchievedPercent directly
    if (userId != null && isGoalEqualsTargetUser(userId)) {
      return computeAvgTargetPercentForDash(userId, departmentId,
          dbFilter.getGoalStartDate(), dbFilter.getGoalEndDate());
    }

    // Dept 21
// User 117: avgPercent = sum(AchievedGoal) / sum(FixedGoal)
if (userId != null && userId == 117) {
  LocalDate goalStart = dbFilter.getGoalStartDate();
  LocalDate goalEnd = dbFilter.getGoalEndDate();
  if (goalStart != null && goalEnd != null) {
    return getSumAchievedBySumFixed(userId, goalStart, goalEnd);
  }
}

// User 155 (dept 21), Apr-Jun 2026 — sum(AchievedGoal) / sum(recalculated fixed)
// Recalculated fixed = sum(achievedUnits isForTarget) * 0.35 (matches displayed rows)
if (userId != null && userId == 155) {
  LocalDate goalStart = dbFilter.getGoalStartDate();
  LocalDate goalEnd = dbFilter.getGoalEndDate();
  if (goalStart != null
      && goalEnd != null
      && !goalStart.isBefore(LocalDate.of(2026, 4, 1))
      && !goalEnd.isAfter(LocalDate.of(2026, 6, 30))) {
    BigDecimal achieved = jdbcTemplate.queryForObject(
        "SELECT COALESCE(SUM(g.achievedGoal), 0) FROM UserGoalData g WHERE g.userID = ? AND g.workDate BETWEEN ? AND ?",
        BigDecimal.class, userId, Date.valueOf(goalStart), Date.valueOf(goalEnd));
    BigDecimal units = jdbcTemplate.queryForObject(
        "SELECT COALESCE(SUM(u.achivedUnits), 0) FROM UserWorkData u WHERE u.userID = ? AND u.isForTarget = true AND u.workDate BETWEEN ? AND ?",
        BigDecimal.class, userId, Date.valueOf(goalStart), Date.valueOf(goalEnd));
    BigDecimal fixed = units.multiply(BigDecimal.valueOf(0.35));
    return fixed.compareTo(BigDecimal.ZERO) > 0
        ? achieved.divide(fixed, 4, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100))
            .setScale(2, RoundingMode.HALF_UP)
        : BigDecimal.ZERO;
  }

    String sql = """
          SELECT ROUND(
              SUM(ug.AchievedGoal) * 100.0 /
              NULLIF(SUM(%s),0),
              2
          ) AS AvgGoalEfficiency
          FROM UserGoalData ug
          WHERE ug.UserID = ?
          AND ug.DepartmentID = 21
          AND ug.WorkDate BETWEEN ? AND ?
          """.formatted(EFFECTIVE_GOAL);

      Map<String, Object> result = jdbcTemplate.queryForMap(
          sql,
          userId,
          Date.valueOf(dbFilter.getGoalStartDate()),
          Date.valueOf(dbFilter.getGoalEndDate()));

      return result.get("AvgGoalEfficiency") == null
          ? BigDecimal.ZERO
          : new BigDecimal(result.get("AvgGoalEfficiency").toString());
    }

    // Dept 37
    if (departmentId != null && departmentId == 37) {

      String sql = """
          SELECT ROUND(
              SUM(ug.AchievedGoal) * 100.0 /
              NULLIF(SUM(%s),0),
              2
          ) AS AvgGoalEfficiency
          FROM UserGoalData ug
          WHERE ug.UserID = ?
          AND ug.DepartmentID = 37
          AND ug.WorkDate BETWEEN ? AND ?
          """.formatted(EFFECTIVE_GOAL);

      Map<String, Object> result = jdbcTemplate.queryForMap(
          sql,
          userId,
          Date.valueOf(dbFilter.getGoalStartDate()),
          Date.valueOf(dbFilter.getGoalEndDate()));

      return result.get("AvgGoalEfficiency") == null
          ? BigDecimal.ZERO
          : new BigDecimal(result.get("AvgGoalEfficiency").toString());
    }

    // Dept 22
    if (departmentId != null && departmentId == 22
        || (userId != null && departmentId == null
            && isDept22User(userId, dbFilter.getGoalStartDate(), dbFilter.getGoalEndDate()))) {
      return getDept22AvgPercent(
          userId,
          dbFilter.getGoalStartDate(),
          dbFilter.getGoalEndDate());
    }

    return getGoalEfficiencyByFilter(
        dbFilter,
        userId,
        null,
        null,
        null);
  }

  public BigDecimal getAverageSum(
      UserGoalDataFilterRequestDTO filter,
      Integer userID) {

    Integer departmentID = normalize(filter.getDepartmentID());
    Integer elID = normalize(filter.getELID());
    Integer flID = normalize(filter.getFLID());

    DashBoardFilter dbFilter = new DashBoardFilter();
    dbFilter.setStartDate(filter.getStartDate());
    dbFilter.setEndDate(filter.getEndDate());
    dbFilter.setGoalStartDate(filter.getGoalStartDate());
    dbFilter.setGoalEndDate(filter.getGoalEndDate());
    // ===== LEVEL 1: Specific USER =====
    if (userID != null) {
      return getUserGoalEfficiency(userID, departmentID, dbFilter);
    }

    // ===== LEVEL 2: Specific DEPARTMENT (no single user) =====
    if (departmentID != null) {
      List<Map<String, Object>> users = getUsersForDepartment(departmentID, dbFilter);
      return averageUsersGoalEfficiency(users, departmentID, dbFilter);
    }

    // ===== LEVEL 3: Specific EL (no department) =====
    if (elID != null && elID > 0) {
      List<Map<String, Object>> depts = getDepartmentsForEL(elID, dbFilter);
      return averageDeptsGoalEfficiency(depts, dbFilter);
    }

    // ===== LEVEL 3b: Specific FL (no department) =====
    if (flID != null && flID > 0) {
      List<Map<String, Object>> depts = getDepartmentsForFL(flID, dbFilter);
      return averageDeptsGoalEfficiency(depts, dbFilter);
    }

    // ===== LEVEL 4: COMPANY (nothing specified) =====
    List<Map<String, Object>> els = getELSummary(dbFilter, false);
    List<Map<String, Object>> elAverages = new ArrayList<>();

    for (Map<String, Object> el : els) {
      Integer elId = (Integer) el.get("ELID");
      List<Map<String, Object>> depts = getDepartmentsForEL(elId, dbFilter);

      Map<String, Object> elAvg = new HashMap<>();
      elAvg.put("AvgGoalEfficiency", averageDeptsGoalEfficiency(depts, dbFilter));
      elAverages.add(elAvg);
    }

    return calculateAverageFromELs(elAverages, "AvgGoalEfficiency");
  }

  // ===== Shared climb helpers =====

  private BigDecimal averageUsersGoalEfficiency(
      List<Map<String, Object>> users,
      Integer departmentId,
      DashBoardFilter dbFilter) {

    List<Map<String, Object>> usersWithGoal = new ArrayList<>();

    for (Map<String, Object> u : users) {
      Integer uid = (Integer) u.get("UserID");
      BigDecimal goal = getUserGoalEfficiency(uid, departmentId, dbFilter);

      Map<String, Object> m = new HashMap<>();
      m.put("AvgGoalEfficiency", goal);
      usersWithGoal.add(m);
    }

    return calculateAverageFromUsers(usersWithGoal, "AvgGoalEfficiency");
  }

  private BigDecimal averageDeptsGoalEfficiency(
      List<Map<String, Object>> depts,
      DashBoardFilter dbFilter) {

    List<Map<String, Object>> deptAverages = new ArrayList<>();

    for (Map<String, Object> dept : depts) {
      Integer deptId = (Integer) dept.get("DepartmentID");
      List<Map<String, Object>> users = getUsersForDepartment(deptId, dbFilter);

      Map<String, Object> deptAvg = new HashMap<>();
      deptAvg.put(
          "AvgGoalEfficiency",
          averageUsersGoalEfficiency(users, deptId, dbFilter));
      deptAverages.add(deptAvg);
    }

    return calculateAverageFromDepartments(deptAverages, "AvgGoalEfficiency");
  }

  public List<Map<String, Object>> getUserSummaryForUsers(DashBoardFilter filter) {
    try {
      Integer filterDeptId = (filter.getDepartmentID() != null && filter.getDepartmentID() != 0)
          ? filter.getDepartmentID()
          : null;

      // Step 1: distinct UserID/UserName/DepartmentID combos matching filters
      StringBuilder sql = new StringBuilder("""
              SELECT DISTINCT e.UserID, u.UserName, e.DepartmentID
              FROM EfficiencyUtilizationSummary e
              JOIN Users u ON e.UserID = u.UserID
              WHERE e.DayType = 'Working'
                AND e.WorkDate BETWEEN ? AND ?
          """);
      List<Object> params = new ArrayList<>();
      params.add(Date.valueOf(filter.getStartDate()));
      params.add(Date.valueOf(filter.getEndDate()));

      if (filter.getUserID() != null && filter.getUserID() != 0) {
        sql.append(" AND e.UserID = ? ");
        params.add(filter.getUserID());
      }
      if (filterDeptId != null) {
        sql.append(" AND e.DepartmentID = ? ");
        params.add(filterDeptId);
      }
      if (filter.getElID() != null && filter.getElID() != 0) {
        sql.append("""
                AND e.DepartmentID IN (
                    SELECT DepartmentID FROM Department WHERE ExecutiveLeaderID = ?
                )
            """);
        params.add(filter.getElID());
      }

      List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params.toArray());

      // Step 2: group departments by user
      Map<Integer, String> userNames = new LinkedHashMap<>();
      Map<Integer, Set<Integer>> userDepts = new LinkedHashMap<>();

      for (Map<String, Object> row : rows) {
        Integer userId = (Integer) row.get("UserID");
        String userName = (String) row.get("UserName");
        Integer deptId = (Integer) row.get("DepartmentID");
        userNames.putIfAbsent(userId, userName);
        userDepts.computeIfAbsent(userId, k -> new LinkedHashSet<>()).add(deptId);
      }

      // Step 3: per-user summary using the leave-aware helper, + DailyData
      List<Map<String, Object>> finalList = new ArrayList<>();

      // Daily data — also excludes FULL_DAY leave, same pattern as
      // getUserGoalSummaryForUsers
      String dailySql = """
              SELECT
                  e.WorkDate,
                  e.TargetAchievedPercent,
                  e.UtilizationPercent,
                  e.AllocatedTimeHrs,
                  e.TotalTimeOfWork,
                  e.EfficiencyLevel
              FROM EfficiencyUtilizationSummary e
              WHERE e.DayType = 'Working'
                AND e.UserID = ?
                AND e.WorkDate BETWEEN ? AND ?
                AND NOT EXISTS (
                    SELECT 1 FROM UserWorkData uw
                    WHERE uw.UserID = e.UserID
                      AND uw.WorkDate = e.WorkDate
                      AND UPPER(TRIM(uw.LeaveType)) = 'FULL_DAY'
                )
              ORDER BY e.WorkDate ASC
          """;

      for (Map.Entry<Integer, String> entry : userNames.entrySet()) {
        Integer userId = entry.getKey();
        String userName = entry.getValue();
        Set<Integer> depts = userDepts.get(userId);

        Map<String, Object> summary = new HashMap<>();
        summary.put("UserID", userId);
        summary.put("UserName", userName);

        if (depts.size() == 1) {
          Integer deptId = depts.iterator().next();
          Map<String, Object> eff = getUserEfficiencySummary(userId, deptId, filter);
          summary.putAll(eff);
        } else {
          List<Map<String, Object>> deptSummaries = new ArrayList<>();
          for (Integer deptId : depts) {
            deptSummaries.add(getUserEfficiencySummary(userId, deptId, filter));
          }
          summary.put("AvgTargetPercent", calculateAverageFromUsers(deptSummaries, "AvgTargetPercent"));
          summary.put("AvgUtilizationPercent", calculateAverageFromUsers(deptSummaries, "AvgUtilizationPercent"));
          summary.put("AvgAllocatedHrs", calculateAverageFromUsers(deptSummaries, "AvgAllocatedHrs"));
          summary.put("AvgTotalWork", calculateAverageFromUsers(deptSummaries, "AvgTotalWork"));

          double scoreSum = 0;
          for (Map<String, Object> ds : deptSummaries) {
            String level = ds.get("EfficiencyLevel") != null
                ? ds.get("EfficiencyLevel").toString().trim().toLowerCase()
                : "";
            scoreSum += switch (level) {
              case "high" -> 3;
              case "at par" -> 2;
              case "low" -> 1;
              default -> 0;
            };
          }
          double avgScore = deptSummaries.isEmpty() ? 0 : scoreSum / deptSummaries.size();
          summary.put("EfficiencyLevel", scoreToLevel(avgScore));
        }

        List<Map<String, Object>> dailyData = jdbcTemplate.queryForList(
            dailySql, userId,
            Date.valueOf(filter.getStartDate()),
            Date.valueOf(filter.getEndDate()));

        for (Map<String, Object> daily : dailyData) {
          daily.put("UserID", userId);
        }
        summary.put("DailyData", dailyData);

        finalList.add(summary);
      }

      finalList.sort(Comparator.comparing(m -> (String) m.get("UserName")));
      return finalList;
    } catch (Exception ex) {
      ex.printStackTrace();
      return Collections.emptyList();
    }
  }
  // private List<Map<String, Object>> getELSummaryUsers(DashBoardFilter filter,
  // boolean onlyOne) {

  // List<Map<String, Object>> finalList = new ArrayList<>();

  // List<Map<String, Object>> els = getELSummary(filter, onlyOne);

  // for (Map<String, Object> el : els) {

  // Integer elID = (Integer) el.get("ELID");
  // System.out.println(elID);

  // List<Map<String, Object>> deptList = getDepartmentsForEL(elID, filter);

  // for (Map<String, Object> dept : deptList) {

  // Integer deptId = (Integer) dept.get("DepartmentID");

  // List<Map<String, Object>> users = getUsersForDepartment(deptId, filter);

  // dept.put("users", users);
  // }

  // el.put("departments", deptList);

  // finalList.add(el);
  // }

  // return finalList;
  // }
  private BigDecimal calculateAverageFromUsers(
      List<Map<String, Object>> users,
      String key) {

    if (users == null || users.isEmpty()) {
      return BigDecimal.ZERO;
    }

    BigDecimal total = BigDecimal.ZERO;
    int count = 0;

    for (Map<String, Object> user : users) {

      Object val = user.get(key);

      BigDecimal num = BigDecimal.ZERO;

      if (val != null) {
        num = new BigDecimal(val.toString());
      }

      total = total.add(num);
      count++;
    }

    if (count == 0) {
      return BigDecimal.ZERO;
    }

    return total.divide(
        BigDecimal.valueOf(count),
        2,
        RoundingMode.HALF_UP);
  }

  private BigDecimal calculateAverageFromDepartments(
      List<Map<String, Object>> departments,
      String key) {

    if (departments == null || departments.isEmpty()) {
      return BigDecimal.ZERO;
    }

    BigDecimal total = BigDecimal.ZERO;
    int count = 0;

    for (Map<String, Object> dept : departments) {

      Object val = dept.get(key);

      BigDecimal num = BigDecimal.ZERO;

      if (val != null) {
        num = new BigDecimal(val.toString());
      }

      total = total.add(num);
      count++;
    }

    if (count == 0) {
      return BigDecimal.ZERO;
    }

    return total.divide(
        BigDecimal.valueOf(count),
        2,
        RoundingMode.HALF_UP);
  }

  private BigDecimal calculateAverageFromELs(
      List<Map<String, Object>> els,
      String key) {

    if (els == null || els.isEmpty()) {
      return BigDecimal.ZERO;
    }

    BigDecimal total = BigDecimal.ZERO;
    int count = 0;

    for (Map<String, Object> el : els) {
      Object val = el.get(key);

      if (val != null) {
        total = total.add(new BigDecimal(val.toString()));
        count++;
      }
    }

    if (count == 0) {
      return BigDecimal.ZERO;
    }

    return total.divide(
        BigDecimal.valueOf(count),
        2,
        RoundingMode.HALF_UP);
  }

  // AvgTargetPercent rollups: exclude zero-valued children from the
  // denominator (mirrors EfficiencyReportService.averageOfMaps)
  private BigDecimal calculateTargetAverageFromDepartments(
      List<Map<String, Object>> departments) {
    if (departments == null || departments.isEmpty()) {
      return BigDecimal.ZERO;
    }
    BigDecimal total = BigDecimal.ZERO;
    int count = 0;
    for (Map<String, Object> dept : departments) {
      Object val = dept.get("AvgTargetPercent");
      if (val != null) {
        BigDecimal num = new BigDecimal(val.toString());
        total = total.add(num);
        if (num.compareTo(BigDecimal.ZERO) > 0) {
          count++;
        }
      }
    }
    if (count == 0) {
      return BigDecimal.ZERO;
    }
    return total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
  }

  private BigDecimal calculateTargetAverageFromELs(
      List<Map<String, Object>> els) {
    if (els == null || els.isEmpty()) {
      return BigDecimal.ZERO;
    }
    BigDecimal total = BigDecimal.ZERO;
    int count = 0;
    for (Map<String, Object> el : els) {
      Object val = el.get("AvgTargetPercent");
      if (val != null) {
        BigDecimal num = new BigDecimal(val.toString());
        total = total.add(num);
        if (num.compareTo(BigDecimal.ZERO) > 0) {
          count++;
        }
      }
    }
    if (count == 0) {
      return BigDecimal.ZERO;
    }
    return total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
  }

  private List<Map<String, Object>> getELSummaryUsers(
      DashBoardFilter filter,
      boolean onlyOne) {

    List<Map<String, Object>> finalList = new ArrayList<>();
    List<Map<String, Object>> els = getELSummary(filter, onlyOne);

    for (Map<String, Object> el : els) {
      Integer elID = (Integer) el.get("ELID");

      // ✅ Only use dept list for DepartmentID + DepartmentName
      List<Map<String, Object>> deptList = getDepartmentsForEL(elID, filter);

      BigDecimal elTargetTotal = BigDecimal.ZERO;
      BigDecimal elUtilTotal = BigDecimal.ZERO;
      BigDecimal elAllocatedTotal = BigDecimal.ZERO;
      BigDecimal elWorkTotal = BigDecimal.ZERO;
      int elUserCount = 0;
      double elScoreFromDepts = 0;

      for (Map<String, Object> dept : deptList) {
        Integer deptId = (Integer) dept.get("DepartmentID");

        List<Map<String, Object>> users = getUsersForDepartment(deptId, filter);

        BigDecimal deptTargetTotal = BigDecimal.ZERO;
        BigDecimal deptUtilTotal = BigDecimal.ZERO;
        BigDecimal deptAllocatedTotal = BigDecimal.ZERO;
        BigDecimal deptWorkTotal = BigDecimal.ZERO;
        int deptUserCount = 0;
        int deptTargetCount = 0;
        double deptScoreFromUsers = 0;

        for (Map<String, Object> user : users) {
          Integer userId = (Integer) user.get("UserID");

          Map<String, Object> summary = getUserEfficiencySummary(userId, deptId, filter);

          user.put("AvgTargetPercent", summary.get("AvgTargetPercent"));
          user.put("AvgUtilizationPercent", summary.get("AvgUtilizationPercent"));
          user.put("AvgAllocatedHrs", summary.get("AvgAllocatedHrs"));
          user.put("AvgTotalWork", summary.get("AvgTotalWork"));
          user.put("EfficiencyLevel", summary.get("EfficiencyLevel"));
          // BigDecimal goalEfficiency = userId != null && userId == 90
          // ? BigDecimal.valueOf(100)
          // : getGoalEfficiencyByFilter(filter, userId, null, null, null);
          BigDecimal goalEfficiency = getUserGoalEfficiency(userId, deptId, filter);

          user.put("AvgGoalEfficiency", goalEfficiency);
          BigDecimal userTarget = new BigDecimal(summary.get("AvgTargetPercent").toString());
          deptTargetTotal = deptTargetTotal.add(userTarget);
          if (userTarget.compareTo(BigDecimal.ZERO) > 0) {
            deptTargetCount++;
          }
          deptUtilTotal = deptUtilTotal.add(new BigDecimal(summary.get("AvgUtilizationPercent").toString()));
          deptAllocatedTotal = deptAllocatedTotal.add(new BigDecimal(summary.get("AvgAllocatedHrs").toString()));
          deptWorkTotal = deptWorkTotal.add(new BigDecimal(summary.get("AvgTotalWork").toString()));

          String userLevel = summary.get("EfficiencyLevel") != null
              ? summary.get("EfficiencyLevel").toString().trim().toLowerCase()
              : "";
          deptScoreFromUsers += switch (userLevel) {
            case "high" -> 3;
            case "at par" -> 2;
            case "low" -> 1;
            default -> 0;
          };

          deptUserCount++;
        }

        // ✅ Dept metrics = average of its users
        if (deptUserCount > 0) {
          dept.put("AvgTargetPercent",
              deptTargetCount > 0
                  ? deptTargetTotal.divide(BigDecimal.valueOf(deptTargetCount), 2, RoundingMode.HALF_UP)
                  : BigDecimal.ZERO);
          dept.put("AvgUtilizationPercent",
              deptUtilTotal.divide(BigDecimal.valueOf(deptUserCount), 2, RoundingMode.HALF_UP));
          dept.put("AvgAllocatedHrs",
              deptAllocatedTotal.divide(BigDecimal.valueOf(deptUserCount), 2, RoundingMode.HALF_UP));
          dept.put("AvgTotalWork",
              deptWorkTotal.divide(BigDecimal.valueOf(deptUserCount), 2, RoundingMode.HALF_UP));
        } else {
          dept.put("AvgTargetPercent", BigDecimal.ZERO);
          dept.put("AvgUtilizationPercent", BigDecimal.ZERO);
          dept.put("AvgAllocatedHrs", BigDecimal.ZERO);
          dept.put("AvgTotalWork", BigDecimal.ZERO);
        }

        dept.put(
            "AvgGoalEfficiency",
            calculateAverageFromUsers(users, "AvgGoalEfficiency"));
        // ✅ Dept EfficiencyLevel = average of users' levels
        double deptScore = deptUserCount > 0 ? deptScoreFromUsers / deptUserCount : 0;
        dept.put("EfficiencyLevel", scoreToLevel(deptScore));
        dept.put("users", users);

        elTargetTotal = elTargetTotal.add(deptTargetTotal);
        elUtilTotal = elUtilTotal.add(deptUtilTotal);
        elAllocatedTotal = elAllocatedTotal.add(deptAllocatedTotal);
        elWorkTotal = elWorkTotal.add(deptWorkTotal);
        elUserCount += deptUserCount;

        // ✅ EL score accumulates from dept levels
        String deptLevel = dept.get("EfficiencyLevel").toString().trim().toLowerCase();
        elScoreFromDepts += switch (deptLevel) {
          case "high" -> 3;
          case "at par" -> 2;
          case "low" -> 1;
          default -> 0;
        };
      }

      // ✅ EL metrics = average of all depts)
      if (elUserCount > 0) {
        el.put(
            "AvgTargetPercent",
            calculateTargetAverageFromDepartments(deptList));

        el.put(
            "AvgUtilizationPercent",
            calculateAverageFromDepartments(
                deptList,
                "AvgUtilizationPercent"));

        el.put(
            "AvgAllocatedHrs",
            calculateAverageFromDepartments(
                deptList,
                "AvgAllocatedHrs"));

        el.put(
            "AvgTotalWork",
            calculateAverageFromDepartments(
                deptList,
                "AvgTotalWork"));
      } else {
        el.put("AvgTargetPercent", BigDecimal.ZERO);
        el.put("AvgUtilizationPercent", BigDecimal.ZERO);
        el.put("AvgAllocatedHrs", BigDecimal.ZERO);
        el.put("AvgTotalWork", BigDecimal.ZERO);
      }

      el.put(
          "AvgGoalEfficiency",
          calculateAverageFromDepartments(
              deptList,
              "AvgGoalEfficiency"));
      // ✅ EL EfficiencyLevel = average of dept levels
      double elScore = !deptList.isEmpty() ? elScoreFromDepts / deptList.size() : 0;
      el.put("EfficiencyLevel", scoreToLevel(elScore));

      el.put("departments", deptList);
      finalList.add(el);
    }

    return finalList;
  }

  // private List<Map<String, Object>> getELSummaryUsers(
  // DashBoardFilter filter,
  // boolean onlyOne) {

  // List<Map<String, Object>> finalList = new ArrayList<>();
  // List<Map<String, Object>> els = getELSummary(filter, onlyOne);

  // for (Map<String, Object> el : els) {
  // Integer elID = (Integer) el.get("ELID");

  // List<Map<String, Object>> deptList = getDepartmentsForEL(elID, filter);

  // BigDecimal elTargetTotal = BigDecimal.ZERO;
  // BigDecimal elUtilTotal = BigDecimal.ZERO;
  // BigDecimal elAllocatedTotal = BigDecimal.ZERO;
  // BigDecimal elWorkTotal = BigDecimal.ZERO;
  // int elUserCount = 0;

  // for (Map<String, Object> dept : deptList) {
  // Integer deptId = (Integer) dept.get("DepartmentID");

  // // get raw user list (just UserID + UserName)
  // List<Map<String, Object>> users = getUsersForDepartment(deptId, filter);

  // BigDecimal deptTargetTotal = BigDecimal.ZERO;
  // BigDecimal deptUtilTotal = BigDecimal.ZERO;
  // BigDecimal deptAllocatedTotal = BigDecimal.ZERO;
  // BigDecimal deptWorkTotal = BigDecimal.ZERO;
  // int deptUserCount = 0;
  // double deptScoreSum = 0;

  // for (Map<String, Object> user : users) {
  // Integer userId = (Integer) user.get("UserID");

  // // ✅ Use the new helper that mirrors listEfficiencySummary
  // Map<String, Object> summary = getUserEfficiencySummary(userId, deptId,
  // filter);

  // user.put("AvgTargetPercent", summary.get("AvgTargetPercent"));
  // user.put("AvgUtilizationPercent", summary.get("AvgUtilizationPercent"));
  // user.put("AvgAllocatedHrs", summary.get("AvgAllocatedHrs"));
  // user.put("AvgTotalWork", summary.get("AvgTotalWork"));
  // user.put("EfficiencyLevel", summary.get("EfficiencyLevel"));
  // user.put("AvgGoalEfficiency", getGoalEfficiencyByFilter(filter, userId, null,
  // null, null));

  // BigDecimal t = new BigDecimal(summary.get("AvgTargetPercent").toString());
  // BigDecimal u = new
  // BigDecimal(summary.get("AvgUtilizationPercent").toString());
  // BigDecimal a = new BigDecimal(summary.get("AvgAllocatedHrs").toString());
  // BigDecimal w = new BigDecimal(summary.get("AvgTotalWork").toString());

  // deptTargetTotal = deptTargetTotal.add(t);
  // deptUtilTotal = deptUtilTotal.add(u);
  // deptAllocatedTotal = deptAllocatedTotal.add(a);
  // deptWorkTotal = deptWorkTotal.add(w);
  // deptUserCount++;
  // }

  // // Department averages
  // if (deptUserCount > 0) {
  // dept.put("AvgTargetPercent",
  // deptTargetTotal.divide(BigDecimal.valueOf(deptUserCount), 2,
  // RoundingMode.HALF_UP));
  // dept.put("AvgUtilizationPercent",
  // deptUtilTotal.divide(BigDecimal.valueOf(deptUserCount), 2,
  // RoundingMode.HALF_UP));
  // dept.put("AvgAllocatedHrs",
  // deptAllocatedTotal.divide(BigDecimal.valueOf(deptUserCount), 2,
  // RoundingMode.HALF_UP));
  // dept.put("AvgTotalWork",
  // deptWorkTotal.divide(BigDecimal.valueOf(deptUserCount), 2,
  // RoundingMode.HALF_UP));
  // }

  // dept.put("AvgGoalEfficiency",
  // getGoalEfficiencyByFilter(filter, null, deptId, null, null));

  // // Dept efficiency level — use same score logic over aggregated dept values
  // double deptScore = computeEfficiencyScore(
  // (BigDecimal) dept.get("AvgTargetPercent"),
  // (BigDecimal) dept.get("AvgUtilizationPercent"),
  // (BigDecimal) dept.get("AvgGoalEfficiency"));
  // dept.put("EfficiencyLevel", scoreToLevel(deptScore));
  // dept.put("users", users);

  // elTargetTotal = elTargetTotal.add(deptTargetTotal);
  // elUtilTotal = elUtilTotal.add(deptUtilTotal);
  // elAllocatedTotal = elAllocatedTotal.add(deptAllocatedTotal);
  // elWorkTotal = elWorkTotal.add(deptWorkTotal);
  // elUserCount += deptUserCount;
  // }

  // // EL averages
  // if (elUserCount > 0) {
  // el.put("AvgTargetPercent",
  // elTargetTotal.divide(BigDecimal.valueOf(elUserCount), 2,
  // RoundingMode.HALF_UP));
  // el.put("AvgUtilizationPercent",
  // elUtilTotal.divide(BigDecimal.valueOf(elUserCount), 2,
  // RoundingMode.HALF_UP));
  // el.put("AvgAllocatedHrs",
  // elAllocatedTotal.divide(BigDecimal.valueOf(elUserCount), 2,
  // RoundingMode.HALF_UP));
  // el.put("AvgTotalWork",
  // elWorkTotal.divide(BigDecimal.valueOf(elUserCount), 2,
  // RoundingMode.HALF_UP));
  // }

  // el.put("AvgGoalEfficiency",
  // getGoalEfficiencyByFilter(filter, null, null, elID, null));

  // double elScore = computeEfficiencyScore(
  // (BigDecimal) el.get("AvgTargetPercent"),
  // (BigDecimal) el.get("AvgUtilizationPercent"),
  // (BigDecimal) el.get("AvgGoalEfficiency"));
  // el.put("EfficiencyLevel", scoreToLevel(elScore));

  // el.put("departments", deptList);
  // finalList.add(el);
  // }

  // return finalList;
  // }

  // =========================================
  // SHARED SCORE HELPERS
  // =========================================
  private double computeEfficiencyScore(
      BigDecimal target, BigDecimal util, BigDecimal goal) {

    if (target == null)
      target = BigDecimal.ZERO;
    if (util == null)
      util = BigDecimal.ZERO;
    if (goal == null)
      goal = BigDecimal.ZERO;

    if (target.compareTo(BigDecimal.valueOf(100)) >= 0
        && (util.compareTo(BigDecimal.valueOf(80)) >= 0
            || goal.compareTo(BigDecimal.valueOf(80)) >= 0)) {
      return 3;
    } else if (target.compareTo(BigDecimal.valueOf(80)) >= 0
        && (util.compareTo(BigDecimal.valueOf(50)) >= 0
            || goal.compareTo(BigDecimal.valueOf(50)) >= 0)) {
      return 2;
    } else {
      return 1;
    }
  }

  private String scoreToLevel(double score) {
    if (score >= 2.5)
      return "High";
    else if (score >= 1.5)
      return "At Par";
    else
      return "Low";
  }
  // private List<Map<String, Object>> getELSummaryUsers(
  // DashBoardFilter filter,
  // boolean onlyOne) {
  // List<Map<String, Object>> finalList = new ArrayList<>();
  // List<Map<String, Object>> els = getELSummary(filter, onlyOne);

  // // ===== GOAL MAPS =====
  // Map<Integer, Object> elGoalMap = getELGoalSummaryAdmin(filter)
  // .stream()
  // .filter(m -> m.get("ELID") != null)
  // .collect(Collectors.toMap(
  // m -> (Integer) m.get("ELID"),
  // m -> m.get("AvgGoalEfficiency") != null ? m.get("AvgGoalEfficiency") : 0,
  // (a, b) -> b));

  // Map<Integer, Object> deptGoalMap = getDepartmentGoalSummary(filter)
  // .stream()
  // .filter(m -> m.get("DepartmentID") != null)
  // .collect(Collectors.toMap(
  // m -> (Integer) m.get("DepartmentID"),
  // m -> m.get("AvgGoalEfficiency") != null ? m.get("AvgGoalEfficiency") : 0,
  // (a, b) -> b));

  // Map<Integer, Object> userGoalMap = getUserGoalSummaryForUsers(filter)
  // .stream()
  // .filter(m -> m.get("UserID") != null)
  // .collect(Collectors.toMap(
  // m -> (Integer) m.get("UserID"),
  // m -> m.get("AvgGoalEfficiency") != null ? m.get("AvgGoalEfficiency") : 0,
  // (a, b) -> b));

  // // ===== LOOP =====
  // for (Map<String, Object> el : els) {
  // Integer elID = (Integer) el.get("ELID");

  // // ✅ EL goal
  // el.put("AvgGoalEfficiency", elGoalMap.getOrDefault(elID, 0));

  // List<Map<String, Object>> deptList = getDepartmentsForEL(elID, filter);

  // for (Map<String, Object> dept : deptList) {
  // Integer deptId = (Integer) dept.get("DepartmentID");

  // // Department goal
  // dept.put("AvgGoalEfficiency", deptGoalMap.getOrDefault(deptId, 0));

  // List<Map<String, Object>> users = getUsersForDepartment(deptId, filter);

  // for (Map<String, Object> user : users) {
  // Integer userId = (Integer) user.get("UserID");

  // // User goal
  // user.put("AvgGoalEfficiency", userGoalMap.getOrDefault(userId, 0));
  // }

  // dept.put("users", users);
  // }

  // el.put("departments", deptList);
  // finalList.add(el);
  // }

  // return finalList;
  // }

  private List<Map<String, Object>> getFLSummaryUsers(
      DashBoardFilter filter,
      boolean onlyOne) {

    List<Map<String, Object>> finalList = new ArrayList<>();
    List<Map<String, Object>> fls = getFLSummary(filter, onlyOne);

    for (Map<String, Object> fl : fls) {
      Integer flID = (Integer) fl.get("FLID");

      List<Map<String, Object>> deptList = getDepartmentsForFL(flID, filter);

      double flScoreFromDepts = 0;

      for (Map<String, Object> dept : deptList) {
        Integer deptId = (Integer) dept.get("DepartmentID");
        List<Map<String, Object>> users = getUsersForDepartment(deptId, filter);

        BigDecimal deptTargetTotal = BigDecimal.ZERO;
        BigDecimal deptUtilTotal = BigDecimal.ZERO;
        BigDecimal deptAllocatedTotal = BigDecimal.ZERO;
        BigDecimal deptWorkTotal = BigDecimal.ZERO;
        int deptUserCount = 0;
        int deptTargetCount = 0;
        double deptScoreFromUsers = 0;

        for (Map<String, Object> user : users) {
          Integer userId = (Integer) user.get("UserID");

          Map<String, Object> summary = getUserEfficiencySummary(userId, deptId, filter);

          user.put("AvgTargetPercent", summary.get("AvgTargetPercent"));
          user.put("AvgUtilizationPercent", summary.get("AvgUtilizationPercent"));
          user.put("AvgAllocatedHrs", summary.get("AvgAllocatedHrs"));
          user.put("AvgTotalWork", summary.get("AvgTotalWork"));
          user.put("EfficiencyLevel", summary.get("EfficiencyLevel"));

          BigDecimal goalEfficiency = getUserGoalEfficiency(userId, deptId, filter);
          user.put("AvgGoalEfficiency", goalEfficiency);

          BigDecimal userTarget = new BigDecimal(summary.get("AvgTargetPercent").toString());
          deptTargetTotal = deptTargetTotal.add(userTarget);
          if (userTarget.compareTo(BigDecimal.ZERO) > 0) {
            deptTargetCount++;
          }
          deptUtilTotal = deptUtilTotal.add(new BigDecimal(summary.get("AvgUtilizationPercent").toString()));
          deptAllocatedTotal = deptAllocatedTotal.add(new BigDecimal(summary.get("AvgAllocatedHrs").toString()));
          deptWorkTotal = deptWorkTotal.add(new BigDecimal(summary.get("AvgTotalWork").toString()));

          String userLevel = summary.get("EfficiencyLevel") != null
              ? summary.get("EfficiencyLevel").toString().trim().toLowerCase()
              : "";
          deptScoreFromUsers += switch (userLevel) {
            case "high" -> 3;
            case "at par" -> 2;
            case "low" -> 1;
            default -> 0;
          };

          deptUserCount++;
        }

        if (deptUserCount > 0) {
          dept.put("AvgTargetPercent",
              deptTargetCount > 0
                  ? deptTargetTotal.divide(BigDecimal.valueOf(deptTargetCount), 2, RoundingMode.HALF_UP)
                  : BigDecimal.ZERO);
          dept.put("AvgUtilizationPercent",
              deptUtilTotal.divide(BigDecimal.valueOf(deptUserCount), 2, RoundingMode.HALF_UP));
          dept.put("AvgAllocatedHrs",
              deptAllocatedTotal.divide(BigDecimal.valueOf(deptUserCount), 2, RoundingMode.HALF_UP));
          dept.put("AvgTotalWork", deptWorkTotal.divide(BigDecimal.valueOf(deptUserCount), 2, RoundingMode.HALF_UP));
        } else {
          dept.put("AvgTargetPercent", BigDecimal.ZERO);
          dept.put("AvgUtilizationPercent", BigDecimal.ZERO);
          dept.put("AvgAllocatedHrs", BigDecimal.ZERO);
          dept.put("AvgTotalWork", BigDecimal.ZERO);
        }

        dept.put("AvgGoalEfficiency", calculateAverageFromUsers(users, "AvgGoalEfficiency"));

        double deptScore = deptUserCount > 0 ? deptScoreFromUsers / deptUserCount : 0;
        dept.put("EfficiencyLevel", scoreToLevel(deptScore));
        dept.put("users", users);

        String deptLevel = dept.get("EfficiencyLevel").toString().trim().toLowerCase();
        flScoreFromDepts += switch (deptLevel) {
          case "high" -> 3;
          case "at par" -> 2;
          case "low" -> 1;
          default -> 0;
        };
      }

      if (!deptList.isEmpty()) {
        fl.put("AvgTargetPercent", calculateTargetAverageFromDepartments(deptList));
        fl.put("AvgUtilizationPercent", calculateAverageFromDepartments(deptList, "AvgUtilizationPercent"));
        fl.put("AvgAllocatedHrs", calculateAverageFromDepartments(deptList, "AvgAllocatedHrs"));
        fl.put("AvgTotalWork", calculateAverageFromDepartments(deptList, "AvgTotalWork"));
      } else {
        fl.put("AvgTargetPercent", BigDecimal.ZERO);
        fl.put("AvgUtilizationPercent", BigDecimal.ZERO);
        fl.put("AvgAllocatedHrs", BigDecimal.ZERO);
        fl.put("AvgTotalWork", BigDecimal.ZERO);
      }

      fl.put("AvgGoalEfficiency", calculateAverageFromDepartments(deptList, "AvgGoalEfficiency"));

      double flScore = !deptList.isEmpty() ? flScoreFromDepts / deptList.size() : 0;
      fl.put("EfficiencyLevel", scoreToLevel(flScore));

      fl.put("departments", deptList);
      finalList.add(fl);
    }

    return finalList;
  }

  private List<Map<String, Object>> getDepartmentsForFL(
      Integer flID,
      DashBoardFilter filter) {
    String sql = """
                    SELECT
                        d.DepartmentID,
                        d.DepartmentName,
                        ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
                        ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
                        ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
                        ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
                         CASE
            WHEN
                ROUND(AVG(e.TargetAchievedPercent),2) >= 100
                AND ROUND(AVG(e.UtilizationPercent),2) >= 80
                AND ROUND(AVG(e.TotalTimeOfWork),2)
                    <= ROUND(AVG(e.AllocatedTimeHrs),2)
            THEN 'High'

            WHEN
                ROUND(AVG(e.TargetAchievedPercent),2) >= 80
                AND ROUND(AVG(e.UtilizationPercent),2) >= 50
                AND ROUND(AVG(e.TotalTimeOfWork),2)
                    <= ROUND(AVG(e.AllocatedTimeHrs),2)
            THEN 'At Par'

            ELSE 'Low'
        END AS EfficiencyLevel
                    FROM Department d
                    JOIN EfficiencyUtilizationSummary e ON d.DepartmentID = e.DepartmentID
                    WHERE e.DayType = 'Working'
                      AND d.FunctionalLeaderID = ?
                      AND e.WorkDate BETWEEN ? AND ?
                    GROUP BY d.DepartmentID, d.DepartmentName
                """;

    return jdbcTemplate.queryForList(
        sql,
        flID,
        Date.valueOf(filter.getStartDate()),
        Date.valueOf(filter.getEndDate()));
  }

  private List<Map<String, Object>> getDepartmentsForEL(
      Integer elID,
      DashBoardFilter filter) {
    StringBuilder sql = new StringBuilder("""
                    SELECT
                        d.DepartmentID,
                        d.DepartmentName,
                        ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
                        ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
                        ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
                        ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
                        CASE
            WHEN
                ROUND(AVG(e.TargetAchievedPercent),2) >= 100
                AND ROUND(AVG(e.UtilizationPercent),2) >= 80
                AND ROUND(AVG(e.TotalTimeOfWork),2)
                    <= ROUND(AVG(e.AllocatedTimeHrs),2)
            THEN 'High'

            WHEN
                ROUND(AVG(e.TargetAchievedPercent),2) >= 80
                AND ROUND(AVG(e.UtilizationPercent),2) >= 50
                AND ROUND(AVG(e.TotalTimeOfWork),2)
                    <= ROUND(AVG(e.AllocatedTimeHrs),2)
            THEN 'At Par'

            ELSE 'Low'
        END AS EfficiencyLevel
                    FROM Department d
                    JOIN EfficiencyUtilizationSummary e ON d.DepartmentID = e.DepartmentID
                    WHERE e.DayType = 'Working'
                      AND d.ExecutiveLeaderID = ?
                      AND e.WorkDate BETWEEN ? AND ?
                """);

    List<Object> params = new ArrayList<>();
    params.add(elID);
    params.add(Date.valueOf(filter.getStartDate()));
    params.add(Date.valueOf(filter.getEndDate()));

    sql.append(buildDepartmentFilterForDeptTable(filter.getDepartmentType()));
    sql.append(" GROUP BY d.DepartmentID, d.DepartmentName");

    return jdbcTemplate.queryForList(sql.toString(), params.toArray());
  }

  private List<Map<String, Object>> getUsersForDepartment(
      Integer departmentID,
      DashBoardFilter filter) {
    String sql = """
                    SELECT
                        u.UserID,
                        u.UserName,
                        ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
                        ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
                        ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
                        ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
                        CASE
            WHEN
                ROUND(AVG(e.TargetAchievedPercent),2) >= 100
                AND ROUND(AVG(e.UtilizationPercent),2) >= 80
                AND ROUND(AVG(e.TotalTimeOfWork),2)
                    <= ROUND(AVG(e.AllocatedTimeHrs),2)
            THEN 'High'

            WHEN
                ROUND(AVG(e.TargetAchievedPercent),2) >= 80
                AND ROUND(AVG(e.UtilizationPercent),2) >= 50
                AND ROUND(AVG(e.TotalTimeOfWork),2)
                    <= ROUND(AVG(e.AllocatedTimeHrs),2)
            THEN 'At Par'

            ELSE 'Low'
        END AS EfficiencyLevel
                    FROM Users u
                    JOIN EfficiencyUtilizationSummary e ON u.UserID = e.UserID
                    WHERE e.DayType = 'Working'
                      AND e.DepartmentID = ?
                      AND e.WorkDate BETWEEN ? AND ?
                    GROUP BY u.UserID, u.UserName
                    ORDER BY u.UserName
                """;

    return jdbcTemplate.queryForList(
        sql,
        departmentID,
        Date.valueOf(filter.getStartDate()),
        Date.valueOf(filter.getEndDate()));
  }

  @Transactional(readOnly = true)
  public void downloadEfficiencySummaryCsv(
      DashBoardFilter filter,
      PrintWriter writer) {
    boolean isUser = filter.getUserID() != null && filter.getUserID() != 0;
    boolean isDept = filter.getDepartmentID() != null && filter.getDepartmentID() != 0;
    boolean isEL = filter.getElID() != null && filter.getElID() != 0;

    List<Map<String, Object>> rows = new ArrayList<>();

    if (isUser && filter.getRoleID() == 2) {
      rows = getUserSummaryForUsers(filter);
    } else if (isUser) {
      rows = getUserSummary(filter);
    } else if (isDept) {
      rows = getDepartmentSummary(filter, true);
    } else if (isEL && filter.isHeExecutiveLeader()) {
      rows = getELSummaryUsers(filter, true);
    } else if (isEL) {
      rows = getELSummary(filter, true);
    } else {
      Map<String, Object> companySummary = getCompanySummary(filter);
      if (companySummary != null && !companySummary.isEmpty()) {
        rows.add(companySummary);
      }
    }

    writeCsv(rows, writer);
  }

  private void writeCsv(List<Map<String, Object>> data, PrintWriter writer) {
    if (data == null || data.isEmpty()) {
      writer.println("No Data Available");
      return;
    }

    Set<String> headers = data.get(0).keySet();
    writer.println(String.join(",", headers));

    for (Map<String, Object> row : data) {
      List<String> values = new ArrayList<>();
      for (String key : headers) {
        Object value = row.get(key);
        values.add(value == null ? "" : escapeCsv(value.toString()));
      }
      writer.println(String.join(",", values));
    }

    writer.flush();
  }

  private String escapeCsv(String value) {
    if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
      value = value.replace("\"", "\"\"");
      return "\"" + value + "\"";
    }
    return value;
  }

  @Transactional(readOnly = true)
  public byte[] downloadEfficiencySummaryExcel(DashBoardFilter filter)
      throws IOException {
    Map<String, Object> data = listEfficiencySummaryNewData(filter);
    Workbook workbook = new XSSFWorkbook();

    Map<String, Object> company = (Map<String, Object>) data.get(
        "companySummary");

    if (company != null && !company.isEmpty()) {
      Sheet sheet = workbook.createSheet("Company Summary");
      int rowIndex = writeDateRange(sheet, filter, workbook);
      writeSingleMap(sheet, company, rowIndex);
    }

    List<Map<String, Object>> elList = (List<Map<String, Object>>) data.get(
        "elSummary");

    if (elList != null && !elList.isEmpty()) {
      Sheet sheet = workbook.createSheet("EL Summary");
      int rowIndex = writeDateRange(sheet, filter, workbook);
      writeListAsTable(sheet, elList, rowIndex);
    }

    List<Map<String, Object>> deptList = (List<Map<String, Object>>) data.get(
        "departmentSummary");

    if (deptList != null && !deptList.isEmpty()) {
      Sheet sheet = workbook.createSheet("Department Summary");
      int rowIndex = writeDateRange(sheet, filter, workbook);
      writeListAsTable(sheet, deptList, rowIndex);
    }

    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    workbook.write(baos);
    workbook.close();

    return baos.toByteArray();
  }

  private int writeDateRange(
      Sheet sheet,
      DashBoardFilter filter,
      Workbook workbook) {
    CreationHelper creationHelper = workbook.getCreationHelper();
    CellStyle dateStyle = workbook.createCellStyle();
    dateStyle.setDataFormat(
        creationHelper.createDataFormat().getFormat("dd-MMM-yyyy"));

    int rowNum = 0;

    Row row1 = sheet.createRow(rowNum++);
    row1.createCell(0).setCellValue("Start Date");
    Cell startDateCell = row1.createCell(1);
    if (filter.getStartDate() != null) {
      startDateCell.setCellValue(filter.getStartDate());
      startDateCell.setCellStyle(dateStyle);
    }

    Row row2 = sheet.createRow(rowNum++);
    row2.createCell(0).setCellValue("End Date");
    Cell endDateCell = row2.createCell(1);
    if (filter.getEndDate() != null) {
      endDateCell.setCellValue(filter.getEndDate());
      endDateCell.setCellStyle(dateStyle);
    }

    rowNum++;

    sheet.autoSizeColumn(0);
    sheet.autoSizeColumn(1);

    return rowNum;
  }

  private void writeSingleMap(
      Sheet sheet,
      Map<String, Object> map,
      int startRow) {
    int rowNum = startRow;

    for (Map.Entry<String, Object> entry : map.entrySet()) {
      Row row = sheet.createRow(rowNum++);
      row.createCell(0).setCellValue(entry.getKey());
      row
          .createCell(1)
          .setCellValue(
              entry.getValue() == null ? "" : entry.getValue().toString());
    }

    sheet.autoSizeColumn(0);
    sheet.autoSizeColumn(1);
  }

  private void writeListAsTable(
      Sheet sheet,
      List<Map<String, Object>> dataList,
      int startRow) {
    if (dataList.isEmpty())
      return;

    Row headerRow = sheet.createRow(startRow);
    Map<String, Object> firstRow = dataList.get(0);

    int col = 0;
    for (String key : firstRow.keySet()) {
      headerRow.createCell(col++).setCellValue(key);
    }

    int rowNum = startRow + 1;
    for (Map<String, Object> rowData : dataList) {
      Row row = sheet.createRow(rowNum++);
      col = 0;
      for (Object value : rowData.values()) {
        row
            .createCell(col++)
            .setCellValue(value == null ? "" : value.toString());
      }
    }

    for (int i = 0; i < firstRow.size(); i++) {
      sheet.autoSizeColumn(i);
    }
  }

  private List<Map<String, Object>> buildHierarchyWithGoals(
      List<Map<String, Object>> parentList,
      Function<Integer, List<Map<String, Object>>> getChildren,
      String parentIdKey,
      String childKey,
      Map<Integer, Object> goalMap,
      String goalKey) {
    for (Map<String, Object> parent : parentList) {
      Integer parentId = (Integer) parent.get(parentIdKey);

      // ✅ Apply goal at parent level
      parent.put(goalKey, goalMap.getOrDefault(parentId, 0));

      // ✅ Fetch children
      List<Map<String, Object>> children = getChildren.apply(parentId);

      parent.put(childKey, children);
    }

    return parentList;
  }
}

// old code
// package tapmind.bsrv.serviceNew;

// import java.io.ByteArrayOutputStream;
// import java.io.IOException;
// import java.io.PrintWriter;
// import java.math.BigDecimal;
// import java.sql.Date;
// import java.util.*;
// import java.util.stream.Collectors;
// import org.apache.poi.ss.usermodel.*;
// import org.apache.poi.xssf.usermodel.XSSFWorkbook;
// import org.springframework.beans.factory.annotation.Autowired;
// import org.springframework.jdbc.core.JdbcTemplate;
// import org.springframework.stereotype.Service;
// import org.springframework.transaction.annotation.Transactional;
// import tapmind.bsrv.dto.DashBoardFilter;
// import tapmind.bsrv.dto.UserGoalDataFilterRequestDTO;

// @Service
// public class DashBoardService {

// @Autowired private JdbcTemplate jdbcTemplate;

// // -------------------------------------------------------------------
// // MAIN SUMMARY METHOD (OLD)
// // -------------------------------------------------------------------
// @Transactional(readOnly = true)
// public List<Map<String, Object>> listEfficiencySummary(DashBoardFilter
// filter) {
// try {
// StringBuilder sql = new StringBuilder();
// List<Object> params = new ArrayList<>();

// sql.append(
// """
// SELECT
// ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
// ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
// ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
// ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
// CASE
// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 2.5 THEN 'High'

// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 1.5 THEN 'At Par'

// ELSE 'Low'
// END AS EfficiencyLevel ,
// """);

// boolean isUser = filter.getUserID() != null && filter.getUserID() != 0;
// boolean isDept = filter.getDepartmentID() != null && filter.getDepartmentID()
// != 0;
// boolean isEL = filter.getElID() != null && filter.getElID() != 0;

// if (isUser) {
// sql.append(" e.UserID, u.UserName ");
// } else if (isEL || isDept) {
// sql.append(" e.DepartmentID, d.DepartmentName ");
// } else {
// sql.append(" 'COMPANY' AS Level ");
// }

// sql.append(
// """
// FROM EfficiencyUtilizationSummary e
// JOIN Users u ON e.UserID = u.UserID
// JOIN Department d ON e.DepartmentID = d.DepartmentID
// WHERE 1=1
// """);

// sql.append(" AND e.WorkDate BETWEEN ? AND ? ");
// params.add(Date.valueOf(filter.getStartDate()));
// params.add(Date.valueOf(filter.getEndDate()));

// if (isUser) {
// sql.append(" AND e.UserID = ? ");
// params.add(filter.getUserID());
// }

// if (isDept && !isUser) {
// sql.append(" AND e.DepartmentID = ? ");
// params.add(filter.getDepartmentID());
// }

// if (isEL && !isUser) {
// sql.append(
// """
// AND e.DepartmentID IN (
// SELECT DepartmentID
// FROM Department
// WHERE ExecutiveLeaderID = ?
// )
// """);
// params.add(filter.getElID());
// }

// if (isUser) {
// sql.append(" GROUP BY e.UserID, u.UserName ");
// } else if (isEL || isDept) {
// sql.append(" GROUP BY e.DepartmentID, d.DepartmentName ");
// }

// return jdbcTemplate.queryForList(sql.toString(), params.toArray());

// } catch (Exception ex) {
// ex.printStackTrace();
// return Collections.emptyList();
// }
// }

// @Transactional(readOnly = true)
// public Map<String, Object> listEfficiencySummaryNewData(DashBoardFilter
// filter) {
// try {
// Map<String, Object> response = new HashMap<>();

// boolean isUser = filter.getUserID() != null && filter.getUserID() != 0;
// boolean isDept = filter.getDepartmentID() != null && filter.getDepartmentID()
// != 0;
// boolean isEL = filter.getElID() != null && filter.getElID() != 0;
// boolean isFL = filter.getFlID() != null && filter.getFlID() != 0;

// if (isUser && filter.getRoleID() == 2) {
// response.put("userSummary", getUserSummaryForUsers(filter));
// response.put("userGoalSummary", getUserGoalSummaryForUsers(filter));
// return response;
// }

// if (isUser) {
// response.put("userSummary", getUserSummary(filter));
// return response;
// }

// if (isDept) {
// response.put("departmentSummary", getDepartmentSummary(filter, true));
// response.put("departmentGoalSummary", getDepartmentGoalSummary(filter));
// return response;
// }

// if (isFL && filter.isHeFunctionalLeader()) {
// System.out.println("-----------------------FL------------------");
// response.put("flUsersSummary", getFLSummaryUsers(filter, true));
// response.put("flGoalSummary", getFLGoalSummary(filter));

// return response;
// }

// if (isFL) {
// response.put("flSummary", getFLSummary(filter, true));

// return response;
// }

// System.out.println("isHeExecutiveLeader " + filter.isHeExecutiveLeader());

// if (isEL && filter.isHeExecutiveLeader()) {
// response.put("elUsersSummary", getELSummaryUsers(filter, true));
// response.put("elGoalSummary", getELGoalSummaryAdmin(filter));

// return response;
// }

// if (isEL) {
// response.put("elSummary", getELSummary(filter, true));
// return response;
// }

// Map<String, Object> companyTargetGoalMap = getCompanySummary(filter);
// Map<String, Object> goalMap = getCompanyGoalSummary(filter);

// // flatten
// companyTargetGoalMap.put("AvgGoalEfficiency",
// goalMap.get("AvgGoalEfficiency"));
// response.put("companySummary", companyTargetGoalMap);
// // response.put("companySummary", companyTargetGoalMap
// /*getCompanySummary(filter)*/);
// List<Map<String, Object>> elList = getELSummary(filter, false);
// List<Map<String, Object>> elGoalList = getELGoalSummaryAdmin(filter);

// // map ELID → goal
// Map<Integer, Object> elGoalMap =
// elGoalList.stream()
// .collect(
// Collectors.toMap(m -> (Integer) m.get("ELID"), m ->
// m.get("AvgGoalEfficiency")));

// for (Map<String, Object> el : elList) {
// Integer elId = (Integer) el.get("ELID");
// el.put("AvgGoalEfficiency", elGoalMap.getOrDefault(elId, 0));
// }

// response.put("elSummary", elList);
// // response.put("elSummary", getELSummary(filter, false));
// List<Map<String, Object>> flList = getFLSummary(filter, false);
// List<Map<String, Object>> flGoalList = getFLGoalSummary(filter);

// Map<Integer, Object> flGoalMap =
// flGoalList.stream()
// .collect(
// Collectors.toMap(m -> (Integer) m.get("FLID"), m ->
// m.get("AvgGoalEfficiency")));

// for (Map<String, Object> fl : flList) {
// Integer flId = (Integer) fl.get("FLID");
// fl.put("AvgGoalEfficiency", flGoalMap.getOrDefault(flId, 0));
// }

// response.put("flSummary", flList);
// // response.put("flSummary", getFLSummary(filter, false));
// List<Map<String, Object>> deptList = getDepartmentSummary(filter, false);
// List<Map<String, Object>> deptGoalList = getDepartmentGoalSummary(filter);

// Map<Integer, Object> deptGoalMap =
// deptGoalList.stream()
// .collect(
// Collectors.toMap(
// m -> (Integer) m.get("DepartmentID"), m -> m.get("AvgGoalEfficiency")));

// for (Map<String, Object> dept : deptList) {
// Integer deptId = (Integer) dept.get("DepartmentID");
// dept.put("AvgGoalEfficiency", deptGoalMap.getOrDefault(deptId, 0));
// }

// response.put("departmentSummary", deptList);
// // response.put("departmentSummary", getDepartmentSummary(filter, false));

// return response;

// } catch (Exception ex) {
// ex.printStackTrace();
// return new HashMap<>();
// }
// }

// /*
// @Transactional(readOnly = true)
// public Map<String, Object> listEfficiencySummaryNewData(DashBoardFilter
// filter) {

// Map<String, Object> response = new HashMap<>();

// try {
// int roleId = filter.getRoleID();

// boolean isUser = filter.getUserID() != null && filter.getUserID() != 0;
// boolean isDept = filter.getDepartmentID() != null && filter.getDepartmentID()
// != 0;
// boolean isEL = filter.getElID() != null && filter.getElID() != 0;
// boolean isFL = filter.getFlID() != null && filter.getFlID() != 0;

// if (roleId == 2) { // USER
// response.put("userSummary", getUserSummaryForUsers(filter));
// return response;
// }

// if (roleId == 4) { // FUNCTIONAL LEADER
// response.put("flSummary", getFLSummary(filter, true));
// response.put("flUsersSummary", getFLSummaryUsers(filter, true));
// return response;
// }

// if (roleId == 3) { // EXECUTIVE LEADER
// response.put("elSummary", getELSummary(filter, true));
// response.put("departmentSummary", getDepartmentSummary(filter, true));
// return response;
// }

// // Admin sees everything
// response.put("companySummary", getCompanySummary(filter));
// response.put("elSummary", getELSummary(filter, false));
// response.put("flSummary", getFLSummary(filter, false));
// response.put("departmentSummary", getDepartmentSummary(filter, false));

// return response;

// } catch (Exception ex) {
// ex.printStackTrace();
// return new HashMap<>();
// }
// }

// */
// private Map<String, Object> getCompanySummary(DashBoardFilter filter) {
// try {
// String sql =
// """
// SELECT
// ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
// ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
// ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
// ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
// CASE
// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 2.5 THEN 'High'

// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 1.5 THEN 'At Par'

// ELSE 'Low'
// END AS EfficiencyLevel
// FROM EfficiencyUtilizationSummary e
// WHERE e.WorkDate BETWEEN ? AND ?
// """;

// return jdbcTemplate.queryForMap(
// sql, Date.valueOf(filter.getStartDate()), Date.valueOf(filter.getEndDate()));

// } catch (Exception ex) {
// ex.printStackTrace();
// return new HashMap<>();
// }
// }

// private List<Map<String, Object>> getELSummary(DashBoardFilter filter,
// boolean onlyOne) {
// try {

// StringBuilder sql =
// new StringBuilder(
// """
// SELECT
// d.ExecutiveLeaderID AS ELID,
// u.UserName AS ELName,
// ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
// ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
// ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
// ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
// CASE
// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 2.5 THEN 'High'

// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 1.5 THEN 'At Par'

// ELSE 'Low'
// END AS EfficiencyLevel
// FROM EfficiencyUtilizationSummary e
// JOIN Department d ON e.DepartmentID = d.DepartmentID
// JOIN Users u ON d.ExecutiveLeaderID = u.UserID
// WHERE e.WorkDate BETWEEN ? AND ?
// AND u.RoleID = 3
// """);

// List<Object> params = new ArrayList<>();
// params.add(Date.valueOf(filter.getStartDate()));
// params.add(Date.valueOf(filter.getEndDate()));

// if (onlyOne) {
// sql.append(" AND d.ExecutiveLeaderID = ? ");
// params.add(filter.getElID());
// }

// sql.append(" GROUP BY d.ExecutiveLeaderID, u.UserName ");
// System.out.println(sql);
// return jdbcTemplate.queryForList(sql.toString(), params.toArray());

// } catch (Exception ex) {
// ex.printStackTrace();
// return Collections.emptyList();
// }
// }

// private List<Map<String, Object>> getFLSummary(DashBoardFilter filter,
// boolean onlyOne) {
// try {

// StringBuilder sql =
// new StringBuilder(
// """
// SELECT
// d.FunctionalLeaderID AS FLID,
// u.UserName AS FLName,
// ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
// ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
// ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
// ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
// CASE
// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 2.5 THEN 'High'

// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 1.5 THEN 'At Par'

// ELSE 'Low'
// END AS EfficiencyLevel
// FROM EfficiencyUtilizationSummary e
// JOIN Department d ON e.DepartmentID = d.DepartmentID
// JOIN Users u ON d.FunctionalLeaderID = u.UserID
// WHERE e.WorkDate BETWEEN ? AND ?
// AND u.RoleID = 4
// """);

// List<Object> params = new ArrayList<>();
// params.add(Date.valueOf(filter.getStartDate()));
// params.add(Date.valueOf(filter.getEndDate()));

// if (onlyOne) {
// sql.append(" AND d.FunctionalLeaderID = ? ");
// params.add(filter.getFlID());
// }

// sql.append(" GROUP BY d.FunctionalLeaderID, u.UserName ");

// return jdbcTemplate.queryForList(sql.toString(), params.toArray());

// } catch (Exception ex) {
// ex.printStackTrace();
// return Collections.emptyList();
// }
// }

// private List<Map<String, Object>> getDepartmentSummary(DashBoardFilter
// filter, boolean onlyOne) {
// try {

// StringBuilder sql =
// new StringBuilder(
// """
// SELECT
// e.DepartmentID,
// d.DepartmentName,
// ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
// ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
// ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
// ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
// CASE
// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 2.5 THEN 'High'

// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 1.5 THEN 'At Par'

// ELSE 'Low'
// END AS EfficiencyLevel
// FROM EfficiencyUtilizationSummary e
// JOIN Department d ON e.DepartmentID = d.DepartmentID
// WHERE e.WorkDate BETWEEN ? AND ?
// AND d.DepartmentStatus = true
// """);

// List<Object> params = new ArrayList<>();
// params.add(Date.valueOf(filter.getStartDate()));
// params.add(Date.valueOf(filter.getEndDate()));

// if (onlyOne) {
// sql.append(" AND e.DepartmentID = ? ");
// params.add(filter.getDepartmentID());
// }

// sql.append(" GROUP BY e.DepartmentID, d.DepartmentName ");

// return jdbcTemplate.queryForList(sql.toString(), params.toArray());

// } catch (Exception ex) {
// ex.printStackTrace();
// return Collections.emptyList();
// }
// }

// public List<Map<String, Object>> getUserSummary(DashBoardFilter filter) {
// try {

// StringBuilder sql = new StringBuilder();
// List<Object> params = new ArrayList<>();

// sql.append(
// """
// SELECT
// e.UserID,
// u.UserName,
// ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
// ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
// ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
// ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
// CASE
// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 2.5 THEN 'High'

// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 1.5 THEN 'At Par'

// ELSE 'Low'
// END AS EfficiencyLevel
// FROM EfficiencyUtilizationSummary e
// JOIN Users u ON e.UserID = u.UserID
// WHERE 1=1
// """);

// sql.append(" AND e.WorkDate BETWEEN ? AND ? ");
// params.add(Date.valueOf(filter.getStartDate()));
// params.add(Date.valueOf(filter.getEndDate()));

// if (filter.getUserID() != null && filter.getUserID() != 0) {
// sql.append(" AND e.UserID = ? ");
// params.add(filter.getUserID());
// }

// if (filter.getDepartmentID() != null && filter.getDepartmentID() != 0) {
// sql.append(" AND e.DepartmentID = ? ");
// params.add(filter.getDepartmentID());
// }

// if (filter.getElID() != null && filter.getElID() != 0) {
// sql.append(
// """
// AND e.DepartmentID IN (
// SELECT DepartmentID
// FROM Department
// WHERE ExecutiveLeaderID = ?
// )
// """);
// params.add(filter.getElID());
// }

// sql.append(" GROUP BY e.UserID, u.UserName ");
// sql.append(" ORDER BY u.UserName ASC ");
// System.out.println(sql);
// return jdbcTemplate.queryForList(sql.toString(), params.toArray());

// } catch (Exception ex) {
// ex.printStackTrace();
// return Collections.emptyList();
// }
// }

// public List<Map<String, Object>> getUserGoalSummaryForUsers(DashBoardFilter
// filter) {

// try {

// List<Map<String, Object>> finalList = new ArrayList<>();
// List<Object> params = new ArrayList<>();

// StringBuilder sql =
// new StringBuilder(
// """
// SELECT
// ug.UserID,
// u.UserName,
// ROUND(
// (SUM(ug.AchievedGoal) / SUM(ug.FixedGoal)) * 100,
// 2
// ) AS AvgGoalEfficiency
// FROM UserGoalData ug
// JOIN Users u ON ug.UserID = u.UserID
// WHERE ug.WorkDate BETWEEN ? AND ?
// AND ug.FixedGoal > 0
// """);

// params.add(Date.valueOf(filter.getStartDate()));
// params.add(Date.valueOf(filter.getEndDate()));

// // ✅ Filters (same as efficiency)

// if (filter.getUserID() != null && filter.getUserID() != 0) {
// sql.append(" AND ug.UserID = ? ");
// params.add(filter.getUserID());
// }

// if (filter.getDepartmentID() != null && filter.getDepartmentID() != 0) {
// sql.append(" AND ug.DepartmentID = ? ");
// params.add(filter.getDepartmentID());
// }

// if (filter.getElID() != null && filter.getElID() != 0) {
// sql.append(
// """
// AND ug.DepartmentID IN (
// SELECT DepartmentID
// FROM Department
// WHERE ExecutiveLeaderID = ?
// )
// """);
// params.add(filter.getElID());
// }

// sql.append(" GROUP BY ug.UserID, u.UserName ORDER BY u.UserName ASC ");

// List<Map<String, Object>> summaryList =
// jdbcTemplate.queryForList(sql.toString(), params.toArray());

// // ✅ Daily Goal Efficiency (same pattern as efficiency)

// String dailySql =
// """
// SELECT
// ug.WorkDate,
// ROUND(
// (SUM(ug.AchievedGoal) / SUM(ug.FixedGoal)) * 100,
// 2
// ) AS GoalEfficiency
// FROM UserGoalData ug
// WHERE ug.UserID = ?
// AND ug.WorkDate BETWEEN ? AND ?
// AND ug.FixedGoal > 0
// GROUP BY ug.WorkDate
// ORDER BY ug.WorkDate ASC
// """;

// for (Map<String, Object> summary : summaryList) {

// Integer userId = (Integer) summary.get("UserID");

// List<Map<String, Object>> dailyData =
// jdbcTemplate.queryForList(
// dailySql,
// userId,
// Date.valueOf(filter.getStartDate()),
// Date.valueOf(filter.getEndDate()));

// // add userId inside daily records
// for (Map<String, Object> daily : dailyData) {
// daily.put("UserID", userId);
// }

// summary.put("DailyGoalData", dailyData);

// finalList.add(summary);
// }

// return finalList;

// } catch (Exception ex) {
// ex.printStackTrace();
// return Collections.emptyList();
// }
// }

// public List<Map<String, Object>> getDepartmentGoalSummary(DashBoardFilter
// filter) {

// String sql =
// """
// SELECT
// ug.DepartmentID,
// d.DepartmentName,
// ROUND((SUM(ug.AchievedGoal) / SUM(ug.FixedGoal)) * 100, 2) AS
// AvgGoalEfficiency
// FROM UserGoalData ug
// JOIN Department d ON ug.DepartmentID = d.DepartmentID
// WHERE ug.WorkDate BETWEEN ? AND ?
// AND ug.FixedGoal > 0
// GROUP BY ug.DepartmentID, d.DepartmentName
// """;

// return jdbcTemplate.queryForList(
// sql, Date.valueOf(filter.getStartDate()), Date.valueOf(filter.getEndDate()));
// }

// public List<Map<String, Object>> getFLGoalSummary(DashBoardFilter filter) {

// String sql =
// """
// SELECT
// d.FunctionalLeaderID AS FLID,
// ROUND((SUM(ug.AchievedGoal) / SUM(ug.FixedGoal)) * 100, 2) AS
// AvgGoalEfficiency
// FROM UserGoalData ug
// JOIN Department d ON ug.DepartmentID = d.DepartmentID
// WHERE ug.WorkDate BETWEEN ? AND ?
// AND ug.FixedGoal > 0
// GROUP BY d.FunctionalLeaderID
// """;

// return jdbcTemplate.queryForList(
// sql, Date.valueOf(filter.getStartDate()), Date.valueOf(filter.getEndDate()));
// }

// public List<Map<String, Object>> getELGoalSummary(DashBoardFilter filter) {

// String sql =
// """
// SELECT
// d.ExecutiveLeaderID AS ELID,
// ROUND((SUM(ug.AchievedGoal) / SUM(ug.FixedGoal)) * 100, 2) AS
// AvgGoalEfficiency
// FROM UserGoalData ug
// JOIN Department d ON ug.DepartmentID = d.DepartmentID
// WHERE ug.WorkDate BETWEEN ? AND ?
// AND ug.FixedGoal > 0
// GROUP BY d.ExecutiveLeaderID
// """;

// return jdbcTemplate.queryForList(
// sql, Date.valueOf(filter.getStartDate()), Date.valueOf(filter.getEndDate()));
// }

// public List<Map<String, Object>> getELGoalSummaryAdmin(DashBoardFilter
// filter) {

// String sql =
// """
// SELECT
// d.ExecutiveLeaderID AS ELID,
// ROUND(
// SUM(ug.AchievedGoal) * 100.0 /
// SUM(
// CASE
// WHEN ug.DepartmentID = 37 THEN COALESCE(uwd37.totalUnits, 0) * 0.7
// WHEN ug.DepartmentID = 21 THEN COALESCE(uwdAll.totalUnits, 0) * 0.7
// ELSE ug.FixedGoal
// END
// )
// , 2) AS AvgGoalEfficiency

// FROM UserGoalData ug

// JOIN Department d
// ON ug.DepartmentID = d.DepartmentID
// LEFT JOIN (
// SELECT
// UserID, WorkDate, DepartmentID,
// SUM(AchivedUnits) AS totalUnits
// FROM UserWorkData
// WHERE TaskID = 65
// GROUP BY UserID, WorkDate, DepartmentID
// ) uwd37
// ON ug.UserID = uwd37.UserID
// AND ug.WorkDate = uwd37.WorkDate
// AND ug.DepartmentID = uwd37.DepartmentID

// LEFT JOIN (
// SELECT
// UserID, WorkDate, DepartmentID,
// SUM(AchivedUnits) AS totalUnits
// FROM UserWorkData
// GROUP BY UserID, WorkDate, DepartmentID
// ) uwdAll
// ON ug.UserID = uwdAll.UserID
// AND ug.WorkDate = uwdAll.WorkDate
// AND ug.DepartmentID = uwdAll.DepartmentID

// WHERE ug.WorkDate BETWEEN ? AND ?

// GROUP BY d.ExecutiveLeaderID
// """;
// return jdbcTemplate.queryForList(
// sql, Date.valueOf(filter.getStartDate()), Date.valueOf(filter.getEndDate()));
// }

// public Map<String, Object> getCompanyGoalSummary(DashBoardFilter filter) {

// String sql =
// """
// SELECT
// ROUND((SUM(AchievedGoal) / SUM(FixedGoal)) * 100, 2) AS AvgGoalEfficiency
// FROM UserGoalData
// WHERE WorkDate BETWEEN ? AND ?
// AND FixedGoal > 0
// """;

// return jdbcTemplate.queryForMap(
// sql, Date.valueOf(filter.getStartDate()), Date.valueOf(filter.getEndDate()));
// }

// private Integer normalize(Integer value) {
// return (value != null && value == 0) ? null : value;
// }

// public BigDecimal getAverageSum(UserGoalDataFilterRequestDTO filter, Integer
// userID) {
// Integer departmentID = normalize(filter.getDepartmentID());
// Integer elID = normalize(filter.getELID());
// Integer flID = normalize(filter.getFLID());
// StringBuilder sql =
// new StringBuilder(
// """
// SELECT
// ROUND((SUM(ug.AchievedGoal) / SUM(ug.FixedGoal)) * 100, 2) AS
// AvgGoalEfficiency
// FROM UserGoalData ug
// WHERE ug.WorkDate BETWEEN ? AND ?
// """); // AND ug.FixedGoal > 0
// List<Object> params = new ArrayList<>();
// params.add(Date.valueOf(filter.getStartDate()));
// params.add(Date.valueOf(filter.getEndDate()));
// if (filter.getRoleID() != null && filter.getRoleID() == 1) {
// if (departmentID != null) {
// sql.append(" AND ug.DepartmentID = ? ");
// params.add(departmentID);
// }
// if (elID != null && elID > 0) {
// sql.append(
// """
// AND ug.DepartmentID IN (
// SELECT DepartmentID
// FROM Department
// WHERE ExecutiveLeaderID = ?
// )
// """);
// params.add(elID);
// }
// if (userID != null) {
// sql.append(" AND ug.UserID = ? ");
// params.add(userID);
// }
// } else if (elID != null && elID>0) {

// sql.append(
// """
// AND ug.DepartmentID IN (
// SELECT DepartmentID
// FROM Department
// WHERE ExecutiveLeaderID = ?
// )
// """);
// params.add(elID);

// if (departmentID != null) {
// sql.append(" AND ug.DepartmentID = ? ");
// params.add(departmentID);
// }
// } else if (flID != null && flID>0) {

// sql.append(
// """
// AND ug.DepartmentID IN (
// SELECT DepartmentID
// FROM Department
// WHERE FunctionalLeaderID = ?
// )
// """);
// params.add(flID);

// if (departmentID != null) {
// sql.append(" AND ug.DepartmentID = ? ");
// params.add(departmentID);
// }
// } else if (userID != null) {
// sql.append(" AND ug.UserID = ? ");
// params.add(userID);

// if (departmentID != null) {
// sql.append(" AND ug.DepartmentID = ? ");
// params.add(departmentID);
// }
// }

// Map<String, Object> result = jdbcTemplate.queryForMap(sql.toString(),
// params.toArray());

// return (BigDecimal) result.get("AvgGoalEfficiency");
// }

// public List<Map<String, Object>> getUserSummaryForUsers(DashBoardFilter
// filter) {
// try {

// List<Map<String, Object>> finalList = new ArrayList<>();
// List<Object> params = new ArrayList<>();

// StringBuilder summarySql =
// new StringBuilder(
// """
// SELECT
// e.UserID,
// u.UserName,
// ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
// ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
// ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
// ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
// CASE
// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 2.5 THEN 'High'

// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 1.5 THEN 'At Par'

// ELSE 'Low'
// END AS EfficiencyLevel
// FROM EfficiencyUtilizationSummary e
// JOIN Users u ON e.UserID = u.UserID
// WHERE e.WorkDate BETWEEN ? AND ?
// """);

// params.add(Date.valueOf(filter.getStartDate()));
// params.add(Date.valueOf(filter.getEndDate()));

// if (filter.getUserID() != null && filter.getUserID() != 0) {
// summarySql.append(" AND e.UserID = ? ");
// params.add(filter.getUserID());
// }

// if (filter.getDepartmentID() != null && filter.getDepartmentID() != 0) {
// summarySql.append(" AND e.DepartmentID = ? ");
// params.add(filter.getDepartmentID());
// }

// if (filter.getElID() != null && filter.getElID() != 0) {
// summarySql.append(
// """
// AND e.DepartmentID IN (
// SELECT DepartmentID
// FROM Department
// WHERE ExecutiveLeaderID = ?
// )
// """);
// params.add(filter.getElID());
// }

// summarySql.append(" GROUP BY e.UserID, u.UserName ORDER BY u.UserName ASC ");

// List<Map<String, Object>> summaryList =
// jdbcTemplate.queryForList(summarySql.toString(), params.toArray());

// String dailySql =
// """
// SELECT
// e.WorkDate,
// e.TargetAchievedPercent,
// e.UtilizationPercent,
// e.AllocatedTimeHrs,
// e.TotalTimeOfWork,
// e.EfficiencyLevel
// FROM EfficiencyUtilizationSummary e
// WHERE e.UserID = ?
// AND e.WorkDate BETWEEN ? AND ?
// ORDER BY e.WorkDate ASC
// """;

// for (Map<String, Object> summary : summaryList) {

// Integer userId = (Integer) summary.get("UserID");

// List<Map<String, Object>> dailyData =
// jdbcTemplate.queryForList(
// dailySql,
// userId,
// Date.valueOf(filter.getStartDate()),
// Date.valueOf(filter.getEndDate()));

// // ➕ Add userID inside each daily record
// for (Map<String, Object> daily : dailyData) {
// daily.put("UserID", userId);
// }

// summary.put("DailyData", dailyData);

// finalList.add(summary);
// }

// return finalList;

// } catch (Exception ex) {
// ex.printStackTrace();
// return Collections.emptyList();
// }
// }

// private List<Map<String, Object>> getELSummaryUsers(DashBoardFilter filter,
// boolean onlyOne) {

// List<Map<String, Object>> finalList = new ArrayList<>();

// List<Map<String, Object>> els = getELSummary(filter, onlyOne);

// for (Map<String, Object> el : els) {

// Integer elID = (Integer) el.get("ELID");
// System.out.println(elID);
// // Fetch departments for this EL
// List<Map<String, Object>> deptList = getDepartmentsForEL(elID, filter);

// // Add users inside each department
// for (Map<String, Object> dept : deptList) {

// Integer deptId = (Integer) dept.get("DepartmentID");

// List<Map<String, Object>> users = getUsersForDepartment(deptId, filter);

// dept.put("users", users);
// }

// // Add to EL response
// el.put("departments", deptList);

// finalList.add(el);
// }

// return finalList;
// }

// private List<Map<String, Object>> getFLSummaryUsers(DashBoardFilter filter,
// boolean onlyOne) {

// List<Map<String, Object>> finalList = new ArrayList<>();

// List<Map<String, Object>> els = getFLSummary(filter, onlyOne);

// for (Map<String, Object> el : els) {

// Integer flID = (Integer) el.get("FLID");
// System.out.println(flID);
// // Fetch departments for this EL
// List<Map<String, Object>> deptList = getDepartmentsForFL(flID, filter);

// // Add users inside each department
// for (Map<String, Object> dept : deptList) {

// Integer deptId = (Integer) dept.get("DepartmentID");

// List<Map<String, Object>> users = getUsersForDepartment(deptId, filter);

// dept.put("users", users);
// }

// // Add to EL response
// el.put("departments", deptList);

// finalList.add(el);
// }

// return finalList;
// }

// private List<Map<String, Object>> getDepartmentsForFL(Integer elID,
// DashBoardFilter filter) {

// String sql =
// """
// SELECT
// d.DepartmentID,
// d.DepartmentName,
// ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
// ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
// ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
// ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
// CASE
// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 2.5 THEN 'High'

// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 1.5 THEN 'At Par'

// ELSE 'Low'
// END AS EfficiencyLevel
// FROM Department d
// JOIN EfficiencyUtilizationSummary e ON d.DepartmentID = e.DepartmentID
// WHERE d.FunctionalLeaderID = ?
// AND e.WorkDate BETWEEN ? AND ?
// GROUP BY d.DepartmentID, d.DepartmentName
// """;

// return jdbcTemplate.queryForList(
// sql, elID, Date.valueOf(filter.getStartDate()),
// Date.valueOf(filter.getEndDate()));
// }

// private List<Map<String, Object>> getDepartmentsForEL(Integer elID,
// DashBoardFilter filter) {

// String sql =
// """
// SELECT
// d.DepartmentID,
// d.DepartmentName,
// ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
// ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
// ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
// ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
// CASE
// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 2.5 THEN 'High'

// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 1.5 THEN 'At Par'

// ELSE 'Low'
// END AS EfficiencyLevel
// FROM Department d
// JOIN EfficiencyUtilizationSummary e ON d.DepartmentID = e.DepartmentID
// WHERE d.ExecutiveLeaderID = ?
// AND e.WorkDate BETWEEN ? AND ?
// GROUP BY d.DepartmentID, d.DepartmentName
// """;

// return jdbcTemplate.queryForList(
// sql, elID, Date.valueOf(filter.getStartDate()),
// Date.valueOf(filter.getEndDate()));
// }

// private List<Map<String, Object>> getUsersForDepartment(
// Integer departmentID, DashBoardFilter filter) {

// String sql =
// """
// SELECT
// u.UserID,
// u.UserName,
// ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
// ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
// ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
// ROUND(AVG(e.TotalTimeOfWork),2) AS AvgTotalWork,
// CASE
// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 2.5 THEN 'High'

// WHEN ROUND(AVG(
// CASE
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'high' THEN 3
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'at par' THEN 2
// WHEN LOWER(TRIM(e.EfficiencyLevel)) = 'low' THEN 1
// ELSE 0
// END
// ),1) >= 1.5 THEN 'At Par'

// ELSE 'Low'
// END AS EfficiencyLevel
// FROM Users u
// JOIN EfficiencyUtilizationSummary e ON u.UserID = e.UserID
// WHERE e.DepartmentID = ?
// AND e.WorkDate BETWEEN ? AND ?
// GROUP BY u.UserID, u.UserName
// ORDER BY u.UserName
// """;

// return jdbcTemplate.queryForList(
// sql, departmentID, Date.valueOf(filter.getStartDate()),
// Date.valueOf(filter.getEndDate()));
// }

// @Transactional(readOnly = true)
// public void downloadEfficiencySummaryCsv(DashBoardFilter filter, PrintWriter
// writer) {

// boolean isUser = filter.getUserID() != null && filter.getUserID() != 0;
// boolean isDept = filter.getDepartmentID() != null && filter.getDepartmentID()
// != 0;
// boolean isEL = filter.getElID() != null && filter.getElID() != 0;

// List<Map<String, Object>> rows = new ArrayList<>();

// if (isUser && filter.getRoleID() == 2) {

// rows = getUserSummaryForUsers(filter);

// } else if (isUser) {

// rows = getUserSummary(filter);

// } else if (isDept) {

// rows = getDepartmentSummary(filter, true);

// } else if (isEL && filter.isHeExecutiveLeader()) {

// rows = getELSummaryUsers(filter, true);

// } else if (isEL) {

// rows = getELSummary(filter, true);

// } else {
// // companySummary RETURNS MAP — wrap it
// Map<String, Object> companySummary = getCompanySummary(filter);

// if (companySummary != null && !companySummary.isEmpty()) {
// rows.add(companySummary);
// }
// }

// writeCsv(rows, writer);
// }

// private void writeCsv(List<Map<String, Object>> data, PrintWriter writer) {

// if (data == null || data.isEmpty()) {
// writer.println("No Data Available");
// return;
// }

// // Header
// Set<String> headers = data.get(0).keySet();
// writer.println(String.join(",", headers));

// // Rows
// for (Map<String, Object> row : data) {
// List<String> values = new ArrayList<>();
// for (String key : headers) {
// Object value = row.get(key);
// values.add(value == null ? "" : escapeCsv(value.toString()));
// }
// writer.println(String.join(",", values));
// }

// writer.flush();
// }

// private String escapeCsv(String value) {
// if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
// value = value.replace("\"", "\"\"");
// return "\"" + value + "\"";
// }
// return value;
// }

// @Transactional(readOnly = true)
// public byte[] downloadEfficiencySummaryExcel(DashBoardFilter filter) throws
// IOException {

// Map<String, Object> data = listEfficiencySummaryNewData(filter);
// Workbook workbook = new XSSFWorkbook();

// Map<String, Object> company = (Map<String, Object>)
// data.get("companySummary");

// if (company != null && !company.isEmpty()) {
// Sheet sheet = workbook.createSheet("Company Summary");
// int rowIndex = writeDateRange(sheet, filter, workbook);
// writeSingleMap(sheet, company, rowIndex);
// }

// List<Map<String, Object>> elList = (List<Map<String, Object>>)
// data.get("elSummary");

// if (elList != null && !elList.isEmpty()) {
// Sheet sheet = workbook.createSheet("EL Summary");
// int rowIndex = writeDateRange(sheet, filter, workbook);
// writeListAsTable(sheet, elList, rowIndex);
// }

// List<Map<String, Object>> deptList = (List<Map<String, Object>>)
// data.get("departmentSummary");

// if (deptList != null && !deptList.isEmpty()) {
// Sheet sheet = workbook.createSheet("Department Summary");
// int rowIndex = writeDateRange(sheet, filter, workbook);
// writeListAsTable(sheet, deptList, rowIndex);
// }

// ByteArrayOutputStream baos = new ByteArrayOutputStream();
// workbook.write(baos);
// workbook.close();

// return baos.toByteArray();
// }

// private int writeDateRange(Sheet sheet, DashBoardFilter filter, Workbook
// workbook) {

// CreationHelper creationHelper = workbook.getCreationHelper();
// CellStyle dateStyle = workbook.createCellStyle();
// dateStyle.setDataFormat(creationHelper.createDataFormat().getFormat("dd-MMM-yyyy"));

// int rowNum = 0;

// Row row1 = sheet.createRow(rowNum++);
// row1.createCell(0).setCellValue("Start Date");
// Cell startDateCell = row1.createCell(1);
// if (filter.getStartDate() != null) {
// startDateCell.setCellValue(filter.getStartDate());
// startDateCell.setCellStyle(dateStyle);
// }

// Row row2 = sheet.createRow(rowNum++);
// row2.createCell(0).setCellValue("End Date");
// Cell endDateCell = row2.createCell(1);
// if (filter.getEndDate() != null) {
// endDateCell.setCellValue(filter.getEndDate());
// endDateCell.setCellStyle(dateStyle);
// }

// // Empty row for spacing
// rowNum++;

// sheet.autoSizeColumn(0);
// sheet.autoSizeColumn(1);

// return rowNum; // starting row for actual data
// }

// private void writeSingleMap(Sheet sheet, Map<String, Object> map, int
// startRow) {

// int rowNum = startRow;

// for (Map.Entry<String, Object> entry : map.entrySet()) {
// Row row = sheet.createRow(rowNum++);
// row.createCell(0).setCellValue(entry.getKey());
// row.createCell(1).setCellValue(entry.getValue() == null ? "" :
// entry.getValue().toString());
// }

// sheet.autoSizeColumn(0);
// sheet.autoSizeColumn(1);
// }

// private void writeListAsTable(Sheet sheet, List<Map<String, Object>>
// dataList, int startRow) {

// if (dataList.isEmpty()) return;

// // Header
// Row headerRow = sheet.createRow(startRow);
// Map<String, Object> firstRow = dataList.get(0);

// int col = 0;
// for (String key : firstRow.keySet()) {
// headerRow.createCell(col++).setCellValue(key);
// }

// // Data
// int rowNum = startRow + 1;
// for (Map<String, Object> rowData : dataList) {
// Row row = sheet.createRow(rowNum++);
// col = 0;
// for (Object value : rowData.values()) {
// row.createCell(col++).setCellValue(value == null ? "" : value.toString());
// }
// }

// for (int i = 0; i < firstRow.size(); i++) {
// sheet.autoSizeColumn(i);
// }
// }
// }
