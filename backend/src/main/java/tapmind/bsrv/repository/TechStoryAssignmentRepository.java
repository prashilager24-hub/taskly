package tapmind.bsrv.repository;

import tapmind.bsrv.model.*;
import org.springframework.data.jpa.repository.*;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
public interface TechStoryAssignmentRepository
        extends JpaRepository<TechStoryAssignment, Long> {


      @Query(
    value = """
        SELECT *
        FROM TechStoryAssignment
        WHERE UserID = :userID
          AND StoryID = :storyID
    """,
    nativeQuery = true
)
List<TechStoryAssignment> findByUserIDAndStoryID(
        @Param("userID") Long userID,
        @Param("storyID") Long storyID
);


   @Query(
    value = """
        SELECT COALESCE(SUM(a.points_worked), 0)
        FROM TechStoryAssignment a
        JOIN TechStory s
            ON s.StoryID = a.story_id
        WHERE s.SprintID = :sprintID
          AND a.UserID = :userID
    """,
    nativeQuery = true
)
Integer totalPointsByUser(
        @Param("sprintID") Long sprintID,
        @Param("userID") Long userID
);

}
