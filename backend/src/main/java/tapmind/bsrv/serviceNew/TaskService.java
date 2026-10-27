package tapmind.bsrv.serviceNew;

import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.dto.TaskRequest;
import tapmind.bsrv.dto.TaskResponse;
import tapmind.bsrv.exception.ResourceNotFoundException;
import tapmind.bsrv.model.SprintEntry;
import tapmind.bsrv.model.Task;
import tapmind.bsrv.repository.TaskRepository;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final SprintEntryService sprintEntryService;

    private static final String JIRA_BASE = "https://tapminds.atlassian.net/browse/";

    // ── Add task to sprint ────────────────────────────────────────────────
    @Transactional
    public TaskResponse addTask(Long sprintId, TaskRequest req) {
        SprintEntry entry = sprintEntryService.getOrThrow(sprintId);

        long nextOrder = taskRepository.countBySprintEntryId(sprintId);
        Task task = Task.builder()
                .sprintEntry(entry)
                .jiraId(req.getJiraId() != null ? req.getJiraId().toUpperCase().trim() : null)
                .taskName(req.getTaskName().trim())
                .storyPoints(req.getStoryPoints() != null ? req.getStoryPoints() : 0)
                .product(req.getProduct())
                .module(req.getModule())
                .taskType(req.getTaskType())
                .status(req.getStatus())
                .sortOrder(req.getSortOrder() != null ? req.getSortOrder() : (int) nextOrder)
                .build();

        Task saved = taskRepository.save(task);
        log.info("Task added: id={} sprintId={}", saved.getId(), sprintId);
        return toResponse(saved);
    }

    // ── Update task ───────────────────────────────────────────────────────
    @Transactional
    public TaskResponse updateTask(Long sprintId, Long taskId, TaskRequest req) {
        Task task = taskRepository.findByIdAndSprintEntryId(taskId, sprintId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Task id=" + taskId + " not found in sprint id=" + sprintId));

        task.setJiraId(req.getJiraId() != null ? req.getJiraId().toUpperCase().trim() : null);
        task.setTaskName(req.getTaskName().trim());
        task.setStoryPoints(req.getStoryPoints() != null ? req.getStoryPoints() : 0);
        task.setProduct(req.getProduct());
        task.setModule(req.getModule());
        task.setTaskType(req.getTaskType());
        task.setStatus(req.getStatus());
        if (req.getSortOrder() != null) task.setSortOrder(req.getSortOrder());

        Task saved = taskRepository.save(task);
        log.info("Task updated: id={}", taskId);
        return toResponse(saved);
    }

    // ── Delete task ───────────────────────────────────────────────────────
    @Transactional
    public void deleteTask(Long sprintId, Long taskId) {
        if (!taskRepository.existsByIdAndSprintEntryId(taskId, sprintId)) {
            throw new ResourceNotFoundException(
                    "Task id=" + taskId + " not found in sprint id=" + sprintId);
        }
        taskRepository.deleteById(taskId);
        log.info("Task deleted: id={}", taskId);
    }

    // ── List all tasks for a sprint ───────────────────────────────────────
    @Transactional(readOnly = true)
    public List<TaskResponse> findBySprintId(Long sprintId) {
        sprintEntryService.getOrThrow(sprintId); // verify sprint exists
        return taskRepository.findBySprintEntryIdOrderBySortOrderAsc(sprintId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ── Mapping ───────────────────────────────────────────────────────────
    public TaskResponse toResponse(Task t) {
        String jiraUrl = (t.getJiraId() != null && !t.getJiraId().isBlank())
                ? JIRA_BASE + t.getJiraId() : null;
        return TaskResponse.builder()
                .id(t.getId())
                .jiraId(t.getJiraId())
                .jiraUrl(jiraUrl)
                .taskName(t.getTaskName())
                .storyPoints(t.getStoryPoints())
                .product(t.getProduct().name())
                .module(t.getModule().name())
                .taskType(t.getTaskType().name())
                .status(t.getStatus().name())
                .sortOrder(t.getSortOrder())
                .build();
    }
}
