package tapmind.bsrv.serviceNew;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.dto.GoalEfficiencyFilterRequestDTO;

import java.sql.Date;
import java.util.*;

@Service
@RequiredArgsConstructor
public class GoalEfficiencyReportService {

    private final JdbcTemplate jdbcTemplate;

    // =====================================================
    // ================= MAIN ENTRY ========================
    // =====================================================
    @Transactional(readOnly = true)
    public Map<String, Object> listGoalEfficiency(
            GoalEfficiencyFilterRequestDTO filter) {

        Map<String, Object> response = new HashMap<>();
        List<Map<String, Object>> result = new ArrayList<>();

        List<Integer> departmentIds = resolveDepartments(filter);

        for (Integer deptId : departmentIds) {

            switch (deptId) {
                case 36 -> result.addAll(calcDept36(filter));
                case 13 -> result.addAll(calcDept13(filter));
                case 21 -> result.addAll(calcDept21Sales(filter));
                default -> result.addAll(calcGeneral(filter, deptId));
            }
        }

        response.put("status", true);
        response.put("data", result);
        return response;
    }

    // =====================================================
    // ================= DEPT 36 ===========================
    // Direct: achieved / fixed
    // =====================================================
    private List<Map<String, Object>> calcDept36(
            GoalEfficiencyFilterRequestDTO f) {

        String sql = """
            SELECT
                ug.UserID,
                u.UserName,
                ug.GoalID,
                g.GoalName,
                ug.DepartmentID,
                ROUND(
                    (SUM(ug.AchievedGoal) / NULLIF(SUM(ug.FixedGoal),0)) * 100, 2
                ) AS GoalEfficiency
            FROM UserGoalData ug
            JOIN Users u ON ug.UserID = u.UserID
            JOIN DepartmentGoal g ON ug.GoalID = g.GoalID
            WHERE ug.DepartmentID = 36
              AND ug.WorkDate BETWEEN ? AND ?
            GROUP BY ug.UserID, ug.GoalID
        """;

        return jdbcTemplate.queryForList(
                sql,
                Date.valueOf(f.getStartDate()),
                Date.valueOf(f.getEndDate())
        );
    }

    // =====================================================
    // ================= DEPT 13 ===========================
    // Multiple goals (per goal)
    // =====================================================
    private List<Map<String, Object>> calcDept13(
            GoalEfficiencyFilterRequestDTO f) {

        String sql = """
            SELECT
                ug.UserID,
                u.UserName,
                ug.GoalID,
                g.GoalName,
                ug.DepartmentID,
                ROUND(
                    (SUM(ug.AchievedGoal) / NULLIF(SUM(ug.FixedGoal),0)) * 100, 2
                ) AS GoalEfficiency
            FROM UserGoalData ug
            JOIN Users u ON ug.UserID = u.UserID
            JOIN DepartmentGoal g ON ug.GoalID = g.GoalID
            WHERE ug.DepartmentID = 13
              AND ug.WorkDate BETWEEN ? AND ?
            GROUP BY ug.UserID, ug.GoalID
        """;

        return jdbcTemplate.queryForList(
                sql,
                Date.valueOf(f.getStartDate()),
                Date.valueOf(f.getEndDate())
        );
    }

    // =====================================================
    // ================= DEPT 21 (SALES) ===================
    // Excludes RESCHEDULED & CANCELLED
    // =====================================================
    private List<Map<String, Object>> calcDept21Sales(
            GoalEfficiencyFilterRequestDTO f) {

        String sql = """
            SELECT
                c.SalesUserID AS UserID,
                u.UserName,
                21 AS DepartmentID,
                ROUND(
                    (
                        SUM(CASE WHEN c.status = 'COMPLETED' THEN 1 ELSE 0 END) /
                        NULLIF(
                            SUM(CASE
                                WHEN c.status IN ('SCHEDULED','COMPLETED','NO_SHOW')
                                THEN 1 ELSE 0 END
                            ), 0
                        )
                    ) * 100, 2
                ) AS GoalEfficiency
            FROM SalesCallSchedule c
            JOIN Users u ON c.SalesUserID = u.UserID
            WHERE DATE(c.ScheduledDatetime) BETWEEN ? AND ?
            GROUP BY c.SalesUserID
        """;

        return jdbcTemplate.queryForList(
                sql,
                Date.valueOf(f.getStartDate()),
                Date.valueOf(f.getEndDate())
        );
    }

    // =====================================================
    // ================= ALL OTHER DEPTS ===================
    // General formula
    // =====================================================
    private List<Map<String, Object>> calcGeneral(
            GoalEfficiencyFilterRequestDTO f,
            Integer deptId) {

        String sql = """
            SELECT
                ug.UserID,
                u.UserName,
                ug.DepartmentID,
                ROUND(
                    (SUM(ug.AchievedGoal) / NULLIF(SUM(ug.FixedGoal),0)) * 100, 2
                ) AS GoalEfficiency
            FROM UserGoalData ug
            JOIN Users u ON ug.UserID = u.UserID
            WHERE ug.DepartmentID = ?
              AND ug.WorkDate BETWEEN ? AND ?
            GROUP BY ug.UserID
        """;

        return jdbcTemplate.queryForList(
                sql,
                deptId,
                Date.valueOf(f.getStartDate()),
                Date.valueOf(f.getEndDate())
        );
    }

    // =====================================================
    // ================= DEPT RESOLUTION ===================
    // =====================================================
    private List<Integer> resolveDepartments(
            GoalEfficiencyFilterRequestDTO filter) {

        if (Boolean.TRUE.equals(filter.getIsHeExecutiveLeader())
                && filter.getELID() != null) {

            return jdbcTemplate.queryForList(
                    "SELECT DepartmentID FROM Department WHERE ExecutiveLeaderID = ?",
                    Integer.class,
                    filter.getELID()
            );
        }

        if (filter.getDepartmentID() != null && filter.getDepartmentID() != 0) {
            return List.of(filter.getDepartmentID());
        }

        return jdbcTemplate.queryForList(
                "SELECT DepartmentID FROM Department",
                Integer.class
        );
    }
}
