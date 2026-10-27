package tapmind.bsrv.repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.model.UserGoalData;
import tapmind.bsrv.model.UserWorkData;
import tapmind.bsrv.model.User;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Pageable;

@Repository
public interface UserWorkDataRepository extends JpaRepository<UserWorkData, Integer> {

    // UserWorkDataRepository.java

    @Query("""
                SELECT u FROM UserWorkData u
                 JOIN Department d ON d.departmentID = u.departmentID
                WHERE ((:userID = 0) OR (:userID IS NULL) OR u.userID = :userID)
                  AND ((:departmentID = 0) OR (:departmentID IS NULL) OR u.departmentID = :departmentID)
                  AND (:startDate IS NULL OR u.workDate >= :startDate)
                  AND (:endDate IS NULL OR u.workDate <= :endDate)
                  AND (:isForTarget IS NULL OR u.isForTarget = :isForTarget)
                   AND ((:taskID = 0) OR (:taskID IS NULL) OR u.taskID = :taskID)
                   AND ((:elID = 0) OR (:elID IS NULL) OR d.executiveLeader.userID = :elID)
                ORDER BY u.workDate DESC
            """)
    List<UserWorkData> findFilteredWorkData(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("isForTarget") Boolean isForTarget,
            @Param("taskID") Integer taskID,
            @Param("elID") Integer elID);

    @Query("""
                SELECT u FROM UserWorkData u
                JOIN Department d ON d.departmentID = u.departmentID
                WHERE ((:userID = 0) OR (:userID IS NULL) OR u.userID = :userID)
                  AND ((:departmentID = 0) OR (:departmentID IS NULL) OR u.departmentID = :departmentID)

                  AND (
                        (
                            :departmentID = 42
                            AND :startDate IS NULL
                            AND :endDate IS NULL
                            AND LOWER(TRIM(u.remarks)) = 'pending'
                            AND u.workDate <= CURRENT_DATE
                        )
                        OR
                        (
                            NOT (
                                :departmentID = 42
                                AND :startDate IS NULL
                                AND :endDate IS NULL
                            )
                            AND (:startDate IS NULL OR u.workDate >= :startDate)
                            AND (:endDate IS NULL OR u.workDate <= :endDate)
                        )
                  )

                  AND (:isForTarget IS NULL OR u.isForTarget = :isForTarget)
                  AND ((:taskID = 0) OR (:taskID IS NULL) OR u.taskID = :taskID)
                  AND ((:elID = 0) OR (:elID IS NULL) OR d.executiveLeader.userID = :elID)

                ORDER BY u.workDate DESC
            """)
    Page<UserWorkData> findFilteredWorkDataPaginated(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("isForTarget") Boolean isForTarget,
            @Param("taskID") Integer taskID,
            @Param("elID") Integer elID,
            Pageable pageable);

    @Query("SELECT u FROM UserWorkData u "
            + "WHERE ((:userID = 0) OR (:userID IS NULL) OR u.userID = :userID) "
            + " AND ((:departmentID = 0) OR (:departmentID IS NULL) OR u.departmentID = :departmentID) "
            + "AND (:startDate IS NULL OR u.workDate >= :startDate) "
            + "AND (:endDate IS NULL OR u.workDate <= :endDate)")
    List<UserWorkData> findByOptionalFilters(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    // @Query(
    // value =
    // """
    // SELECT
    // COALESCE(
    // ROUND(
    // SUM(u.AllocatedTime/ 60) / NULLIF(DATEDIFF(:endDate, :startDate) + 1, 0),
    // 2),
    // 0) AS avgAllocated,

    // COALESCE(
    // ROUND(
    // SUM(u.TimeTakenToWork/ 60) / NULLIF(DATEDIFF(:endDate, :startDate) + 1, 0),
    // 2),
    // 0) AS avgWork

    // FROM UserWorkData u
    // WHERE ((:userID = 0) OR (:userID IS NULL) OR u.userID = :userID)
    // AND ((:departmentID = 0) OR (:departmentID IS NULL) OR u.departmentID =
    // :departmentID)
    // AND (:startDate IS NULL OR u.WorkDate >= :startDate)
    // AND (:endDate IS NULL OR u.WorkDate <= :endDate)
    // AND (:taskID IS NULL OR :taskID = 0 OR u.TaskID = :taskID)
    // AND (:isForTarget IS NULL OR u.IsForTarget = :isForTarget)
    // AND (
    // :elID IS NULL OR :elID = 0
    // OR u.DepartmentID IN (
    // SELECT d.DepartmentID
    // FROM Department d
    // WHERE d.ExecutiveLeaderID = :elID
    // )
    // )
    // """,
    // nativeQuery = true)
    @Query(value = """
            SELECT
                COALESCE(ROUND(AVG(daily_allocated), 2), 0) AS avgAllocated,
                COALESCE(ROUND(AVG(daily_work), 2), 0) AS avgWork
            FROM (
                SELECT
                    u.UserID,
                    DATE(u.WorkDate) AS work_day,

                    SUM(u.AllocatedTime) / 60 AS daily_allocated,
                    SUM(u.TimeTakenToWork) / 60 AS daily_work

                FROM UserWorkData u

                WHERE ((:userID = 0) OR (:userID IS NULL) OR u.userID = :userID)
                  AND ((:departmentID = 0) OR (:departmentID IS NULL) OR u.departmentID = :departmentID)
                  AND (:startDate IS NULL OR u.WorkDate >= :startDate)
                  AND (:endDate IS NULL OR u.WorkDate <= :endDate)
                  AND (:taskID IS NULL OR :taskID = 0 OR u.TaskID = :taskID)
                  AND (:isForTarget IS NULL OR u.IsForTarget = :isForTarget)

                  -- REMOVE FULL DAY
                  AND (u.LeaveType IS NULL OR u.LeaveType != 'FULL_DAY')

                  -- REMOVE WEEKENDS
                  AND DAYOFWEEK(u.WorkDate) NOT IN (1,7)

                  AND (
                        :elID IS NULL OR :elID = 0
                        OR u.DepartmentID IN (
                            SELECT d.DepartmentID
                            FROM Department d
                            WHERE d.ExecutiveLeaderID = :elID
                        )
                  )

                GROUP BY u.UserID, DATE(u.WorkDate)

            ) t;
            """, nativeQuery = true)
    Map<String, Object> findOverallAverages(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("isForTarget") Boolean isForTarget,
            @Param("taskID") Integer taskID,
            @Param("elID") Integer elID);

    // @Query(value = """
    // SELECT
    // COALESCE(ROUND(AVG(u.AllocatedTime) , 2), 0) AS avgAllocated,
    // COALESCE(ROUND(AVG(u.TimeTakenToWork) , 2), 0) AS avgWork
    // FROM UserWorkData u
    // WHERE ((:userID = 0) OR (:userID IS NULL) OR u.userID = :userID)
    // AND ((:departmentID = 0) OR (:departmentID IS NULL) OR u.departmentID =
    // :departmentID)
    // AND (:startDate IS NULL OR u.WorkDate >= :startDate)
    // AND (:endDate IS NULL OR u.WorkDate <= :endDate)
    // AND (:taskID IS NULL OR :taskID = 0 OR u.TaskID = :taskID)
    // AND (:isForTarget IS NULL OR u.IsForTarget = :isForTarget)
    // AND (
    // :elID IS NULL OR :elID = 0
    // OR u.DepartmentID IN (
    // SELECT d.DepartmentID
    // FROM Department d
    // WHERE d.ExecutiveLeaderID = :elID
    // )
    // )
    // """, nativeQuery = true)
    // Map<String, Object> findOverallAverages(
    // @Param("userID") Integer userID,
    // @Param("departmentID") Integer departmentID,
    // @Param("startDate") LocalDate startDate,
    // @Param("endDate") LocalDate endDate,
    // @Param("isForTarget") Boolean isForTarget,
    // @Param("taskID") Integer taskID,
    // @Param("elID") Integer elID
    // );

    // @Query(value = """
    // SELECT
    // u.UserID,
    // u.DepartmentID,
    // u.WorkDate,

    // -- Total AllocatedTime (non-target) (already in hours)
    // SUM(
    // CASE
    // WHEN u.IsForTarget = 0
    // THEN COALESCE(u.AllocatedTime / 60 , 0.0)
    // ELSE 0.0
    // END
    // ) AS TotalAllocatedTime,

    // -- Total TimeTakenToWork (non-target) MINUTES → HOURS
    // SUM(
    // CASE
    // WHEN u.IsForTarget = 0
    // THEN COALESCE(u.TimeTakenToWork / 60, 0.0)
    // ELSE 0.0
    // END
    // ) AS TotalTimeTaken,

    // -- Average TotalUnitValues (target)
    // AVG(
    // CASE
    // WHEN u.IsForTarget = 1
    // THEN CAST(u.TotalUnitValues AS DECIMAL(10,2))
    // END
    // ) AS AvgUnitValues,

    // -- Check if half-day leave exists
    // MAX(u.IsHalfDayLeave) AS IsHalfDayLeave

    // FROM UserWorkData u

    // LEFT JOIN DepartmentTask dt
    // ON (u.IsForTarget = 0 AND u.TaskID = dt.TaskID)

    // LEFT JOIN DepartmentTarget dtt
    // ON (u.IsForTarget = 1 AND u.TaskID = dtt.TargetID)

    // WHERE u.WorkDate = :workDate

    // GROUP BY u.UserID, u.DepartmentID, u.WorkDate
    // """, nativeQuery = true)
    // List<Object[]> fetchUserWorkDataGrouped(@Param("workDate") LocalDate
    // workDate);

    // @Query(value = """
    // SELECT
    // u.UserID,
    // u.DepartmentID,
    // u.WorkDate,

    // -- Total AllocatedTime (non-target) convert MINUTES → HOURS
    // SUM(
    // CASE
    // WHEN u.IsForTarget = 0
    // THEN COALESCE(u.AllocatedTime/ 60, 0.0)
    // ELSE 0.0
    // END
    // ) AS TotalAllocatedTime,

    // -- Total TimeTakenToWork (non-target) convert MINUTES → HOURS
    // SUM(
    // CASE
    // WHEN u.IsForTarget = 0
    // THEN COALESCE(u.TimeTakenToWork / 60, 0.0)
    // ELSE 0.0
    // END
    // ) AS TotalTimeTaken,

    // -- Average TotalUnitValues (target)
    // AVG(
    // CASE
    // WHEN u.IsForTarget = 1
    // THEN CAST(u.TotalUnitValues AS DECIMAL(10,2))
    // END
    // ) AS AvgUnitValues,

    // -- Check half-day leave
    // MAX(u.IsHalfDayLeave) AS IsHalfDayLeave

    // FROM UserWorkData u

    // LEFT JOIN DepartmentTask dt
    // ON (u.IsForTarget = 0 AND u.TaskID = dt.TaskID)

    // LEFT JOIN DepartmentTarget dtt
    // ON (u.IsForTarget = 1 AND u.TaskID = dtt.TargetID)

    // GROUP BY u.UserID, u.DepartmentID, u.WorkDate
    // """, nativeQuery = true)
    // List<Object[]> fetchUserWorkDataGrouped();

    @Query(value = """
                SELECT
                    u.UserID,
                    u.DepartmentID,
                    u.WorkDate,

                    -- Non Target Work (Time Based)
                    SUM(
                        CASE
                            WHEN u.IsForTarget = 0
                            THEN COALESCE(u.AllocatedTime / 60, 0.0)
                            ELSE 0.0
                        END
                    ) AS TotalAllocatedTime,

                    SUM(
                        CASE
                            WHEN u.IsForTarget = 0
                            THEN COALESCE(u.TimeTakenToWork / 60, 0.0)
                            ELSE 0.0
                        END
                    ) AS TotalTimeTaken,

                    --  FIXED TARGET ACHIEVED USING UNITS
                    CASE
                        WHEN SUM(CASE WHEN u.IsForTarget = 1 THEN COALESCE(u.Units,0) END) > 0
                        THEN (
                            SUM(CASE WHEN u.IsForTarget = 1 THEN COALESCE(u.AchivedUnits,0) END)
                            /
                            SUM(CASE WHEN u.IsForTarget = 1 THEN COALESCE(u.Units,0) END)
                        ) * 100
                        ELSE NULL
                    END AS TargetAchievedPercent,

                    MAX(u.IsHalfDayLeave) AS IsHalfDayLeave

                FROM UserWorkData u

                WHERE u.WorkDate = :workDate

                GROUP BY u.UserID, u.DepartmentID, u.WorkDate
            """, nativeQuery = true)
    List<Object[]> fetchUserWorkDataGrouped(@Param("workDate") LocalDate workDate);

    @Query(value = """
                SELECT
                    u.UserID,
                    u.DepartmentID,
                    u.WorkDate,

                    -- Non Target Work (Time Based)
                    SUM(
                        CASE
                            WHEN u.IsForTarget = 0
                            THEN COALESCE(u.AllocatedTime / 60, 0.0)
                            ELSE 0.0
                        END
                    ) AS TotalAllocatedTime,

                    SUM(
                        CASE
                            WHEN u.IsForTarget = 0
                            THEN COALESCE(u.TimeTakenToWork / 60, 0.0)
                            ELSE 0.0
                        END
                    ) AS TotalTimeTaken,

                    -- TARGET ACHIEVED: per-row average; depts 59/60/61 penalize if achieved > units
                    AVG(
                        CASE
                            WHEN u.IsForTarget = 1 AND u.Units > 0 THEN
                                CASE
                                    WHEN u.DepartmentID IN (59, 60, 61) AND u.AchivedUnits > u.Units
                                    THEN (u.AchivedUnits * 100.0 / u.Units) - 10
                                    ELSE (u.AchivedUnits * 100.0 / u.Units)
                                END
                            ELSE NULL
                        END
                    ) AS TargetAchievedPercent,

                    MAX(u.IsHalfDayLeave) AS IsHalfDayLeave

                FROM UserWorkData u

                GROUP BY u.UserID, u.DepartmentID, u.WorkDate
            """, nativeQuery = true)
    List<Object[]> fetchUserWorkDataGrouped();

    @Query("""
            SELECT COALESCE(SUM(u.achivedUnits), 0)
            FROM UserWorkData u
            WHERE u.userID = :userId
              AND u.workDate = :workDate
              AND u.departmentID = :departmentId
              AND u.isForTarget = true
            """)
    Integer sumAchievedUnitsForTarget(
            @Param("userId") Integer userId,
            @Param("workDate") LocalDate workDate,
            @Param("departmentId") Integer departmentId);

    @Query("""
            SELECT COALESCE(SUM(u.achivedUnits), 0)
            FROM UserWorkData u
            WHERE u.userID = :userId
              AND u.workDate = :workDate
              AND u.departmentID = :departmentId
              AND u.taskID = :taskId
              AND u.isForTarget = true
            """)
    Integer sumAchievedUnitsForTargetWithTask(
            @Param("userId") Integer userId,
            @Param("workDate") LocalDate workDate,
            @Param("departmentId") Integer departmentId,
            @Param("taskId") Integer taskId);

    @Query("""
            SELECT COALESCE(SUM(u.achivedUnits), 0)
            FROM UserWorkData u
            WHERE u.userID = :userId
              AND u.workDate BETWEEN :startDate AND :endDate
              AND u.departmentID = :departmentId
              AND u.isForTarget = true
            """)
    Integer sumAchievedUnitsForTargetInRange(
            @Param("userId") Integer userId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("departmentId") Integer departmentId);

    @Query("""
            SELECT COALESCE(SUM(u.achivedUnits), 0)
            FROM UserWorkData u
            WHERE u.userID = :userId
              AND u.workDate BETWEEN :startDate AND :endDate
              AND u.departmentID = :departmentId
              AND u.taskID = :taskId
              AND u.isForTarget = true
            """)
    Integer sumAchievedUnitsForTargetWithTaskInRange(
            @Param("userId") Integer userId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("departmentId") Integer departmentId,
            @Param("taskId") Integer taskId);

    @Query("""
            SELECT u.taskID, COALESCE(SUM(u.achivedUnits), 0)
            FROM UserWorkData u
            WHERE u.userID = :userId
              AND u.workDate = :workDate
              AND u.departmentID = :departmentId
              AND u.isForTarget = true
            GROUP BY u.taskID
            """)
    List<Object[]> sumAchievedUnitsPerTaskForTarget(
            @Param("userId") Integer userId,
            @Param("workDate") LocalDate workDate,
            @Param("departmentId") Integer departmentId);

    Optional<UserWorkData> findByWorkDateAndUserID(
            LocalDate workDate, Integer userID);

    @Query("""
                SELECT u FROM UserWorkData u
                WHERE u.userID = :userID
                  AND u.taskID = :taskID
                  AND u.workDate = :workDate
                  AND (:isForTarget IS NULL OR u.isForTarget = :isForTarget)
            """)
    List<UserWorkData> findByUserTaskAndWorkDate(
            @Param("userID") Integer userID,
            @Param("taskID") Integer taskID,
            @Param("workDate") LocalDate workDate,
            @Param("isForTarget") Boolean isForTarget);

    // Add these two methods to your existing UserWorkDataRepository
    @Query("""
                SELECT u FROM UserWorkData u
                WHERE (:userID IS NULL OR u.userID = :userID)
                  AND (:departmentID IS NULL OR u.departmentID = :departmentID)
                  AND (u.approvedByEL IS NULL OR u.approvedByEL = false)
                  AND (:isForTarget IS NULL OR u.isForTarget = :isForTarget)
                  AND (:startDate IS NULL OR u.workDate >= :startDate)
                  AND (:endDate IS NULL OR u.workDate <= :endDate)
                  AND (:onlyCommented = false
                       OR (u.commentForRejection IS NOT NULL
                           AND u.commentForRejection <> ''))
                ORDER BY u.workDate DESC
            """)
    Page<UserWorkData> findByUserAndDepartmentPaginatedWithCommentFilter(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("onlyCommented") boolean onlyCommented,
            @Param("isForTarget") Boolean isForTarget,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Pageable pageable);

    @Query("""
                SELECT u FROM UserWorkData u
                WHERE (:userID IS NULL OR u.userID = :userID)
                  AND (:departmentID IS NULL OR u.departmentID = :departmentID)
                  AND (u.approvedByEL IS NULL OR u.approvedByEL = false)
                  AND (:isForTarget IS NULL OR u.isForTarget = :isForTarget)
                  AND (:startDate IS NULL OR u.workDate >= :startDate)
                  AND (:endDate IS NULL OR u.workDate <= :endDate)
                  AND u.workDate IN :dates
                  AND (:onlyCommented = false
                       OR (u.commentForRejection IS NOT NULL
                           AND u.commentForRejection <> ''))
                ORDER BY u.workDate DESC
            """)
    List<UserWorkData> findByUserAndDepartmentAndDatesWithCommentFilter(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("dates") List<LocalDate> dates,
            @Param("onlyCommented") boolean onlyCommented,
            @Param("isForTarget") Boolean isForTarget,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Modifying
    @Transactional
    @Query("""
                UPDATE UserWorkData u
                SET u.approvedByEL = true
                WHERE u.dailyTaskLogID IN :ids
            """)
    int approveTaskEntries(
            @Param("ids") List<Integer> ids);

    @Modifying
    @Transactional
    @Query("""
                UPDATE UserWorkData u
                SET u.commentForRejection = :comment
                WHERE u.dailyTaskLogID = :id
            """)
    int rejectTaskEntry(
            @Param("id") Integer id,
            @Param("comment") String comment);

    boolean existsByUserIDAndWorkDate(
            Integer userID,
            LocalDate workDate);

    @Query("SELECT COALESCE(SUM(u.achivedUnits), 0) FROM UserWorkData u WHERE u.departmentID = :departmentId AND u.isForTarget = true AND u.workDate = CURRENT_DATE")
    Integer sumAchievedUnitsByDepartmentToday(@Param("departmentId") Integer departmentId);

    @Query("SELECT COALESCE(SUM(u.achivedUnits), 0) FROM UserWorkData u WHERE u.userID = :userID AND u.isForTarget = true AND u.taskID = 65 AND u.workDate BETWEEN :startDate AND :endDate")
    BigDecimal sumAchivedUnitsForTarget(@Param("userID") Integer userID, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT COALESCE(SUM(u.units), 0) FROM UserWorkData u WHERE u.userID = :userID AND u.isForTarget = true AND u.taskID = 65 AND u.workDate BETWEEN :startDate AND :endDate")
    BigDecimal sumUnitsForTarget(@Param("userID") Integer userID, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT COALESCE(SUM(u.achivedUnits), 0) FROM UserWorkData u WHERE u.userID = :userID AND u.taskID = :taskID AND u.workDate = :workDate")
    BigDecimal sumAchivedUnitsByTaskId(@Param("userID") Integer userID, @Param("taskID") Integer taskID, @Param("workDate") LocalDate workDate);

    @Query("SELECT COALESCE(SUM(u.achivedUnits), 0) FROM UserWorkData u WHERE u.userID = :userID AND u.taskID = :taskID AND u.workDate BETWEEN :startDate AND :endDate")
    BigDecimal sumAchivedUnitsByTaskIdRange(@Param("userID") Integer userID, @Param("taskID") Integer taskID, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT COALESCE(SUM(u.achivedUnits), 0) FROM UserWorkData u WHERE u.userID = :userID AND u.isForTarget = true AND u.workDate BETWEEN :startDate AND :endDate")
    BigDecimal sumAchivedUnitsByIsForTarget(@Param("userID") Integer userID, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT COALESCE(SUM(u.units), 0) FROM UserWorkData u WHERE u.userID = :userID AND u.isForTarget = true AND u.workDate BETWEEN :startDate AND :endDate")
    BigDecimal sumUnitsByIsForTarget(@Param("userID") Integer userID, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
}
