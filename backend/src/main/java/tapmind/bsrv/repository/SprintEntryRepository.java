package tapmind.bsrv.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.model.SprintEntry;

@Repository
public interface SprintEntryRepository extends JpaRepository<SprintEntry, Long> {

    // ── Single lookup ────────────────────────────────────────────────────
    Optional<SprintEntry> findByUserUserIDAndSprintLabel(Integer userId, String sprintLabel);

    // ── Latest sprint for a user ─────────────────────────────────────────
    Optional<SprintEntry> findTopByUserUserIDOrderByWeekStartDesc(Integer userId);

    // ── History list with optional filters ───────────────────────────────
    @Query("""
            SELECT se FROM SprintEntry se
            WHERE se.user.userID = :userId
              AND (:sprint IS NULL OR se.sprintLabel = :sprint)
              AND (:from   IS NULL OR se.weekStart  >= :from)
              AND (:to     IS NULL OR se.weekEnd    <= :to)
            ORDER BY se.weekStart DESC
            """)
    Page<SprintEntry> findHistory(
            @Param("userId") Integer userId,
            @Param("sprint") String sprint,
            @Param("from")   LocalDate from,
            @Param("to")     LocalDate to,
            Pageable pageable);

    @Query("""
            SELECT se FROM SprintEntry se
            WHERE (:sprint IS NULL OR se.sprintLabel = :sprint)
              AND (:from   IS NULL OR se.weekStart  >= :from)
              AND (:to     IS NULL OR se.weekEnd    <= :to)
            ORDER BY se.weekStart DESC
            """)
    Page<SprintEntry> findHistoryForAdmin(
            @Param("sprint") String sprint,
            @Param("from")   LocalDate from,
            @Param("to")     LocalDate to,
            Pageable pageable);

    // ── Trend: last N sprints for chart (oldest → newest after reverse) ──
    @Query("""
            SELECT se FROM SprintEntry se
            WHERE se.user.userID = :userId
            ORDER BY se.weekStart DESC
            LIMIT :weeks
            """)
    List<SprintEntry> findTrend(
            @Param("userId") Integer userId,
            @Param("weeks")  int weeks);

    // ── Team view: all entries for a given sprint label ──────────────────
    @Query("""
            SELECT se FROM SprintEntry se
            JOIN FETCH se.user u
            WHERE se.sprintLabel = :sprint
            ORDER BY se.scoreOverall DESC NULLS LAST
            """)
    List<SprintEntry> findBySprintLabel(@Param("sprint") String sprint);

    // ── All distinct sprint labels (for filter dropdowns) ────────────────
    @Query("SELECT DISTINCT se.sprintLabel FROM SprintEntry se ORDER BY se.sprintLabel DESC")
    List<String> findAllSprintLabels();

    // ── Count sprints per user ────────────────────────────────────────────
    long countByUserUserID(Integer userId);

    // ── Check existence for upsert guard ─────────────────────────────────
    boolean existsByUserUserIDAndSprintLabel(Integer userId, String sprintLabel);
}
