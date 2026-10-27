package tapmind.bsrv.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.jpa.repository.Modifying;

import tapmind.bsrv.model.DepartmentUser;
import tapmind.bsrv.model.DepartmentUserID;
import tapmind.bsrv.model.Department;
import tapmind.bsrv.model.User;

import java.util.Optional;
import java.util.List;

public interface DepartmentUserRepository extends JpaRepository<DepartmentUser, DepartmentUserID> {

    // Check if a user is already linked to a department
    boolean existsByUserAndDepartment(User user, Department department);

    // Fetch Department Name by User ID
    @Query("SELECT du.department.departmentName FROM DepartmentUser du WHERE du.user.userID = :userID")
    String findDepartmentNameByUserId(@Param("userID") Integer userID);

    // Fetch Department ID by User ID
    @Query("SELECT du.department.departmentID FROM DepartmentUser du WHERE du.user.userID = :userID")
    Integer findDepartmentIdByUserId(@Param("userID") Integer userID);

    // Delete department-user mapping for a specific user
    @Modifying
    @Transactional
    @Query("DELETE FROM DepartmentUser du WHERE du.user.userID = :userID")
    void deleteByUserId(@Param("userID") Integer userID);

    // Fetch Department ID by Username
    @Query("SELECT du.department.departmentID FROM DepartmentUser du WHERE du.user.username = :userName")
    Optional<Integer> findDepartmentIdByUserName(@Param("userName") String userName);

    @Query("""
                SELECT
                    dep.departmentID,
                    dep.departmentName,
                    el.userID,
                    fl.userID,
                    CASE
                        WHEN el.userID = :userId THEN true
                        ELSE false
                    END,
                    CASE
                        WHEN fl.userID = :userId THEN true
                        ELSE false
                    END
                FROM DepartmentUser du
                JOIN du.department dep
                LEFT JOIN dep.executiveLeader el
                LEFT JOIN dep.functionalLeader fl
                WHERE du.user.userID = :userId
                  AND dep.isDepartmentArchived = false
                  AND dep.departmentStatus = true
            """)
    List<Object[]> findDepartmentDetailsByUserId(
            @Param("userId") Integer userId);

    // Batch fetch department name/id for multiple users at once (avoids N+1 in
    // review listings)
    @Query("""
                SELECT du.user.userID, du.department.departmentName, du.department.departmentID
                FROM DepartmentUser du
                WHERE du.user.userID IN :userIds
            """)
    List<Object[]> findDepartmentInfoByUserIds(@Param("userIds") List<Integer> userIds);

    // HIERARCHY: Batch fetch DepartmentUser mappings with User details for a set of
    // department IDs
    @Query("""
                SELECT du
                FROM DepartmentUser du
                JOIN FETCH du.user u
                LEFT JOIN FETCH u.role r
                LEFT JOIN FETCH u.reportingManager rm
                WHERE du.department.departmentID IN :departmentIds
                  AND u.userStatus = true
                  AND u.isUserArchived = false
                ORDER BY u.name ASC
            """)
    List<DepartmentUser> findActiveDepartmentUsersByDepartmentIds(
            @Param("departmentIds") List<Integer> departmentIds);
}
