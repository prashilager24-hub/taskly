package tapmind.bsrv.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.model.Department;

public interface DepartmentRepository extends JpaRepository<Department, Integer> {

    Optional<Department> findByDepartmentName(String departmentName);

    @Query("""
                SELECT
                    d.departmentID,
                    d.departmentName,
                    d.departmentStatus,
                    d.isDepartmentArchived,
                    d.departmentCreateTime,
                    d.departmentModifyTime,
                    d.departmentDescription,
                    u.name,
                    uf.name,
                    u.userID,
                    uf.userID,
                    pd.primaryDepartmentId,
                    pd.primaryDepartmentName
                FROM Department d
                LEFT JOIN d.executiveLeader u
                  LEFT JOIN d.functionalLeader uf
                  LEFT JOIN d.primaryDepartment pd
                WHERE (
                    :searchText IS NULL OR
                    CAST(d.departmentID AS string) LIKE CONCAT('%', :searchText, '%')
                    OR LOWER(d.departmentName) LIKE LOWER(CONCAT('%', :searchText, '%'))
                    OR LOWER(d.departmentDescription) LIKE LOWER(CONCAT('%', :searchText, '%'))
                )
                AND (:departmentStatus IS NULL OR d.departmentStatus = :departmentStatus)
                AND (:isDepartmentArchived IS NULL OR d.isDepartmentArchived = :isDepartmentArchived)
                AND (:startDate IS NULL OR d.departmentCreateTime >= :startDate)
                AND (:endDate IS NULL OR d.departmentCreateTime <= :endDate)
                AND (:elID IS NULL OR u.userID = :elID)
                AND (:flID IS NULL OR uf.userID = :flID)
                ORDER BY d.departmentModifyTime DESC, d.departmentID DESC
            """)
    Page<Object[]> findAllDepartmentsBySearchText(
            @Param("searchText") String searchText,
            @Param("departmentStatus") Boolean departmentStatus,
            @Param("isDepartmentArchived") Boolean isDepartmentArchived,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("elID") Integer elID,
            @Param("flID") Integer flID,
            Pageable pageable);

    @Query("""
                SELECT
                    d.departmentID,
                    d.departmentName,
                    d.departmentStatus,
                    d.isDepartmentArchived,
                    d.departmentCreateTime,
                    d.departmentModifyTime,
                    d.departmentDescription,
                     u.name,
                    uf.name,
                    u.userID,
                    uf.userID,
                    pd.primaryDepartmentId,
                    pd.primaryDepartmentName
                FROM Department d
                LEFT JOIN d.executiveLeader u
                LEFT JOIN d.functionalLeader uf
                LEFT JOIN d.primaryDepartment pd
                WHERE (
                    :searchText IS NULL OR
                    CAST(d.departmentID AS string) LIKE CONCAT('%', :searchText, '%')
                    OR LOWER(d.departmentName) LIKE LOWER(CONCAT('%', :searchText, '%'))
                    OR LOWER(d.departmentDescription) LIKE LOWER(CONCAT('%', :searchText, '%'))
                )
                AND (:departmentStatus IS NULL OR d.departmentStatus = :departmentStatus)
                AND (:isDepartmentArchived IS NULL OR d.isDepartmentArchived = :isDepartmentArchived)
                AND (:startDate IS NULL OR d.departmentCreateTime >= :startDate)
                AND (:endDate IS NULL OR d.departmentCreateTime <= :endDate)
                AND (:elID IS NULL OR u.userID = :elID)
                AND (:flID IS NULL OR uf.userID = :flID)
                ORDER BY d.departmentModifyTime DESC, d.departmentID DESC
            """)
    List<Object[]> findAllDepartmentsBySearchTextNoPagination(
            @Param("searchText") String searchText,
            @Param("departmentStatus") Boolean departmentStatus,
            @Param("isDepartmentArchived") Boolean isDepartmentArchived,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("elID") Integer elID,
            @Param("flID") Integer flID);

    // Paginated version
    @Query("""
                SELECT d.departmentID, d.departmentName, d.departmentStatus, d.isDepartmentArchived,
                       d.departmentCreateTime, d.departmentModifyTime, d.departmentDescription,
                       u.username  AS executiveLeaderName,  uf.username  AS functionalLeaderName
                FROM Department d
                LEFT JOIN d.executiveLeader u
                LEFT JOIN d.functionalLeader uf
                WHERE (
                    :searchText IS NULL OR
                    (CAST(d.departmentID AS string) LIKE CONCAT('%', :searchText, '%')
                     OR LOWER(d.departmentName) LIKE LOWER(CONCAT('%', :searchText, '%'))
                     OR LOWER(d.departmentDescription) LIKE LOWER(CONCAT('%', :searchText, '%')))
                )
                AND (:departmentStatus IS NULL OR d.departmentStatus = :departmentStatus)
                AND (:isDepartmentArchived IS NULL OR d.isDepartmentArchived = :isDepartmentArchived)
                AND (:startDate IS NULL OR d.departmentCreateTime >= :startDate)
                AND (:endDate IS NULL OR d.departmentCreateTime <= :endDate)
                ORDER BY d.departmentModifyTime DESC, d.departmentID DESC
            """)
    Page<Object[]> findAllDepartmentsBySearchText(
            @Param("searchText") String searchText,
            @Param("departmentStatus") Boolean departmentStatus,
            @Param("isDepartmentArchived") Boolean isDepartmentArchived,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Pageable pageable);

    // non pagination
    @Query("""
                SELECT d.departmentID, d.departmentName, d.departmentStatus, d.isDepartmentArchived,
                       d.departmentCreateTime, d.departmentModifyTime, d.departmentDescription,
                       u.username  AS executiveLeaderName ,uf.username  AS functionalLeaderName
                FROM Department d
                LEFT JOIN d.executiveLeader u
                 LEFT JOIN d.functionalLeader uf
                WHERE (
                    :searchText IS NULL OR
                    (CAST(d.departmentID AS string) LIKE CONCAT('%', :searchText, '%')
                     OR LOWER(d.departmentName) LIKE LOWER(CONCAT('%', :searchText, '%'))
                     OR LOWER(d.departmentDescription) LIKE LOWER(CONCAT('%', :searchText, '%')))
                )
                AND (:departmentStatus IS NULL OR d.departmentStatus = :departmentStatus)
                AND (:isDepartmentArchived IS NULL OR d.isDepartmentArchived = :isDepartmentArchived)
                AND (:startDate IS NULL OR d.departmentCreateTime >= :startDate)
                AND (:endDate IS NULL OR d.departmentCreateTime <= :endDate)
                ORDER BY d.departmentModifyTime DESC, d.departmentID DESC
            """)
    List<Object[]> findAllDepartmentsBySearchTextNoPagination(
            @Param("searchText") String searchText,
            @Param("departmentStatus") Boolean departmentStatus,
            @Param("isDepartmentArchived") Boolean isDepartmentArchived,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Sort sort);

    @Transactional
    @Modifying
    @Query(value = "UPDATE Department d SET d.departmentStatus = :status, d.departmentModifyTime = :modifyTime WHERE d.departmentID = :departmentId", nativeQuery = true)
    void updateDepartmentStatus(
            @Param("status") boolean status,
            @Param("modifyTime") String modifyTime,
            @Param("departmentId") Integer departmentId);

    // Optional — only if you have users linked to department
    @Query("SELECT COUNT(u) FROM User u "
            + "JOIN u.departmentUsers du "
            + "WHERE du.department.departmentID = :deptId AND u.userStatus = true")
    Long findActiveUserCountByDepartmentId(@Param("deptId") Integer deptId);

    // @Query("SELECT d.logTableName FROM Department d WHERE d.departmentID =
    // :deptId")
    // String findLogTableNameById(@Param("deptId") Integer deptId);

    // Update archive flag
    @Transactional
    @Modifying
    @Query(value = "UPDATE Department d SET d.isDepartmentArchived = true, d.departmentModifyTime = :modifyTime WHERE d.departmentID = :departmentId", nativeQuery = true)
    void updateArchiveStatus(
            @Param("modifyTime") String modifyTime, @Param("departmentId") Integer departmentId);

    @Query(value = "SELECT d.departmentName FROM Department d WHERE d.departmentID = :departmentId", nativeQuery = true)
    String findDepartmentNameByID(@Param("departmentId") Integer departmentId);

    @Query("""
                SELECT d
                FROM Department d
                LEFT JOIN FETCH d.executiveLeader el
                LEFT JOIN FETCH d.functionalLeader fl
                WHERE d.primaryDepartment.primaryDepartmentId IN :primaryDepartmentIds
                  AND d.departmentStatus = true
                  AND d.isDepartmentArchived = false
                ORDER BY d.departmentName ASC
            """)
    List<Department> findActiveDepartmentsByPrimaryDepartmentIds(
            @Param("primaryDepartmentIds") List<Long> primaryDepartmentIds);

    @Query("""
                           SELECT
                               d.departmentID,
                               d.departmentName,
            d.executiveLeader.userID,
                   d.functionalLeader.userID
                                   FROM Department d
                           WHERE d.executiveLeader.userID = :userId
                             AND d.isDepartmentArchived = false
                             AND d.departmentStatus = true
                       """)
    List<Object[]> findDepartmentsWhereUserIsExecutiveLeader(@Param("userId") Integer userId);

    @Query("""
                SELECT
                    d.departmentID,
                    d.departmentName,
                    d.executiveLeader.userID
                FROM Department d
                WHERE d.executiveLeader.userID = :userId
            """)
    List<Object[]> findDepartmentIdsWhereUserIsExecutiveLeader(@Param("userId") Integer userId);

    @Query("""
                SELECT
                    d.departmentID,
                    d.departmentName,
                    d.executiveLeader.userID,
                    d.functionalLeader.userID
                FROM Department d
                WHERE d.functionalLeader.userID = :userId
                  AND d.isDepartmentArchived = false
                  AND d.departmentStatus = true
            """)
    List<Object[]> findDepartmentsWhereUserIsFunctinalLeader(@Param("userId") Integer userId);

    @Query("""
                SELECT d.departmentID
                FROM Department d
                WHERE d.executiveLeader.userID = :userId
            """)
    List<Integer> findDepartmentIDWhereUserIsExecutiveLeader(@Param("userId") Integer userId);
}
