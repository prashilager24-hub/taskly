package tapmind.bsrv.repository;

import tapmind.bsrv.model.*;
import org.springframework.data.jpa.repository.*;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import java.util.Map;
import java.time.LocalDate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Pageable;
public interface TechStoryRepository extends JpaRepository<TechStory, Long> {




@Query(
    value = """
        SELECT
            st.story_id        AS storyId,
            st.story_key       AS storyKey,
            st.story_points    AS storyPoints,
            st.status          AS status,
            u.user_name        AS assignedUser,
            s.sprint_id        AS sprintId
        FROM tech_story st
        JOIN tech_sprint s
            ON s.sprint_id = st.sprint_id
        LEFT JOIN tech_story_assignment a
            ON a.story_id = st.story_id
        LEFT JOIN users u
            ON u.user_id = a.user_id
        WHERE (:sprintId IS NULL OR s.sprint_id = :sprintId)
          AND (:userId IS NULL OR a.user_id = :userId)
          AND (:startDate IS NULL OR s.start_date >= :startDate)
          AND (:endDate IS NULL OR s.end_date <= :endDate)
        ORDER BY st.created_at DESC
    """,
    nativeQuery = true
)
List<Object[]> findStoriesBySprintAndUser(
        @Param("sprintId") Long sprintId,
        @Param("userId") Integer userId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
);




}
