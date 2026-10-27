package tapmind.bsrv.repository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import tapmind.bsrv.model.*;
import org.springframework.data.jpa.repository.*;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Pageable;
import java.util.Map;

@Repository
public interface TechSprintRepository extends JpaRepository<TechSprint, Long> {

    @Query(
    value = """
        SELECT 
            s.SprintID        AS sprintId,
            s.SprintName      AS sprintName,
            s.StartDate       AS startDate,
            s.EndDate         AS endDate,
            s.PlannedPoints   AS plannedPoints,
            s.Status          AS status,
            IFNULL(SUM(st.StoryPoints), 0) AS totalStoryPoints,
            JSON_ARRAYAGG(m.UserID) AS userMappedIds
        FROM TechSprint s
        LEFT JOIN TechSprintUserMapping m
            ON m.SprintID = s.SprintID
        LEFT JOIN TechStory st
            ON st.SprintID = s.SprintID
        WHERE 
           (:startDate IS NULL OR s.StartDate >= :startDate)
          AND (:endDate IS NULL OR s.EndDate <= :endDate)
        GROUP BY
            s.SprintID,
            s.SprintName,
            s.StartDate,
            s.EndDate,
            s.PlannedPoints,
            s.Status
        ORDER BY s.StartDate DESC
    """,
    nativeQuery = true
)
List<Map<String, Object>> findSprintSummaryByUser(
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
);
@Query("""
    SELECT 
        s.sprintID,
        s.startDate,
        s.plannedPoints,
        COALESCE(SUM(CASE WHEN st.status = 'DONE' THEN st.storyPoints ELSE 0 END), 0)
    FROM TechSprint s
    LEFT JOIN TechStory st ON st.sprintID = s.sprintID
    GROUP BY s.sprintID, s.startDate, s.plannedPoints
""")
List<Object[]> fetchTechGroupedBySprintAndDate();
}



