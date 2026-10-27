package tapmind.bsrv.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import tapmind.bsrv.model.AMRole;

import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Pageable;
public interface AMRoleRepository extends JpaRepository<AMRole, Integer> {

    // You can define custom query methods here if needed
    Optional<AMRole> findByRoleName(String roleName);

    // Example method to find archived roles
    List<AMRole> findByIsRoleArchived(boolean isArchived);

    // Example method to find roles by status
    List<AMRole> findByRoleStatus(boolean status);


    @Query("SELECT r.roleID FROM AMRole r WHERE r.roleName = :roleName")
   Integer findRoleIDByRoleName(String roleName);


     // Custom query to search by roleName and roleDescription
@Query("SELECT r.roleID, r.roleName, r.roleStatus, r.isRoleArchived, " +
       "r.roleCreateTime, r.roleModifyTime, r.roleDescription,r.rolePrivileges " +
       "FROM AMRole r " +
       "WHERE (:searchText IS NULL OR " +
       "(CAST(:searchText AS string) = CAST(r.roleID AS string) OR r.roleName LIKE CONCAT('%', :searchText, '%') OR r.roleDescription LIKE CONCAT('%', :searchText, '%'))) " +
       "AND (:roleStatus IS NULL OR r.roleStatus = :roleStatus) " +
       "AND (:isRoleArchived IS NULL OR r.isRoleArchived = :isRoleArchived) " +
       "AND (:startDate IS NULL OR r.roleCreateTime >= :startDate) " +
       "AND (:endDate IS NULL OR r.roleCreateTime <= :endDate) " +
       "ORDER BY r.roleModifyTime DESC")
Page<Object[]> findAllAMRolesBySearchText(@Param("searchText") String searchText,
                                           @Param("roleStatus") Boolean roleStatus,
                                           @Param("isRoleArchived") Boolean isRoleArchived,
                                           @Param("startDate") LocalDate startDate,
                                           @Param("endDate") LocalDate endDate,
                                           Pageable pageable);


    // Custom query to search without pagination (non-paginated version)
   @Query("SELECT r.roleID, r.roleName, r.roleStatus, r.isRoleArchived, " +
       "r.roleCreateTime, r.roleModifyTime, r.roleDescription,r.rolePrivileges " +
       "FROM AMRole r " +
       "WHERE (:searchText IS NULL OR " +
       "(CAST(:searchText AS string) = CAST(r.roleID AS string) OR r.roleName LIKE CONCAT('%', :searchText, '%') OR r.roleDescription LIKE CONCAT('%', :searchText, '%'))) " +
       "AND (:roleStatus IS NULL OR r.roleStatus = :roleStatus) " +
       "AND (:isRoleArchived IS NULL OR r.isRoleArchived = :isRoleArchived) " +
       "AND (:startDate IS NULL OR r.roleCreateTime >= :startDate) " +
       "AND (:endDate IS NULL OR r.roleCreateTime <= :endDate) " +
       "ORDER BY r.roleModifyTime DESC")
List<Object[]> findAllAMRolesBySearchTextNoPagination(@Param("searchText") String searchText,
                                                      @Param("roleStatus") Boolean roleStatus,
                                                      @Param("isRoleArchived") Boolean isRoleArchived,
                                                      @Param("startDate") LocalDate startDate,
                                                      @Param("endDate") LocalDate endDate,
                                                      Sort sort);


// Find the role count and name based on role ID
    @Query(value="SELECT COUNT(u.UserID) as userCount " +
            "FROM Users u " +
            "JOIN AMRole r ON u.UserRole = r.RoleName " +
            "WHERE u.UserStatus = true AND r.RoleID = :roleID",nativeQuery=true)
    Long findUserCountAndRoleNameByRoleID(int roleID);



@Modifying
@Transactional
@Query(value = "UPDATE AMRole  SET RoleStatus = :status, RoleModifyTime =:modifyTime  WHERE RoleID = :id", nativeQuery = true)
void updateRoleStatus(@Param("status") boolean status, @Param("modifyTime") String modifyTime,
            @Param("id") Integer id);

@Modifying
@Transactional
@Query(value = "UPDATE AMRole  SET IsRoleArchived = TRUE, RoleStatus = FALSE, RoleModifyTime = :modifyTime  WHERE RoleID = :id", nativeQuery = true)
void updateArchiveStatus(@Param("modifyTime") String modifyTime, @Param("id") Integer id);

}
