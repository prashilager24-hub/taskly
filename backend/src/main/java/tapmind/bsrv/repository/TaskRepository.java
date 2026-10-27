package tapmind.bsrv.repository;


import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import tapmind.bsrv.enums.TaskStatus;
import tapmind.bsrv.model.Task;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findBySprintEntryIdOrderBySortOrderAsc(Long sprintEntryId);

    Optional<Task> findByIdAndSprintEntryId(Long id, Long sprintEntryId);

    boolean existsByIdAndSprintEntryId(Long id, Long sprintEntryId);

    long countBySprintEntryId(Long sprintEntryId);

    long countBySprintEntryIdAndStatus(Long sprintEntryId, TaskStatus status);

    void deleteBySprintEntryId(Long sprintEntryId);
}
