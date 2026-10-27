package tapmind.bsrv.serviceNew;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.repository.DepartmentRepository;
import tapmind.bsrv.repository.UserWorkDataRepository;
import tapmind.bsrv.repository.UserGoalDataRepository;
import tapmind.bsrv.model.TAMAccount;
import tapmind.bsrv.model.TAMStatus;
import tapmind.bsrv.repository.TAMAccountRepository;

@Service
@RequiredArgsConstructor
public class EfficiencyReportService {

  private final JdbcTemplate jdbcTemplate;
  private final DepartmentRepository departmentRepository;
  private final TAMAccountRepository tamAccountRepository;
  private final DashBoardService dashBoardService;
  private final UserWorkDataRepository userWorkDataRepository;
  private final UserGoalDataRepository userGoalDataRepository;

  // Effective goal: RevisedGoal.value if EL-approved, else FixedGoal
  private static final String EFFECTIVE_GOAL =
      "CASE WHEN ug.RevisedGoal IS NOT NULL AND ug.RevisedGoal != '' "
          + "AND JSON_UNQUOTE(JSON_EXTRACT(ug.RevisedGoal, '$.elApproved')) = 'true' "
          + "THEN CAST(JSON_EXTRACT(ug.RevisedGoal, '$.value') AS DECIMAL(10,2)) "
          + "ELSE ug.FixedGoal END";

  // =========================================================================
  // HIERARCHICAL SUMMARY HELPERS
  // =========================================================================

  /**
   * Maps an EfficiencyLevel string ("High" / "At Par" / "Low") to a numeric score
   * used for averaging across the hierarchy.
   */
  private BigDecimal levelToScore(Object levelObj) {
    String level = levelObj != null ? levelObj.toString().trim().toLowerCase() : "";
    return switch (level) {
      case "high" -> BigDecimal.valueOf(3);
      case "at par" -> BigDecimal.valueOf(2);
      case "low" -> BigDecimal.valueOf(1);
      default -> BigDecimal.ZERO;
    };
  }

  /**
   * USER LEVEL — averages a set of raw daily rows straight from filteredList.
   * Keys read: TargetAchievedPercent, UtilizationPercent, AllocatedTimeHrs,
   * TotalTimeOfWork, EfficiencyLevel
   * Keys written: AvgTargetPercent, AvgUtilizationPercent, AvgAllocatedHrs,
   * AvgTotalWork, EfficiencyLevel, _score (internal)
   */
  private Map<String, Object> computeRowAverages(List<Map<String, Object>> rows) {
    Map<String, Object> result = new HashMap<>();

    if (rows == null || rows.isEmpty()) {
      result.put("AvgTargetPercent", BigDecimal.ZERO);
      result.put("AvgUtilizationPercent", BigDecimal.ZERO);
      result.put("AvgAllocatedHrs", BigDecimal.ZERO);
      result.put("AvgTotalWork", BigDecimal.ZERO);
      result.put("EfficiencyLevel", "Low");
      result.put("_score", BigDecimal.ZERO);
      return result;
    }

    BigDecimal totalTarget = BigDecimal.ZERO;
    BigDecimal totalUtil = BigDecimal.ZERO;
    BigDecimal totalAllocated = BigDecimal.ZERO;
    BigDecimal totalWork = BigDecimal.ZERO;
    BigDecimal scoreSum = BigDecimal.ZERO;
    int count = rows.size();
    int targetCount = 0;

    for (Map<String, Object> row : rows) {
      BigDecimal target = new BigDecimal(row.get("TargetAchievedPercent").toString());
      totalTarget = totalTarget.add(target);
      // Dept 54: consider ALL rows (0-target days included in the denominator)
      Object deptObj = row.get("DepartmentID");
      boolean isDept54 = deptObj != null && Integer.valueOf(54).equals(deptObj);
      if (isDept54 || target.compareTo(BigDecimal.ZERO) > 0) {
        targetCount++;
      }
      totalUtil = totalUtil.add(new BigDecimal(row.get("UtilizationPercent").toString()));
      totalAllocated = totalAllocated.add(new BigDecimal(row.get("AllocatedTimeHrs").toString()));
      totalWork = totalWork.add(new BigDecimal(row.get("TotalTimeOfWork").toString()));
      scoreSum = scoreSum.add(levelToScore(row.get("EfficiencyLevel")));
    }

    result.put("AvgTargetPercent",
        targetCount > 0
            ? totalTarget.divide(BigDecimal.valueOf(targetCount), 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO);
    result.put("AvgUtilizationPercent",
        totalUtil.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP));
    result.put("AvgAllocatedHrs",
        totalAllocated.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP));
    result.put("AvgTotalWork",
        totalWork.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP));

    double avgScore = scoreSum.divide(BigDecimal.valueOf(count), 4, RoundingMode.HALF_UP).doubleValue();
    result.put("EfficiencyLevel", avgScore >= 2.5 ? "High" : avgScore >= 1.5 ? "At Par" : "Low");
    result.put("_score", BigDecimal.valueOf(avgScore));
    return result;
  }

  /**
   * DEPARTMENT / EL / COMPANY LEVEL — averages a list of already-averaged maps
   * (output of computeRowAverages or a prior call to averageOfMaps).
   * Keys read: AvgTargetPercent, AvgUtilizationPercent, AvgAllocatedHrs,
   * AvgTotalWork, _score / EfficiencyLevel
   * Keys written: same as computeRowAverages output.
   */
  private Map<String, Object> averageOfMaps(List<Map<String, Object>> items) {
    Map<String, Object> result = new HashMap<>();

    if (items == null || items.isEmpty()) {
      result.put("AvgTargetPercent", BigDecimal.ZERO);
      result.put("AvgUtilizationPercent", BigDecimal.ZERO);
      result.put("AvgAllocatedHrs", BigDecimal.ZERO);
      result.put("AvgTotalWork", BigDecimal.ZERO);
      result.put("EfficiencyLevel", "Low");
      result.put("_score", BigDecimal.ZERO);
      return result;
    }

    BigDecimal totalTarget = BigDecimal.ZERO;
    BigDecimal totalUtil = BigDecimal.ZERO;
    BigDecimal totalAllocated = BigDecimal.ZERO;
    BigDecimal totalWork = BigDecimal.ZERO;
    BigDecimal scoreSum = BigDecimal.ZERO;
    int count = items.size();
    int targetCount = 0;

    for (Map<String, Object> item : items) {
      BigDecimal target = new BigDecimal(item.get("AvgTargetPercent").toString());
      totalTarget = totalTarget.add(target);
      if (target.compareTo(BigDecimal.ZERO) > 0) {
        targetCount++;
      }
      totalUtil = totalUtil.add(new BigDecimal(item.get("AvgUtilizationPercent").toString()));
      totalAllocated = totalAllocated.add(new BigDecimal(item.get("AvgAllocatedHrs").toString()));
      totalWork = totalWork.add(new BigDecimal(item.get("AvgTotalWork").toString()));

      BigDecimal score = item.get("_score") != null
          ? new BigDecimal(item.get("_score").toString())
          : levelToScore(item.get("EfficiencyLevel"));
      scoreSum = scoreSum.add(score);
    }

    result.put("AvgTargetPercent",
        targetCount > 0
            ? totalTarget.divide(BigDecimal.valueOf(targetCount), 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO);
    result.put("AvgUtilizationPercent",
        totalUtil.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP));
    result.put("AvgAllocatedHrs",
        totalAllocated.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP));
    result.put("AvgTotalWork",
        totalWork.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP));

    double avgScore = scoreSum.divide(BigDecimal.valueOf(count), 4, RoundingMode.HALF_UP).doubleValue();
    result.put("EfficiencyLevel", avgScore >= 2.5 ? "High" : avgScore >= 1.5 ? "At Par" : "Low");
    result.put("_score", BigDecimal.valueOf(avgScore));
    return result;
  }

  /**
   * Extracts the EL ID from either the static ELID field on the filter
   * or from the dynamic filters list (field = "EL" / "ExecutiveLeader").
   */
  private Integer extractElId(EfficiencySummaryFilterRequest filter) {
    if (filter.getELID() != null && filter.getELID() != 0) {
      return filter.getELID();
    }
    if (filter.getFilters() != null) {
      for (EfficiencySummaryFilterRequest.Filter f : filter.getFilters()) {
        if ("EL".equalsIgnoreCase(f.getField())
            || "ExecutiveLeader".equalsIgnoreCase(f.getField())) {
          try {
            return Integer.parseInt(f.getValue());
          } catch (NumberFormatException ignored) {
          }
        }
      }
    }
    return null;
  }

  // =========================================================================
  // EXISTING METHODS (unchanged)
  // =========================================================================

  public Map<String, Object> getEfficiencyAndUtilization(EfficiencyReportRequest request) {
    Map<String, Object> response = new LinkedHashMap<>();

    String departmentName = departmentRepository.findDepartmentNameByID(request.getDepartmentId());
    if (departmentName == null) {
      response.put("status", false);
      response.put("message", "Invalid department ID");
      return response;
    }

    String dailyTaskTable = departmentName + "_DailyTaskLog";
    String efficiencyTable = departmentName + "_EfficiencySummary";

    StringBuilder sql = new StringBuilder();
    sql.append("SELECT l.UserID, u.UserName, SUM(l.actualTimeOfWork) AS totalActual, ")
        .append("SUM(t.StandardTimeMins) AS totalStandard ")
        .append("FROM ").append(dailyTaskTable).append(" l ")
        .append("JOIN DepartmentTask t ON l.TaskID = t.TaskID ")
        .append("JOIN Users u ON l.UserID = u.UserID ")
        .append("WHERE t.IsDynamic = FALSE ");

    List<Object> params = new ArrayList<>();

    if (request.getStartDate() != null && request.getEndDate() != null) {
      sql.append("AND l.WorkDate BETWEEN ? AND ? ");
      params.add(java.sql.Date.valueOf(request.getStartDate()));
      params.add(java.sql.Date.valueOf(request.getEndDate()));
    }

    if (request.getUserId() != null && request.getUserId() != 0) {
      sql.append("AND l.UserID = ? ");
      params.add(request.getUserId());
    }

    sql.append("GROUP BY l.UserID, u.UserName");

    List<Map<String, Object>> efficiencyList = jdbcTemplate.queryForList(sql.toString(), params.toArray());

    for (Map<String, Object> row : efficiencyList) {
      BigDecimal totalActual = new BigDecimal(row.get("totalActual").toString());
      BigDecimal totalStandard = new BigDecimal(row.get("totalStandard").toString());

      BigDecimal efficiencyPercent = BigDecimal.ZERO;
      if (totalStandard.compareTo(BigDecimal.ZERO) > 0) {
        efficiencyPercent = totalActual
            .divide(totalStandard, 2, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100));
      }
      row.put("EfficiencyPercent", efficiencyPercent);
    }

    StringBuilder utilSql = new StringBuilder();
    utilSql.append("SELECT e.UserID, u.UserName, SUM(e.AllocatedTimeHrs) AS totalAllocated ")
        .append("FROM ").append(efficiencyTable).append(" e ")
        .append("JOIN Users u ON e.UserID = u.UserID WHERE 1=1 ");

    List<Object> utilParams = new ArrayList<>();

    if (request.getStartDate() != null && request.getEndDate() != null) {
      utilSql.append("AND e.WorkDate BETWEEN ? AND ? ");
      utilParams.add(java.sql.Date.valueOf(request.getStartDate()));
      utilParams.add(java.sql.Date.valueOf(request.getEndDate()));
    }
    if (request.getUserId() != null && request.getUserId() != 0) {
      utilSql.append("AND e.UserID = ? ");
      utilParams.add(request.getUserId());
    }

    utilSql.append("GROUP BY e.UserID, u.UserName");

    List<Map<String, Object>> utilizationList = jdbcTemplate.queryForList(utilSql.toString(), utilParams.toArray());

    for (Map<String, Object> row : utilizationList) {
      BigDecimal totalAllocated = new BigDecimal(row.get("totalAllocated").toString());
      BigDecimal utilizationPercent = totalAllocated
          .divide(BigDecimal.valueOf(8), 2, RoundingMode.HALF_UP)
          .multiply(BigDecimal.valueOf(100));
      row.put("UtilizationPercent", utilizationPercent);
    }

    Map<Integer, Map<String, Object>> merged = new LinkedHashMap<>();
    efficiencyList.forEach(e -> merged.put((Integer) e.get("UserID"), e));

    for (Map<String, Object> u : utilizationList) {
      Integer uid = (Integer) u.get("UserID");
      Map<String, Object> target = merged.computeIfAbsent(uid, k -> new LinkedHashMap<>());
      target.put("UserName", u.get("UserName"));
      target.put("UtilizationPercent", u.get("UtilizationPercent"));
    }

    if (request.getUserId() == 0) {
      BigDecimal totalEff = BigDecimal.ZERO;
      BigDecimal totalUtil = BigDecimal.ZERO;
      int count = merged.size();

      for (Map<String, Object> val : merged.values()) {
        totalEff = totalEff.add((BigDecimal) val.getOrDefault("EfficiencyPercent", BigDecimal.ZERO));
        totalUtil = totalUtil.add((BigDecimal) val.getOrDefault("UtilizationPercent", BigDecimal.ZERO));
      }

      BigDecimal avgEff = count > 0
          ? totalEff.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)
          : BigDecimal.ZERO;
      BigDecimal avgUtil = count > 0
          ? totalUtil.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)
          : BigDecimal.ZERO;

      response.put("DepartmentAverage", Map.of(
          "AverageEfficiency", avgEff,
          "AverageUtilization", avgUtil));
    }

    response.put("status", true);
    response.put("data", merged.values());
    return response;
  }

  @Transactional
  public void calculateEfficiencySummaryForDept28(LocalDate workDate) {
    int departmentId = 28;
    String departmentName = departmentRepository.findDepartmentNameByID(departmentId);
    if (departmentName == null) {
      throw new RuntimeException("Department not found for ID 28");
    }

    String dailyTable = departmentName + "_DailyTaskLog";
    String efficiencyTable = departmentName + "_EfficiencySummary";

    String sql = """
            SELECT l.UserID, l.WorkDate, l.DataPercentage, t.TargetNumber, t.IsForTarget
            FROM %s l
            JOIN DepartmentTask t ON l.TaskID = t.TaskID
            WHERE l.DepartmentID = ? AND t.IsForTarget = TRUE
        """.formatted(dailyTable);

    List<Map<String, Object>> records = jdbcTemplate.queryForList(sql, departmentId);

    for (Map<String, Object> row : records) {
      Integer userId = (Integer) row.get("UserID");
      BigDecimal dataPerc = new BigDecimal(Optional.ofNullable(row.get("DataPercentage")).orElse("0").toString());
      BigDecimal targetNum = new BigDecimal(Optional.ofNullable(row.get("TargetNumber")).orElse("0").toString());

      BigDecimal efficiencyPercent = BigDecimal.ZERO;
      if (targetNum.compareTo(BigDecimal.ZERO) > 0) {
        efficiencyPercent = dataPerc.divide(targetNum, 2, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100));
      }

      String level = "Low";
      if (efficiencyPercent.compareTo(BigDecimal.valueOf(90)) >= 0) {
        level = "High";
      } else if (efficiencyPercent.compareTo(BigDecimal.valueOf(70)) >= 0) {
        level = "Medium";
      }

      String upsert = """
              INSERT INTO %s (UserID, WorkDate, TargetAchievedPercent, EfficiencyLevel, CreatedAt, UpdatedAt)
              VALUES (?, ?, ?, ?, NOW(), NOW())
              ON DUPLICATE KEY UPDATE
                  TargetAchievedPercent = VALUES(TargetAchievedPercent),
                  EfficiencyLevel = VALUES(EfficiencyLevel),
                  UpdatedAt = NOW()
          """.formatted(efficiencyTable);

      jdbcTemplate.update(upsert, userId, row.get("WorkDate"), efficiencyPercent, level);
    }
  }

  @Transactional
  public void updateEfficiencySummaryForDept28(LocalDate workDate) {
    int departmentId = 28;
    String departmentName = departmentRepository.findDepartmentNameByID(departmentId);
    if (departmentName == null) {
      throw new RuntimeException("Department not found for ID 28");
    }

    try {
      String sql = """
              SELECT l.UserID, l.WorkDate, l.DataPercentage, t.TargetNumber
              FROM AgencyOperationsCuration_DailyTaskLog l
              JOIN DepartmentTask t ON l.TaskID = t.TaskID
              WHERE t.DepartmentID = ? AND t.IsForTarget = TRUE AND l.WorkDate = ?
          """;

      List<Map<String, Object>> records = jdbcTemplate.queryForList(sql, departmentId, workDate);

      for (Map<String, Object> row : records) {
        Integer userId = (Integer) row.get("UserID");
        LocalDate date = ((Date) row.get("WorkDate")).toLocalDate();

        String dataPercentStr = Optional.ofNullable(row.get("DataPercentage"))
            .map(Object::toString).orElse("0").replace("%", "").trim();
        String targetNumStr = Optional.ofNullable(row.get("TargetNumber"))
            .map(Object::toString).orElse("0").trim();

        BigDecimal dataPerc = new BigDecimal(dataPercentStr);
        BigDecimal targetNum = new BigDecimal(targetNumStr);

        BigDecimal efficiencyPercent = BigDecimal.ZERO;
        if (targetNum.compareTo(BigDecimal.ZERO) > 0) {
          efficiencyPercent = dataPerc.divide(targetNum, 2, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100));
        }

        String efficiencyLevel;
        if (efficiencyPercent.compareTo(BigDecimal.valueOf(100)) > 0) {
          efficiencyLevel = "High";
        } else if (efficiencyPercent.compareTo(BigDecimal.valueOf(90)) >= 0) {
          efficiencyLevel = "At Par";
        } else if (efficiencyPercent.compareTo(BigDecimal.valueOf(70)) >= 0) {
          efficiencyLevel = "Medium";
        } else {
          efficiencyLevel = "Low";
        }

        String upsertSql = """
                INSERT INTO AgencyOperationsCuration_EfficiencySummary
                    (UserID, WorkDate, TargetAchievedPercent, EfficiencyLevel, CreatedAt, UpdatedAt)
                VALUES (?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    TargetAchievedPercent = VALUES(TargetAchievedPercent),
                    EfficiencyLevel = VALUES(EfficiencyLevel),
                    UpdatedAt = NOW()
            """;

        jdbcTemplate.update(upsertSql, userId, date, efficiencyPercent, efficiencyLevel);
      }

      System.out.printf("✅ Efficiency Summary updated successfully for Department 28 on %s%n", workDate);

    } catch (Exception e) {
      e.printStackTrace();
      throw new RuntimeException("Error updating Efficiency Summary: " + e.getMessage());
    }
  }

  private void attachLeaveType(List<Map<String, Object>> dataList) {
    if (dataList == null || dataList.isEmpty())
      return;

    String sql = """
            SELECT UserID, WorkDate, LeaveType
            FROM UserWorkData
            WHERE UserID = ? AND WorkDate = ?
        """;

    for (Map<String, Object> row : dataList) {
      Integer userId = (Integer) row.get("UserID");
      Object dateObj = row.get("WorkDate");
      LocalDate workDate = (dateObj instanceof Date)
          ? ((Date) dateObj).toLocalDate()
          : LocalDate.parse(dateObj.toString());

      List<Map<String, Object>> result = jdbcTemplate.queryForList(sql, userId, workDate);
      String leaveType = null;
      if (!result.isEmpty()) {
        leaveType = (String) result.get(0).get("LeaveType");
      }
      row.put("LeaveType", leaveType);
    }
  }

  private void attachGoalPercent(List<Map<String, Object>> dataList) {
    if (dataList == null || dataList.isEmpty())
      return;

    // Generic: average of (AchievedGoal/effectiveGoal)*100 per day
    String sqlGeneric = """
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

    // Dept 19 specific goal IDs
    String sql19 = """
            SELECT
                COALESCE(SUM(CASE WHEN GoalID = 67 THEN AchievedGoal ELSE 0 END),0) AS goal67,
                COALESCE(SUM(CASE WHEN GoalID = 68 THEN AchievedGoal ELSE 0 END),0) AS goal68,
                COALESCE(SUM(CASE WHEN GoalID = 67 THEN FixedGoal   ELSE 0 END),0) AS fixed67,
                COALESCE(SUM(CASE WHEN GoalID = 68 THEN FixedGoal   ELSE 0 END),0) AS fixed68
            FROM UserGoalData
            WHERE UserID = ?
              AND WorkDate = ?
        """;

    // Dept 37: AchievedGoal / (TaskID=65 units * 0.7) * 100, per day
    String sql37 = """
            SELECT ROUND(
                SUM(ug.AchievedGoal) * 100.0 /
                NULLIF(SUM(COALESCE(uwd.totalUnits, 0) * 0.7), 0),
                2
            ) AS GoalPercent
            FROM UserGoalData ug
            LEFT JOIN (
                SELECT
                    UserID,
                    WorkDate,
                    DepartmentID,
                    SUM(AchivedUnits) AS totalUnits
                FROM UserWorkData
                WHERE TaskID = 65
                GROUP BY UserID, WorkDate, DepartmentID
            ) uwd
              ON ug.UserID  = uwd.UserID
             AND ug.WorkDate = uwd.WorkDate
             AND ug.DepartmentID = uwd.DepartmentID
            WHERE ug.UserID = ?
              AND ug.DepartmentID = 37
              AND ug.WorkDate = ?
        """;

    // Dept 21: AchievedGoal / (all units * 0.7) * 100, per day
    String sql21 = """
            SELECT ROUND(
                SUM(ug.AchievedGoal) * 100.0 /
                NULLIF(SUM(COALESCE(uwd.totalUnits, 0) * 0.7), 0),
                2
            ) AS GoalPercent
            FROM UserGoalData ug
            LEFT JOIN (
                SELECT
                    UserID,
                    WorkDate,
                    DepartmentID,
                    SUM(AchivedUnits) AS totalUnits
                FROM UserWorkData
                GROUP BY UserID, WorkDate, DepartmentID
            ) uwd
              ON ug.UserID     = uwd.UserID
             AND ug.WorkDate   = uwd.WorkDate
             AND ug.DepartmentID = uwd.DepartmentID
            WHERE ug.UserID = ?
              AND ug.DepartmentID = 21
              AND ug.WorkDate = ?
        """;

    // Dept 22: dept-22 rule from UserGoalData per day
    // (AchievedGoal < 40 → 100, else 100 - FLOOR((AchievedGoal - 40) / 10) * 10)
    String sql22 = """
            SELECT
                COALESCE(
                    ROUND(AVG(
                        CASE
                          WHEN ug.AchievedGoal < 40 THEN 100
                          ELSE GREATEST(
                              100 - (FLOOR((ug.AchievedGoal - 40) / 10) * 10),
                              0
                          )
                        END
                    ), 2),
                    0
                ) AS GoalPercent
            FROM UserGoalData ug
            WHERE ug.UserID = ?
              AND ug.DepartmentID = 22
              AND ug.WorkDate = ?
        """;

    for (Map<String, Object> row : dataList) {
      Integer userId = (Integer) row.get("UserID");
      Integer departmentId = (Integer) row.get("DepartmentID");
      Object dateObj = row.get("WorkDate");
      LocalDate workDate = (dateObj instanceof Date)
          ? ((Date) dateObj).toLocalDate()
          : LocalDate.parse(dateObj.toString());

      BigDecimal goalPercent = BigDecimal.ZERO;

      // ── Department 19 ──────────────────────────────────────────────────
      if (departmentId != null && departmentId == 19) {
        Map<String, Object> goalMap = jdbcTemplate.queryForMap(sql19, userId, workDate);
        BigDecimal fixed67 = new BigDecimal(goalMap.get("fixed67").toString());
        BigDecimal fixed68 = new BigDecimal(goalMap.get("fixed68").toString());

        if (fixed67.add(fixed68).compareTo(BigDecimal.ZERO) == 0) {
          // Old records → generic formula
          List<Map<String, Object>> result = jdbcTemplate.queryForList(sqlGeneric, userId, workDate);
          if (!result.isEmpty() && result.get(0).get("GoalPercent") != null) {
            goalPercent = new BigDecimal(result.get(0).get("GoalPercent").toString());
          }
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
        row.put("GoalPercent", goalPercent);
        continue;
      }

      // ── Department 7 ───────────────────────────────────────────────────
      if (departmentId != null && departmentId == 7) {
        row.put("GoalPercent", BigDecimal.valueOf(100));
        continue;
      }

      // ── Department 37 ──────────────────────────────────────────────────
      if (departmentId != null && departmentId == 37) {
        List<Map<String, Object>> result = jdbcTemplate.queryForList(sql37, userId, workDate);
        if (!result.isEmpty() && result.get(0).get("GoalPercent") != null) {
          goalPercent = new BigDecimal(result.get(0).get("GoalPercent").toString());
        }
        row.put("GoalPercent", goalPercent);
        continue;
      }

      // ── Department 21 ──────────────────────────────────────────────────
      if (departmentId != null && departmentId == 21) {
        List<Map<String, Object>> result = jdbcTemplate.queryForList(sql21, userId, workDate);
        if (!result.isEmpty() && result.get(0).get("GoalPercent") != null) {
          goalPercent = new BigDecimal(result.get(0).get("GoalPercent").toString());
        }
        row.put("GoalPercent", goalPercent);
        continue;
      }

      // ── Department 22 ──────────────────────────────────────────────────
      if (departmentId != null && departmentId == 22) {
        List<Map<String, Object>> result = jdbcTemplate.queryForList(sql22, userId, workDate);
        if (!result.isEmpty() && result.get(0).get("GoalPercent") != null) {
          goalPercent = new BigDecimal(result.get(0).get("GoalPercent").toString());
        }
        row.put("GoalPercent", goalPercent);
        continue;
      }

      // ── All other departments ───────────────────────────────────────────

      // ── isForTarget users (130, 97, 118) — GoalPercent = TargetAchievedPercent ──
      if (userId != null && (userId == 130 || userId == 97 || userId == 118)) {
        Object targetObj = row.get("TargetAchievedPercent");
        if (targetObj != null) {
          goalPercent = new BigDecimal(targetObj.toString());
        }
        row.put("GoalPercent", goalPercent);
        continue;
      }

      // ── User 158 (dept 42): GoalPercent = TargetAchievedPercent — only Apr-Jun 2026 ──
      if (userId != null && userId == 158 && departmentId != null && departmentId == 42
          && !workDate.isBefore(LocalDate.of(2026, 4, 1))
          && !workDate.isAfter(LocalDate.of(2026, 6, 30))) {
        Object targetObj = row.get("TargetAchievedPercent");
        if (targetObj != null) {
          goalPercent = new BigDecimal(targetObj.toString());
        }
        row.put("GoalPercent", goalPercent);
        continue;
      }

      List<Map<String, Object>> result = jdbcTemplate.queryForList(sqlGeneric, userId, workDate);
      if (!result.isEmpty() && result.get(0).get("GoalPercent") != null) {
        goalPercent = new BigDecimal(result.get(0).get("GoalPercent").toString());
      }
      row.put("GoalPercent", goalPercent);
    }
  }

  private long getWorkingDays(LocalDate start, LocalDate end) {
    long days = 0;
    while (!start.isAfter(end)) {
      if (start.getDayOfWeek() != DayOfWeek.SATURDAY
          && start.getDayOfWeek() != DayOfWeek.SUNDAY) {
        days++;
      }
      start = start.plusDays(1);
    }
    return days;
  }

  private List<Map<String, Object>> applyUserLevelFilter(
      List<Map<String, Object>> list,
      EfficiencySummaryFilterRequest.Filter f) {

    switch (f.getField()) {

      case "Target Achieved":
        return filterNumeric(
            list,
            "AvgTargetPercent",
            f);

      case "Goal Achieved":
        return filterNumeric(
            list,
            "AvgGoalPercent",
            f);

      case "Utilization":
        return filterNumeric(
            list,
            "AvgUtilizationPercent",
            f);

      case "Efficiency":

        return list.stream()
            .filter(r -> r.get("EfficiencyLevel")
                .toString()
                .equalsIgnoreCase(f.getValue()))
            .collect(Collectors.toList());

      case "Name":

        return list.stream()
            .filter(r -> r.get("UserName")
                .toString()
                .toLowerCase()
                .contains(f.getValue().toLowerCase()))
            .collect(Collectors.toList());

      case "Department":

        return list.stream()
            .filter(r -> r.get("DepartmentName")
                .toString()
                .toLowerCase()
                .contains(f.getValue().toLowerCase()))
            .collect(Collectors.toList());

      default:
        return list;
    }
  }

  private List<Map<String, Object>> filterNumeric(
      List<Map<String, Object>> list,
      String field,
      EfficiencySummaryFilterRequest.Filter f) {

    BigDecimal value;
    try {
      value = new BigDecimal(f.getValue());
    } catch (NumberFormatException e) {
      return list;
    }

    return list.stream()
        .filter(row -> {
          Object raw = row.getOrDefault(field, BigDecimal.ZERO);
          BigDecimal rowVal = new BigDecimal(raw.toString());
          return switch (f.getOperator()) {
            case ">" -> rowVal.compareTo(value) > 0;
            case "<" -> rowVal.compareTo(value) < 0;
            case ">=" -> rowVal.compareTo(value) >= 0;
            case "<=" -> rowVal.compareTo(value) <= 0;
            case "=" -> rowVal.compareTo(value) == 0;
            default -> true;
          };
        })
        .collect(Collectors.toList());
  }

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

        System.out.println("\n========== TAM TARGET DEBUG ==========");
        System.out.println("User ID      : " + userId);
        System.out.println("Work Date    : " + workDate);
        System.out.println("Achieved92   : " + achieved92);
        System.out.println("Units92      : " + units92);
        System.out.println("Task92 %     : " + task92Percent);
        System.out.println("Achieved93   : " + achieved93);
        System.out.println("Units93      : " + units93);
        System.out.println("Task93 %     : " + task93Percent);
        System.out.println("TAM %        : " + tamPercent);
        System.out.println("Total        : " + total);
        System.out.println("Divisor      : " + divisor);
        System.out.println("Final %      : " + finalPercent);
        System.out.println("=====================================\n");

        row.put("TargetAchievedPercent", finalPercent);
      }

      // Dept 22: TargetAchievedPercent = GoalPercent (dept-22 rule) so the
      // target column matches the goal / avgPercent — only Apr-Jun 2026
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

  // EL-approved RevisedTarget on any UserWorkData row of that user+day becomes
  // the effective target of that day:
  //   * the day's TargetAchievedPercent is RECOMPUTED against the revised
  //     target (achieved units * 100 / revised target) - the same rule the
  //     goal side applies to an EL-approved RevisedGoal (achieved * 100 /
  //     revised goal). Falls back to EfficiencyUtilizationSummary when there
  //     is no approved revision (or no achieved units to compare against).
  //   * the revision itself is attached to the row (revisedTarget /
  //     revisedTargetValue) so the UI can render it the way it renders
  //     revisedGoal on the goal list.
  // Monthly/summary averages pick the recomputed value up because they are
  // computed from these rows afterwards.
  private void attachRevisedTargetPercent(List<Map<String, Object>> dataList) {
    if (dataList == null || dataList.isEmpty())
      return;

    Set<Integer> userIds = new LinkedHashSet<>();
    LocalDate minDate = null;
    LocalDate maxDate = null;
    for (Map<String, Object> row : dataList) {
      Object userObj = row.get("UserID");
      Integer userId = userObj == null ? null : ((Number) userObj).intValue();
      Object dateObj = row.get("WorkDate");
      if (userId == null || dateObj == null)
        continue;
      LocalDate workDate = (dateObj instanceof Date)
          ? ((Date) dateObj).toLocalDate()
          : LocalDate.parse(dateObj.toString());
      userIds.add(userId);
      if (minDate == null || workDate.isBefore(minDate))
        minDate = workDate;
      if (maxDate == null || workDate.isAfter(maxDate))
        maxDate = workDate;
    }
    if (userIds.isEmpty() || minDate == null)
      return;

    String inClause = userIds.stream().map(id -> "?").collect(Collectors.joining(","));

    // EL-approved revisions of the requested users/dates (lowest row id wins).
    String revisionSql = """
            SELECT uwd.UserID,
                   uwd.WorkDate,
                   uwd.RevisedTarget,
                   CAST(JSON_EXTRACT(uwd.RevisedTarget, '$.value') AS DECIMAL(10,2)) AS revisedValue
            FROM UserWorkData uwd
            WHERE uwd.UserID IN (%s)
              AND uwd.WorkDate BETWEEN ? AND ?
              AND uwd.RevisedTarget IS NOT NULL
              AND uwd.RevisedTarget != ''
              AND JSON_UNQUOTE(JSON_EXTRACT(uwd.RevisedTarget, '$.elApproved')) = 'true'
              AND JSON_UNQUOTE(JSON_EXTRACT(uwd.RevisedTarget, '$.value')) IS NOT NULL
            ORDER BY uwd.DailyTaskLogID
        """.formatted(inClause);

    List<Object> revisionParams = new ArrayList<>(userIds);
    revisionParams.add(Date.valueOf(minDate));
    revisionParams.add(Date.valueOf(maxDate));

    Map<String, Map<String, Object>> revisionByUserDate = new HashMap<>();
    for (Map<String, Object> revision : jdbcTemplate.queryForList(revisionSql, revisionParams.toArray())) {
      Integer userId = ((Number) revision.get("UserID")).intValue();
      LocalDate workDate = toLocalDate(revision.get("WorkDate"));
      revisionByUserDate.putIfAbsent(userId + "|" + workDate, revision);
    }
    if (revisionByUserDate.isEmpty())
      return;

    // Target/achieved units of the target rows - the original target and the
    // numerator of the recomputed %.
    String achievedSql = """
            SELECT uwd.UserID,
                   uwd.DepartmentID,
                   uwd.WorkDate,
                   COALESCE(SUM(uwd.Units), 0) AS targetUnits,
                   COALESCE(SUM(uwd.AchivedUnits), 0) AS achievedUnits
            FROM UserWorkData uwd
            WHERE uwd.UserID IN (%s)
              AND uwd.WorkDate BETWEEN ? AND ?
              AND uwd.IsForTarget = 1
            GROUP BY uwd.UserID, uwd.DepartmentID, uwd.WorkDate
        """.formatted(inClause);

    List<Object> achievedParams = new ArrayList<>(userIds);
    achievedParams.add(Date.valueOf(minDate));
    achievedParams.add(Date.valueOf(maxDate));

    Map<String, BigDecimal> achievedByUserDeptDate = new HashMap<>();
    Map<String, BigDecimal> achievedByUserDate = new HashMap<>();
    Map<String, BigDecimal> targetUnitsByUserDeptDate = new HashMap<>();
    for (Map<String, Object> achieved : jdbcTemplate.queryForList(achievedSql, achievedParams.toArray())) {
      Integer userId = ((Number) achieved.get("UserID")).intValue();
      Object deptObj = achieved.get("DepartmentID");
      Integer deptId = deptObj == null ? null : ((Number) deptObj).intValue();
      LocalDate workDate = toLocalDate(achieved.get("WorkDate"));
      BigDecimal units = new BigDecimal(achieved.get("achievedUnits").toString());
      if (deptId != null) {
        achievedByUserDeptDate.put(userId + "|" + deptId + "|" + workDate, units);
        targetUnitsByUserDeptDate.put(userId + "|" + deptId + "|" + workDate,
            new BigDecimal(achieved.get("targetUnits").toString()));
      }
      achievedByUserDate.merge(userId + "|" + workDate, units, BigDecimal::add);
    }

    for (Map<String, Object> row : dataList) {
      Object userObj = row.get("UserID");
      Integer userId = userObj == null ? null : ((Number) userObj).intValue();
      Object dateObj = row.get("WorkDate");
      if (userId == null || dateObj == null)
        continue;

      LocalDate workDate = (dateObj instanceof Date)
          ? ((Date) dateObj).toLocalDate()
          : LocalDate.parse(dateObj.toString());

      Map<String, Object> revision = revisionByUserDate.get(userId + "|" + workDate);
      if (revision == null || revision.get("revisedValue") == null)
        continue;

      BigDecimal revisedTarget = new BigDecimal(revision.get("revisedValue").toString());
      row.put("revisedTarget", parseRevisedTarget((String) revision.get("RevisedTarget")));
      row.put("revisedTargetValue", revisedTarget);

      if (revisedTarget.compareTo(BigDecimal.ZERO) <= 0)
        continue;

      Object deptObj = row.get("DepartmentID");
      String deptKey = deptObj == null ? "" : String.valueOf(((Number) deptObj).intValue());
      BigDecimal achieved = achievedByUserDeptDate.get(userId + "|" + deptKey + "|" + workDate);
      BigDecimal targetUnits = targetUnitsByUserDeptDate.get(userId + "|" + deptKey + "|" + workDate);
      if (achieved == null)
        achieved = achievedByUserDate.get(userId + "|" + workDate);
      if (achieved == null || achieved.compareTo(BigDecimal.ZERO) <= 0)
        continue;

      // Original (pre-revision) numbers, so the UI can show "15 -> 76" the way
      // it shows "fixedGoal -> revisedGoal" on the goal list.
      Object originalPercent = row.get("TargetAchievedPercent");
      if (originalPercent != null)
        row.put("originalTargetAchievedPercent", new BigDecimal(originalPercent.toString()));
      row.put("targetUnits", targetUnits);
      row.put("achievedUnits", achieved);

      row.put("TargetAchievedPercent", achieved
          .multiply(BigDecimal.valueOf(100))
          .divide(revisedTarget, 2, RoundingMode.HALF_UP));
    }
  }

  private LocalDate toLocalDate(Object dateObj) {
    return (dateObj instanceof Date)
        ? ((Date) dateObj).toLocalDate()
        : LocalDate.parse(dateObj.toString());
  }

  private RevisedTargetDetailsDTO parseRevisedTarget(String json) {
    if (json == null || json.isBlank()) {
      return null;
    }
    try {
      return new ObjectMapper().readValue(json, RevisedTargetDetailsDTO.class);
    } catch (Exception e) {
      return null;
    }
  }

  private RevisedGoalDetailsDTO parseRevisedGoal(String json) {
    if (json == null || json.isBlank()) {
      return null;
    }
    try {
      return new ObjectMapper().readValue(json, RevisedGoalDetailsDTO.class);
    } catch (Exception e) {
      return null;
    }
  }

  // =========================================================================
  // listEfficiencySummary — with hierarchical summary rollup
  // =========================================================================

  @Transactional(readOnly = true)
  public Map<String, Object> listEfficiencySummary(EfficiencySummaryFilterRequest filter) {

    StringBuilder sql = new StringBuilder();
    List<Object> params = new ArrayList<>();

    sql.append("""
            SELECT
                e.UserID,
                u.UserName,
                e.DepartmentID,
                d.DepartmentName,
        """);

    String groupBy = filter.getGroupBy() == null ? "day" : filter.getGroupBy().toLowerCase();

    switch (groupBy) {
      case "week":
        sql.append("""
                YEAR(e.WorkDate) AS Year,
                WEEK(e.WorkDate, 1) AS WeekNumber,
                ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
                ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
                ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
                ROUND(AVG(e.TotalTimeOfWork),2) AS TotalTimeOfWork,
                MAX(e.EfficiencyLevel) AS EfficiencyLevel
                FROM EfficiencyUtilizationSummary e
                JOIN Users u ON e.UserID = u.UserID
                JOIN Department d ON e.DepartmentID = d.DepartmentID
                WHERE 1=1
            """);
        break;

      case "month":
        sql.append("""
                YEAR(e.WorkDate) AS Year,
                MONTH(e.WorkDate) AS MonthNumber,
                ROUND(AVG(e.TargetAchievedPercent),2) AS AvgTargetPercent,
                ROUND(AVG(e.UtilizationPercent),2) AS AvgUtilizationPercent,
                ROUND(AVG(e.AllocatedTimeHrs),2) AS AvgAllocatedHrs,
                ROUND(AVG(e.TotalTimeOfWork),2) AS TotalTimeOfWork,
                MAX(e.EfficiencyLevel) AS EfficiencyLevel
                FROM EfficiencyUtilizationSummary e
                JOIN Users u ON e.UserID = u.UserID
                JOIN Department d ON e.DepartmentID = d.DepartmentID
                WHERE 1=1
            """);
        break;

      default: // DAY
        sql.append("""
                e.WorkDate,
                e.TargetAchievedPercent,
                e.UtilizationPercent,
                e.AllocatedTimeHrs,
                e.TotalTimeOfWork,
                e.EfficiencyLevel
                FROM EfficiencyUtilizationSummary e
                JOIN Users u ON e.UserID = u.UserID
                JOIN Department d ON e.DepartmentID = d.DepartmentID
                WHERE 1=1
            """);
        break;
    }

    // COMMON FILTERS
    if (filter.getStartDate() != null
        && filter.getEndDate() != null
        && !filter.getStartDate().toString().trim().isEmpty()
        && !filter.getEndDate().toString().trim().isEmpty()) {
      sql.append(" AND e.WorkDate BETWEEN ? AND ? ");
      params.add(Date.valueOf(filter.getStartDate()));
      params.add(Date.valueOf(filter.getEndDate()));
    }

    if (filter.getUserID() != null && filter.getUserID() != 0) {
      sql.append(" AND e.UserID = ? ");
      params.add(filter.getUserID());
    }

    if (filter.getDepartmentID() != null && filter.getDepartmentID() != 0) {
      sql.append(" AND e.DepartmentID = ? ");
      params.add(filter.getDepartmentID());
    }

    if (filter.getELID() != null && filter.getELID() != 0) {
      sql.append("""
              AND e.DepartmentID IN (
                  SELECT d2.DepartmentID
                  FROM Department d2
                  WHERE d2.ExecutiveLeaderID = ?
              )
          """);
      params.add(filter.getELID());
    }

    if (filter.getEfficiencyLevel() != null && !filter.getEfficiencyLevel().isBlank()) {
      sql.append(" AND e.EfficiencyLevel = ? ");
      params.add(filter.getEfficiencyLevel());
    }

    // Dynamic Filters
    if (filter.getFilters() != null && !filter.getFilters().isEmpty()) {
      for (EfficiencySummaryFilterRequest.Filter f : filter.getFilters()) {
        String column = null;
        switch (f.getField()) {
          case "Name":
            column = "u.UserName";
            break;
          case "Department":
            column = "d.DepartmentName";
            break;
          case "EL":
          case "ExecutiveLeader":
            sql.append("""
                    AND e.DepartmentID IN (
                        SELECT d3.DepartmentID
                        FROM Department d3
                        WHERE d3.ExecutiveLeaderID = ?
                    )
                """);
            params.add(f.getValue());
            continue;
          case "Target Achieved":

          case "Utilization":

          case "Efficiency":

          case "Goal Achieved":
            continue;
          default:
            continue;
        }

        if ("contains".equalsIgnoreCase(f.getOperator())) {
          sql.append(" AND ").append(column).append(" LIKE ? ");
          params.add("%" + f.getValue() + "%");
        } else {
          sql.append(" AND ").append(column).append(" ").append(f.getOperator()).append(" ? ");
          params.add(f.getValue());
        }
      }
    }

    // GROUP BY
    switch (groupBy) {
      case "week":
        sql.append("""
                GROUP BY
                    e.UserID,
                    e.DepartmentID,
                    d.DepartmentName,
                    YEAR(e.WorkDate),
                    WEEK(e.WorkDate, 1)
            """);
        break;
      case "month":
        sql.append("""
                GROUP BY
                    e.UserID,
                    e.DepartmentID,
                    d.DepartmentName,
                    YEAR(e.WorkDate),
                    MONTH(e.WorkDate)
            """);
        break;
      default:
        sql.append(" ORDER BY e.WorkDate ASC");
    }

    // MAIN RESULT
    List<Map<String, Object>> mainList = jdbcTemplate.queryForList(sql.toString(), params.toArray());

    // Post-query enrichment
    attachLeaveType(mainList);
    attachGoalPercent(mainList);
    attachTargetAchievedPercent(mainList); // mutates TargetAchievedPercent for depts 19/23
    attachRevisedTargetPercent(mainList); // approved RevisedTarget recomputes the day's percent

    // In-memory Goal Achieved filter
    // if (filter.getFilters() != null && !filter.getFilters().isEmpty()) {
    // for (EfficiencySummaryFilterRequest.Filter f : filter.getFilters()) {
    // if ("Goal Achieved".equalsIgnoreCase(f.getField())) {
    // BigDecimal value = new BigDecimal(f.getValue());
    // mainList = mainList.stream()
    // .filter(row -> {
    // BigDecimal goalPercent = new BigDecimal(
    // row.getOrDefault("GoalPercent", 0).toString());
    // return switch (f.getOperator()) {
    // case "=" -> goalPercent.compareTo(value) == 0;
    // case ">" -> goalPercent.compareTo(value) > 0;
    // case "<" -> goalPercent.compareTo(value) < 0;
    // case ">=" -> goalPercent.compareTo(value) >= 0;
    // case "<=" -> goalPercent.compareTo(value) <= 0;
    // default -> true;
    // };
    // })
    // .collect(Collectors.toList());
    // }
    // }
    // }

    // Exclude full-day leave rows
    List<Map<String, Object>> filteredList = mainList.stream()
        .filter(row -> {
          Object lt = row.get("LeaveType");

          if (lt == null)
            return true;
          return !lt.toString().trim().equalsIgnoreCase("FULL_DAY");
        })
        .collect(Collectors.toList());
    boolean hasFilters = filter.getFilters() != null &&
        !filter.getFilters().isEmpty();
    if (hasFilters) {

      Map<Integer, List<Map<String, Object>>> rowsByUser = filteredList.stream()
          .collect(Collectors.groupingBy(
              r -> (Integer) r.get("UserID")));

      List<Map<String, Object>> userSummaryList = new ArrayList<>();

      for (Map.Entry<Integer, List<Map<String, Object>>> entry : rowsByUser.entrySet()) {

        List<Map<String, Object>> rows = entry.getValue();

        Map<String, Object> user = new HashMap<>();

        user.put("UserID", rows.get(0).get("UserID"));
        user.put("UserName", rows.get(0).get("UserName"));
        user.put("DepartmentID", rows.get(0).get("DepartmentID"));
        user.put("DepartmentName", rows.get(0).get("DepartmentName"));

        Map<String, Object> avgMap = computeRowAverages(rows);

        // Original keys for frontend
        user.put("TargetAchievedPercent", avgMap.get("AvgTargetPercent"));
        user.put("UtilizationPercent", avgMap.get("AvgUtilizationPercent"));
        user.put("AllocatedTimeHrs", avgMap.get("AvgAllocatedHrs"));
        user.put("TotalTimeOfWork", avgMap.get("AvgTotalWork"));
        user.put("EfficiencyLevel", avgMap.get("EfficiencyLevel"));

        // Hidden working keys for applyUserLevelFilter
        // Hidden working keys for averageOfMaps + applyUserLevelFilter
        user.put("AvgTargetPercent", avgMap.get("AvgTargetPercent"));
        user.put("AvgUtilizationPercent", avgMap.get("AvgUtilizationPercent"));
        user.put("AvgAllocatedHrs", avgMap.get("AvgAllocatedHrs"));
        user.put("AvgTotalWork", avgMap.get("AvgTotalWork"));
        user.put("_score", avgMap.get("_score"));

        BigDecimal avgGoal = rows.stream()
            .map(r -> new BigDecimal(
                r.getOrDefault("GoalPercent", 0).toString()))
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(
                BigDecimal.valueOf(rows.size()),
                2,
                RoundingMode.HALF_UP);

        user.put("GoalPercent", avgGoal);
        user.put("AvgGoalPercent", avgGoal);

        userSummaryList.add(user);
      }
      // Apply filters on averages
      for (EfficiencySummaryFilterRequest.Filter f : filter.getFilters()) {

        userSummaryList = applyUserLevelFilter(userSummaryList, f);
      }

      // Summary from filtered users
      Map<String, Object> summaryRow = averageOfMaps(userSummaryList);

      BigDecimal avgGoal = userSummaryList.stream()
          .map(r -> new BigDecimal(
              r.getOrDefault("AvgGoalPercent", 0).toString()))
          .reduce(BigDecimal.ZERO, BigDecimal::add);

      if (!userSummaryList.isEmpty()) {

        avgGoal = avgGoal.divide(
            BigDecimal.valueOf(userSummaryList.size()),
            2,
            RoundingMode.HALF_UP);
      }

      summaryRow.put("AvgGoalPercent", avgGoal);

      userSummaryList.forEach(u -> {
        u.remove("AvgTargetPercent");
        u.remove("AvgUtilizationPercent");
        u.remove("AvgAllocatedHrs");
        u.remove("AvgTotalWork");
        u.remove("AvgGoalPercent");
        u.remove("_score");
      });

      Map<String, Object> finalResponse = new HashMap<>();
      finalResponse.put("data", userSummaryList);
      finalResponse.put("summary", summaryRow);

      return finalResponse;
    }

    // =========================================================================
    // HIERARCHICAL SUMMARY
    // Levels (most specific wins):
    // USER → avg of that user's raw daily rows
    // DEPARTMENT → avg of its users' averages
    // EL → avg of its departments' averages
    // COMPANY → avg of all EL averages
    // =========================================================================

    Integer summaryUserId = (filter.getUserID() != null && filter.getUserID() != 0)
        ? filter.getUserID()
        : null;
    Integer summaryDeptId = (filter.getDepartmentID() != null && filter.getDepartmentID() != 0)
        ? filter.getDepartmentID()
        : null;
    Integer summaryElId = extractElId(filter);

    Map<String, Object> summaryRow;

    if (summaryUserId != null) {
      // ===== USER LEVEL: average of this user's raw daily rows =====
      summaryRow = computeRowAverages(filteredList);

    } else {
      // Build per-user averages (foundation for every higher level)
      Map<Integer, List<Map<String, Object>>> rowsByUser = filteredList.stream()
          .filter(r -> r.get("UserID") != null)
          .collect(Collectors.groupingBy(r -> (Integer) r.get("UserID")));

      Map<Integer, Integer> userToDept = new HashMap<>();
      Map<Integer, Map<String, Object>> userAvgById = new HashMap<>();

      for (Map.Entry<Integer, List<Map<String, Object>>> entry : rowsByUser.entrySet()) {
        Map<String, Object> avg = computeRowAverages(entry.getValue());
        userAvgById.put(entry.getKey(), avg);

        Object deptObj = entry.getValue().get(0).get("DepartmentID");
        if (deptObj != null) {
          userToDept.put(entry.getKey(), (Integer) deptObj);
        }
      }

      if (summaryDeptId != null) {
        // ===== DEPARTMENT LEVEL: average of its users =====
        summaryRow = averageOfMaps(new ArrayList<>(userAvgById.values()));

      } else {
        // Build per-department averages (foundation for EL / company)
        Map<Integer, List<Map<String, Object>>> usersByDept = new HashMap<>();
        for (Map.Entry<Integer, Map<String, Object>> entry : userAvgById.entrySet()) {
          Integer deptId = userToDept.get(entry.getKey());
          if (deptId == null)
            continue;
          usersByDept.computeIfAbsent(deptId, k -> new ArrayList<>()).add(entry.getValue());
        }

        List<Map<String, Object>> deptAverages = new ArrayList<>();
        for (Map.Entry<Integer, List<Map<String, Object>>> entry : usersByDept.entrySet()) {
          Map<String, Object> deptAvg = averageOfMaps(entry.getValue());
          deptAvg.put("DepartmentID", entry.getKey());
          deptAverages.add(deptAvg);
        }

        if (summaryElId != null) {
          // ===== EL LEVEL: average of its departments =====
          List<Integer> elDeptIds = jdbcTemplate.queryForList(
              "SELECT DepartmentID FROM Department WHERE ExecutiveLeaderID = ?",
              Integer.class, summaryElId);

          List<Map<String, Object>> elDeptAverages = deptAverages.stream()
              .filter(d -> elDeptIds.contains((Integer) d.get("DepartmentID")))
              .collect(Collectors.toList());

          summaryRow = averageOfMaps(elDeptAverages);

        } else {
          // ===== COMPANY LEVEL: average of EL averages =====
          List<Map<String, Object>> deptElMappings = jdbcTemplate.queryForList(
              "SELECT DepartmentID, ExecutiveLeaderID FROM Department WHERE ExecutiveLeaderID IS NOT NULL");

          Map<Integer, Integer> deptToEl = new HashMap<>();
          for (Map<String, Object> m : deptElMappings) {
            deptToEl.put((Integer) m.get("DepartmentID"), (Integer) m.get("ExecutiveLeaderID"));
          }

          Map<Integer, List<Map<String, Object>>> deptsByEl = new HashMap<>();
          for (Map<String, Object> deptAvg : deptAverages) {
            Integer deptId = (Integer) deptAvg.get("DepartmentID");
            Integer elId = deptToEl.get(deptId);
            if (elId == null)
              continue;
            deptsByEl.computeIfAbsent(elId, k -> new ArrayList<>()).add(deptAvg);
          }

          List<Map<String, Object>> elAverages = new ArrayList<>();
          for (List<Map<String, Object>> depts : deptsByEl.values()) {
            elAverages.add(averageOfMaps(depts));
          }

          summaryRow = averageOfMaps(elAverages);
        }
      }
    }

    summaryRow.remove("_score"); // internal field — strip before sending to frontend
    summaryRow.remove("DepartmentID"); // intermediate grouping key — not needed in response

    // =========================================================================
    // Goal efficiency (unchanged — runs independently of the hierarchy)
    // =========================================================================
    BigDecimal avgGoalPercent = BigDecimal.ZERO;
    Map<String, BigDecimal> deptGoalMap = new LinkedHashMap<>();

    try {

      if (Boolean.TRUE.equals(filter.getHistory())
          && filter.getUserID() != null
          && filter.getUserID() != 0) {

        List<Integer> userDeptIds = filteredList.stream()
            .map(r -> (Integer) r.get("DepartmentID"))
            .filter(Objects::nonNull)
            .distinct()
            .collect(Collectors.toList());

        if (userDeptIds.isEmpty()) {
          userDeptIds = jdbcTemplate.queryForList(
              """
                  SELECT DISTINCT DepartmentID
                  FROM EfficiencyUtilizationSummary
                  WHERE UserID = ?
                  """,
              Integer.class,
              filter.getUserID());
        }

        BigDecimal totalGoal = BigDecimal.ZERO;
        int deptCount = 0;

        for (Integer deptId : userDeptIds) {

          // Get rows only for this department
          List<Map<String, Object>> deptRows = filteredList.stream()
              .filter(r -> deptId.equals(r.get("DepartmentID")))
              .collect(Collectors.toList());

          LocalDate deptStartDate;
          LocalDate deptEndDate;

          if (!deptRows.isEmpty()) {

            deptStartDate = deptRows.stream()
                .map(r -> {
                  Object wd = r.get("WorkDate");
                  return wd instanceof java.sql.Date
                      ? ((java.sql.Date) wd).toLocalDate()
                      : LocalDate.parse(wd.toString());
                })
                .min(LocalDate::compareTo)
                .orElse(LocalDate.of(2020, 1, 1));

            deptEndDate = deptRows.stream()
                .map(r -> {
                  Object wd = r.get("WorkDate");
                  return wd instanceof java.sql.Date
                      ? ((java.sql.Date) wd).toLocalDate()
                      : LocalDate.parse(wd.toString());
                })
                .max(LocalDate::compareTo)
                .orElse(LocalDate.now());

          } else {

            deptStartDate = filter.getStartDate() != null
                ? filter.getStartDate()
                : LocalDate.of(2020, 1, 1);

            deptEndDate = filter.getEndDate() != null
                ? filter.getEndDate()
                : LocalDate.now();
          }

          UserGoalDataFilterRequestDTO goalFilter = new UserGoalDataFilterRequestDTO();

          goalFilter.setDepartmentID(deptId);
          goalFilter.setUserID(filter.getUserID());

          goalFilter.setStartDate(deptStartDate);
          goalFilter.setEndDate(deptEndDate);

          goalFilter.setGoalStartDate(deptStartDate);
          goalFilter.setGoalEndDate(deptEndDate);

          goalFilter.setELID(0);
          goalFilter.setFLID(0);

          BigDecimal deptGoal = dashBoardService.getAverageSum(
              goalFilter,
              filter.getUserID());

          System.out.println(
              "Dept=" + deptId +
                  ", Start=" + deptStartDate +
                  ", End=" + deptEndDate +
                  ", Goal=" + deptGoal);

          if (deptGoal != null) {

            totalGoal = totalGoal.add(deptGoal);
            deptCount++;

            deptGoalMap.put(
                String.valueOf(deptId),
                deptGoal.setScale(2, RoundingMode.HALF_UP));
          }
        }

        if (deptCount > 0) {
          avgGoalPercent = totalGoal.divide(
              BigDecimal.valueOf(deptCount),
              2,
              RoundingMode.HALF_UP);
        }

      } else {

        BigDecimal totalGoal = BigDecimal.ZERO;
        int goalCount = 0;

        for (Map<String, Object> row : filteredList) {

          Object gp = row.get("GoalPercent");

          if (gp != null) {
            totalGoal = totalGoal.add(new BigDecimal(gp.toString()));
            goalCount++;
          }
        }

        if (goalCount > 0) {
          avgGoalPercent = totalGoal.divide(
              BigDecimal.valueOf(goalCount),
              2,
              RoundingMode.HALF_UP);
        }
      }

    } catch (Exception e) {
      e.printStackTrace();
      avgGoalPercent = BigDecimal.ZERO;
    }

    summaryRow.putAll(deptGoalMap);
    summaryRow.put("AvgGoalPercent", avgGoalPercent);

    // =========================================================================
    // Monthly breakdown — computed from enriched filteredList
    // (includes GoalPercent from attachGoalPercent).
    // The summary AvgTargetPercent / AvgGoalPercent override (mean of monthly
    // values) always runs when dates are present. The monthlyBreakdown list is
    // only attached to the response when isQuarterly=true.
    // =========================================================================
    if (filter.getStartDate() != null && filter.getEndDate() != null) {

      Map<String, List<Map<String, Object>>> rowsByMonth = filteredList.stream()
          .collect(Collectors.groupingBy(row -> {
            Object wd = row.get("WorkDate");
            LocalDate d = wd instanceof Date
                ? ((Date) wd).toLocalDate()
                : LocalDate.parse(wd.toString());
            return d.getYear() + "-" + String.format("%02d", d.getMonthValue());
          }, LinkedHashMap::new, Collectors.toList()));

      List<Map<String, Object>> monthlyBreakdown = new ArrayList<>();

      rowsByMonth.entrySet().stream()
          .sorted(Map.Entry.comparingByKey())
          .forEach(entry -> {
            List<Map<String, Object>> rows = entry.getValue();
            String[] parts = entry.getKey().split("-");

            BigDecimal totalTarget = BigDecimal.ZERO;
            BigDecimal totalUtil = BigDecimal.ZERO;
            BigDecimal totalAllocated = BigDecimal.ZERO;
            BigDecimal totalWork = BigDecimal.ZERO;
            BigDecimal totalGoal = BigDecimal.ZERO;
            int count = rows.size();
            int targetCount = 0;
            int goalCount = 0;

            for (Map<String, Object> row : rows) {
              BigDecimal target = new BigDecimal(row.get("TargetAchievedPercent").toString());
              totalTarget = totalTarget.add(target);
              if (target.compareTo(BigDecimal.ZERO) > 0) {
                targetCount++;
              }
              totalUtil = totalUtil.add(
                  new BigDecimal(row.get("UtilizationPercent").toString()));
              totalAllocated = totalAllocated.add(
                  new BigDecimal(row.get("AllocatedTimeHrs").toString()));
              totalWork = totalWork.add(
                  new BigDecimal(row.get("TotalTimeOfWork").toString()));
              BigDecimal goal = new BigDecimal(
                  row.getOrDefault("GoalPercent", BigDecimal.ZERO).toString());
              totalGoal = totalGoal.add(goal);
              if (goal.compareTo(BigDecimal.ZERO) > 0) {
                goalCount++;
              }
            }

            BigDecimal avgTarget = targetCount > 0
                ? totalTarget.divide(BigDecimal.valueOf(targetCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
            BigDecimal avgUtil = count > 0
                ? totalUtil.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
            BigDecimal avgAllocated = count > 0
                ? totalAllocated.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
            BigDecimal avgWork = count > 0
                ? totalWork.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
            BigDecimal avgGoal = goalCount > 0
                ? totalGoal.divide(BigDecimal.valueOf(goalCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

            String level;
            if (avgTarget.compareTo(BigDecimal.valueOf(100)) >= 0
                && avgUtil.compareTo(BigDecimal.valueOf(80)) >= 0) {
              level = "High";
            } else if (avgTarget.compareTo(BigDecimal.valueOf(80)) >= 0
                && avgUtil.compareTo(BigDecimal.valueOf(50)) >= 0) {
              level = "At Par";
            } else {
              level = "Low";
            }

            Map<String, Object> monthMap = new LinkedHashMap<>();
            monthMap.put("Year", Integer.parseInt(parts[0]));
            monthMap.put("MonthNumber", Integer.parseInt(parts[1]));
            monthMap.put("AvgTargetPercent", avgTarget);
            monthMap.put("AvgUtilizationPercent", avgUtil);
            monthMap.put("AvgAllocatedHrs", avgAllocated);
            monthMap.put("AvgTotalWork", avgWork);
            monthMap.put("EfficiencyLevel", level);
            monthMap.put("AvgGoalPercent", avgGoal);
            monthlyBreakdown.add(monthMap);
          });

      // Source monthly AvgGoalPercent from UserGoalData directly (matches the
      // userGoalData/list endpoint) so goal-only days (present in UserGoalData
      // but absent from EfficiencyUtilizationSummary) are not missed.
      if (filter.getUserID() != null && filter.getUserID() != 0) {
        List<Map<String, Object>> goalMonthRows = jdbcTemplate.queryForList("""
            SELECT
                YEAR(ug.WorkDate) AS y,
                MONTH(ug.WorkDate) AS m,
                ROUND(AVG(
                    CASE WHEN %s > 0
                        THEN (ug.AchievedGoal * 100.0) / %s
                        ELSE 0 END
                ), 2) AS monthAvg
            FROM UserGoalData ug
            WHERE ug.UserID = ?
              AND ug.WorkDate BETWEEN ? AND ?
            GROUP BY YEAR(ug.WorkDate), MONTH(ug.WorkDate)
            """.formatted(EFFECTIVE_GOAL, EFFECTIVE_GOAL),
            filter.getUserID(),
            Date.valueOf(filter.getStartDate()),
            Date.valueOf(filter.getEndDate()));

        Map<String, BigDecimal> goalAvgByKey = new HashMap<>();
        for (Map<String, Object> r : goalMonthRows) {
          goalAvgByKey.put(r.get("y") + "-" + r.get("m"),
              new BigDecimal(r.get("monthAvg").toString()));
        }

        for (Map<String, Object> monthMap : monthlyBreakdown) {
          int y = (Integer) monthMap.get("Year");
          int m = (Integer) monthMap.get("MonthNumber");
          BigDecimal goalAvg = goalAvgByKey.get(y + "-" + m);
          if (goalAvg != null) {
            monthMap.put("AvgGoalPercent", goalAvg);
          }
        }
      }

      // Override AvgGoalPercent for users 153/154/155/130/97/118 in Apr/May/Juns
      List<Integer> targetCalcUserIds = List.of(153, 154, 155, 130, 97, 118);
      if (filter.getUserID() != null && targetCalcUserIds.contains(filter.getUserID())) {
        for (Map<String, Object> monthMap : monthlyBreakdown) {
          int m = (Integer) monthMap.get("MonthNumber");
          if (m >= 4 && m <= 6) {
            int y = (Integer) monthMap.get("Year");
            LocalDate monthStart = LocalDate.of(y, m, 1);
            LocalDate monthEnd = monthStart.withDayOfMonth(monthStart.lengthOfMonth());
            if (monthEnd.isAfter(filter.getEndDate())) {
              monthEnd = filter.getEndDate();
            }
            if (monthStart.isBefore(filter.getStartDate())) {
              monthStart = filter.getStartDate();
            }

            Integer uid = filter.getUserID();
            boolean isIsForTarget = uid == 130 || uid == 97 || uid == 118;
            BigDecimal goalPercent;
            if (isIsForTarget) {
              // GoalPercent = TargetAchievedPercent for these users
              Object avgTargetObj = monthMap.get("AvgTargetPercent");
              goalPercent = avgTargetObj != null
                  ? new BigDecimal(avgTargetObj.toString())
                  : BigDecimal.ZERO;
            } else {
              BigDecimal fixedGoal;
              if (uid != null && uid == 117) {
                BigDecimal task31 = userWorkDataRepository
                    .sumAchivedUnitsByTaskIdRange(uid, 31, monthStart, monthEnd);
                BigDecimal task48 = userWorkDataRepository
                    .sumAchivedUnitsByTaskIdRange(uid, 48, monthStart, monthEnd);
                fixedGoal = task31.multiply(BigDecimal.valueOf(0.70))
                    .add(task48.multiply(BigDecimal.valueOf(0.70)));
                if (monthStart.getMonthValue() == 6) {
                  LocalDate goal70Start = LocalDate.of(2026, 6, 6);
                  if (goal70Start.isBefore(monthStart)) goal70Start = monthStart;
                  if (!goal70Start.isAfter(monthEnd)) {
                    BigDecimal task94 = userWorkDataRepository
                        .sumAchivedUnitsByTaskIdRange(uid, 94, goal70Start, monthEnd);
                    BigDecimal task95 = userWorkDataRepository
                        .sumAchivedUnitsByTaskIdRange(uid, 95, goal70Start, monthEnd);
                    fixedGoal = fixedGoal.add(task94.add(task95).multiply(BigDecimal.valueOf(0.35)));
                  }
                }
                fixedGoal = fixedGoal.setScale(2, RoundingMode.HALF_UP);
              } else {
                Integer taskIdForUser = (uid == 155) ? 21 : 65;
                BigDecimal sumAchived = userWorkDataRepository
                    .sumAchivedUnitsByTaskIdRange(uid, taskIdForUser, monthStart, monthEnd);
                fixedGoal = sumAchived
                    .multiply(BigDecimal.valueOf(0.35))
                    .setScale(2, RoundingMode.HALF_UP);
              }
              BigDecimal achievedGoal = userGoalDataRepository
                  .sumAchievedGoalByUserAndDateRange(uid, monthStart, monthEnd);
              goalPercent = BigDecimal.ZERO;
              if (fixedGoal.compareTo(BigDecimal.ZERO) > 0) {
                goalPercent = achievedGoal
                    .divide(fixedGoal, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP);
              }
            }
            monthMap.put("AvgGoalPercent", goalPercent);
          }
        }
      }

      // Dept 22: apply the dept-22 avgPercent logic to the monthly breakdown —
      // but only for months where this user actually has dept-22 goal data.
      // Months spent in another department keep the standard computed values,
      // so a department transfer is handled without hardcoding users or dates.
      if (filter.getUserID() != null
          && filter.getStartDate() != null && filter.getEndDate() != null) {
        List<Map<String, Object>> dept22MonthRows = jdbcTemplate.queryForList("""
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
            """,
            filter.getUserID(),
            Date.valueOf(filter.getStartDate()),
            Date.valueOf(filter.getEndDate()));

        Map<String, BigDecimal> dept22ByKey = new HashMap<>();
        for (Map<String, Object> r : dept22MonthRows) {
          dept22ByKey.put(r.get("y") + "-" + r.get("m"),
              new BigDecimal(r.get("monthAvg").toString()));
        }

        int overriddenMonths = 0;
        for (Map<String, Object> monthMap : monthlyBreakdown) {
          int y = (Integer) monthMap.get("Year");
          int m = (Integer) monthMap.get("MonthNumber");
          BigDecimal dept22Val = dept22ByKey.get(y + "-" + m);
          if (dept22Val == null) {
            // No dept-22 goal data this month (different department / no goals)
            // → keep the standard AvgTargetPercent / AvgGoalPercent computed above.
            continue;
          }
          // AvgGoalPercent uses the same monthly-breakdown logic as
          // UserGoalDataService (per-month avg of the dept-22 rule).
          monthMap.put("AvgTargetPercent", dept22Val);
          monthMap.put("AvgGoalPercent", dept22Val);
          overriddenMonths++;
        }

        // Summary override only when EVERY month in the range used the dept-22
        // rule (preserves the original dept-22 summary math: mean over months).
        if (overriddenMonths > 0 && overriddenMonths == monthlyBreakdown.size()) {
          BigDecimal dept22Total = BigDecimal.ZERO;
          for (Map<String, Object> monthMap : monthlyBreakdown) {
            dept22Total = dept22Total.add(
                new BigDecimal(monthMap.get("AvgTargetPercent").toString()));
          }
          BigDecimal dept22Avg = dept22Total.divide(
              BigDecimal.valueOf(monthlyBreakdown.size()), 2, RoundingMode.HALF_UP);
          summaryRow.put("AvgTargetPercent", dept22Avg);
          summaryRow.put("AvgGoalPercent", dept22Avg);
        }
      }

      // EL-approved revised target of a month replaces that month's
      // AvgTargetPercent with the revised value - the same rule the goal side
      // applies for an EL-approved RevisedGoal (the raw revised value is used
      // for the month instead of the computed average).
      // The quarterly summary below is the mean of the monthly values, so the
      // top level AvgTargetPercent follows automatically.
      if (filter.getUserID() != null && filter.getUserID() != 0) {
        // Revised target of the month: the details are attached for every
        // revision of that month (approved or still pending), so the UI can
        // show the revision the same way the goal list does. Only an
        // EL-approved revision replaces the month's AvgTargetPercent.
        List<Map<String, Object>> revisedMonthRows = jdbcTemplate.queryForList("""
            SELECT w.DailyTaskLogID,
                   YEAR(w.WorkDate) AS y,
                   MONTH(w.WorkDate) AS m,
                   w.RevisedTarget,
                   CAST(JSON_UNQUOTE(JSON_EXTRACT(w.RevisedTarget, '$.value')) AS DECIMAL(10,2)) AS revisedValue,
                   JSON_UNQUOTE(JSON_EXTRACT(w.RevisedTarget, '$.elApproved')) AS elApproved
            FROM UserWorkData w
            WHERE w.UserID = ?
              AND w.WorkDate BETWEEN ? AND ?
              AND w.RevisedTarget IS NOT NULL
              AND w.RevisedTarget <> ''
              AND JSON_UNQUOTE(JSON_EXTRACT(w.RevisedTarget, '$.value')) IS NOT NULL
              AND CAST(JSON_UNQUOTE(JSON_EXTRACT(w.RevisedTarget, '$.value')) AS DECIMAL(10,2)) > 0
            ORDER BY w.DailyTaskLogID
            """,
            filter.getUserID(),
            Date.valueOf(filter.getStartDate()),
            Date.valueOf(filter.getEndDate()));

        Map<String, Map<String, Object>> approvedTargetByMonth = new HashMap<>();
        Map<String, Map<String, Object>> pendingTargetByMonth = new HashMap<>();
        for (Map<String, Object> r : revisedMonthRows) {
          String key = r.get("y") + "-" + r.get("m");
          if ("true".equalsIgnoreCase(String.valueOf(r.get("elApproved")))) {
            approvedTargetByMonth.putIfAbsent(key, r);
          } else {
            pendingTargetByMonth.putIfAbsent(key, r);
          }
        }

        for (Map<String, Object> monthMap : monthlyBreakdown) {
          String key = monthMap.get("Year") + "-" + monthMap.get("MonthNumber");
          Map<String, Object> revision =
              approvedTargetByMonth.get(key) != null
                  ? approvedTargetByMonth.get(key)
                  : pendingTargetByMonth.get(key);
          if (revision == null)
            continue;

          BigDecimal revisedValue = new BigDecimal(revision.get("revisedValue").toString());
          monthMap.put("revisedTarget", parseRevisedTarget((String) revision.get("RevisedTarget")));
          monthMap.put("revisedTargetValue", revisedValue);

          if (!"true".equalsIgnoreCase(String.valueOf(revision.get("elApproved"))))
            continue;

          // EL-approved revised target of a month replaces that month's
          // AvgTargetPercent with the revised value - the same rule the goal
          // side applies for an EL-approved RevisedGoal (the raw revised value
          // is used for the month instead of the computed average).
          monthMap.put("AvgTargetPercent", revisedValue);

          // The efficiency level is derived from AvgTargetPercent.
          BigDecimal avgUtil = new BigDecimal(
              monthMap.get("AvgUtilizationPercent").toString());
          String level;
          if (revisedValue.compareTo(BigDecimal.valueOf(100)) >= 0
              && avgUtil.compareTo(BigDecimal.valueOf(80)) >= 0) {
            level = "High";
          } else if (revisedValue.compareTo(BigDecimal.valueOf(80)) >= 0
              && avgUtil.compareTo(BigDecimal.valueOf(50)) >= 0) {
            level = "At Par";
          } else {
            level = "Low";
          }
          monthMap.put("EfficiencyLevel", level);
        }

        // Revised goal of the month: the details are attached for every
        // revision of that month (approved or still pending). Only an
        // EL-approved revision replaces the month's AvgGoalPercent.
        // The quarterly summary below is the mean of the monthly values, so the
        // top level AvgGoalPercent follows automatically.
        List<Map<String, Object>> revisedGoalMonthRows = jdbcTemplate.queryForList("""
            SELECT ug.UserGoalDataID,
                   YEAR(ug.WorkDate) AS y,
                   MONTH(ug.WorkDate) AS m,
                   ug.RevisedGoal,
                   CAST(JSON_UNQUOTE(JSON_EXTRACT(ug.RevisedGoal, '$.value')) AS DECIMAL(10,2)) AS revisedValue,
                   JSON_UNQUOTE(JSON_EXTRACT(ug.RevisedGoal, '$.elApproved')) AS elApproved
            FROM UserGoalData ug
            WHERE ug.UserID = ?
              AND ug.WorkDate BETWEEN ? AND ?
              AND ug.RevisedGoal IS NOT NULL
              AND ug.RevisedGoal <> ''
              AND JSON_UNQUOTE(JSON_EXTRACT(ug.RevisedGoal, '$.value')) IS NOT NULL
              AND CAST(JSON_UNQUOTE(JSON_EXTRACT(ug.RevisedGoal, '$.value')) AS DECIMAL(10,2)) > 0
            ORDER BY ug.UserGoalDataID
            """,
            filter.getUserID(),
            Date.valueOf(filter.getStartDate()),
            Date.valueOf(filter.getEndDate()));

        Map<String, Map<String, Object>> approvedGoalByMonth = new HashMap<>();
        Map<String, Map<String, Object>> pendingGoalByMonth = new HashMap<>();
        for (Map<String, Object> r : revisedGoalMonthRows) {
          String key = r.get("y") + "-" + r.get("m");
          if ("true".equalsIgnoreCase(String.valueOf(r.get("elApproved")))) {
            approvedGoalByMonth.putIfAbsent(key, r);
          } else {
            pendingGoalByMonth.putIfAbsent(key, r);
          }
        }

        for (Map<String, Object> monthMap : monthlyBreakdown) {
          String key = monthMap.get("Year") + "-" + monthMap.get("MonthNumber");
          Map<String, Object> revision =
              approvedGoalByMonth.get(key) != null
                  ? approvedGoalByMonth.get(key)
                  : pendingGoalByMonth.get(key);
          if (revision == null)
            continue;

          BigDecimal revisedValue = new BigDecimal(revision.get("revisedValue").toString());
          monthMap.put("revisedGoal", parseRevisedGoal((String) revision.get("RevisedGoal")));
          monthMap.put("revisedGoalValue", revisedValue);

          if (!"true".equalsIgnoreCase(String.valueOf(revision.get("elApproved"))))
            continue;

          // EL-approved revised goal of a month replaces that month's
          // AvgGoalPercent with the revised value - the same rule the goal side
          // applies for an EL-approved RevisedGoal (the raw revised value is
          // used for the month instead of the computed average).
          monthMap.put("AvgGoalPercent", revisedValue);
        }
      }

      // Quarterly summary AvgTargetPercent / AvgGoalPercent = mean of monthly
      // values (divide by number of months, not by day count)
      if (!monthlyBreakdown.isEmpty()) {
        BigDecimal monthlyTargetTotal = BigDecimal.ZERO;
        BigDecimal monthlyGoalTotal = BigDecimal.ZERO;
        for (Map<String, Object> monthMap : monthlyBreakdown) {
          monthlyTargetTotal = monthlyTargetTotal.add(
              new BigDecimal(monthMap.get("AvgTargetPercent").toString()));
          monthlyGoalTotal = monthlyGoalTotal.add(
              new BigDecimal(monthMap.getOrDefault("AvgGoalPercent", BigDecimal.ZERO).toString()));
        }
        BigDecimal monthCount = BigDecimal.valueOf(monthlyBreakdown.size());
        summaryRow.put("AvgTargetPercent",
            monthlyTargetTotal.divide(monthCount, 2, RoundingMode.HALF_UP));
        summaryRow.put("AvgGoalPercent",
            monthlyGoalTotal.divide(monthCount, 2, RoundingMode.HALF_UP));
      }

      // One DailyTaskLogID per month — any UserWorkData row of that user in the
      // month (MIN = earliest) so the client can deep-link to the month's work
      // entries. null when no user filter is applied or the month has no rows.
      Map<String, Integer> dailyTaskLogIdByKey = new HashMap<>();
      if (filter.getUserID() != null && filter.getUserID() != 0) {
        List<Map<String, Object>> idRows = jdbcTemplate.queryForList("""
            SELECT MIN(w.DailyTaskLogID) AS dailyTaskLogID,
                   YEAR(w.WorkDate) AS y,
                   MONTH(w.WorkDate) AS m
            FROM UserWorkData w
            WHERE w.UserID = ?
              AND w.WorkDate BETWEEN ? AND ?
            GROUP BY YEAR(w.WorkDate), MONTH(w.WorkDate)
            """,
            filter.getUserID(),
            Date.valueOf(filter.getStartDate()),
            Date.valueOf(filter.getEndDate()));
        for (Map<String, Object> r : idRows) {
          Object id = r.get("dailyTaskLogID");
          if (id != null) {
            dailyTaskLogIdByKey.put(r.get("y") + "-" + r.get("m"),
                ((Number) id).intValue());
          }
        }
      }
      for (Map<String, Object> monthMap : monthlyBreakdown) {
        monthMap.put("DailyTaskLogID",
            dailyTaskLogIdByKey.get(
                monthMap.get("Year") + "-" + monthMap.get("MonthNumber")));
      }

      // Attach monthlyBreakdown only for quarterly reports
      if (Boolean.TRUE.equals(filter.getIsQuarterly())) {
        summaryRow.put("monthlyBreakdown", monthlyBreakdown);
      }
    }

    // FINAL RESPONSE
    Map<String, Object> finalResponse = new HashMap<>();
    finalResponse.put("data", filteredList);
    finalResponse.put("summary", summaryRow);

    return finalResponse;
  }

  // =========================================================================
  // listEfficiencySummaryEl (unchanged)
  // =========================================================================

  @Transactional(readOnly = true)
  public Map<String, Object> listEfficiencySummaryEl(EfficiencySummaryFilterRequest filter) {

    Map<String, Object> response = new HashMap<>();
    List<Integer> departmentIds = new ArrayList<>();

    if (Boolean.TRUE.equals(filter.getIsHeExecutiveLeader()) && filter.getUserID() != null) {

      // ✅ Only departments that actually have Working-day data in range
      departmentIds = jdbcTemplate.queryForList("""
              SELECT DISTINCT d.DepartmentID
              FROM Department d
              JOIN EfficiencyUtilizationSummary e ON d.DepartmentID = e.DepartmentID
              WHERE d.ExecutiveLeaderID = ?
                AND e.DayType = 'Working'
                AND e.WorkDate BETWEEN ? AND ?
          """,
          Integer.class,
          filter.getUserID(),
          Date.valueOf(filter.getStartDate()),
          Date.valueOf(filter.getEndDate()));

      if (departmentIds.isEmpty()) {
        response.put("status", false);
        response.put("message", "No departments assigned to this Executive Leader");
        return response;
      }
    }

    List<Map<String, Object>> departmentDataList = new ArrayList<>();

    for (Integer deptId : departmentIds) {
      String deptName = jdbcTemplate.queryForObject(
          "SELECT DepartmentName FROM Department WHERE DepartmentID = ?", String.class, deptId);

      // ✅ Only users with actual data, same join pattern as Dashboard's
      // getUsersForDepartment
      List<Map<String, Object>> usersList = jdbcTemplate.queryForList("""
              SELECT DISTINCT u.UserID, u.UserName
              FROM Users u
              JOIN EfficiencyUtilizationSummary e ON u.UserID = e.UserID
              WHERE e.DepartmentID = ?
                AND e.DayType = 'Working'
                AND e.WorkDate BETWEEN ? AND ?
                AND u.UserID <> ?
          """,
          deptId,
          Date.valueOf(filter.getStartDate()),
          Date.valueOf(filter.getEndDate()),
          filter.getUserID());

      for (Map<String, Object> user : usersList) {
        Integer userId = (Integer) user.get("UserID");

        // ✅ Fetch raw rows, exclude FULL_DAY leave, then average — same as
        // getUserEfficiencySummary
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT TargetAchievedPercent, UtilizationPercent, AllocatedTimeHrs, TotalTimeOfWork, EfficiencyLevel,
                       UserID, WorkDate
                FROM EfficiencyUtilizationSummary
                WHERE UserID = ? AND DepartmentID = ? AND DayType = 'Working'
                  AND WorkDate BETWEEN ? AND ?
            """,
            userId, deptId,
            Date.valueOf(filter.getStartDate()),
            Date.valueOf(filter.getEndDate()));

        attachLeaveType(rows); // existing private helper

        List<Map<String, Object>> filtered = rows.stream()
            .filter(r -> {
              Object lt = r.get("LeaveType");
              return lt == null || !lt.toString().trim().equalsIgnoreCase("FULL_DAY");
            })
            .collect(Collectors.toList());

        Map<String, Object> avg = computeRowAverages(filtered); // already defined in this class
        user.put("AvgTargetPercent", avg.get("AvgTargetPercent"));
        user.put("AvgUtilizationPercent", avg.get("AvgUtilizationPercent"));
        user.put("AvgAllocatedHrs", avg.get("AvgAllocatedHrs"));
        user.put("TotalTimeOfWork", avg.get("AvgTotalWork"));
        user.put("EfficiencyLevel", avg.get("EfficiencyLevel"));
      }

      Map<String, Object> deptMap = new HashMap<>();
      deptMap.put("ELID", filter.getUserID());
      deptMap.put("DepartmentID", deptId);
      deptMap.put("DepartmentName", deptName);
      deptMap.put("Users", usersList);
      departmentDataList.add(deptMap);
    }

    // summary section similarly should use the same DayType + leave-exclusion
    // logic,
    // ideally just reuse computeRowAverages/averageOfMaps as listEfficiencySummary
    // does.

    response.put("status", true);
    response.put("departments", departmentDataList);
    return response;
  }
  // =========================================================================
  // Excel download (unchanged)
  // =========================================================================

  @Transactional(readOnly = true)
  public byte[] downloadEfficiencySummaryExcel(EfficiencySummaryFilterRequest filter)
      throws IOException {

    Map<String, Object> data = Boolean.TRUE.equals(filter.getIsHeExecutiveLeader())
        ? listEfficiencySummaryEl(filter)
        : listEfficiencySummary(filter);

    Workbook workbook = new XSSFWorkbook();

    if (Boolean.TRUE.equals(filter.getIsHeExecutiveLeader())) {
      writeELExcel(workbook, data, filter);
    } else {
      writeNormalExcel(workbook, data, filter);
    }

    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    workbook.write(baos);
    workbook.close();

    return baos.toByteArray();
  }

  private void writeNormalExcel(
      Workbook workbook, Map<String, Object> data, EfficiencySummaryFilterRequest filter) {

    Sheet dataSheet = workbook.createSheet("Efficiency Data");
    int rowIndex = writeDateRange(dataSheet, filter, workbook);

    List<Map<String, Object>> rows = (List<Map<String, Object>>) data.get("data");
    writeListAsTable(dataSheet, rows, rowIndex);

    Sheet summarySheet = workbook.createSheet("Summary");
    int summaryRow = writeDateRange(summarySheet, filter, workbook);

    Map<String, Object> summary = (Map<String, Object>) data.get("summary");
    writeSingleMap(summarySheet, summary, summaryRow);
  }

  private void writeELExcel(
      Workbook workbook, Map<String, Object> data, EfficiencySummaryFilterRequest filter) {

    List<Map<String, Object>> departments = (List<Map<String, Object>>) data.get("departments");

    for (Map<String, Object> dept : departments) {
      String deptName = (String) dept.get("DepartmentName");
      Sheet sheet = workbook.createSheet(deptName);
      int rowIndex = writeDateRange(sheet, filter, workbook);
      List<Map<String, Object>> users = (List<Map<String, Object>>) dept.get("Users");
      writeListAsTable(sheet, users, rowIndex);
    }

    Sheet summarySheet = workbook.createSheet("Overall Summary");
    int summaryRow = writeDateRange(summarySheet, filter, workbook);

    Map<String, Object> summary = (Map<String, Object>) data.get("summary");
    writeSingleMap(summarySheet, summary, summaryRow);
  }

  private int writeDateRange(
      Sheet sheet, EfficiencySummaryFilterRequest filter, Workbook workbook) {

    CreationHelper helper = workbook.getCreationHelper();
    CellStyle dateStyle = workbook.createCellStyle();
    dateStyle.setDataFormat(helper.createDataFormat().getFormat("dd-MMM-yyyy"));

    int row = 0;

    Row r1 = sheet.createRow(row++);
    r1.createCell(0).setCellValue("Start Date");
    Cell c1 = r1.createCell(1);
    c1.setCellValue(Date.valueOf(filter.getStartDate()));
    c1.setCellStyle(dateStyle);

    Row r2 = sheet.createRow(row++);
    r2.createCell(0).setCellValue("End Date");
    Cell c2 = r2.createCell(1);
    c2.setCellValue(Date.valueOf(filter.getEndDate()));
    c2.setCellStyle(dateStyle);

    row++;
    sheet.autoSizeColumn(0);
    sheet.autoSizeColumn(1);

    return row;
  }

  private void writeSingleMap(Sheet sheet, Map<String, Object> map, int startRow) {
    int rowNum = startRow;
    for (Map.Entry<String, Object> entry : map.entrySet()) {
      Row row = sheet.createRow(rowNum++);
      row.createCell(0).setCellValue(entry.getKey());
      row.createCell(1).setCellValue(entry.getValue() == null ? "" : entry.getValue().toString());
    }
    sheet.autoSizeColumn(0);
    sheet.autoSizeColumn(1);
  }

  private void writeListAsTable(Sheet sheet, List<Map<String, Object>> dataList, int startRow) {
    if (dataList == null || dataList.isEmpty())
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
        row.createCell(col++).setCellValue(value == null ? "" : value.toString());
      }
    }

    for (int i = 0; i < firstRow.size(); i++) {
      sheet.autoSizeColumn(i);
    }
  }
}
