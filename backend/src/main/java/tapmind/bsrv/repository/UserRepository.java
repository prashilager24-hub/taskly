// package tapmind.bsrv.repository;

// import java.time.LocalDate;
// import java.util.Date;
// import java.util.List;
// import java.util.Optional;
// import org.springframework.data.jpa.repository.JpaRepository;
// import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
// import org.springframework.data.jpa.repository.Modifying;
// import org.springframework.data.jpa.repository.Query;
// import org.springframework.data.repository.query.Param;
// import org.springframework.transaction.annotation.Transactional;
// import tapmind.bsrv.model.User;

// public interface UserRepository extends JpaRepository<User, Integer>, JpaSpecificationExecutor<User>{
//     // Custom Queries can be added here
//     Optional<User> findByName(String username); // Custom query to find User by Username
//     List<User> findByUserStatus(boolean status); // Custom query to find users by status
//     Optional<User> findByUserEmail(String userEmail);
//     Optional<User> findByUserEmailAndUserIDNot(String userEmail, int userID);
//     Optional<User> findByNameAndUserIDNot(String username,int userID);

//        @Query("""
//         SELECT u.role.roleID
//         FROM User u
//         WHERE u.userID = :userId
//     """)
//     Integer findRoleIdByUserId(@Param("userId") Integer userId);

//         // Native query to fetch the user by email and user status
//     @Query(value = "SELECT * FROM Users u WHERE u.UserEmail = :username AND u.UserStatus = true", nativeQuery = true)
//     User findByUsernameAndStatusTrue(@Param("username") String username);

//      boolean existsByUserEmail(String email);

//       @Modifying
//     @Transactional
//     @Query(value = "UPDATE Users SET UserPassword = :password WHERE UserEmail = :email", nativeQuery = true)
//     int updatePasswordByEmail(String password, String email);

//      @Modifying
//     @Transactional
//     @Query("UPDATE User u SET u.userStatus = :status, u.userModifyTime = :modifyTime WHERE u.userID IN :ids")
//     int updateUserStatusByIds(@Param("status") boolean status, @Param("modifyTime") Date modifyTime, @Param("ids") List<Integer> ids);

//      @Modifying
//     @Transactional
//     @Query("UPDATE User u SET u.isUserArchived = true, u.userStatus = false, u.userModifyTime = :modifyTime WHERE u.userID IN :ids")
//     int archiveUsers(@Param("ids") List<Integer> ids, @Param("modifyTime") Date modifyTime);

//        @Query(value = "SELECT u.UserEmail  FROM Users u WHERE u.UserID = :userID ", nativeQuery = true)
//     String findEmailByUserId(@Param("userID") Integer userID);

//     @Modifying
// @Transactional
// @Query("""
//     UPDATE Department d
//     SET d.executiveLeader.userID = :newELId
//     WHERE d.departmentID = :departmentId
// """)
// void updateExecutiveLeader(@Param("departmentId") Integer departmentId,
//                            @Param("newELId") Integer newELId);

//         @Modifying
// @Transactional
// @Query("""
//     UPDATE Department d
//     SET d.functionalLeader.userID = :newFLId
//     WHERE d.departmentID = :departmentId
// """)
// void updateFunctionalLeader(@Param("departmentId") Integer departmentId,
//                            @Param("newFLId") Integer newFLId);

//         @Query(value = """
//         SELECT u.UserID, u.UserName, u.UserEmail
//         FROM Users u
//         WHERE u.RoleID IN (2,4)
//           AND u.UserStatus = 1
//           AND u.IsUserArchived = 0
//           AND NOT EXISTS (
//                 SELECT 1
//                 FROM DepartmentUser du
//                 WHERE du.UserID = u.UserID
//                   AND du.DepartmentID IN (22,24)
//           )
//           AND NOT EXISTS (
//                 SELECT 1
//                 FROM UserWorkData uwd
//                 WHERE uwd.UserID = u.UserID
//                   AND uwd.WorkDate BETWEEN :startDate AND :endDate
//           )
//         """, nativeQuery = true)
//     List<Object[]> findUsersWhoDidNotFillWorkDataExcludeDept22And24(
//             @Param("startDate") LocalDate startDate,
//             @Param("endDate") LocalDate endDate
//     );

//     List<User> findByUserStatusTrueAndIsUserArchivedFalseOrderByNameAsc();

//     Optional<User> findByUserStatusTrueAndIsUserArchivedFalseAndUserID(Integer id);

//     boolean existsByUserIDAndUserStatusTrueAndIsUserArchivedFalse(Integer id);
// }

package tapmind.bsrv.repository;

import java.time.LocalDate;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import tapmind.bsrv.model.User;

public interface UserRepository extends JpaRepository<User, Integer>, JpaSpecificationExecutor<User> {

        // ================= BASIC =================

        @Query("SELECT u FROM User u LEFT JOIN FETCH u.departmentUsers du LEFT JOIN FETCH du.department WHERE u.name = :name")
        Optional<User> findByName(@Param("name") String name);

        List<User> findByUserStatus(boolean status);

        Optional<User> findByUserEmail(String userEmail);

        Optional<User> findByUserEmailAndUserIDNot(String userEmail, int userID);

        Optional<User> findByNameAndUserIDNot(String name, int userID);

        boolean existsByUserEmail(String email);

        // ================= ROLE =================

        @Query("""
                            SELECT u.role.roleID
                            FROM User u
                            WHERE u.userID = :userId
                        """)
        Integer findRoleIdByUserId(@Param("userId") Integer userId);

        // ================= AUTH =================

        @Query(value = "SELECT * FROM Users u WHERE u.UserEmail = :username AND u.UserStatus = true", nativeQuery = true)
        User findByUsernameAndStatusTrue(@Param("username") String username);

        // ================= PASSWORD =================

        @Modifying
        @Transactional
        @Query(value = "UPDATE Users SET UserPassword = :password WHERE UserEmail = :email", nativeQuery = true)
        int updatePasswordByEmail(@Param("password") String password, @Param("email") String email);

        // ================= STATUS =================

        @Modifying
        @Transactional
        @Query("UPDATE User u SET u.userStatus = :status, u.userModifyTime = :modifyTime WHERE u.userID IN :ids")
        int updateUserStatusByIds(@Param("status") boolean status,
                        @Param("modifyTime") Date modifyTime,
                        @Param("ids") List<Integer> ids);

        @Modifying
        @Transactional
        @Query("UPDATE User u SET u.isUserArchived = true, u.userStatus = false, u.userModifyTime = :modifyTime WHERE u.userID IN :ids")
        int archiveUsers(@Param("ids") List<Integer> ids,
                        @Param("modifyTime") Date modifyTime);

        // ================= UTIL =================

        @Query(value = "SELECT u.UserEmail FROM Users u WHERE u.UserID = :userID", nativeQuery = true)
        String findEmailByUserId(@Param("userID") Integer userID);

        // ================= DEPARTMENT =================

        @Modifying
        @Transactional
        @Query("""
                            UPDATE Department d
                            SET d.executiveLeader.userID = :newELId
                            WHERE d.departmentID = :departmentId
                        """)
        void updateExecutiveLeader(@Param("departmentId") Integer departmentId,
                        @Param("newELId") Integer newELId);

        @Modifying
        @Transactional
        @Query("""
                            UPDATE Department d
                            SET d.functionalLeader.userID = :newFLId
                            WHERE d.departmentID = :departmentId
                        """)
        void updateFunctionalLeader(@Param("departmentId") Integer departmentId,
                        @Param("newFLId") Integer newFLId);

        // ================= REPORT =================

        @Query(value = """
                        SELECT u.UserID, u.UserName, u.UserEmail
                        FROM Users u
                        WHERE u.RoleID IN (2,4,3)
                          AND u.UserStatus = 1
                          AND u.IsUserArchived = 0
                          AND NOT EXISTS (
                                SELECT 1
                                FROM DepartmentUser du
                                WHERE du.UserID = u.UserID
                                  AND du.DepartmentID IN (22,24)
                          )
                          AND NOT EXISTS (
                                SELECT 1
                                FROM UserWorkData uwd
                                WHERE uwd.UserID = u.UserID
                                  AND uwd.WorkDate BETWEEN :startDate AND :endDate
                          )
                        """, nativeQuery = true)
        List<Object[]> findUsersWhoDidNotFillWorkDataExcludeDept22And24(
                        @Param("startDate") LocalDate startDate,
                        @Param("endDate") LocalDate endDate);

        // ================= NEW: EMPLOYEE =================

        Optional<User> findByEmployeeID(String employeeID);

        boolean existsByEmployeeID(String employeeID);

        // ================= NEW: MANAGER FETCH =================

        @Query("""
                            SELECT DISTINCT u
                            FROM User u
                            LEFT JOIN FETCH u.reportingManager
                            LEFT JOIN FETCH u.elManager
                            WHERE u.userStatus = true AND u.isUserArchived = false
                        """)
        List<User> findAllActiveUsersWithManagers();

        // ================= NEW: MANAGER FILTER =================

        List<User> findByReportingManager_UserID(Integer managerId);

        List<User> findByElManager_UserID(Integer elManagerId);

        // ================= NEW: APPRAISAL UPDATE =================

        @Modifying
        @Transactional
        @Query(value = """
                            UPDATE Users
                            SET
                                ReportingManagerID = :rmId,
                                ELManagerID = :elId,
                                AppraisalCycle = :cycle,
                                UserModifyTime = :modifyTime
                            WHERE UserID = :userId
                        """, nativeQuery = true)
        int updateAppraisalNative(
                        @Param("userId") Integer userId,
                        @Param("rmId") Integer rmId,
                        @Param("elId") Integer elId,
                        @Param("cycle") String cycle,
                        @Param("modifyTime") Date modifyTime);

        @Query("""
                            SELECT DISTINCT u
                            FROM User u
                            JOIN u.departmentUsers du
                            WHERE du.department.departmentID = :departmentId
                              AND u.userStatus = true
                              AND u.isUserArchived = false
                        """)
        List<User> findUsersByDepartmentId(
                        @Param("departmentId") Integer departmentId);

        @Query("""
                            SELECT DISTINCT u
                            FROM User u
                            WHERE u.userStatus = true
                              AND u.isUserArchived = false
                        """)
        List<User> findAllActiveUsers();

        // ================= ACTIVE USERS =================

        List<User> findByUserStatusTrueAndIsUserArchivedFalseOrderByNameAsc();

        Optional<User> findByUserStatusTrueAndIsUserArchivedFalseAndUserID(Integer id);

        boolean existsByUserIDAndUserStatusTrueAndIsUserArchivedFalse(Integer id);

        // ================= HIERARCHY: USERS BY DEPARTMENT IDS =================

        @Query("""
                            SELECT DISTINCT u
                            FROM User u
                            JOIN u.departmentUsers du
                            LEFT JOIN FETCH u.role r
                            LEFT JOIN FETCH u.reportingManager rm
                            WHERE du.department.departmentID IN :departmentIds
                              AND u.userStatus = true
                              AND u.isUserArchived = false
                            ORDER BY u.name ASC
                        """)
        List<User> findActiveUsersByDepartmentIds(@Param("departmentIds") List<Integer> departmentIds);
}