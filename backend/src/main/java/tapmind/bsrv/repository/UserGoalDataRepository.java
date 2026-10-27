package tapmind.bsrv.repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.model.UserGoalData;

@Repository
public interface UserGoalDataRepository extends JpaRepository<UserGoalData, Integer> {
    Optional<UserGoalData> findByUserIDAndGoalIDAndWorkDate(
            Integer userID,
            Integer goalID,
            LocalDate workDate);

    Optional<UserGoalData> findByWorkDateAndUserIDAndGoalIDAndGoalType(
            LocalDate workDate, Integer userID, Integer goalID, String goalType);

    @Query("""
                SELECT AVG(u.achievedGoal)
                FROM UserGoalData u
                WHERE u.userID = :userId
                  AND u.goalID = :goalId
                  AND u.workDate BETWEEN :startDate AND :endDate
            """)
    BigDecimal getPrevious7DaysAverageSpend(
            @Param("userId") Integer userId,
            @Param("goalId") Integer goalId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("""
            SELECT COALESCE(SUM(u.achievedGoal),0)
            FROM UserGoalData u
            WHERE u.departmentID = :departmentId
            AND u.goalID = 65
            AND u.workDate BETWEEN :startDate AND :endDate
            """)
    BigDecimal getLast7DaysAchievedGoalSumByDepartment(
            @Param("departmentId") Integer departmentId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("""
                SELECT g FROM UserGoalData g
                WHERE
                    (:userID IS NULL OR g.userID = :userID)
                AND (:departmentID IS NULL OR g.departmentID = :departmentID)
                AND (:goalID IS NULL OR g.goalID = :goalID)
                AND (:goalType IS NULL OR g.goalType = :goalType)
                AND (:startDate IS NULL OR g.workDate >= :startDate)
                AND (:endDate IS NULL OR g.workDate <= :endDate)
            """)
    Page<UserGoalData> findFilteredPaginated(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("goalID") Integer goalID,
            @Param("goalType") String goalType,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Pageable pageable);

    @Query("""
                SELECT g FROM UserGoalData g
                WHERE
                    (:userID IS NULL OR g.userID = :userID)
                AND (:departmentID IS NULL OR g.departmentID = :departmentID)
                AND (:goalID IS NULL OR g.goalID = :goalID)
                AND (:startDate IS NULL OR g.workDate >= :startDate)
                AND (:endDate IS NULL OR g.workDate <= :endDate)
            """)
    List<UserGoalData> findFiltered(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("goalID") Integer goalID,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("""
                SELECT ug
                FROM UserGoalData ug
                JOIN ug.user u
                JOIN ug.goal g
                WHERE
                    (:userID IS NULL OR ug.userID = :userID)
                AND (:departmentID IS NULL OR ug.departmentID = :departmentID)
                AND (:goalID IS NULL OR ug.goalID = :goalID)
                AND (:startDate IS NULL OR ug.workDate >= :startDate)
                AND (:endDate IS NULL OR ug.workDate <= :endDate)
            """)
    List<UserGoalData> findGoalDataWithNames(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("goalID") Integer goalID,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("""
                 SELECT ug
                 FROM UserGoalData ug
                 JOIN ug.user u
                 JOIN ug.goal g
                 JOIN ug.department d
                 WHERE
                     (:userID IS NULL OR ug.userID = :userID)
                 AND (:departmentID IS NULL OR ug.departmentID = :departmentID)
                 AND (:goalID IS NULL OR ug.goalID = :goalID)
                 AND (:executiveLeaderID IS NULL OR d.executiveLeader.userID = :executiveLeaderID)
                 AND (:startDate IS NULL OR ug.workDate >= :startDate)
                 AND (:endDate IS NULL OR ug.workDate <= :endDate)
            """)
    Page<UserGoalData> findFilteredWithRelations(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("goalID") Integer goalID,
            @Param("executiveLeaderID") Integer executiveLeaderID,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Pageable pageable);

    @Query("""
            SELECT
                AVG(
                    CASE
                        WHEN ug.fixedGoal > 0
                        THEN (ug.achievedGoal * 100.0) / ug.fixedGoal
                        ELSE 0
                    END
                )
            FROM UserGoalData ug
            WHERE
                (:userID IS NULL OR ug.userID = :userID)
            AND (:departmentID IS NULL OR ug.departmentID = :departmentID)
            AND (:goalID IS NULL OR ug.goalID = :goalID)
            AND (:startDate IS NULL OR ug.workDate >= :startDate)
            AND (:endDate IS NULL OR ug.workDate <= :endDate)
            """)
    Double getAverageAchievedPercentage(
            Integer userID, Integer departmentID, Integer goalID, LocalDate startDate, LocalDate endDate);

    @Query(value = """
                SELECT
                    CASE
                        WHEN COALESCE((
                            SELECT SUM(ug.fixedGoal)
                            FROM UserGoalData ug
                            WHERE (:userID IS NULL OR ug.userID = :userID)
                              AND (:departmentID IS NULL OR ug.departmentID = :departmentID)
                              AND (:goalID IS NULL OR ug.goalID = :goalID)
                              AND (:startDate IS NULL OR ug.workDate >= :startDate)
                              AND (:endDate IS NULL OR ug.workDate <= :endDate)
                        ), 0) = 0
                        THEN 0
                        ELSE (
                            COALESCE((
                                SELECT SUM(ug.achievedGoal)
                                FROM UserGoalData ug
                                WHERE (:userID IS NULL OR ug.userID = :userID)
                                  AND (:departmentID IS NULL OR ug.departmentID = :departmentID)
                                  AND (:goalID IS NULL OR ug.goalID = :goalID)
                                  AND (:startDate IS NULL OR ug.workDate >= :startDate)
                                  AND (:endDate IS NULL OR ug.workDate <= :endDate)
                            ), 0) * 100.0
                        )
                        /
                        (
                            (
                                SELECT SUM(ug.fixedGoal)
                                FROM UserGoalData ug
                                WHERE (:userID IS NULL OR ug.userID = :userID)
                                  AND (:departmentID IS NULL OR ug.departmentID = :departmentID)
                                  AND (:goalID IS NULL OR ug.goalID = :goalID)
                                  AND (:startDate IS NULL OR ug.workDate >= :startDate)
                                  AND (:endDate IS NULL OR ug.workDate <= :endDate)
                            )
                        )
                    END
            """, nativeQuery = true)
    BigDecimal getAverageAchievedPercentageForSD(
            Integer userID,
            Integer departmentID,
            Integer goalID,
            LocalDate startDate,
            LocalDate endDate);

    @Query(value = """
            SELECT
                CASE
                    WHEN COALESCE((
                        SELECT SUM(ug.fixedGoal)
                        FROM UserGoalData ug
                        WHERE (:userID IS NULL OR ug.userID = :userID)
                          AND (:departmentID IS NULL OR ug.departmentID = :departmentID)
                          AND (:goalID IS NULL OR ug.goalID = :goalID)
                          AND (:startDate IS NULL OR ug.workDate >= :startDate)
                          AND (:endDate IS NULL OR ug.workDate <= :endDate)
                    ), 0) = 0
                    THEN 0
                    ELSE (
                        COALESCE((
                            SELECT SUM(ug.achievedGoal)
                            FROM UserGoalData ug
                            WHERE (:userID IS NULL OR ug.userID = :userID)
                              AND (:departmentID IS NULL OR ug.departmentID = :departmentID)
                              AND (:goalID IS NULL OR ug.goalID = :goalID)
                              AND (:startDate IS NULL OR ug.workDate >= :startDate)
                              AND (:endDate IS NULL OR ug.workDate <= :endDate)
                        ), 0) * 100.0
                    )
                    /
                    (
                        (
                            SELECT SUM(ug.fixedGoal)
                            FROM UserGoalData ug
                            WHERE (:userID IS NULL OR ug.userID = :userID)
                              AND (:departmentID IS NULL OR ug.departmentID = :departmentID)
                              AND (:goalID IS NULL OR ug.goalID = :goalID)
                              AND (:startDate IS NULL OR ug.workDate >= :startDate)
                              AND (:endDate IS NULL OR ug.workDate <= :endDate)
                        )
                    )
                END
            """, nativeQuery = true)
    BigDecimal getAverageAchievedPercentageForSDAndSDA(
            Integer userID,
            Integer departmentID,
            Integer goalID,
            LocalDate startDate,
            LocalDate endDate);

    @Query(value = """
                            SELECT ROUND(
                                AVG(
                                    CASE
                                        WHEN ug.AchievedGoal < 40 THEN
                                            (ug.FixedGoal * 100.0)
                                            / NULLIF(ug.AchievedGoal, 0)
                                        ELSE
                                            GREATEST(
                                                100 -
                                                (
                                                    FLOOR((ug.AchievedGoal - 40) / 10) * 10
                                                ),
                                                0
                                            )
                                    END
                                ),
                                2
                            )
                            FROM UserGoalData ug
                            WHERE (:userID IS NULL OR ug.UserID = :userID)
                              AND (:departmentID IS NULL OR ug.DepartmentID = :departmentID)
            AND CAST(ug.modifiedAt AS DATE) BETWEEN :startDate AND :endDate
                        """, nativeQuery = true)
    BigDecimal getAverageAchievedPercentageForDept22(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("""
                SELECT ug
                FROM UserGoalData ug
                JOIN FETCH ug.user u
                JOIN FETCH ug.goal g
                JOIN FETCH ug.department d
                WHERE (:userID IS NULL OR ug.userID = :userID)
                  AND (:departmentID IS NULL OR ug.departmentID = :departmentID)
                  AND (:goalID IS NULL OR ug.goalID = :goalID)
                  AND (:executiveLeaderID IS NULL OR d.executiveLeader.userID = :executiveLeaderID)
                  AND (:startDate IS NULL OR ug.workDate >= :startDate)
                  AND (:endDate IS NULL OR ug.workDate <= :endDate)
            """)
    Page<UserGoalData> findFilteredWithRelationsByUpdatedAt(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("goalID") Integer goalID,
            @Param("executiveLeaderID") Integer executiveLeaderID,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Pageable pageable);

    @Query("""
                SELECT ug FROM UserGoalData ug
                JOIN FETCH ug.user u
                JOIN FETCH ug.goal g
                WHERE
                    (:userID IS NULL OR ug.userID = :userID)
                AND (:departmentID IS NULL OR ug.departmentID = :departmentID)
                AND (:goalID IS NULL OR ug.goalID = :goalID)
                AND (:startDate IS NULL OR ug.workDate >= :startDate)
                AND (:endDate IS NULL OR ug.workDate <= :endDate)
            """)
    List<UserGoalData> findFilteredWithRelations(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("goalID") Integer goalID,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    List<UserGoalData> findByUserIDAndWorkDateBetween(
            Integer userID, LocalDate fromDate, LocalDate toDate);

    Optional<UserGoalData> findByWorkDateAndDepartmentIDAndGoalID(
            LocalDate workDate, Integer departmentID, Integer goalID);

    Optional<UserGoalData> findByWorkDateAndDepartmentIDAndGoalIDAndTarget(
            LocalDate workDate, Integer departmentID, Integer goalID, Boolean target);

    // Add this method to your existing UserGoalDataRepository

    @Query("""
                SELECT g FROM UserGoalData g
                WHERE (:userID IS NULL OR g.userID = :userID)
                  AND (:departmentID IS NULL OR g.departmentID = :departmentID)
                  AND (g.approvedByEL IS NULL OR g.approvedByEL = false)
                  AND (:startDate IS NULL OR g.workDate >= :startDate)
                  AND (:endDate IS NULL OR g.workDate <= :endDate)
                  AND g.workDate IN :dates
                  AND (:onlyCommented = false
                       OR (g.commentForRejection IS NOT NULL
                           AND g.commentForRejection <> ''))
                ORDER BY g.workDate DESC
            """)
    List<UserGoalData> findByUserAndDepartmentAndDatesWithCommentFilter(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("dates") List<LocalDate> dates,
            @Param("onlyCommented") boolean onlyCommented,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("""
                SELECT g FROM UserGoalData g
                WHERE (:userID IS NULL OR g.userID = :userID)
                  AND (:departmentID IS NULL OR g.departmentID = :departmentID)
                  AND (g.approvedByEL IS NULL OR g.approvedByEL = false)
                  AND (:startDate IS NULL OR g.workDate >= :startDate)
                  AND (:endDate IS NULL OR g.workDate <= :endDate)
                  AND (:onlyCommented = false
                       OR (g.commentForRejection IS NOT NULL
                           AND g.commentForRejection <> ''))
                ORDER BY g.workDate DESC
            """)
    Page<UserGoalData> findByUserAndDepartmentPaginatedWithCommentFilter(
            @Param("userID") Integer userID,
            @Param("departmentID") Integer departmentID,
            @Param("onlyCommented") boolean onlyCommented,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Pageable pageable);

    @Modifying
    @Transactional
    @Query("""
                UPDATE UserGoalData g
                SET g.approvedByEL = true
                WHERE g.userGoalDataID IN :ids
            """)
    int approveGoalEntries(
            @Param("ids") List<Integer> ids);

    @Modifying
    @Transactional
    @Query("""
                UPDATE UserGoalData g
                SET g.commentForRejection = :comment
                WHERE g.userGoalDataID = :id
            """)
    int rejectGoalEntry(
            @Param("id") Integer id,
            @Param("comment") String comment);

    @Query("SELECT COALESCE(SUM(g.achievedGoal), 0) FROM UserGoalData g WHERE g.userID = :userID AND g.workDate BETWEEN :startDate AND :endDate")
    BigDecimal sumAchievedGoalByUserAndDateRange(@Param("userID") Integer userID, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT COALESCE(SUM(g.fixedGoal), 0) FROM UserGoalData g WHERE g.userID = :userID AND g.workDate BETWEEN :startDate AND :endDate")
    BigDecimal sumFixedGoalByUserAndDateRange(@Param("userID") Integer userID, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT COUNT(DISTINCT g.userID) FROM UserGoalData g WHERE (:departmentID IS NULL OR g.departmentID = :departmentID) AND g.workDate BETWEEN :startDate AND :endDate")
    Long countByDepartmentAndDateRange(@Param("departmentID") Integer departmentID, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT COUNT(g) FROM UserGoalData g WHERE g.userID = :userID AND g.workDate BETWEEN :startDate AND :endDate")
    Long countByUserAndDateRange(@Param("userID") Integer userID, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("""
                SELECT ug.userID, u.name, u.userEmail, COUNT(ug)
                FROM UserGoalData ug
                JOIN ug.user u
                WHERE (:departmentID IS NULL OR ug.departmentID = :departmentID)
                  AND ug.workDate BETWEEN :startDate AND :endDate
                  AND ug.approvedByEL = true
                GROUP BY ug.userID, u.name, u.userEmail
                ORDER BY u.name
            """)
    List<Object[]> findReviewedUsersByDeptAndDateRange(
            @Param("departmentID") Integer departmentID,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("""
                SELECT ug.userID, u.name, u.userEmail, COUNT(ug)
                FROM UserGoalData ug
                JOIN ug.user u
                WHERE (:departmentID IS NULL OR ug.departmentID = :departmentID)
                  AND ug.workDate BETWEEN :startDate AND :endDate
                  AND (ug.approvedByEL IS NULL OR ug.approvedByEL = false)
                GROUP BY ug.userID, u.name, u.userEmail
                ORDER BY u.name
            """)
    List<Object[]> findNonReviewedUsersByDeptAndDateRange(
            @Param("departmentID") Integer departmentID,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
