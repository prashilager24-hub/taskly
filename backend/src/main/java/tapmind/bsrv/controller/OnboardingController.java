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
import tapmind.bsrv.serviceNew.OnboardingService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/hrFeedback/onboarding")
@RequiredArgsConstructor
public class OnboardingController {

    private final OnboardingService onboardingService;

    private Integer currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserAuthDetails) {
            return ((UserAuthDetails) auth.getPrincipal()).getUser().getUserID();
        }
        return null;
    }

    @GetMapping("/surveys/mine")
    public ResponseEntity<ApiResponse<OnboardingSurveyEmployeeResponse>> getMine() {
        return ResponseEntity.ok(ApiResponse.ok(onboardingService.getMine(currentUserId())));
    }

    @PostMapping({"/submit", "/submit-survey"})
    public ResponseEntity<ApiResponse<OnboardingSubmitResponse>> submitSurvey(
            @Valid @RequestBody OnboardingSubmitRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Survey submitted successfully", onboardingService.submitSurvey(currentUserId(), req)));
    }

    @GetMapping({"/surveys", "/surveys/list"})
    public ResponseEntity<ApiResponse<OnboardingSurveyHRResponse>> getSurveysHR(
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(required = false) String dateRange) {
        return ResponseEntity.ok(ApiResponse.ok(onboardingService.getSurveysHR(status, dateRange)));
    }

    @GetMapping("/scores")
    public ResponseEntity<ApiResponse<OnboardingScoresResponse>> getScores() {
        return ResponseEntity.ok(ApiResponse.ok(onboardingService.getScores()));
    }

    @PostMapping({"/send", "/send-survey"})
    public ResponseEntity<ApiResponse<OnboardingSendResponse>> sendSurvey(
            @Valid @RequestBody OnboardingSendRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Surveys sent successfully", onboardingService.sendSurvey(req)));
    }

    @GetMapping("/admin")
    public ResponseEntity<ApiResponse<OnboardingAdminResponse>> getAdmin() {
        return ResponseEntity.ok(ApiResponse.ok(onboardingService.getAdmin()));
    }
}
