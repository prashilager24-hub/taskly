package tapmind.bsrv.repository;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.model.DepartmentTarget;
import java.util.*;

@Repository
public interface DepartmentTargetRepository extends JpaRepository<DepartmentTarget, Integer> {

    @Query("SELECT t FROM DepartmentTarget t WHERE t.department.departmentID = :departmentId AND t.isActive = true")
    List<DepartmentTarget> findByDepartmentId(@Param("departmentId") Integer departmentId);

    @Query("""
        SELECT t FROM DepartmentTarget t
        WHERE 
            (:searchText IS NULL OR t.targetName LIKE %:searchText% OR t.targetMetric LIKE %:searchText%)
            AND (:status IS NULL OR t.isActive = :status)
            AND (:startDate IS NULL OR t.createdAt >= :startDate)
            AND (:endDate IS NULL OR t.createdAt <= :endDate)
        """)
    Page<DepartmentTarget> findAllFiltered(
            @Param("searchText") String searchText,
            @Param("status") Boolean status,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate,
            Pageable pageable
    );

    @Query("""
        SELECT t FROM DepartmentTarget t
        WHERE 
            (:searchText IS NULL OR t.targetName LIKE %:searchText% OR t.targetMetric LIKE %:searchText%)
            AND (:status IS NULL OR t.isActive = :status)
        """)
    List<DepartmentTarget> findAllFilteredNoPagination(
            @Param("searchText") String searchText,
            @Param("status") Boolean status,
            Sort sort
    );
// ✅ 1. Paged version
  @Query(value = """
    SELECT 
        dt.TargetID,
        dt.DepartmentID,
        dt.TargetName,
        dt.TargetMetric,
        dt.MetricValue,
        dt.Unit,
        dt.Frequency,
        dt.TimingType,
        dt.IsDynamic,
        dt.Description,
        dt.CreatedAt,
        dt.ModifiedAt,
        dt.IsActive,
        dt.RoleID
    FROM DepartmentTarget dt
    WHERE 
        (:searchText IS NULL OR :searchText = '' OR dt.TargetName LIKE %:searchText% OR dt.TargetMetric LIKE %:searchText%)
    AND 
        (:filter IS NULL OR :filter = '' 
         OR (:filter = 'Active' AND dt.IsActive = TRUE)
         OR (:filter = 'Inactive' AND dt.IsActive = FALSE))
    AND 
        (:startDate IS NULL OR :startDate = '' OR dt.CreatedAt >= :startDate)
    AND 
        (:endDate IS NULL OR :endDate = '' OR dt.CreatedAt <= :endDate)
    """,
    countQuery = """
    SELECT COUNT(dt.TargetID)
    FROM DepartmentTarget dt
    WHERE 
        (:searchText IS NULL OR :searchText = '' OR dt.TargetName LIKE %:searchText% OR dt.TargetMetric LIKE %:searchText%)
    AND 
        (:filter IS NULL OR :filter = '' 
         OR (:filter = 'Active' AND dt.IsActive = TRUE)
         OR (:filter = 'Inactive' AND dt.IsActive = FALSE))
    AND 
        (:startDate IS NULL OR :startDate = '' OR dt.CreatedAt >= :startDate)
    AND 
        (:endDate IS NULL OR :endDate = '' OR dt.CreatedAt <= :endDate)
    """,
    nativeQuery = true)
Page<Object[]> findAllTargetsFiltered(
        @Param("searchText") String searchText,
        @Param("filter") String filter,
        @Param("startDate") String startDate,
        @Param("endDate") String endDate,
        Pageable pageable
);



    // ✅ 2. Non-paged version
 @Query(value = """
    SELECT 
        dt.TargetID,
        dt.DepartmentID,
        dt.TargetName,
        dt.TargetMetric,
        dt.MetricValue,
        dt.Unit,
        dt.Frequency,
        dt.TimingType,
        dt.IsDynamic,
        dt.Description,
        dt.CreatedAt,
        dt.ModifiedAt,
        dt.IsActive,
        dt.RoleID
    FROM DepartmentTarget dt
    WHERE 
        (:searchText IS NULL OR :searchText = '' OR dt.TargetName LIKE %:searchText% OR dt.TargetMetric LIKE %:searchText%)
    AND 
        (:filter IS NULL OR :filter = '' 
         OR (:filter = 'Active' AND dt.IsActive = TRUE)
         OR (:filter = 'Inactive' AND dt.IsActive = FALSE))
    AND 
        (:startDate IS NULL OR :startDate = '' OR dt.CreatedAt >= :startDate)
    AND 
        (:endDate IS NULL OR :endDate = '' OR dt.CreatedAt <= :endDate)
    ORDER BY
        CASE WHEN :sortBy = 'modifiedAt' THEN dt.ModifiedAt END DESC,
        CASE WHEN :sortBy <> 'modifiedAt' THEN dt.TargetID END DESC
    """, nativeQuery = true)
List<Object[]> findAllTargetsFilteredNoPagination(
        @Param("searchText") String searchText,
        @Param("filter") String filter,
        @Param("startDate") String startDate,
        @Param("endDate") String endDate,
        @Param("sortBy") String sortBy
);

   @Query("SELECT d FROM DepartmentTarget d WHERE d.department.departmentID = :departmentID AND d.isActive = true")
   List<DepartmentTarget> findByDepartment_DepartmentID(@Param("departmentID") Integer departmentID);

   @Query("SELECT d FROM DepartmentTarget d WHERE d.department.departmentID = :departmentID AND d.isActive = true AND EXISTS (SELECT 1 FROM d.roleIds r WHERE r = :roleID)")
   List<DepartmentTarget> findByDepartmentAndRoleID(@Param("departmentID") Integer departmentID, @Param("roleID") Integer roleID);

   @Query(value = "SELECT TargetID, RoleID FROM DepartmentTargetRole WHERE TargetID IN :targetIds", nativeQuery = true)
   List<Object[]> findRoleIdsByTargetIds(@Param("targetIds") Collection<Integer> targetIds);

}
