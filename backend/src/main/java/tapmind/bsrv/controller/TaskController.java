package tapmind.bsrv.controller;

import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.ApiResponse;
import tapmind.bsrv.dto.TaskRequest;
import tapmind.bsrv.dto.TaskResponse;
import tapmind.bsrv.serviceNew.TaskService;

/**
 * Task APIs (nested under sprint)
 *
 * POST   /api/sprints/{sprintId}/tasks                  – add task
 * GET    /api/sprints/{sprintId}/tasks                  – list tasks for sprint
 * PUT    /api/sprints/{sprintId}/tasks/{taskId}         – update task
 * DELETE /api/sprints/{sprintId}/tasks/{taskId}         – delete task
 */
@RestController
@RequestMapping("/api/sprints/{sprintId}/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    // ── POST /api/sprints/{sprintId}/tasks ────────────────────────────────
    @PostMapping
    public ResponseEntity<ApiResponse<TaskResponse>> addTask(
            @PathVariable Long sprintId,
            @Valid @RequestBody TaskRequest req) {

        TaskResponse response = taskService.addTask(sprintId, req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Task added successfully", response));
    }

    // ── GET /api/sprints/{sprintId}/tasks ─────────────────────────────────
    @GetMapping
    public ResponseEntity<ApiResponse<List<TaskResponse>>> findAll(
            @PathVariable Long sprintId) {

        return ResponseEntity.ok(ApiResponse.ok(taskService.findBySprintId(sprintId)));
    }

    // ── PUT /api/sprints/{sprintId}/tasks/{taskId} ────────────────────────
    @PutMapping("/{taskId}")
    public ResponseEntity<ApiResponse<TaskResponse>> updateTask(
            @PathVariable Long sprintId,
            @PathVariable Long taskId,
            @Valid @RequestBody TaskRequest req) {

        TaskResponse response = taskService.updateTask(sprintId, taskId, req);
        return ResponseEntity.ok(ApiResponse.ok("Task updated successfully", response));
    }

    // ── DELETE /api/sprints/{sprintId}/tasks/{taskId} ─────────────────────
    @DeleteMapping("/{taskId}")
    public ResponseEntity<ApiResponse<Void>> deleteTask(
            @PathVariable Long sprintId,
            @PathVariable Long taskId) {

        taskService.deleteTask(sprintId, taskId);
        return ResponseEntity.ok(ApiResponse.ok("Task deleted successfully", null));
    }
}
