package tapmind.bsrv.controller;

import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.ApiResponse;
import tapmind.bsrv.dto.GoalRequest;
import tapmind.bsrv.dto.GoalResponse;
import tapmind.bsrv.serviceNew.GoalService;

/**
 * Goal APIs (nested under sprint)
 *
 * <p>
 * POST /api/sprints/{sprintId}/goals – add goal GET
 * /api/sprints/{sprintId}/goals – list goals
 * for sprint PUT /api/sprints/{sprintId}/goals/{goalId} – update goal DELETE
 * /api/sprints/{sprintId}/goals/{goalId} – delete goal
 */
@RestController
@RequestMapping("/api/sprints/{sprintId}/goals")
@RequiredArgsConstructor

public class GoalController {
  private final GoalService goalService;

  // ── POST /api/sprints/{sprintId}/goals ────────────────────────────────
  @PostMapping
  public ResponseEntity<ApiResponse<GoalResponse>> addGoal(
      @PathVariable Long sprintId, @Valid @RequestBody GoalRequest req) {

    GoalResponse response = goalService.addGoal(sprintId, req);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.ok("Goal added successfully", response));
  }

  // ── GET /api/sprints/{sprintId}/goals ─────────────────────────────────
  @GetMapping
  public ResponseEntity<ApiResponse<List<GoalResponse>>> findAll(@PathVariable Long sprintId) {

    return ResponseEntity.ok(ApiResponse.ok(goalService.findBySprintId(sprintId)));
  }

  // ── PUT /api/sprints/{sprintId}/goals/{goalId} ────────────────────────
  @PutMapping("/{goalId}")
  public ResponseEntity<ApiResponse<GoalResponse>> updateGoal(
      @PathVariable Long sprintId, @PathVariable Long goalId, @Valid @RequestBody GoalRequest req) {

    GoalResponse response = goalService.updateGoal(sprintId, goalId, req);
    return ResponseEntity.ok(ApiResponse.ok("Goal updated successfully", response));
  }

  // ── DELETE /api/sprints/{sprintId}/goals/{goalId} ─────────────────────
  @DeleteMapping("/{goalId}")
  public ResponseEntity<ApiResponse<Void>> deleteGoal(
      @PathVariable Long sprintId, @PathVariable Long goalId) {

    goalService.deleteGoal(sprintId, goalId);
    return ResponseEntity.ok(ApiResponse.ok("Goal deleted successfully", null));
  }

}
