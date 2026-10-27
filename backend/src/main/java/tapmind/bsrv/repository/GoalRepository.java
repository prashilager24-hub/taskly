package tapmind.bsrv.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.model.Goal;

@Repository
public interface GoalRepository extends JpaRepository<Goal, Long> {

    List<Goal> findBySprintEntryIdOrderBySortOrderAsc(Long sprintEntryId);

    Optional<Goal> findByIdAndSprintEntryId(Long id, Long sprintEntryId);

    boolean existsByIdAndSprintEntryId(Long id, Long sprintEntryId);

    long countBySprintEntryId(Long sprintEntryId);

    @Query("SELECT COUNT(g) FROM Goal g WHERE g.sprintEntry.id = :sprintId AND g.isAchieved = true")
    long countAchievedBySprintEntryId(@Param("sprintId") Long sprintEntryId);

    void deleteBySprintEntryId(Long sprintEntryId);
}
