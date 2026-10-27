package tapmind.bsrv.controller;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.serviceNew.UserGoalDataService;
import tapmind.bsrv.dto.UserGoalDataResponseWrapperDTO;
import tapmind.bsrv.dto.UserGoalDataFilterRequestDTO;
import tapmind.bsrv.dto.UserGoalDataResponseDTO;
import tapmind.bsrv.dto.RevisedGoalUpdateRequestDTO;
import tapmind.bsrv.dto.RevisedGoalDetailsDTO;
import tapmind.bsrv.dto.ReviewStatusSummaryDTO;
import tapmind.bsrv.dto.ReviewStatusFilterDTO;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;


@RestController
@RequestMapping("/t2.0/authentificationUtilization/userGoalData")
public class UserGoalDataController {

    @Autowired
    private UserGoalDataService userGoalDataService;

    @PostMapping("/list")
    public ResponseEntity<UserGoalDataResponseWrapperDTO> list(
            @RequestBody UserGoalDataFilterRequestDTO filter,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sortBy) {

        UserGoalDataResponseWrapperDTO response;

        if (page != null && size != null && page > 0 && size > 0) {
            response = userGoalDataService.listPaginated(filter, page, size, sortBy);
        } else {
            response = userGoalDataService.listAll(filter);
        }

        return ResponseEntity.ok(response);
    }

    @PutMapping("/revised-goal")
    public ResponseEntity<UserGoalDataResponseDTO> updateRevisedGoal(
            @RequestBody RevisedGoalUpdateRequestDTO request) {

        UserGoalDataResponseDTO response =
            userGoalDataService.updateRevisedGoal(request, currentUserId());

        return ResponseEntity.ok(response);
    }

    private Integer currentUserId() {
        org.springframework.security.core.Authentication auth =
            org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof tapmind.bsrv.auth.UserAuthDetails) {
            return ((tapmind.bsrv.auth.UserAuthDetails) auth.getPrincipal()).getUser().getUserID();
        }
        return null;
    }

    @PostMapping("/review-status")
    public ResponseEntity<ReviewStatusSummaryDTO> getReviewStatus(
            @RequestBody ReviewStatusFilterDTO filter) {

        ReviewStatusSummaryDTO response = userGoalDataService
            .getReviewStatusSummary(filter);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/revised-goal/{userGoalDataID}")
    public ResponseEntity<RevisedGoalDetailsDTO> getRevisedGoalById(
            @PathVariable Integer userGoalDataID) {

        return ResponseEntity.ok(userGoalDataService.getRevisedGoal(userGoalDataID));
    }

    @GetMapping("/revised-goal")
    public ResponseEntity<RevisedGoalDetailsDTO> getRevisedGoal(
            @RequestParam Long userId,
            @RequestParam Long goalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate workDate) {

        return ResponseEntity.ok(userGoalDataService.getRevisedGoal(userId, goalId, workDate));
    }
}
