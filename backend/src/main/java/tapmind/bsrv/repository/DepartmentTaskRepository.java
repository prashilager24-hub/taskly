package tapmind.bsrv.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.model.DepartmentTask;
import org.springframework.data.domain.Sort;
import java.time.LocalDate;
import java.util.List;
import tapmind.bsrv.serviceNew.DepartmentTaskProjection;

@Repository
public interface DepartmentTaskRepository extends JpaRepository<DepartmentTask, Integer> {
 

 @Query(value = """
    SELECT 
        dt.TaskID, dt.DepartmentID, dt.TaskName, 
        dt.StandardTimeMins, dt.Frequency, dt.IsDynamic, dt.Description, 
        dt.IsActive, dt.CreatedAt, dt.ModifiedAt, d.DepartmentName ,dt.isForTarget,dt.targetNumber,dt.TimingType, dt.RoleID
    FROM DepartmentTask dt
    JOIN Department d ON dt.DepartmentID = d.DepartmentID
    WHERE 
        (:searchText IS NULL OR :searchText = '' OR dt.TaskName LIKE %:searchText%)
        AND (
            :filter IS NULL OR :filter = '' OR 
            (:filter = 'Active' AND dt.IsActive = TRUE) OR
            (:filter = 'Inactive' AND dt.IsActive = FALSE)
        )
        AND (:startDate IS NULL OR :startDate = '' OR dt.CreatedAt >= :startDate)
        AND (:endDate IS NULL OR :endDate = '' OR dt.CreatedAt <= :endDate)
""",
       countQuery = """
    SELECT COUNT(*) 
    FROM DepartmentTask dt
    JOIN Department d ON dt.DepartmentID = d.DepartmentID
    WHERE 
        (:searchText IS NULL OR :searchText = '' OR dt.TaskName LIKE %:searchText%)
        AND (
            :filter IS NULL OR :filter = '' OR 
            (:filter = 'Active' AND dt.IsActive = TRUE) OR
            (:filter = 'Inactive' AND dt.IsActive = FALSE)
        )
        AND (:startDate IS NULL OR :startDate = '' OR dt.CreatedAt >= :startDate)
        AND (:endDate IS NULL OR :endDate = '' OR dt.CreatedAt <= :endDate)
""",
       nativeQuery = true)
Page<Object[]> findAllTasksFiltered(
        @Param("searchText") String searchText,
        @Param("filter") String filter,
        @Param("startDate") String startDate,
        @Param("endDate") String endDate,
        Pageable pageable
);





@Query(value = """
    SELECT 
        dt.TaskID, dt.DepartmentID, dt.TaskName, 
        dt.StandardTimeMins, dt.Frequency, dt.IsDynamic, dt.Description, 
        dt.IsActive, dt.CreatedAt, dt.ModifiedAt, d.DepartmentName,dt.isForTarget,dt.targetNumber,dt.TimingType, dt.RoleID
    FROM DepartmentTask dt
    JOIN Department d ON dt.DepartmentID = d.DepartmentID
    WHERE 
        (:searchText IS NULL OR :searchText = '' OR dt.TaskName LIKE %:searchText%)
        AND (
            :filter IS NULL OR :filter = '' OR 
            (:filter = 'Active' AND dt.IsActive = TRUE) OR
            (:filter = 'Inactive' AND dt.IsActive = FALSE)
        )
        AND (:startDate IS NULL OR :startDate = '' OR dt.CreatedAt >= :startDate)
        AND (:endDate IS NULL OR :endDate = '' OR dt.CreatedAt <= :endDate)
    ORDER BY 
        CASE WHEN :sortBy = 'ModifiedAt' THEN dt.ModifiedAt END DESC,
        CASE WHEN :sortBy <> 'ModifiedAt' THEN dt.TaskID END DESC
""", nativeQuery = true)
List<Object[]> findAllTasksFilteredNoPagination(
        @Param("searchText") String searchText,
        @Param("filter") String filter,
        @Param("startDate") String startDate,
        @Param("endDate") String endDate,
        @Param("sortBy") String sortBy
);


     @Modifying
    @Query("UPDATE DepartmentTask t SET t.isActive = :status, t.modifiedAt = CURRENT_TIMESTAMP WHERE t.taskID = :taskID")
    void updateTaskStatus(@Param("taskID") Integer taskID, @Param("status") Boolean status);


     List<DepartmentTask> findByDepartment_DepartmentID(Integer departmentId);


// @Query("SELECT d.taskID AS taskID, d.taskName AS taskName FROM DepartmentTask d WHERE d.department.departmentID = :departmentId AND d.isActive = true")
// List<DepartmentTaskProjection> findTasksByDepartmentId(Integer departmentId);


@Query("SELECT d FROM DepartmentTask d WHERE d.department.departmentID = :departmentId AND d.isActive = true")
List<DepartmentTask> findTasksByDepartmentId(Integer departmentId);

@Query("SELECT d FROM DepartmentTask d WHERE d.department.departmentID = :departmentId AND d.roleID = :roleId AND d.isActive = true")
List<DepartmentTask> findTasksByDepartmentIdAndRoleId(@Param("departmentId") Integer departmentId, @Param("roleId") Integer roleId);







}
