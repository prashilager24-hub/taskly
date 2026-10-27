package tapmind.bsrv.repository;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import tapmind.bsrv.model.DepartmentGoal;

import java.util.*;

@Repository
public interface DepartmentGoalRepository
        extends JpaRepository<DepartmentGoal, Integer> {

    // ✅ Get active goals by department
    @Query("SELECT g FROM DepartmentGoal g WHERE g.department.departmentID = :departmentId AND g.isActive = true")
    List<DepartmentGoal> findByDepartmentId(
            @Param("departmentId") Integer departmentId);

    // ✅ JPQL paged filter
    @Query("""
            SELECT g FROM DepartmentGoal g
            WHERE
                (:searchText IS NULL OR g.goalName LIKE %:searchText% OR g.goalMetric LIKE %:searchText%)
                AND (:status IS NULL OR g.isActive = :status)
                AND (:startDate IS NULL OR g.createdAt >= :startDate)
                AND (:endDate IS NULL OR g.createdAt <= :endDate)
            """)
    Page<DepartmentGoal> findAllFiltered(
            @Param("searchText") String searchText,
            @Param("status") Boolean status,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            Pageable pageable);

    // ✅ JPQL non-paged
    @Query("""
            SELECT g FROM DepartmentGoal g
            WHERE
                (:searchText IS NULL OR g.goalName LIKE %:searchText% OR g.goalMetric LIKE %:searchText%)
                AND (:status IS NULL OR g.isActive = :status)
            """)
    List<DepartmentGoal> findAllFilteredNoPagination(
            @Param("searchText") String searchText,
            @Param("status") Boolean status,
            Sort sort);

    // ======================================================
    // =============== NATIVE QUERIES =======================
    // ======================================================

    // ✅ PAGINATED
    @Query(value = """
            SELECT
                dg.GoalID,
                dg.DepartmentID,
                d.DepartmentName,
                dg.GoalName,
                dg.GoalMetric,
                dg.MetricValue,
                dg.Unit,
                dg.Frequency,
                dg.TimingType,
                dg.IsDynamic,
                dg.Description,
                dg.CreatedAt,
                dg.ModifiedAt,
                dg.IsActive,
                dg.LiveAccounts,
                dg.ApprovedByEL,
                dg.RoleID,
                d.IsDepartmentArchived
            FROM DepartmentGoal dg
            JOIN Department d ON dg.DepartmentID = d.DepartmentID
            WHERE
                (:searchText IS NULL OR :searchText = ''
                    OR dg.GoalName LIKE %:searchText%
                    OR dg.GoalMetric LIKE %:searchText%)
            AND
                (:filter IS NULL OR :filter = ''
                    OR (:filter = 'Active' AND dg.IsActive = TRUE)
                    OR (:filter = 'Inactive' AND dg.IsActive = FALSE))
            AND
                (:startDate IS NULL OR :startDate = '' OR dg.CreatedAt >= :startDate)
            AND
                (:endDate IS NULL OR :endDate = '' OR dg.CreatedAt <= :endDate)
            """, countQuery = """
            SELECT COUNT(dg.GoalID)
            FROM DepartmentGoal dg
            JOIN Department d ON dg.DepartmentID = d.DepartmentID
            WHERE
                (:searchText IS NULL OR :searchText = ''
                    OR dg.GoalName LIKE %:searchText%
                    OR dg.GoalMetric LIKE %:searchText%)
            AND
                (:filter IS NULL OR :filter = ''
                    OR (:filter = 'Active' AND dg.IsActive = TRUE)
                    OR (:filter = 'Inactive' AND dg.IsActive = FALSE))
            AND
                (:startDate IS NULL OR :startDate = '' OR dg.CreatedAt >= :startDate)
            AND
                (:endDate IS NULL OR :endDate = '' OR dg.CreatedAt <= :endDate)
            """, nativeQuery = true)
    Page<Object[]> findAllGoalsFiltered(
            @Param("searchText") String searchText,
            @Param("filter") String filter,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            Pageable pageable);

    // ✅ NON-PAGINATED
    @Query(value = """
            SELECT
                dg.GoalID,
                dg.DepartmentID,
                d.DepartmentName,
                dg.GoalName,
                dg.GoalMetric,
                dg.MetricValue,
                dg.Unit,
                dg.Frequency,
                dg.TimingType,
                dg.IsDynamic,
                dg.Description,
                dg.CreatedAt,
                dg.ModifiedAt,
                dg.IsActive,
                dg.LiveAccounts,
                dg.ApprovedByEL,
                dg.RoleID,
                d.IsDepartmentArchived
            FROM DepartmentGoal dg
            JOIN Department d ON dg.DepartmentID = d.DepartmentID
            WHERE
                (:searchText IS NULL OR :searchText = ''
                    OR dg.GoalName LIKE %:searchText%
                    OR dg.GoalMetric LIKE %:searchText%)
            AND
                (:filter IS NULL OR :filter = ''
                    OR (:filter = 'Active' AND dg.IsActive = TRUE)
                    OR (:filter = 'Inactive' AND dg.IsActive = FALSE))
            AND
                (:startDate IS NULL OR :startDate = '' OR dg.CreatedAt >= :startDate)
            AND
                (:endDate IS NULL OR :endDate = '' OR dg.CreatedAt <= :endDate)
            ORDER BY
                CASE WHEN :sortBy = 'modifiedAt' THEN dg.ModifiedAt END DESC,
                CASE WHEN :sortBy <> 'modifiedAt' THEN dg.GoalID END DESC
            """, nativeQuery = true)
    List<Object[]> findAllGoalsFilteredNoPagination(
            @Param("searchText") String searchText,
            @Param("filter") String filter,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            @Param("sortBy") String sortBy);

    // Department specific
    @Query("""
                    SELECT g FROM DepartmentGoal g
                    WHERE g.department.departmentID = :departmentID
                    AND g.isActive = true
            """)
    List<DepartmentGoal> findByDepartment_DepartmentID(
            @Param("departmentID") Integer departmentID);

    // Department + RoleID
    @Query("""
                    SELECT g FROM DepartmentGoal g
                    WHERE g.department.departmentID = :departmentID
                    AND g.isActive = true
                    AND g.roleID = :roleID
            """)
    List<DepartmentGoal> findByDepartmentAndRoleID(
            @Param("departmentID") Integer departmentID,
            @Param("roleID") Integer roleID);

    // Admin → all departments
    @Query("""
            SELECT g
                 FROM DepartmentGoal g
                 JOIN FETCH g.department d
                 WHERE g.isActive = true
             """)
    List<DepartmentGoal> findByDepartment_Admin();

    @Modifying
    @Query("UPDATE DepartmentGoal g SET g.approvedByEL = true, g.modifiedAt = CURRENT_TIMESTAMP WHERE g.goalID IN :goalIds")
    int approveGoals(@Param("goalIds") List<Integer> goalIds);
}
