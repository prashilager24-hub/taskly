
package tapmind.bsrv.serviceNew;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.model.EfficiencyUtilizationSummary;
import tapmind.bsrv.model.JobPosition;
import tapmind.bsrv.model.PositionStatus;
import tapmind.bsrv.repository.EfficiencyUtilizationSummaryRepository;
import tapmind.bsrv.repository.JobPositionRepository;
import tapmind.bsrv.repository.SalesCallScheduleRepository;
import tapmind.bsrv.repository.TACallScheduleRepository;
import tapmind.bsrv.repository.TechSprintRepository;
import tapmind.bsrv.repository.UserWorkDataRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import tapmind.bsrv.repository.TAMAccountRepository;
import tapmind.bsrv.model.TAMAccount;
import tapmind.bsrv.model.TAMStatus;

@Service
@RequiredArgsConstructor
public class EfficiencyServiceImpl {

  private final UserWorkDataRepository userWorkDataRepository;
  private final EfficiencyUtilizationSummaryRepository summaryRepository;
  private final SalesCallScheduleRepository salesCallScheduleRepository;
  private final TACallScheduleRepository taCallScheduleRepository;
  private final TechSprintRepository techSprintRepository;
  private final JobPositionRepository jobPositionRepository;
  private final JdbcTemplate jdbcTemplate;
  private final TAMAccountRepository tamAccountRepository;

  private BigDecimal toBigDecimal(Object obj) {
    if (obj == null)
      return BigDecimal.ZERO;
    if (obj instanceof BigDecimal)
      return (BigDecimal) obj;
    if (obj instanceof Number)
      return BigDecimal.valueOf(((Number) obj).doubleValue());
    return BigDecimal.ZERO;
  }

  @Transactional
  public void calculateAndSaveDailyEfficiency() {

    summaryRepository.truncateTable();

    // NON-SALES USERS (from UserWorkData)
    List<Object[]> results = userWorkDataRepository.fetchUserWorkDataGrouped();

    for (Object[] row : results) {

      Integer userId = ((Number) row[0]).intValue();
      Integer departmentId = ((Number) row[1]).intValue();
      LocalDate workDate = ((java.sql.Date) row[2]).toLocalDate();
      // if (departmentId == 22) continue;
      // if (departmentId == 21) continue; // skip sales here

      Double allocatedTime = row[3] != null ? ((Number) row[3]).doubleValue() : 0.0;
      Double timeTaken = row[4] != null ? ((Number) row[4]).doubleValue() : 0.0;
      Double avgTotalUnitValues = row[5] != null ? ((Number) row[5]).doubleValue() : null;

      Boolean isHalfDayLeave = null;
      if (row[6] != null) {
        Object obj = row[6];
        if (obj instanceof Number) {
          isHalfDayLeave = ((Number) obj).intValue() == 1;
        } else if (obj instanceof Boolean) {
          isHalfDayLeave = (Boolean) obj;
        }
      }

      Set<Integer> SPECIAL_HOURS_DEPTS = Set.of(3, 4, 14, 23, 31, 32, 48);

      boolean isSpecialDept = SPECIAL_HOURS_DEPTS.contains(departmentId);

      System.out.println("------------------------------------------------");
      System.out.println("User ID: " + userId);
      System.out.println("Department ID: " + departmentId);
      System.out.println("Work Date: " + workDate);

      BigDecimal STANDARD_TIME;

      if (departmentId == 48) {

        STANDARD_TIME = Boolean.TRUE.equals(isHalfDayLeave)
            ? BigDecimal.valueOf(20.0)
            : BigDecimal.valueOf(40.0);

      } else if (Boolean.TRUE.equals(isHalfDayLeave)) {

        STANDARD_TIME = isSpecialDept
            ? BigDecimal.valueOf(3.5)
            : BigDecimal.valueOf(4.0);

      } else {

        STANDARD_TIME = isSpecialDept
            ? BigDecimal.valueOf(7.0)
            : BigDecimal.valueOf(8.0);
      }

      Set<Integer> TAT_DEPTS = Set.of(7, 14, 23, 31, 32, 16, 26, 20, 38, 18, 25, 19, 42, 43, 44, 45, 46);

      boolean isTatDept = TAT_DEPTS.contains(departmentId);
      boolean isAprMayJun = workDate.getMonthValue() >= 4 && workDate.getMonthValue() <= 6;

      BigDecimal targetAchievedPercent;

      if (isTatDept && isAprMayJun && allocatedTime > 0) {
        BigDecimal allocated = BigDecimal.valueOf(allocatedTime);
        BigDecimal timeTakenBD = BigDecimal.valueOf(timeTaken);
        BigDecimal rawPercent = timeTakenBD
            .divide(allocated, 4, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100));
        BigDecimal hundred = BigDecimal.valueOf(100);
        if (rawPercent.compareTo(hundred) <= 0) {
          targetAchievedPercent = hundred;
        } else {
          targetAchievedPercent = hundred.subtract(rawPercent.subtract(hundred));
        }
        if (targetAchievedPercent.compareTo(BigDecimal.ZERO) < 0) {
          targetAchievedPercent = BigDecimal.ZERO;
        }
        targetAchievedPercent = targetAchievedPercent.setScale(2, RoundingMode.HALF_UP);
      } else {
        targetAchievedPercent = avgTotalUnitValues != null
            ? BigDecimal.valueOf(avgTotalUnitValues).setScale(2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;
      }

      BigDecimal utilization = BigDecimal.ZERO;

      if (STANDARD_TIME.compareTo(BigDecimal.ZERO) > 0) {
        utilization = BigDecimal.valueOf(timeTaken)
            .divide(STANDARD_TIME, 2, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100));
      }

      double targetPercent = targetAchievedPercent.doubleValue();

      // double goalPercent = 0;

      // ✅ Department 7 hardcoded
      // if (departmentId == 7) {

      // goalPercent = 100;

      // } else {

      // String goalSql = """
      // SELECT
      // COALESCE(
      // ROUND(
      // AVG(
      // CASE
      // WHEN ug.FixedGoal > 0
      // THEN (ug.AchievedGoal * 100.0) / ug.FixedGoal
      // ELSE 0
      // END
      // ),
      // 2
      // ),
      // 0
      // ) AS GoalPercent
      // FROM UserGoalData ug
      // WHERE ug.UserID = ?
      // AND ug.WorkDate = ?
      // """;

      // List<Map<String, Object>> goalResult = jdbcTemplate.queryForList(
      // goalSql,
      // userId,
      // workDate);

      // if (!goalResult.isEmpty()
      // && goalResult.get(0).get("GoalPercent") != null) {

      // goalPercent = Double.parseDouble(
      // goalResult.get(0)
      // .get("GoalPercent")
      // .toString());
      // }
      // }

      double goalPercent = 0;

      // Department 7 hardcoded
      if (departmentId == 7) {

        goalPercent = 100;

      } else if (departmentId == 19) {

        String sql19 = """
            SELECT
                COALESCE(SUM(CASE WHEN GoalID = 67 THEN AchievedGoal ELSE 0 END),0) goal67,
                COALESCE(SUM(CASE WHEN GoalID = 68 THEN AchievedGoal ELSE 0 END),0) goal68,
                COALESCE(SUM(CASE WHEN GoalID = 67 THEN FixedGoal ELSE 0 END),0) fixed67,
                COALESCE(SUM(CASE WHEN GoalID = 68 THEN FixedGoal ELSE 0 END),0) fixed68
            FROM UserGoalData
            WHERE UserID = ?
              AND WorkDate = ?
              AND DepartmentID = 19
            """;

        Map<String, Object> goalMap = jdbcTemplate.queryForMap(sql19, userId, workDate);

        BigDecimal fixed67 = new BigDecimal(goalMap.get("fixed67").toString());

        BigDecimal fixed68 = new BigDecimal(goalMap.get("fixed68").toString());

        // OLD DATA -> generic calculation
        if (fixed67.add(fixed68).compareTo(BigDecimal.ZERO) == 0) {

          String goalSql = """
              SELECT
                  COALESCE(
                      ROUND(
                          AVG(
                              CASE
                                  WHEN ug.FixedGoal > 0
                                  THEN (ug.AchievedGoal * 100.0) / ug.FixedGoal
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
              """;

          List<Map<String, Object>> goalResult = jdbcTemplate.queryForList(goalSql, userId, workDate);

          if (!goalResult.isEmpty()
              && goalResult.get(0).get("GoalPercent") != null) {

            goalPercent = Double.parseDouble(
                goalResult.get(0).get("GoalPercent").toString());
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

          goalPercent = percent67.add(percent68).doubleValue();
        }

      } else if (departmentId == 72
          || departmentId == 31
          || departmentId == 32
          || departmentId == 14) {

        // Apr/May/Jun goal logic (same as UserGoalDataService dept 14/31/32)
        String goalSql = """
            SELECT COALESCE(SUM(FixedGoal),0) fixedGoal,
                   COALESCE(SUM(AchievedGoal),0) achievedGoal
            FROM UserGoalData
            WHERE UserID = ?
              AND WorkDate = ?
            """;

        Map<String, Object> goalMap = jdbcTemplate.queryForMap(goalSql, userId, workDate);

        BigDecimal fixedGoal = new BigDecimal(goalMap.get("fixedGoal").toString());
        BigDecimal achievedGoal = new BigDecimal(goalMap.get("achievedGoal").toString());

        if (fixedGoal.compareTo(BigDecimal.ZERO) > 0) {
          BigDecimal achievedPercent = achievedGoal
              .divide(fixedGoal, 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100))
              .setScale(2, RoundingMode.HALF_UP);

          if (achievedPercent.compareTo(BigDecimal.valueOf(100)) <= 0) {
            goalPercent = achievedPercent.compareTo(BigDecimal.ZERO) == 0
                ? 0
                : 100;
          } else {
            goalPercent = BigDecimal.valueOf(200)
                .subtract(achievedPercent)
                .doubleValue();
          }
        }

      } else {

        // existing generic logic
        String goalSql = """
              SELECT
                          COALESCE(
                              ROUND(
                                  AVG(
                                      CASE
                                          WHEN ug.FixedGoal > 0
                                          THEN (ug.AchievedGoal * 100.0) / ug.FixedGoal
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
            """;
      }
      String efficiency;

      if (targetPercent >= 100 &&
          goalPercent >= 80 &&
          timeTaken <= allocatedTime) {

        efficiency = "High";

      } else if (targetPercent >= 80 &&
          goalPercent >= 50 &&
          timeTaken <= allocatedTime) {

        efficiency = "At Par";

      } else {

        efficiency = "Low";
      }

      if ("Low".equalsIgnoreCase(efficiency)
          && utilization.compareTo(BigDecimal.valueOf(100)) > 0) {
        utilization = BigDecimal.valueOf(100);
      }

      saveSummary(
          userId,
          departmentId,
          workDate,
          allocatedTime,
          timeTaken,
          targetAchievedPercent,
          efficiency,
          utilization);
    }

    // 3 TA USERS (Based on Position Close TAT)
    List<TAMAccount> liveAccounts = tamAccountRepository.findByStatusAndLiveDateIsNotNull(TAMStatus.LIVE);

    for (TAMAccount account : liveAccounts) {

      Integer userId = account.getCreatedByUserID();

      LocalDate workDate = account.getLiveDate();

      long workingDays = getWorkingDays(account.getEntryDate(), account.getLiveDate());

      BigDecimal targetAchievedPercent = calculateTAMPercent(workingDays);

      String efficiency;

      if (targetAchievedPercent.compareTo(BigDecimal.valueOf(90)) >= 0)
        efficiency = "High";
      else if (targetAchievedPercent.compareTo(BigDecimal.valueOf(75)) >= 0)
        efficiency = "At Par";
      else
        efficiency = "Low";

      saveSummary(
          userId,
          23,
          workDate,
          0.0,
          0.0,
          targetAchievedPercent,
          efficiency,
          targetAchievedPercent);
    }

    String dept22GoalSql = """
            SELECT
                ug.UserID,
                ug.WorkDate,
                DATE(ug.ModifiedAt) AS modifiedDate,
                ug.AchievedGoal,
                ug.FixedGoal,
                CASE
                    WHEN ug.FixedGoal > 0
                    THEN (ug.AchievedGoal * 100.0) / ug.FixedGoal
                    ELSE 0
                END AS targetAchievedPercent
            FROM UserGoalData ug
            WHERE ug.DepartmentID = 22
              AND ug.ModifiedAt IS NOT NULL
              AND ug.UserID IN (
                  SELECT DISTINCT jp.CreatedByUserID
                  FROM JobPositions jp
                  WHERE jp.Status = 'CLOSED'
              )
        """;

    List<Map<String, Object>> dept22Rows = jdbcTemplate.queryForList(dept22GoalSql);

    for (Map<String, Object> row : dept22Rows) {

      Integer userId = (Integer) row.get("UserID");
      LocalDate workDate = ((java.sql.Date) row.get("modifiedDate")).toLocalDate();
      BigDecimal achievedGoal = row.get("AchievedGoal") != null
          ? new BigDecimal(row.get("AchievedGoal").toString())
          : BigDecimal.ZERO;

      long days = achievedGoal.longValue();

      BigDecimal targetAchievedPercent;

      if (days < 40) {

        targetAchievedPercent = BigDecimal.valueOf(100);

      } else {

        long extraDays = days - 40;
        long reductionSteps = extraDays / 10;

        int percentage = 100 - (int) (reductionSteps * 10);

        percentage = Math.max(percentage, 0);

        targetAchievedPercent = BigDecimal.valueOf(percentage);
      }

      String efficiency;

      if (targetAchievedPercent.compareTo(BigDecimal.valueOf(90)) >= 0)
        efficiency = "High";
      else if (targetAchievedPercent.compareTo(BigDecimal.valueOf(75)) >= 0)
        efficiency = "At Par";
      else
        efficiency = "Low";

      saveSummaryDept22(userId, workDate, targetAchievedPercent, efficiency);
    }
  }

  private void saveSummaryDept22(
      Integer userId,
      LocalDate workDate,
      BigDecimal targetAchievedPercent,
      String efficiency) {

    EfficiencyUtilizationSummary summary = new EfficiencyUtilizationSummary();
    summary.setUserID(userId);
    summary.setDepartmentID(22);
    summary.setWorkDate(workDate);
    summary.setAllocatedTimeHrs(BigDecimal.ZERO);
    summary.setTotalTimeOfWork(BigDecimal.ZERO);
    summary.setTargetAchievedPercent(targetAchievedPercent);
    summary.setEfficiencyLevel(efficiency);
    summary.setUtilizationPercent(targetAchievedPercent);

    summaryRepository.save(summary);
  }
  // @Transactional
  // public void calculateAndSaveDailyEfficiency() {

  // summaryRepository.truncateTable();

  // // NON-SALES USERS (from UserWorkData)
  // List<Object[]> results = userWorkDataRepository.fetchUserWorkDataGrouped();

  // for (Object[] row : results) {

  // Integer userId = ((Number) row[0]).intValue();
  // Integer departmentId = ((Number) row[1]).intValue();
  // LocalDate workDate = ((java.sql.Date) row[2]).toLocalDate();

  // Double allocatedTime = row[3] != null ? ((Number) row[3]).doubleValue() :
  // 0.0;
  // Double timeTaken = row[4] != null ? ((Number) row[4]).doubleValue() : 0.0;
  // Double avgTotalUnitValues = row[5] != null ? ((Number) row[5]).doubleValue()
  // : null;

  // Boolean isHalfDayLeave = null;
  // if (row[6] != null) {
  // Object obj = row[6];
  // if (obj instanceof Number) {
  // isHalfDayLeave = ((Number) obj).intValue() == 1;
  // } else if (obj instanceof Boolean) {
  // isHalfDayLeave = (Boolean) obj;
  // }
  // }

  // Set<Integer> SPECIAL_HOURS_DEPTS = Set.of(3, 4, 7, 14, 23, 31, 32);
  // Set<Integer> TAT_BASED_DEPTS = Set.of(7, 14, 23, 31, 32, 16, 26, 20, 38, 18,
  // 25, 19, 42, 43, 44, 45, 46);

  // boolean isSpecialDept = SPECIAL_HOURS_DEPTS.contains(departmentId);
  // boolean isTargetAchievedSpecialDept = TAT_BASED_DEPTS.contains(departmentId);

  // // Determine standard working hours
  // BigDecimal STANDARD_TIME;
  // if (Boolean.TRUE.equals(isHalfDayLeave)) {
  // STANDARD_TIME = isSpecialDept ? BigDecimal.valueOf(3.5) :
  // BigDecimal.valueOf(4.0);
  // } else {
  // STANDARD_TIME = isSpecialDept ? BigDecimal.valueOf(7.0) :
  // BigDecimal.valueOf(8.0);
  // }

  // // ─── STEP 1: Calculate Target Achieved % ──────────────────────────────
  // BigDecimal targetAchievedPercent;

  // if (isTargetAchievedSpecialDept && allocatedTime > 0) {
  // BigDecimal allocated = BigDecimal.valueOf(allocatedTime);
  // BigDecimal timeTakenBD = BigDecimal.valueOf(timeTaken);

  // BigDecimal rawPercent = timeTakenBD
  // .divide(allocated, 4, RoundingMode.HALF_UP)
  // .multiply(BigDecimal.valueOf(100));

  // BigDecimal hundred = BigDecimal.valueOf(100);

  // if (rawPercent.compareTo(hundred) <= 0) {
  // targetAchievedPercent = hundred;
  // } else {
  // targetAchievedPercent = hundred.subtract(rawPercent.subtract(hundred));
  // }

  // if (targetAchievedPercent.compareTo(BigDecimal.ZERO) < 0) {
  // targetAchievedPercent = BigDecimal.ZERO;
  // }

  // targetAchievedPercent = targetAchievedPercent.setScale(2,
  // RoundingMode.HALF_UP);

  // } else {
  // targetAchievedPercent = avgTotalUnitValues != null
  // ? BigDecimal.valueOf(avgTotalUnitValues).setScale(2, RoundingMode.HALF_UP)
  // : BigDecimal.ZERO;
  // }

  // // ─── STEP 2: Calculate Utilization (Goal Achieved %) ──────────────────
  // BigDecimal utilization = BigDecimal.ZERO;
  // if (STANDARD_TIME.compareTo(BigDecimal.ZERO) > 0) {
  // utilization = BigDecimal.valueOf(timeTaken)
  // .divide(STANDARD_TIME, 2, RoundingMode.HALF_UP)
  // .multiply(BigDecimal.valueOf(100));
  // }

  // // ─── STEP 3: Determine Efficiency Level ───────────────────────────────
  // String efficiency;
  // boolean timeTakenWithinAllocated = allocatedTime > 0 && timeTaken <=
  // allocatedTime;

  // if (isSpecialDept) {
  // // TAT-based / special depts: inverted scale (less time = better)
  // if (targetAchievedPercent.compareTo(BigDecimal.valueOf(100)) <= 0) efficiency
  // = "High";
  // else if (targetAchievedPercent.compareTo(BigDecimal.valueOf(120)) <= 0)
  // efficiency = "At Par";
  // else efficiency = "Low";

  // } else {
  // // Standard depts: 3-condition logic
  // boolean targetHigh = targetAchievedPercent.compareTo(BigDecimal.valueOf(100))
  // >= 0;
  // boolean targetAtPar = targetAchievedPercent.compareTo(BigDecimal.valueOf(80))
  // >= 0;
  // boolean goalHigh = utilization.compareTo(BigDecimal.valueOf(80)) >= 0;
  // boolean goalAtPar = utilization.compareTo(BigDecimal.valueOf(50)) >= 0;

  // if (targetHigh && goalHigh && timeTakenWithinAllocated) {
  // efficiency = "High";
  // } else if (targetAtPar && goalAtPar && timeTakenWithinAllocated) {
  // efficiency = "At Par";
  // } else {
  // efficiency = "Low";
  // }
  // }

  // // ─── STEP 4: Cap utilization at 100% for Low efficiency ───────────────
  // if ("Low".equalsIgnoreCase(efficiency) &&
  // utilization.compareTo(BigDecimal.valueOf(100)) > 0) {
  // utilization = BigDecimal.valueOf(100);
  // }

  // saveSummary(
  // userId,
  // departmentId,
  // workDate,
  // allocatedTime,
  // timeTaken,
  // targetAchievedPercent,
  // efficiency,
  // utilization);
  // }

  // // ─── TA USERS (Based on Position Close TAT) ─────────────────────────────
  // List<JobPosition> closedPositions =
  // jobPositionRepository.findByStatusAndCloseDateIsNotNull(PositionStatus.CLOSED);

  // for (JobPosition position : closedPositions) {

  // Integer userId = position.getCreatedByUserID();
  // LocalDate workDate = position.getCloseDate();

  // long days = ChronoUnit.DAYS.between(
  // position.getCreatedAt().toLocalDateTime().toLocalDate(),
  // position.getCloseDate());

  // BigDecimal targetAchievedPercent = calculateTATPercent(days);

  // String efficiency;
  // if (targetAchievedPercent.compareTo(BigDecimal.valueOf(90)) >= 0) efficiency
  // = "High";
  // else if (targetAchievedPercent.compareTo(BigDecimal.valueOf(75)) >= 0)
  // efficiency = "At Par";
  // else efficiency = "Low";

  // BigDecimal utilization = targetAchievedPercent;

  // saveSummary(userId, 22, workDate, 0.0, 0.0, targetAchievedPercent,
  // efficiency, utilization);
  // }
  // }

  // private BigDecimal calculateTATPercent(long days) {
  // if (days <= 10)
  // return BigDecimal.valueOf(300);
  // if (days <= 20)
  // return BigDecimal.valueOf(200);
  // if (days <= 30)
  // return BigDecimal.valueOf(100);
  // if (days <= 40)
  // return BigDecimal.valueOf(90);
  // if (days <= 50)
  // return BigDecimal.valueOf(80);
  // if (days <= 60)
  // return BigDecimal.valueOf(70);

  // // After 60 reduce by 10% every 10 days until 0
  // long extra = days - 60;
  // long reductionSteps = extra / 10;
  // long value = 70 - (reductionSteps * 10);

  // if (value < 0)
  // value = 0;

  // return BigDecimal.valueOf(value);
  // }

  // old code of dep 22 TAT calculation with debug logs
  // private BigDecimal calculateTATPercent(long days) {

  // System.out.println("===== TAT DEBUG START =====");
  // System.out.println("Days Received = " + days);

  // if (days <= 10) {

  // System.out.println("Matched: <= 10");
  // System.out.println("Returning TAT = 300");

  // return BigDecimal.valueOf(300);
  // }

  // if (days <= 20) {

  // System.out.println("Matched: <= 20");
  // System.out.println("Returning TAT = 200");

  // return BigDecimal.valueOf(200);
  // }

  // if (days <= 30) {

  // System.out.println("Matched: <= 30");
  // System.out.println("Returning TAT = 100");

  // return BigDecimal.valueOf(100);
  // }

  // if (days <= 40) {

  // System.out.println("Matched: <= 40");
  // System.out.println("Returning TAT = 90");

  // return BigDecimal.valueOf(90);
  // }

  // if (days <= 50) {

  // System.out.println("Matched: <= 50");
  // System.out.println("Returning TAT = 80");

  // return BigDecimal.valueOf(80);
  // }

  // if (days <= 60) {

  // System.out.println("Matched: <= 60");
  // System.out.println("Returning TAT = 70");

  // return BigDecimal.valueOf(70);
  // }

  // // After 60 reduce by 10% every 10 days until 0

  // long extra = days - 60;

  // System.out.println("Extra Days After 60 = " + extra);

  // long reductionSteps = extra / 10;

  // System.out.println("Reduction Steps = " + reductionSteps);

  // long value = 70 - (reductionSteps * 10);

  // System.out.println("Calculated Value Before Clamp = " + value);

  // if (value < 0) {

  // System.out.println("Value Below 0 → Setting to 0");

  // value = 0;
  // }

  // System.out.println("Final TAT Value = " + value);
  // System.out.println("===== TAT DEBUG END =====");

  // return BigDecimal.valueOf(value);
  // }

  private long getWorkingDays(LocalDate startDate,
      LocalDate endDate) {

    long count = 0;

    LocalDate date = startDate;

    while (!date.isAfter(endDate)) {

      DayOfWeek day = date.getDayOfWeek();

      if (day != DayOfWeek.SATURDAY &&
          day != DayOfWeek.SUNDAY) {

        count++;
      }

      date = date.plusDays(1);
    }

    return count;
  }

  private BigDecimal calculateTAMPercent(long workingDays) {

    if (workingDays <= 7) {
      return BigDecimal.valueOf(100);
    }

    long extraDays = workingDays - 7;

    long percentage = 100 - (extraDays * 5);

    if (percentage < 0) {
      percentage = 0;
    }

    return BigDecimal.valueOf(percentage);
  }

  private BigDecimal calculateTATPercent(long days) {

    // ONLY FOR DEPARTMENT 22 (TA)

    // <= 40 days => 100%
    if (days <= 40) {
      return BigDecimal.valueOf(100);
    }

    // Extra days after 40
    long extraDays = days - 40;

    // Every 10 days reduce 10%
    long reductionSteps = extraDays / 10;

    long percentage = 100 - (reductionSteps * 10);

    // Prevent negative
    if (percentage < 0) {
      percentage = 0;
    }

    return BigDecimal.valueOf(percentage);
  }

  private void saveSummary(
      Integer userId,
      Integer departmentId,
      LocalDate workDate,
      Double allocatedTime,
      Double timeTaken,
      BigDecimal targetAchievedPercent,
      String efficiency,
      BigDecimal utilization) {

    EfficiencyUtilizationSummary summary = summaryRepository
        .findByUserIDAndDepartmentIDAndWorkDate(userId, departmentId, workDate)
        .orElse(new EfficiencyUtilizationSummary());

    summary.setUserID(userId);
    summary.setDepartmentID(departmentId);
    summary.setWorkDate(workDate);
    summary.setAllocatedTimeHrs(BigDecimal.valueOf(allocatedTime));
    summary.setTotalTimeOfWork(BigDecimal.valueOf(timeTaken));
    summary.setTargetAchievedPercent(targetAchievedPercent);
    summary.setEfficiencyLevel(efficiency);
    summary.setUtilizationPercent(utilization);

    summaryRepository.save(summary);
  }
}
