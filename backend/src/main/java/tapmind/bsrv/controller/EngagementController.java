package tapmind.bsrv.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.auth.UserAuthDetails;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.serviceNew.EngagementService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/hrFeedback/engagement")
@RequiredArgsConstructor
public class EngagementController {

    private final EngagementService engagementService;

    private UserAuthDetails currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserAuthDetails) {
            return (UserAuthDetails) auth.getPrincipal();
        }
        return null;
    }

    @GetMapping("/surveys/open")
    public ResponseEntity<ApiResponse<EngagementEmployeeResponse>> getOpenSurveys() {
        UserAuthDetails user = currentUser();
        Integer userId = user != null ? user.getUser().getUserID() : null;
        return ResponseEntity.ok(ApiResponse.ok(engagementService.getOpenSurveys(userId)));
    }

    @PostMapping("/submit")
    public ResponseEntity<ApiResponse<EngagementSubmitResponse>> submitResponse(
            @Valid @RequestBody EngagementSubmitRequest req) {
        UserAuthDetails user = currentUser();
        return ResponseEntity.ok(ApiResponse.ok(
                "Response recorded successfully",
                engagementService.submitResponse(
                        user.getUser().getUserID(),
                        user.getUser().getName(),
                        req)));
    }

    @GetMapping({"/surveys", "/surveys/list"})
    public ResponseEntity<ApiResponse<EngagementHRResponse>> getSurveysHR(
            @RequestParam(required = false) String fy) {
        return ResponseEntity.ok(ApiResponse.ok(engagementService.getSurveysHR(fy)));
    }

    @GetMapping("/scores/{surveyId}")
    public ResponseEntity<ApiResponse<EngagementScoresResponse>> getScores(
            @PathVariable String surveyId) {
        return ResponseEntity.ok(ApiResponse.ok(engagementService.getScores(surveyId)));
    }

    @PostMapping("/rollout")
    public ResponseEntity<ApiResponse<EngagementRolloutResponse>> rollout(
            @Valid @RequestBody EngagementRolloutRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Survey rolled out successfully",
                        engagementService.rollout(req)));
    }

    @GetMapping("/admin")
    public ResponseEntity<ApiResponse<EngagementAdminResponse>> getAdmin() {
        return ResponseEntity.ok(ApiResponse.ok(engagementService.getAdmin()));
    }
}
