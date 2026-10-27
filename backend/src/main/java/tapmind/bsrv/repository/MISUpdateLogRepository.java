package tapmind.bsrv.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import tapmind.bsrv.model.MISUpdateLog;

import java.time.LocalDate;
import java.util.List;

public interface MISUpdateLogRepository extends JpaRepository<MISUpdateLog, Integer> {

  // ✅ 1. Fetch by user + date range + department + goal
  @Query(
      """
        SELECT m
        FROM MISUpdateLog m
        WHERE m.userID = :userId
          AND m.departmentID = :departmentId
          AND m.goalID = :goalId
          AND m.workDate BETWEEN :startDate AND :endDate
    """)
  List<MISUpdateLog> findByUserAndDateRange(
      @Param("userId") Integer userId,
      @Param("departmentId") Integer departmentId,
      @Param("goalId") Integer goalId,
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate);

  // ✅ 2. Fetch all users (department-wise) for reporting
  @Query(
      """
        SELECT m
        FROM MISUpdateLog m
        WHERE m.departmentID = :departmentId
          AND m.goalID = :goalId
          AND m.workDate BETWEEN :startDate AND :endDate
    """)
  List<MISUpdateLog> findByDepartmentAndDateRange(
      @Param("departmentId") Integer departmentId,
      @Param("goalId") Integer goalId,
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate);

  // ✅ 3. Fetch single day (useful for recalculation / validation)
  List<MISUpdateLog> findByUserIDAndWorkDateAndGoalID(
      Integer userID, LocalDate workDate, Integer goalID);

  // ✅ 4. Delete existing records before saving (overwrite scenario)
  @Modifying
  @Query(
      """
        DELETE FROM MISUpdateLog m
        WHERE m.userID = :userId
          AND m.workDate = :workDate
          AND m.goalID = :goalId
    """)
  void deleteByUserAndDateAndGoal(
      @Param("userId") Integer userId,
      @Param("workDate") LocalDate workDate,
      @Param("goalId") Integer goalId);

  // ✅ 5. Get all logs for multiple users (bulk reporting)
  @Query(
      """
        SELECT m
        FROM MISUpdateLog m
        WHERE m.userID IN :userIds
          AND m.departmentID = :departmentId
          AND m.workDate BETWEEN :startDate AND :endDate
    """)
  List<MISUpdateLog> findByUsersAndDateRange(
      @Param("userIds") List<Integer> userIds,
      @Param("departmentId") Integer departmentId,
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate);

  // ✅ 6. Count logs (useful for validation / missing updates)
  @Query(
      """
        SELECT COUNT(m)
        FROM MISUpdateLog m
        WHERE m.userID = :userId
          AND m.workDate = :workDate
          AND m.goalID = :goalId
    """)
  Long countByUserAndDateAndGoal(
      @Param("userId") Integer userId,
      @Param("workDate") LocalDate workDate,
      @Param("goalId") Integer goalId);
}
