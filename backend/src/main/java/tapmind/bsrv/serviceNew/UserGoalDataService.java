package tapmind.bsrv.serviceNew;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import tapmind.bsrv.dto.DashBoardFilter;
import tapmind.bsrv.dto.UserGoalDataFilterRequestDTO;
import tapmind.bsrv.dto.UserGoalDataResponseDTO;
import tapmind.bsrv.dto.UserGoalDataResponseWrapperDTO;
import tapmind.bsrv.model.QuarterlyReview;
import tapmind.bsrv.model.User;
import tapmind.bsrv.model.UserGoalData;
import tapmind.bsrv.repository.*;
import tapmind.bsrv.dto.GoalAchievementUpdateRequest;
import tapmind.bsrv.dto.RevisedGoalUpdateRequestDTO;
import tapmind.bsrv.dto.RevisedGoalDetailsDTO;
import tapmind.bsrv.dto.ReviewStatusFilterDTO;
import tapmind.bsrv.dto.ReviewStatusSummaryDTO;
import tapmind.bsrv.exception.ResourceNotFoundException;

@Service
public class UserGoalDataService {

  @Autowired
  private UserGoalDataRepository userGoalDataRepository;

  @Autowired
  private UserWorkDataRepository userWorkDataRepository;

  @Autowired
  private UserRepository userRepository;

  @Autowired
  private SalesCallScheduleRepository salesCallScheduleRepository;
  @Autowired
  private EfficiencyUtilizationSummaryRepository summaryRepository;
  @Autowired
  private MISUpdateLogRepository misUpdateLogRepository;
  @Autowired
  private DashBoardService dashBoardService;
  @Autowired
  private DepartmentRepository departmentRepository;

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @Autowired
  private ObjectMapper objectMapper;

  @Autowired
  private QuarterlyReviewRepository quarterlyReviewRepository;

  // Goal = Target users: for these users, goalEfficiencyPercent uses
  // TargetAchievedPercent
  private static final Map<Integer, Set<Integer>> GOAL_EQUALS_TARGET_USERS = new HashMap<>();

  private static final DateTimeFormatter AUDIT_TIME_FORMAT =
      DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
  static {
    GOAL_EQUALS_TARGET_USERS.put(135, Set.of(4, 5)); // Sidd: Apr, May
    GOAL_EQUALS_TARGET_USERS.put(122, Set.of(4, 5, 6)); // Jyotishman: Apr, May, Jun
    GOAL_EQUALS_TARGET_USERS.put(131, Set.of(4, 5, 6)); // Nirmal: Apr, May, Jun
    GOAL_EQUALS_TARGET_USERS.put(112, Set.of(4, 5, 6)); // Sandhya: Apr
    GOAL_EQUALS_TARGET_USERS.put(102, Set.of(4)); // Nithin: Apr
    GOAL_EQUALS_TARGET_USERS.put(121, Set.of(4, 5, 6)); // Kavya: Apr, May, Jun
    GOAL_EQUALS_TARGET_USERS.put(108, Set.of(4)); // Anantha: Apr
    GOAL_EQUALS_TARGET_USERS.put(130, Set.of(4, 5, 6)); // dept 31: Goal = Target Apr-Jun
    GOAL_EQUALS_TARGET_USERS.put(97, Set.of(4, 5, 6)); // dept 14: Goal = Target Apr-Jun
    GOAL_EQUALS_TARGET_USERS.put(118, Set.of(4, 5, 6)); // dept 32: Goal = Target Apr-Jun
    GOAL_EQUALS_TARGET_USERS.put(90, Set.of(4, 5, 6)); // Girish (dept 7): Goal = Target Apr-Jun
    GOAL_EQUALS_TARGET_USERS.put(158, Set.of(4, 5, 6)); // Jagadisha (dept 42): Goal = Target Apr-Jun
  }

  private boolean isGoalEqualsTargetUser(Integer userID) {
    return userID != null && GOAL_EQUALS_TARGET_USERS.containsKey(userID);
  }

  private Set<Integer> getGoalEqualsTargetMonths(Integer userID) {
    return GOAL_EQUALS_TARGET_USERS.getOrDefault(userID, Set.of());
  }

  private boolean isGoalEqualsTargetMonth(Integer userID, Integer month) {
    return isGoalEqualsTargetUser(userID)
        && getGoalEqualsTargetMonths(userID).contains(month);
  }

  private Integer resolveUserDepartment(Integer userID) {
    try {
      List<Map<String, Object>> rows = jdbcTemplate
          .queryForList("SELECT du.DepartmentID FROM DepartmentUser du WHERE du.UserID = ?", userID);
      if (!rows.isEmpty() && rows.get(0).get("DepartmentID") != null) {
        return ((Number) rows.get(0).get("DepartmentID")).intValue();
      }
    } catch (Exception ignored) {
    }
    return null;
  }

  private Integer resolveUserDepartmentFromGoalData(Integer userID, LocalDate start, LocalDate end) {
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
            """, Integer.class, userID, Date.valueOf(start), Date.valueOf(end));
      } else {
        depts = jdbcTemplate.queryForList("""
            SELECT DepartmentID
            FROM UserGoalData
            WHERE UserID = ?
              AND DepartmentID IS NOT NULL
            ORDER BY WorkDate DESC
            LIMIT 1
            """, Integer.class, userID);
      }
      return (depts.isEmpty() || depts.get(0) == null) ? null : depts.get(0);
    } catch (Exception ignored) {
      return null;
    }
  }

  private List<Map<String, Object>> loadGoalEqualsTargetDays(
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
    for (Map<String, Object> row : rows) {
      LocalDate workDate = toLocalDate(row.get("WorkDate"));
      BigDecimal raw = new BigDecimal(row.get("TargetAchievedPercent").toString());
      row.put("_target", computeDeptTargetPercent(userID, departmentID, workDate, raw));
    }
    return rows;
  }

  private LocalDate toLocalDate(Object value) {
    if (value instanceof java.sql.Date) {
      return ((java.sql.Date) value).toLocalDate();
    }
    if (value instanceof java.time.LocalDate) {
      return (java.time.LocalDate) value;
    }
    return LocalDate.parse(value.toString());
  }

  private BigDecimal averageTarget(BigDecimal total, int count) {
    if (count == 0) {
      return BigDecimal.ZERO;
    }
    return total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
  }

  private BigDecimal averageMonthlyBreakdown(List<Map<String, Object>> monthlyAvgBreakdown) {
    if (monthlyAvgBreakdown == null || monthlyAvgBreakdown.isEmpty()) {
      return BigDecimal.ZERO;
    }
    BigDecimal total = BigDecimal.ZERO;
    for (Map<String, Object> month : monthlyAvgBreakdown) {
      total = total.add(new BigDecimal(month.get("AvgPercent").toString()));
    }
    return total.divide(
        BigDecimal.valueOf(monthlyAvgBreakdown.size()), 2, RoundingMode.HALF_UP);
  }

  private BigDecimal averagePercentOverMonths(
      List<Map<String, Object>> monthlyAvgBreakdown,
      LocalDate startDate,
      LocalDate endDate) {
    if (monthlyAvgBreakdown == null || startDate == null || endDate == null) {
      return BigDecimal.ZERO;
    }
    Map<String, BigDecimal> byKey = new HashMap<>();
    for (Map<String, Object> month : monthlyAvgBreakdown) {
      String key = month.get("Year") + "-" + month.get("MonthNumber");
      byKey.put(key, new BigDecimal(month.get("AvgPercent").toString()));
    }
    BigDecimal total = BigDecimal.ZERO;
    int months = 0;
    LocalDate current = startDate.withDayOfMonth(1);
    while (!current.isAfter(endDate)) {
      String key = current.getYear() + "-" + current.getMonthValue();
      total = total.add(byKey.getOrDefault(key, BigDecimal.ZERO));
      months++;
      current = current.withDayOfMonth(current.lengthOfMonth()).plusDays(1);
    }
    return averageTarget(total, months);
  }

  private BigDecimal computeDeptTargetPercent(
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

  private MonthlyAvgResult getMonthlyAvgPercent(
      UserGoalDataFilterRequestDTO filter, Integer userID, Integer departmentID) {

    if (isGoalEqualsTargetUser(userID)) {
      Integer dept = departmentID != null ? departmentID : resolveUserDepartment(userID);
      return new MonthlyAvgResult(getGoalEqualsTargetMonthlyAvg(filter, userID, dept), false);
    }

    if (userID != null && userID == 155
        && filter.getStartDate() != null && filter.getEndDate() != null
        && !filter.getStartDate().isBefore(LocalDate.of(2026, 4, 1))
        && !filter.getEndDate().isAfter(LocalDate.of(2026, 6, 30))) {
      return new MonthlyAvgResult(
          getSumBySumMonthlyAvg(userID, filter.getStartDate(), filter.getEndDate()), false);
    }

    Integer goalID = normalize(filter.getGoalID());
    Integer elID = normalize(filter.getELID());

    // ✅ Use the elID-aware overload (same as listPaginated but unpaged).
    // The window is widened to the full quarters overlapping the filter, so a
    // quarterly goal entered in a later month (e.g. Sept 30) still mirrors into
    // earlier months of the same quarter (e.g. an Aug-only filter).
    LocalDate queryStart = filter.getStartDate() != null
        ? quarterStartOf(filter.getStartDate())
        : null;
    LocalDate queryEnd = filter.getEndDate() != null
        ? quarterStartOf(filter.getEndDate()).plusMonths(3).minusDays(1)
        : null;

    Pageable unpaged = Pageable.unpaged();
    Page<UserGoalData> pageData;
    if (Integer.valueOf(22).equals(departmentID)) {
      pageData = userGoalDataRepository.findFilteredWithRelationsByUpdatedAt(
          userID, departmentID, goalID, elID,
          queryStart, queryEnd, unpaged);
    } else {
      pageData = userGoalDataRepository.findFilteredWithRelations(
          userID, departmentID, goalID, elID,
          queryStart, queryEnd, unpaged);
    }

    List<UserGoalData> allData = pageData.getContent();

    ContributionResult contributions = buildMonthlyContributions(filter, allData);
    List<Map<String, Object>> monthlyBreakdown =
        monthlyBreakdownFrom(contributions.contribByMonth);

    return new MonthlyAvgResult(monthlyBreakdown, contributions.hasApprovedRevised);
  }

  /** month key -> {goalID, percent} contributions, with quarterly mirroring. */
  private ContributionResult buildMonthlyContributions(
      UserGoalDataFilterRequestDTO filter, List<UserGoalData> allData) {

    // month key -> percent contributions (one per source row, with its goal)
    Map<String, List<Object[]>> contribByMonth = new java.util.TreeMap<>();
    boolean hasApprovedRevised = false;

    // Pass 1: each row contributes to its own month when it is in range.
    for (UserGoalData g : allData) {
      UserGoalDataResponseDTO dto = mapToResponse(g);
      BigDecimal contribution = monthlyPercentContribution(dto);

      if (isWithinFilter(g.getWorkDate(), filter)) {
        contribByMonth.computeIfAbsent(monthKeyOf(g.getWorkDate()), k -> new ArrayList<>())
            .add(new Object[] { g.getGoalID(), contribution });
      }

      RevisedGoalDetailsDTO revised = dto.getRevisedGoal();
      if (isWithinFilter(g.getWorkDate(), filter)
          && revised != null
          && Boolean.TRUE.equals(revised.getElApproved())
          && revised.getValue() != null) {
        hasApprovedRevised = true;
      }
    }

    // Pass 2: a quarterly goal covers its whole quarter — mirror its percent
    // into the quarter's other in-range months, replacing any row of the same
    // goal already sitting in those months (so a lone 0 row does not dilute it).
    for (UserGoalData g : allData) {
      if (!isQuarterlyGoal(g)) {
        continue;
      }
      UserGoalDataResponseDTO dto = mapToResponse(g);
      BigDecimal contribution = monthlyPercentContribution(dto);

      LocalDate workDate = g.getWorkDate();
      String ownKey = monthKeyOf(workDate);
      LocalDate quarterStart = quarterStartOf(workDate);
      LocalDate quarterEnd = quarterStart.plusMonths(3).minusDays(1);
      boolean mirrored = false;

      for (LocalDate month = quarterStart;
          !month.isAfter(quarterEnd);
          month = month.plusMonths(1)) {
        if (filter.getStartDate() != null
            && month.isBefore(filter.getStartDate().withDayOfMonth(1))) {
          continue;
        }
        if (filter.getEndDate() != null
            && month.isAfter(filter.getEndDate().withDayOfMonth(1))) {
          continue;
        }
        String mirroredKey = monthKeyOf(month);
        if (mirroredKey.equals(ownKey)) {
          continue;
        }
        List<Object[]> monthValues =
            contribByMonth.computeIfAbsent(mirroredKey, k -> new ArrayList<>());
        monthValues.removeIf(v -> g.getGoalID() != null && g.getGoalID().equals(v[0]));
        monthValues.add(new Object[] { g.getGoalID(), contribution });
        mirrored = true;
      }

      if (mirrored) {
        RevisedGoalDetailsDTO revised = dto.getRevisedGoal();
        if (revised != null
            && Boolean.TRUE.equals(revised.getElApproved())
            && revised.getValue() != null) {
          hasApprovedRevised = true;
        }
      }
    }

    return new ContributionResult(contribByMonth, hasApprovedRevised);
  }

  private List<Map<String, Object>> monthlyBreakdownFrom(
      Map<String, List<Object[]>> contribByMonth) {

    List<Map<String, Object>> monthlyBreakdown = new ArrayList<>();

    contribByMonth.entrySet().forEach(entry -> {
      List<Object[]> values = entry.getValue();

      BigDecimal total = values.stream()
          .map(v -> (BigDecimal) v[1])
          .reduce(BigDecimal.ZERO, BigDecimal::add);

      BigDecimal monthAvg = values.isEmpty()
          ? BigDecimal.ZERO
          : total.divide(
              BigDecimal.valueOf(values.size()),
              2,
              RoundingMode.HALF_UP);

      String[] parts = entry.getKey().split("-");
      Map<String, Object> monthMap = new LinkedHashMap<>();
      monthMap.put("Year", Integer.parseInt(parts[0]));
      monthMap.put("MonthNumber", Integer.parseInt(parts[1]));
      monthMap.put("AvgPercent", monthAvg);
      monthlyBreakdown.add(monthMap);
    });

    return monthlyBreakdown;
  }

  private String monthKeyOf(LocalDate date) {
    return date.getYear() + "-" + String.format("%02d", date.getMonthValue());
  }

  private boolean isQuarterlyGoal(UserGoalData g) {
    if (g.getGoal() == null) {
      return false;
    }
    String frequency = g.getGoal().getFrequency();
    return frequency != null
        && frequency.toLowerCase(java.util.Locale.ROOT).contains("quarter");
  }

  private LocalDate quarterStartOf(LocalDate date) {
    return date.withDayOfMonth(1).withMonth(((date.getMonthValue() - 1) / 3) * 3 + 1);
  }

  private boolean isWithinFilter(LocalDate date, UserGoalDataFilterRequestDTO filter) {
    if (filter.getStartDate() != null && date.isBefore(filter.getStartDate())) {
      return false;
    }
    if (filter.getEndDate() != null && date.isAfter(filter.getEndDate())) {
      return false;
    }
    return true;
  }

  private static final class ContributionResult {
    private final Map<String, List<Object[]>> contribByMonth;
    private final boolean hasApprovedRevised;

    private ContributionResult(
        Map<String, List<Object[]>> contribByMonth, boolean hasApprovedRevised) {
      this.contribByMonth = contribByMonth;
      this.hasApprovedRevised = hasApprovedRevised;
    }
  }

  private static final class MonthlyAvgResult {
    private final List<Map<String, Object>> breakdown;
    private final boolean hasApprovedRevised;

    private MonthlyAvgResult(List<Map<String, Object>> breakdown, boolean hasApprovedRevised) {
      this.breakdown = breakdown;
      this.hasApprovedRevised = hasApprovedRevised;
    }
  }

  private BigDecimal monthlyPercentContribution(UserGoalDataResponseDTO dto) {
    RevisedGoalDetailsDTO revised = dto.getRevisedGoal();
    if (revised != null
        && Boolean.TRUE.equals(revised.getElApproved())
        && revised.getValue() != null) {
      return revised.getValue();
    }
    return dto.getGoalEfficiencyPercent() != null
        ? dto.getGoalEfficiencyPercent()
        : BigDecimal.ZERO;
  }

  private List<Map<String, Object>> getSumBySumMonthlyAvg(
      Integer userID, LocalDate startDate, LocalDate endDate) {
    LocalDate current = startDate.withDayOfMonth(1);
    List<Map<String, Object>> monthlyBreakdown = new ArrayList<>();
    while (!current.isAfter(endDate)) {
      LocalDate monthStart = current.withDayOfMonth(1);
      LocalDate monthEnd = current.withDayOfMonth(current.lengthOfMonth());
      BigDecimal achieved = userGoalDataRepository.sumAchievedGoalByUserAndDateRange(
          userID, monthStart, monthEnd);
      BigDecimal units = userWorkDataRepository.sumAchivedUnitsByIsForTarget(
          userID, monthStart, monthEnd);
      BigDecimal fixed = units.multiply(BigDecimal.valueOf(0.35));
      BigDecimal monthAvg = fixed.compareTo(BigDecimal.ZERO) > 0
          ? achieved.divide(fixed, 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100))
              .setScale(2, RoundingMode.HALF_UP)
          : BigDecimal.ZERO;

      Map<String, Object> monthMap = new LinkedHashMap<>();
      monthMap.put("Year", current.getYear());
      monthMap.put("MonthNumber", current.getMonthValue());
      monthMap.put("AvgPercent", monthAvg);
      monthlyBreakdown.add(monthMap);

      current = monthEnd.plusDays(1);
    }
    return monthlyBreakdown;
  }

  private List<Map<String, Object>> getGoalEqualsTargetMonthlyAvg(
      UserGoalDataFilterRequestDTO filter, Integer userID, Integer departmentID) {

    LocalDate startDate = filter.getStartDate();
    LocalDate endDate = filter.getEndDate();
    Set<Integer> applicableMonths = getGoalEqualsTargetMonths(userID);

    List<Map<String, Object>> dayRows = loadGoalEqualsTargetDays(userID, departmentID, startDate, endDate);

    Map<String, List<BigDecimal>> byMonth = new LinkedHashMap<>();
    for (Map<String, Object> row : dayRows) {
      LocalDate workDate = toLocalDate(row.get("WorkDate"));
      String key = workDate.getYear() + "-" + String.format("%02d", workDate.getMonthValue());
      byMonth.computeIfAbsent(key, k -> new ArrayList<>())
          .add(new BigDecimal(row.get("_target").toString()));
    }

    // Quarterly-aware goal averages (UserGoalData, widened to whole quarters) so
    // a quarterly goal entered in a later month still counts for earlier months
    // of the same quarter — e.g. a Sept 30 entry covering Jul-Sep.
    Map<String, BigDecimal> goalAvgByKey = new LinkedHashMap<>();
    if (startDate != null && endDate != null) {
      Page<UserGoalData> goalPage = userGoalDataRepository.findFilteredWithRelations(
          userID, departmentID, null, null,
          quarterStartOf(startDate),
          quarterStartOf(endDate).plusMonths(3).minusDays(1),
          Pageable.unpaged());
      ContributionResult contributions =
          buildMonthlyContributions(filter, goalPage.getContent());
      for (Map.Entry<String, List<Object[]>> entry :
          contributions.contribByMonth.entrySet()) {
        List<Object[]> values = entry.getValue();
        BigDecimal total = values.stream()
            .map(v -> (BigDecimal) v[1])
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        goalAvgByKey.put(entry.getKey(), values.isEmpty()
            ? BigDecimal.ZERO
            : total.divide(BigDecimal.valueOf(values.size()), 2, RoundingMode.HALF_UP));
      }
    }

    List<Map<String, Object>> monthlyBreakdown = new ArrayList<>();
    LocalDate current = startDate.withDayOfMonth(1);
    while (!current.isAfter(endDate)) {
      int year = current.getYear();
      int month = current.getMonthValue();
      String key = year + "-" + String.format("%02d", month);

      Map<String, Object> monthMap = new LinkedHashMap<>();
      monthMap.put("Year", year);
      monthMap.put("MonthNumber", month);

      if (applicableMonths.contains(month) && byMonth.containsKey(key)) {
        List<BigDecimal> vals = byMonth.get(key);
        BigDecimal total = vals.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        monthMap.put("AvgPercent", averageTarget(total, vals.size()));
      } else if (applicableMonths.contains(month)) {
        monthMap.put("AvgPercent", BigDecimal.ZERO);
      } else {
        LocalDate monthStart = current.withDayOfMonth(1);
        LocalDate monthEnd = current.withDayOfMonth(current.lengthOfMonth());
        LocalDate from = startDate.isAfter(monthStart) ? startDate : monthStart;
        LocalDate to = endDate.isBefore(monthEnd) ? endDate : monthEnd;
        BigDecimal goalAvg = goalAvgByKey.get(key);
        if (goalAvg == null) {
          goalAvg = computeGoalAvgForMonth(userID, from, to);
        }
        monthMap.put("AvgPercent", goalAvg);
      }

      monthlyBreakdown.add(monthMap);
      current = current.withDayOfMonth(current.lengthOfMonth()).plusDays(1);
    }

    return monthlyBreakdown;
  }

  private BigDecimal computeGoalAvgForMonth(Integer userID, LocalDate monthStart, LocalDate monthEnd) {
    String sql = """
            SELECT COALESCE(
                ROUND(
                    AVG(CASE WHEN CASE WHEN ug.RevisedGoal IS NOT NULL AND ug.RevisedGoal != ''
                          AND JSON_UNQUOTE(JSON_EXTRACT(ug.RevisedGoal, '$.elApproved')) = 'true'
                          THEN CAST(JSON_EXTRACT(ug.RevisedGoal, '$.value') AS DECIMAL(10,2))
                          ELSE ug.FixedGoal END > 0
                        THEN CASE WHEN ug.RevisedGoal IS NOT NULL AND ug.RevisedGoal != ''
                              AND JSON_UNQUOTE(JSON_EXTRACT(ug.RevisedGoal, '$.elApproved')) = 'true'
                              THEN CAST(JSON_EXTRACT(ug.RevisedGoal, '$.value') AS DECIMAL(10,2))
                              ELSE (ug.AchievedGoal * 100.0) / ug.FixedGoal END
                        ELSE 0 END), 2), 0)
            FROM UserGoalData ug
            WHERE ug.UserID = ?
              AND ug.WorkDate BETWEEN ? AND ?
        """;
    BigDecimal result = jdbcTemplate.queryForObject(sql, BigDecimal.class, userID, monthStart, monthEnd);
    return result != null ? result : BigDecimal.ZERO;
  }

  private List<UserGoalDataResponseDTO> buildGoalEqualsTargetDTOList(
      Integer userID, LocalDate startDate, LocalDate endDate) {

    String userSql = "SELECT u.UserName, u.UserID FROM Users u WHERE u.UserID = ?";
    Map<String, Object> userInfo = jdbcTemplate.queryForMap(userSql, userID);
    String userName = userInfo.get("UserName") != null ? userInfo.get("UserName").toString() : "";

    String deptSql = "SELECT du.DepartmentID FROM DepartmentUser du WHERE du.UserID = ?";
    List<Map<String, Object>> deptRows = jdbcTemplate.queryForList(deptSql, userID);
    Integer departmentID = deptRows.isEmpty() ? null : ((Number) deptRows.get(0).get("DepartmentID")).intValue();

    List<Map<String, Object>> rows = loadGoalEqualsTargetDays(userID, departmentID, startDate, endDate);

    return rows.stream()
        .filter(row -> isGoalEqualsTargetMonth(
            userID, toLocalDate(row.get("WorkDate")).getMonthValue()))
        .map(row -> {
          LocalDate workDate = toLocalDate(row.get("WorkDate"));
          BigDecimal targetPercent = new BigDecimal(row.get("_target").toString());
          return new UserGoalDataResponseDTO(
              null, workDate, userID, userName, departmentID,
              null, "Goal = Target",
              BigDecimal.ZERO, BigDecimal.ZERO,
              targetPercent, null, null, null, null);
        }).collect(Collectors.toList());
  }

  // ================= PAGINATED =================
  @Transactional(readOnly = true)
  public UserGoalDataResponseWrapperDTO listPaginated(
      UserGoalDataFilterRequestDTO filter, Integer page, Integer size, String sortBy) {

    int pageIndex = (page != null && page > 0) ? page - 1 : 0;

    String sortingField = "workDate".equalsIgnoreCase(sortBy) ? "workDate" : "userGoalDataID";

    Pageable pageable = PageRequest.of(pageIndex, size, Sort.by(sortingField).descending());

    Integer departmentID = normalize(filter.getDepartmentID());
    boolean forceFilter = filter.getUserID() != null && departmentID == null;
    Integer userID = resolveUserForRole(filter.getUserID(), forceFilter);
    Integer goalID = normalize(filter.getGoalID());
    Integer elID = normalize(filter.getELID());
    Page<UserGoalData> pageData;
    if (Integer.valueOf(22).equals(departmentID)) {
      pageData = userGoalDataRepository.findFilteredWithRelationsByUpdatedAt(
          userID, departmentID, goalID, elID,
          filter.getStartDate(), filter.getEndDate(), pageable);
    } else {
      pageData = userGoalDataRepository.findFilteredWithRelations(
          userID, departmentID, goalID, elID,
          filter.getStartDate(), filter.getEndDate(), pageable);
    }
    List<UserGoalDataResponseDTO> dtoList = pageData.getContent().stream().map(this::mapToResponse).toList();
    BigDecimal avgPercnet = null;

    if (departmentID == null && elID != null && elID > 0) {
      List<Integer> elDeptIDs = departmentRepository.findDepartmentIDWhereUserIsExecutiveLeader(elID);
      if (elDeptIDs.size() == 1) {
        departmentID = elDeptIDs.get(0);
      }
    }
    if (avgPercnet == null) {
      if (departmentID != null) {
        switch (departmentID) {
          case 37:
            avgPercnet = userGoalDataRepository.getAverageAchievedPercentageForSDAndSDA(
                userID, departmentID, goalID, filter.getStartDate(), filter.getEndDate());
            break;
           case 21:
           if (userID != null && userID == 155
      && filter.getStartDate() != null && filter.getEndDate() != null
      && !filter.getStartDate().isBefore(LocalDate.of(2026, 4, 1))
      && !filter.getEndDate().isAfter(LocalDate.of(2026, 6, 30))) {
    BigDecimal achieved = userGoalDataRepository.sumAchievedGoalByUserAndDateRange(
        userID, filter.getStartDate(), filter.getEndDate());
    BigDecimal units = userWorkDataRepository.sumAchivedUnitsByIsForTarget(
        userID, filter.getStartDate(), filter.getEndDate());
    BigDecimal fixed = units.multiply(BigDecimal.valueOf(0.35));
    avgPercnet = fixed.compareTo(BigDecimal.ZERO) > 0
        ? achieved.divide(fixed, 4, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100))
            .setScale(2, RoundingMode.HALF_UP)
        : BigDecimal.ZERO;
  } else {
    avgPercnet = userGoalDataRepository.getAverageAchievedPercentageForSD(
        userID, departmentID, goalID, filter.getStartDate(), filter.getEndDate());
  }
  break;
          default:
            avgPercnet = dashBoardService.getAverageSum(filter, userID);
        }
      } else {
        avgPercnet = dashBoardService.getAverageSum(filter, userID);
      }
    }

    // Generate synthetic DTOs from EfficiencyUtilizationSummary for
    // GOAL_EQUALS_TARGET_USERS (only for the Goal = Target months);
    // keep the real UserGoalData rows for all other months.
    if (isGoalEqualsTargetUser(userID)) {
      Set<Integer> goalMonths = getGoalEqualsTargetMonths(userID);
      List<UserGoalDataResponseDTO> syntheticList =
          buildGoalEqualsTargetDTOList(userID, filter.getStartDate(), filter.getEndDate());

      List<UserGoalDataResponseDTO> realOtherMonths = dtoList.stream()
          .filter(d -> d.getWorkDate() == null
              || !goalMonths.contains(d.getWorkDate().getMonthValue()))
          .collect(Collectors.toList());

      dtoList = new java.util.ArrayList<>();
      dtoList.addAll(realOtherMonths);
      dtoList.addAll(syntheticList);
      dtoList.sort(java.util.Comparator.comparing(
          UserGoalDataResponseDTO::getWorkDate));
    }

    UserGoalDataResponseWrapperDTO wrapper = new UserGoalDataResponseWrapperDTO();
    MonthlyAvgResult monthlyResult = getMonthlyAvgPercent(filter, userID, departmentID);
    List<Map<String, Object>> monthlyAvgBreakdown = monthlyResult.breakdown;

    if (isGoalEqualsTargetUser(userID)
        || (userID != null && (userID == 129 || userID == 124))) {
      avgPercnet = averageMonthlyBreakdown(monthlyAvgBreakdown);
    } else if (Integer.valueOf(21).equals(departmentID)
        || (departmentID == null && userID != null
            && (Integer.valueOf(21).equals(resolveUserDepartment(userID))
                || Integer.valueOf(21).equals(resolveUserDepartmentFromGoalData(
                    userID, filter.getStartDate(), filter.getEndDate()))))) {
      avgPercnet = averageMonthlyBreakdown(monthlyAvgBreakdown);
    } else if (Integer.valueOf(22).equals(departmentID)) {
      avgPercnet = averagePercentOverMonths(
          monthlyAvgBreakdown, filter.getStartDate(), filter.getEndDate());
    } else if (monthlyResult.hasApprovedRevised) {
      // An approved revised goal changes a month's average, so the overall
      // average must come from the same monthly breakdown (not the old sum/sum).
      avgPercnet = averageMonthlyBreakdown(monthlyAvgBreakdown);
    }

    int totalRecords = isGoalEqualsTargetUser(userID)
        ? dtoList.size()
        : (int) pageData.getTotalElements();
    int totalPages = isGoalEqualsTargetUser(userID)
        ? (size != null && size > 0 ? (int) Math.ceil((double) dtoList.size() / size) : 1)
        : pageData.getTotalPages();

    wrapper.setResponse(
        UserGoalDataResponseWrapperDTO.UserGoalDataReadResponseDTO.builder()
            .userGoalDataList(dtoList)
            .currentPage(page)
            .pageSize(size)
            .totalRecords(totalRecords)
            .totalPages(totalPages)
            .avgPercent(avgPercnet)
            .monthlyAvgBreakdown(monthlyAvgBreakdown)
            .build());
    wrapper.setStatus(true);
    wrapper.setStatusCode(200);
    wrapper.setMessage("Paginated user goal data retrieved successfully");

    return wrapper;
  }

  public DashBoardFilter getFilterDetails(UserGoalDataFilterRequestDTO filter) {
    DashBoardFilter dashBoardFilter = new DashBoardFilter();

    // Dashboard range
    dashBoardFilter.setStartDate(filter.getStartDate());
    dashBoardFilter.setEndDate(filter.getEndDate());

    // Goal range
    dashBoardFilter.setGoalStartDate(filter.getGoalStartDate());
    dashBoardFilter.setGoalEndDate(filter.getGoalEndDate());

    dashBoardFilter.setDepartmentID(filter.getDepartmentID());
    dashBoardFilter.setUserID(filter.getUserID());
    dashBoardFilter.setElID(filter.getELID());

    return dashBoardFilter;
  }

  // ================= FULL LIST =================
  @Transactional(readOnly = true)
  public UserGoalDataResponseWrapperDTO listAll(UserGoalDataFilterRequestDTO filter) {

    Integer departmentID = normalize(filter.getDepartmentID());
    boolean forceFilter = filter.getUserID() != null && departmentID == null;
    Integer userID = resolveUserForRole(filter.getUserID(), forceFilter);
    Integer goalID = normalize(filter.getGoalID());

    List<UserGoalData> list = userGoalDataRepository.findFilteredWithRelations(
        userID, departmentID, goalID, filter.getStartDate(), filter.getEndDate());

    List<UserGoalDataResponseDTO> dtoList = list.stream().map(this::mapToResponse).toList();

    UserGoalDataResponseWrapperDTO wrapper = new UserGoalDataResponseWrapperDTO();
    wrapper.setResponse(
        UserGoalDataResponseWrapperDTO.UserGoalDataReadResponseDTO.builder()
            .userGoalDataList(dtoList)
            .currentPage(1)
            .pageSize(dtoList.size())
            .totalRecords(dtoList.size())
            .totalPages(1)
            .build());
    wrapper.setStatus(true);
    wrapper.setStatusCode(200);
    wrapper.setMessage("User goal data retrieved successfully");

    return wrapper;
  }

  // ================= HELPERS =================
  private Integer resolveUserForRole(Integer userID, boolean forceFilter) {
    if (userID == null)
      return null;

    if (forceFilter) {
      return userID;
    }

    Integer roleID = userRepository.findRoleIdByUserId(userID);
    if (roleID != null && (roleID == 1 || roleID == 3)) {
      return null;
    }
    return userID;
  }

  private Integer normalize(Integer value) {
    return (value != null && value == 0) ? null : value;
  }

  // private UserGoalDataResponseDTO mapToResponse(UserGoalData g) {
  // return new UserGoalDataResponseDTO(
  // g.getUserGoalDataID(),
  // g.getWorkDate(),
  // g.getUserID(),
  // g.getUser().getName(), // ✅ user name
  // g.getDepartmentID(),
  // g.getGoalID(),
  // g.getGoal().getGoalName(), // ✅ goal name
  // g.getFixedGoal(),
  // g.getAchievedGoal()
  // );
  // }

  // private UserGoalDataResponseDTO mapToResponse(UserGoalData g) {

  // BigDecimal efficiency = BigDecimal.ZERO;
  // BigDecimal recalculatedTarget = null;

  // // ================= DEFAULT =================
  // if (g.getFixedGoal() != null
  // && g.getFixedGoal().compareTo(BigDecimal.ZERO) > 0) {

  // efficiency = g.getAchievedGoal()
  // .divide(g.getFixedGoal(), 2, RoundingMode.HALF_UP)
  // .multiply(BigDecimal.valueOf(100));
  // }

  // ================= SALES (DEPT 21) =================
  // if (g.getDepartmentID() == 21) {

  // int scheduled =
  // salesCallScheduleRepository.countScheduledCalls(
  // g.getUserID(),
  // g.getWorkDate(),
  // g.getWorkDate()
  // );

  // int completed =
  // salesCallScheduleRepository.countCompletedCalls(
  // g.getUserID(),
  // g.getWorkDate(),
  // g.getWorkDate()
  // );

  // if (scheduled > 0) {
  // recalculatedTarget =
  // BigDecimal.valueOf(completed)
  // .divide(BigDecimal.valueOf(scheduled), 2, RoundingMode.HALF_UP)
  // .multiply(BigDecimal.valueOf(100));

  // efficiency = recalculatedTarget;
  // } else {
  // efficiency = BigDecimal.ZERO;
  // }
  // }

  // return new UserGoalDataResponseDTO(
  // g.getUserGoalDataID(),
  // g.getWorkDate(),
  // g.getUserID(),
  // g.getUser().getName(),
  // g.getDepartmentID(),
  // g.getGoalID(),
  // g.getGoal().getGoalName(),
  // g.getFixedGoal(),
  // g.getAchievedGoal(),
  // efficiency,
  // recalculatedTarget
  // );
  // }

  private UserGoalDataResponseDTO mapToResponse(UserGoalData g) {

    BigDecimal efficiency = BigDecimal.ZERO;
    BigDecimal recalculatedTarget = null;

    // ================= SALES (DEPT 37) =================
    if (g.getDepartmentID() == 37) {

      Integer achievedUnits = userWorkDataRepository.sumAchievedUnitsForTargetWithTask(
          g.getUserID(), g.getWorkDate(), g.getDepartmentID(), 65);

      BigDecimal achievedUnitsFromWorkData = achievedUnits != null ? BigDecimal.valueOf(achievedUnits)
          : BigDecimal.ZERO;

      BigDecimal achievedGoalFromGoalTable = g.getAchievedGoal() != null ? g.getAchievedGoal() : BigDecimal.ZERO;

      if (achievedUnitsFromWorkData.compareTo(BigDecimal.ZERO) > 0) {

        // ✅ Step 1: Calculate 70% of achieved units
        BigDecimal seventyPercentUnits = achievedUnitsFromWorkData
            .multiply(BigDecimal.valueOf(0.70))
            .setScale(2, RoundingMode.HALF_UP);

        // ✅ Send this to UI
        recalculatedTarget = seventyPercentUnits;

        // ✅ Step 2: Efficiency = AchievedGoal / (70% units) × 100
        if (seventyPercentUnits.compareTo(BigDecimal.ZERO) > 0) {
          efficiency = achievedGoalFromGoalTable
              .divide(seventyPercentUnits, 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100))
              .setScale(2, RoundingMode.HALF_UP);
        } else {
          efficiency = BigDecimal.ZERO;
        }

      } else {
        efficiency = BigDecimal.ZERO;
        recalculatedTarget = BigDecimal.ZERO;
      }
    } else if (g.getDepartmentID() == 13) {
      // GoalID → TaskID mapping for dept 13
      Map<Integer, Integer> goalToTaskMap = new HashMap<>();
      goalToTaskMap.put(27, 31); // replace with actual GoalID
      goalToTaskMap.put(28, 48); // replace with actual GoalID

      // GoalID → percentage mapping for dept 13
      Map<Integer, BigDecimal> goalToPercentMap = new HashMap<>();
      goalToPercentMap.put(27, BigDecimal.valueOf(0.70));
      goalToPercentMap.put(28, BigDecimal.valueOf(0.50));

      Integer currentGoalID = g.getGoalID();
      Integer resolvedTaskID = goalToTaskMap.get(currentGoalID);
      BigDecimal percent = goalToPercentMap.get(currentGoalID);

      BigDecimal achievedGoalFromGoalTable = g.getAchievedGoal() != null ? g.getAchievedGoal() : BigDecimal.ZERO;

      if (resolvedTaskID != null && percent != null) {

        // Fetch units only for the specific TaskID linked to this goal row
        List<Object[]> taskUnitRows = userWorkDataRepository.sumAchievedUnitsPerTaskForTarget(
            g.getUserID(), g.getWorkDate(), g.getDepartmentID());

        Map<Integer, BigDecimal> taskUnitsMap = new HashMap<>();
        for (Object[] row : taskUnitRows) {
          Integer taskId = (Integer) row[0];
          BigDecimal units = BigDecimal.valueOf(((Number) row[1]).longValue());
          taskUnitsMap.put(taskId, units);
        }

        BigDecimal taskUnits = taskUnitsMap.getOrDefault(resolvedTaskID, BigDecimal.ZERO);

        // Calculate target = percent% of achieved units for this specific task
        BigDecimal calculatedTarget = taskUnits.multiply(percent).setScale(2, RoundingMode.HALF_UP);

        g.setFixedGoal(calculatedTarget);
        recalculatedTarget = calculatedTarget;

        System.out.println(
            "Dept 13 - GoalID: "
                + currentGoalID
                + " | TaskID: "
                + resolvedTaskID
                + " | Units: "
                + taskUnits
                + " | Percent: "
                + percent
                + " | FixedGoal: "
                + calculatedTarget);

        if (recalculatedTarget.compareTo(BigDecimal.ZERO) > 0) {
          efficiency = achievedGoalFromGoalTable
              .divide(recalculatedTarget, 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100))
              .setScale(2, RoundingMode.HALF_UP);
        } else {
          efficiency = BigDecimal.ZERO;
        }

      } else {
        // GoalID not mapped — preserve DB fixedGoal, compute generic efficiency
        recalculatedTarget = BigDecimal.ZERO;
        if (g.getFixedGoal() != null
            && g.getFixedGoal().compareTo(BigDecimal.ZERO) > 0) {
          efficiency = achievedGoalFromGoalTable
              .divide(g.getFixedGoal(), 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100))
              .setScale(2, RoundingMode.HALF_UP);
        } else {
          efficiency = BigDecimal.ZERO;
        }
        System.out.println("Dept 13 - GoalID: " + currentGoalID + " has no task mapping — using DB FixedGoal.");
      }
    }
    // ================= OTHER DEPARTMENTS =================
    else {

      if (g.getDepartmentID() == 1) {

        BigDecimal dailyBudget = g.getFixedGoal() != null
            ? g.getFixedGoal()
            : BigDecimal.ZERO;

        BigDecimal dailySpend = g.getAchievedGoal() != null
            ? g.getAchievedGoal()
            : BigDecimal.ZERO;

        switch (g.getGoalID()) {

          case 64:

            if (dailyBudget.compareTo(BigDecimal.ZERO) > 0) {

              BigDecimal calculatedPercent = dailySpend
                  .divide(dailyBudget, 4, RoundingMode.HALF_UP)
                  .multiply(BigDecimal.valueOf(100));

              if (calculatedPercent.compareTo(BigDecimal.valueOf(80)) >= 0) {
                efficiency = BigDecimal.valueOf(100);
              } else {
                efficiency = calculatedPercent
                    .divide(BigDecimal.valueOf(0.8), 4, RoundingMode.HALF_UP)
                    .setScale(0, RoundingMode.DOWN);
              }
            }

            break;

          // case 65:

          // BigDecimal todaySpend = g.getAchievedGoal() != null
          // ? g.getAchievedGoal()
          // : BigDecimal.ZERO;

          // // Fetch average spend for previous 7 days
          // BigDecimal previous7DaysAverage =
          // userGoalDataRepository.getPrevious7DaysAverageSpend(
          // g.getUserID(),
          // g.getGoalID(),
          // g.getWorkDate().minusDays(7),
          // g.getWorkDate().minusDays(1));

          // if (previous7DaysAverage == null
          // || previous7DaysAverage.compareTo(BigDecimal.ZERO) == 0) {

          // efficiency = BigDecimal.ZERO;

          // } else {

          // BigDecimal growthPercent = todaySpend
          // .subtract(previous7DaysAverage)
          // .divide(previous7DaysAverage, 4, RoundingMode.HALF_UP)
          // .multiply(BigDecimal.valueOf(100));

          // if (growthPercent.compareTo(BigDecimal.valueOf(5)) >= 0) {

          // efficiency = BigDecimal.valueOf(100);

          // } else {

          // efficiency = growthPercent
          // .divide(BigDecimal.valueOf(5), 4, RoundingMode.HALF_UP)
          // .multiply(BigDecimal.valueOf(100))
          // .setScale(0, RoundingMode.DOWN);

          // if (efficiency.compareTo(BigDecimal.ZERO) < 0) {
          // efficiency = BigDecimal.ZERO;
          // }
          // }
          // }

          // break;

          case 66:

            if (dailyBudget.compareTo(BigDecimal.ZERO) > 0) {

              efficiency = dailySpend
                  .divide(dailyBudget, 4, RoundingMode.HALF_UP)
                  .multiply(BigDecimal.valueOf(100))
                  .setScale(2, RoundingMode.HALF_UP);
            }

            break;
        }

      } else if (g.getDepartmentID() == 22
          && g.getAchievedGoal() != null) {

        long days = g.getAchievedGoal().longValue();

        if (days < 40) {

          efficiency = BigDecimal.valueOf(100);

        } else {

          long extraDays = days - 40;
          long reductionSteps = extraDays / 10;

          int percentage = 100 - (int) (reductionSteps * 10);

          percentage = Math.max(percentage, 0);

          efficiency = BigDecimal.valueOf(percentage);
        }
      } else if ((g.getDepartmentID() == 14
          || g.getDepartmentID() == 31
          || g.getDepartmentID() == 32)
          && g.getFixedGoal() != null
          && g.getAchievedGoal() != null
          && g.getFixedGoal().compareTo(BigDecimal.ZERO) > 0) {
        BigDecimal achievedGoal = g.getAchievedGoal()
            .divide(g.getFixedGoal(), 4, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(100))
            .setScale(2, RoundingMode.HALF_UP);
        BigDecimal finalAchieved;

        if (achievedGoal.compareTo(BigDecimal.valueOf(100)) <= 0) {
          if (achievedGoal.compareTo(BigDecimal.valueOf(0)) == 0)
            efficiency = BigDecimal.valueOf(0);
          else
            efficiency = BigDecimal.valueOf(100);
        } else {
          efficiency = BigDecimal.valueOf(200).subtract(achievedGoal);
        }
        g.setFixedGoal(BigDecimal.valueOf(100));
        g.setAchievedGoal(achievedGoal);
      }
      // else if ((g.getDepartmentID() == 43
      // || g.getDepartmentID() == 44
      // || g.getDepartmentID() == 49)
      // && g.getFixedGoal() != null
      // && g.getAchievedGoal() != null
      // && g.getFixedGoal().compareTo(BigDecimal.ZERO) > 0) {

      // BigDecimal fixedGoal = g.getFixedGoal();
      // BigDecimal achievedGoal = g.getAchievedGoal();

      // System.out.println("====================================");
      // System.out.println("Department ID : " + g.getDepartmentID());
      // System.out.println("Original Fixed Goal : " + fixedGoal);
      // System.out.println("Achieved Goal : " + achievedGoal);

      // // 5% Buffer
      // BigDecimal fivePercentBuffer = fixedGoal.multiply(
      // BigDecimal.valueOf(0.05));

      // System.out.println("5% Buffer : " + fivePercentBuffer);

      // // Adjusted Fixed Goal
      // BigDecimal adjustedFixedGoal = fixedGoal.add(fivePercentBuffer);

      // System.out.println(
      // "Adjusted Fixed Goal : " + adjustedFixedGoal);

      // g.setFixedGoal(
      // adjustedFixedGoal.setScale(
      // 2,
      // RoundingMode.HALF_UP));

      // g.setAchievedGoal(
      // achievedGoal.setScale(
      // 2,
      // RoundingMode.HALF_UP));

      // // Formula:
      // // achievedGoal / adjustedFixedGoal * 100

      // BigDecimal divisionValue = achievedGoal.divide(
      // adjustedFixedGoal,
      // 4,
      // RoundingMode.HALF_UP);

      // System.out.println(
      // "Division Value : " + divisionValue);

      // efficiency = divisionValue.multiply(
      // BigDecimal.valueOf(100));

      // System.out.println(
      // "Final Efficiency : " + efficiency);

      // System.out.println("====================================");
      // }
      else if (g.getUserID() != null && g.getUserID() == 129
          && g.getFixedGoal() != null
          && g.getAchievedGoal() != null
          && g.getAchievedGoal().compareTo(BigDecimal.ZERO) > 0) {
        if (g.getAchievedGoal().compareTo(g.getFixedGoal()) <= 0) {
          efficiency = BigDecimal.valueOf(100);
        } else {
          efficiency = g.getFixedGoal()
              .divide(g.getAchievedGoal(), 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100))
              .setScale(2, RoundingMode.HALF_UP);
        }
      }
      else {
        BigDecimal effectiveFixedGoal = getEffectiveFixedGoal(g);
        if (effectiveFixedGoal != null
            && g.getAchievedGoal() != null
            && effectiveFixedGoal.compareTo(BigDecimal.ZERO) > 0) {
          efficiency = g.getAchievedGoal()
              .divide(effectiveFixedGoal, 4, RoundingMode.HALF_UP)
              .multiply(BigDecimal.valueOf(100))
              .setScale(2, RoundingMode.HALF_UP);
        }
      }
    }
    // if (efficiency.compareTo(BigDecimal.valueOf(100)) > 0) {
    // efficiency = BigDecimal.valueOf(100);
    // }
    return new UserGoalDataResponseDTO(
        g.getUserGoalDataID(),
        g.getWorkDate(),
        g.getUserID(),
        g.getUser().getName(),
        g.getDepartmentID(),
        g.getGoalID(),
        g.getGoal().getGoalName(),
        g.getFixedGoal(),
        g.getAchievedGoal(),
        efficiency,
        recalculatedTarget,
        g.getComment(),
        parseRevisedGoal(g.getRevisedGoal()),
        g.getApprovedByEL());
  }

  private RevisedGoalDetailsDTO parseRevisedGoal(String json) {
    if (json == null || json.isBlank()) {
      return null;
    }
    try {
      return objectMapper.readValue(json, RevisedGoalDetailsDTO.class);
    } catch (Exception e) {
      return null;
    }
  }

  private BigDecimal getEffectiveFixedGoal(UserGoalData g) {
    RevisedGoalDetailsDTO revised = parseRevisedGoal(g.getRevisedGoal());
    if (revised != null && Boolean.TRUE.equals(revised.getElApproved())
        && revised.getValue() != null) {
      return revised.getValue();
    }
    return g.getFixedGoal();
  }

  @Transactional
  public UserGoalDataResponseDTO updateRevisedGoal(
      RevisedGoalUpdateRequestDTO request, Integer currentUserId) {

    UserGoalData goalData = resolveGoalRow(
        request.getUserGoalDataID(), request.getUserId(), request.getGoalId(),
        request.getWorkDate());

    // Only the revised object is written — the row's ApprovedByEL column is
    // never touched here. Payload fields merge into what is already stored, so
    // an APPROVE call (no revisedGoal body) keeps value / enteredBy / enteredAt.
    String action = request.getAction() != null
        ? request.getAction().trim().toUpperCase()
        : null;
    String now = LocalDateTime.now().format(AUDIT_TIME_FORMAT);

    RevisedGoalDetailsDTO merged;
    if (Boolean.TRUE.equals(request.getClear())) {
      merged = null;
    } else if (request.getRevisedGoal() != null) {
      merged = parseRevisedGoal(goalData.getRevisedGoal());
      if (merged == null) {
        merged = new RevisedGoalDetailsDTO();
      }
      RevisedGoalDetailsDTO incoming = request.getRevisedGoal();
      if (incoming.getValue() != null) {
        merged.setValue(incoming.getValue());
      }
      if (incoming.getComment() != null) {
        merged.setComment(incoming.getComment());
      }
      if (incoming.getEnteredBy() != null) {
        merged.setEnteredBy(incoming.getEnteredBy());
      }
      if (incoming.getEnteredAt() != null) {
        merged.setEnteredAt(incoming.getEnteredAt());
      }
      if (incoming.getElApproved() != null) {
        merged.setElApproved(incoming.getElApproved());
      }
      if (incoming.getApprovedBy() != null) {
        merged.setApprovedBy(incoming.getApprovedBy());
      }
      if (incoming.getApprovedAt() != null) {
        merged.setApprovedAt(incoming.getApprovedAt());
      }
    } else {
      merged = parseRevisedGoal(goalData.getRevisedGoal());
    }

    if (merged == null && action != null) {
      merged = new RevisedGoalDetailsDTO();
    }

    if (merged != null) {
      if ("APPROVE".equals(action)) {
        merged.setElApproved(true);
        merged.setApprovedBy(currentUserId);
        merged.setApprovedAt(now);
      } else if ("REJECT".equals(action)) {
        merged.setElApproved(false);
        merged.setApprovedBy(currentUserId);
        merged.setApprovedAt(now);
      }
      if (merged.getValue() != null && merged.getEnteredAt() == null) {
        merged.setEnteredAt(now);
      }
      if (merged.getValue() != null && merged.getEnteredBy() == null) {
        merged.setEnteredBy(currentUserId);
      }
    }

    try {
      goalData.setRevisedGoal(
          merged != null ? objectMapper.writeValueAsString(merged) : null);
    } catch (Exception e) {
      throw new RuntimeException("Failed to serialize revisedGoal", e);
    }
    UserGoalData saved = userGoalDataRepository.save(goalData);

    return mapToResponse(saved);
  }

  @Transactional(readOnly = true)
  public RevisedGoalDetailsDTO getRevisedGoal(Integer userGoalDataID) {
    UserGoalData goalData = userGoalDataRepository.findById(userGoalDataID)
        .orElseThrow(() -> new ResourceNotFoundException(
            "UserGoalData not found with id: " + userGoalDataID));
    RevisedGoalDetailsDTO details = parseRevisedGoal(goalData.getRevisedGoal());
    return details != null ? details : new RevisedGoalDetailsDTO();
  }

  @Transactional(readOnly = true)
  public RevisedGoalDetailsDTO getRevisedGoal(Long userId, Long goalId, LocalDate workDate) {
    UserGoalData goalData = resolveGoalRow(null, userId, goalId, workDate);
    RevisedGoalDetailsDTO details = parseRevisedGoal(goalData.getRevisedGoal());
    return details != null ? details : new RevisedGoalDetailsDTO();
  }

  private UserGoalData resolveGoalRow(
      Integer userGoalDataID, Long userId, Long goalId, LocalDate workDate) {

    if (userGoalDataID != null) {
      return userGoalDataRepository.findById(userGoalDataID)
          .orElseThrow(() -> new ResourceNotFoundException(
              "UserGoalData not found with id: " + userGoalDataID));
    }

    if (userId != null && goalId != null && workDate != null) {
      return userGoalDataRepository
          .findByUserIDAndGoalIDAndWorkDate(userId.intValue(), goalId.intValue(), workDate)
          .orElseThrow(() -> new ResourceNotFoundException(
              "UserGoalData not found for userId=" + userId
                  + ", goalId=" + goalId
                  + ", workDate=" + workDate));
    }

    throw new IllegalArgumentException(
        "Provide either userGoalDataID or userId + goalId + workDate");
  }

  @Transactional
  public UserGoalDataResponseDTO updateGoal(GoalAchievementUpdateRequest request) {

    UserGoalData goalData = userGoalDataRepository
        .findByUserIDAndGoalIDAndWorkDate(
            request.getUserId().intValue(),
            request.getGoalId().intValue(),
            request.getWorkDate())
        .orElseThrow(() -> new RuntimeException("Goal data not found"));

    goalData.setAchievedGoal(request.getAchievedGoal());
    goalData.setComment(request.getComment());
    UserGoalData saved = userGoalDataRepository.save(goalData);

    return mapToResponse(saved);
  }

  public ReviewStatusSummaryDTO getReviewStatusSummary(ReviewStatusFilterDTO filter) {
    Integer departmentID = filter.getDepartmentID();
    String filterType = filter.getFilterType();
    String periodLabel;
    List<String> quarters;
    Integer year;

    if ("month".equalsIgnoreCase(filterType)) {
      Integer month = filter.getMonth();
      year = Integer.parseInt(filter.getYear());
      quarters = List.of(quarterOf(month));
      periodLabel = filter.getYear() + "-" + String.format("%02d", month);
    } else if ("quarter".equalsIgnoreCase(filterType) || "quarterly".equalsIgnoreCase(filterType)) {
      String quarter = filter.getQuarter();
      year = Integer.parseInt(filter.getYear());
      quarters = "all".equalsIgnoreCase(quarter)
          ? List.of("Q1", "Q2", "Q3", "Q4")
          : List.of(quarter.toUpperCase());
      periodLabel = quarter + " " + year;
    } else {
      throw new RuntimeException("Invalid filterType: " + filterType);
    }

    List<Object[]> reviewedRows = quarterlyReviewRepository
        .findReviewedSummaryByQuartersAndYear(quarters, year, departmentID);

    List<ReviewStatusSummaryDTO.UserReviewStatus> reviewedUsers = reviewedRows.stream()
        .map(row -> ReviewStatusSummaryDTO.UserReviewStatus.builder()
            .userID(((Number) row[0]).intValue())
            .userName((String) row[1])
            .userEmail((String) row[2])
            .entryCount(((Number) row[3]).intValue())
            .systemGrade(row[4] == null ? null : ((Number) row[4]).intValue())
            .managerAvgRating(row[5] == null ? null : new BigDecimal(row[5].toString()))
            .finalRating(row[6] == null ? null : new BigDecimal(row[6].toString()))
            .managerRatings(row[7] == null ? null : (String) row[7])
            .targetPercent(row[8] == null ? null : new BigDecimal(row[8].toString()))
            .goalAchievement(row[9] == null ? null : new BigDecimal(row[9].toString()))
            .empId(row[10] == null ? null : (String) row[10])
            .reportingManagerName(row[11] == null ? null : (String) row[11])
            .elName(row[12] == null ? null : (String) row[12])
            .department(row[13] == null ? null : (String) row[13])
            .build())
        .collect(Collectors.toList());

        loadAssessorNames(reviewedUsers);

    Set<Integer> reviewedIds = reviewedUsers.stream()
        .map(ReviewStatusSummaryDTO.UserReviewStatus::getUserID)
        .collect(Collectors.toSet());

    List<User> allUsers = departmentID != null
        ? userRepository.findUsersByDepartmentId(departmentID)
        : userRepository.findAllActiveUsers();

    List<ReviewStatusSummaryDTO.UserReviewStatus> nonReviewedUsers = allUsers.stream()
        .filter(u -> !reviewedIds.contains(u.getUserID()))
        .map(u -> ReviewStatusSummaryDTO.UserReviewStatus.builder()
            .userID(u.getUserID())
            .userName(u.getName())
            .userEmail(u.getUserEmail())
            .entryCount(0)
            .build())
        .collect(Collectors.toList());

    return ReviewStatusSummaryDTO.builder()
        .departmentID(departmentID)
        .filterType(filterType)
        .periodLabel(periodLabel)
        .totalUsers(reviewedUsers.size() + nonReviewedUsers.size())
        .reviewedCount(reviewedUsers.size())
        .nonReviewedCount(nonReviewedUsers.size())
        .reviewedUsers(reviewedUsers)
        .nonReviewedUsers(nonReviewedUsers)
        .build();
  }

  private void loadAssessorNames(
      List<ReviewStatusSummaryDTO.UserReviewStatus> reviewedUsers) {
    Set<Integer> ids = new HashSet<>();
    for (ReviewStatusSummaryDTO.UserReviewStatus u : reviewedUsers) {
      collectAssessorIds(u.getManagerRatings(), ids);
    }
    Map<Integer, String> names = new HashMap<>();
    if (!ids.isEmpty()) {
      try {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT UserID, UserName FROM Users WHERE UserID IN ("
                + ids.stream().map(String::valueOf).collect(Collectors.joining(","))
                + ")");
        for (Map<String, Object> row : rows) {
          names.put(((Number) row.get("UserID")).intValue(), (String) row.get("UserName"));
        }
      } catch (Exception ignored) {
      }
    }
    for (ReviewStatusSummaryDTO.UserReviewStatus u : reviewedUsers) {
      String[] accessors = resolveAccessorNames(u.getManagerRatings(), names);
      u.setAccessor1(accessors[0]);
      u.setAccessor2(accessors[1]);
    }
  }

  private void collectAssessorIds(String managerRatings, Set<Integer> ids) {
    if (managerRatings == null) {
      return;
    }
    try {
      JsonNode root = objectMapper.readTree(managerRatings);
      if (root.isObject()) {
        root.fields().forEachRemaining(entry -> {
          JsonNode dim = entry.getValue();
          addAssessorId(dim.get("assessor1Id"), ids);
          addAssessorId(dim.get("assessor2Id"), ids);
        });
      }
    } catch (Exception ignored) {
    }
  }

  private void addAssessorId(JsonNode node, Set<Integer> ids) {
    if (node != null && !node.isNull() && !node.asText().trim().isEmpty()) {
      ids.add(node.asInt());
    }
  }

  private String[] resolveAccessorNames(String managerRatings, Map<Integer, String> names) {
    String accessor1 = null;
    String accessor2 = null;
    if (managerRatings != null) {
      try {
        JsonNode root = objectMapper.readTree(managerRatings);
        if (root.isObject() && root.fields().hasNext()) {
          JsonNode dim = root.fields().next().getValue();
          accessor1 = assessorName(dim.get("assessor1Id"), names);
          accessor2 = assessorName(dim.get("assessor2Id"), names);
        }
      } catch (Exception ignored) {
      }
    }
    return new String[] { accessor1, accessor2 };
  }

  private String assessorName(JsonNode node, Map<Integer, String> names) {
    if (node == null || node.isNull() || node.asText().trim().isEmpty()) {
      return null;
    }
    return names.get(node.asInt());
  }

  private String quarterOf(Integer month) {
    if (month == null || month < 1 || month > 12) {
      throw new RuntimeException("Invalid month: " + month);
    }
    if (month <= 3) return "Q1";
    if (month <= 6) return "Q2";
    if (month <= 9) return "Q3";
    return "Q4";
  }
}
