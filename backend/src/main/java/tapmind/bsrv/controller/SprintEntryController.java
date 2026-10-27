package tapmind.bsrv.controller;

import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.serviceNew.SprintEntryService;

/**
 * Sprint Entry APIs
 *
 * POST   /api/sprints                                                    – submit (create or upsert)
 * PUT    /api/sprints/{id}                                               – full update
 * GET    /api/sprints/{id}                                               – get one sprint
 * GET    /api/sprints?userId=&sprint=&from=&to=&page=&size=             – paginated history
 * DELETE /api/sprints/{id}                                               – delete
 * PATCH  /api/sprints/{id}/manager-note                                  – save manager note
 * GET    /api/sprints/labels                                             – all sprint labels
 */
@RestController
@RequestMapping("/t2.0/authentificationUtilization/")
@RequiredArgsConstructor
public class SprintEntryController {

    private final SprintEntryService sprintEntryService;

    // ── POST /api/sprints ─────────────────────────────────────────────────
    @PostMapping("/createSprintEntry")
    public ResponseEntity<ApiResponse<SprintEntryResponse>> submit(
            @Valid @RequestBody SprintSubmitRequest req) {

        SprintEntryResponse response = sprintEntryService.submit(req);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Sprint entry submitted successfully", response));
    }

    // ── PUT /api/sprints/{id} ─────────────────────────────────────────────
    @PutMapping("/updateSprint/{id}")
    public ResponseEntity<ApiResponse<SprintEntryResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody SprintSubmitRequest req) {

        SprintEntryResponse response = sprintEntryService.update(id, req);
        return ResponseEntity.ok(ApiResponse.ok("Sprint entry updated successfully", response));
    }

    // ── GET /api/sprints/{id} ─────────────────────────────────────────────
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SprintEntryResponse>> findById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(sprintEntryService.findById(id)));
    }

    // ── GET /api/sprints?userId=&sprint=&from=&to=&page=&size= ───────────
    @GetMapping("/getSprintEntry")
    public ResponseEntity<ApiResponse<PagedResponse<SprintEntryResponse>>> findHistory(
            @RequestParam Integer userId,
            @RequestParam(required = false) String sprint,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        PagedResponse<SprintEntryResponse> result =
                sprintEntryService.findHistory(userId, sprint, from, to, page, size);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    // ── DELETE /api/sprints/{id} ──────────────────────────────────────────
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        sprintEntryService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Sprint entry deleted successfully", null));
    }

    // ── PATCH /api/sprints/{id}/manager-note ──────────────────────────────
    @PatchMapping("/{id}/manager-note")
    public ResponseEntity<ApiResponse<SprintEntryResponse>> patchManagerNote(
            @PathVariable Long id,
            @RequestBody ManagerNoteRequest req) {

        SprintEntryResponse response = sprintEntryService.patchManagerNote(id, req.getManagerNote());
        return ResponseEntity.ok(ApiResponse.ok("Manager note saved", response));
    }

    // ── GET /api/sprints/labels ───────────────────────────────────────────
    @GetMapping("/labels")
    public ResponseEntity<ApiResponse<List<String>>> getAllSprintLabels() {
        return ResponseEntity.ok(ApiResponse.ok(sprintEntryService.findAllSprintLabels()));
    }
}
