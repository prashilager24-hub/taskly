package tapmind.bsrv.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.serviceNew.UserWorkDataService;
import tapmind.bsrv.serviceNew.UserGoalDataService;
import java.util.List;
import tapmind.bsrv.dto.UserWorkDataResponseWrapperDTO.UserWorkDataResponseDTO;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/form")
public class UserWorkDataController {
  @Autowired
  private UserGoalDataService userGoalDataService;
  @Autowired
  private UserWorkDataService userWorkDataService;

  // moved bulk create to bulk work
  @PostMapping("/bulkCreate")
  public List<UserWorkDataResponseDTO> bulkCreate(
      @RequestBody List<UserWorkDataRequestDTO> requestList) {
    return userWorkDataService.bulkCreateUserWorkData(requestList);
  }

  @PostMapping("/bulkWork")
  public ResponseEntity<?> bulkWork(@RequestBody UserWorkAndGoalRequest request) {

    // -------- FULL DAY LEAVE --------
    if ("FULL_DAY".equalsIgnoreCase(request.getLeaveType())) {
      // Validate required data for leave entry
      if (request.getUserID() == null
          || request.getDepartmentID() == null
          || request.getWorkDate() == null) {

        return ResponseEntity.badRequest()
            .body("UserID, DepartmentID and WorkDate are required for FULL_DAY leave");
      }

      // Create single leave entry
      UserWorkDataRequestDTO leaveEntry = new UserWorkDataRequestDTO();
      leaveEntry.setUserID(request.getUserID());
      leaveEntry.setDepartmentID(request.getDepartmentID());
      leaveEntry.setWorkDate(request.getWorkDate());
      leaveEntry.setLeaveType("FULL_DAY");

      userWorkDataService.bulkCreateUserWorkData(List.of(leaveEntry));
      return ResponseEntity.ok("Full day leave saved");
    }
    // -------- NORMAL FLOW --------
    if (request.getActivities() != null && !request.getActivities().isEmpty()) {
      userWorkDataService.bulkCreateUserWorkData(request.getActivities());
    }
    if (request.getGoals() != null && !request.getGoals().isEmpty()) {
      userWorkDataService.bulkUpsertUserGoalData(request.getGoals());
    }
    return ResponseEntity.ok("Saved");
  }

  // UserWorkDataController.java
  @PostMapping("/list")
  public ResponseEntity<UserWorkDataResponseWrapperDTO> list(
      @RequestBody UserWorkDataFilterRequestDTO filter,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size,
      @RequestParam(required = false) String sortBy) {

    UserWorkDataResponseWrapperDTO response;

    // If page & size are provided → PAGINATION
    if (page != null && size != null && page > 0 && size > 0) {
      response = userWorkDataService.listPaginated(filter, page, size, sortBy);
    }
    // If no pagination params → RETURN FULL LIST
    else {
      response = userWorkDataService.listAll(filter);
    }

    return ResponseEntity.ok(response);
  }

  // @PostMapping("/download")
  // public ResponseEntity<UserWorkDataResponseWrapperDTO> list(
  // @RequestBody UserWorkDataFilterRequestDTO filter) {

  // UserWorkDataResponseWrapperDTO response;

  // response = userWorkDataService.listAll(filter);

  // return ResponseEntity.ok(response);
  // }

  @PatchMapping("/bulkUpdate")
  public ResponseEntity<?> bulkUpdate(
      @RequestBody UserWorkAndGoalRequest request) {

    userWorkDataService.bulkUpdateWorkAndGoals(request);

    return ResponseEntity.ok("Updated Successfully");
  }

  @PutMapping("/revised-target")
  public ResponseEntity<UserWorkDataResponseDTO> updateRevisedTarget(
      @RequestBody RevisedTargetUpdateRequestDTO request) {

    UserWorkDataResponseDTO response =
        userWorkDataService.updateRevisedTarget(request, currentUserId());

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

  @GetMapping("/revised-target/{dailyTaskLogID}")
  public ResponseEntity<RevisedTargetDetailsDTO> getRevisedTargetByLogId(
      @PathVariable Integer dailyTaskLogID) {

    return ResponseEntity.ok(userWorkDataService.getRevisedTarget(dailyTaskLogID));
  }

  @GetMapping("/revised-target")
  public ResponseEntity<RevisedTargetDetailsDTO> getRevisedTarget(
      @RequestParam Integer userID,
      @RequestParam Integer taskID,
      @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate workDate,
      @RequestParam(required = false) Boolean isForTarget) {

    return ResponseEntity.ok(
        userWorkDataService.getRevisedTarget(userID, taskID, workDate, isForTarget));
  }

  @PutMapping("/goal/update")
  public ResponseEntity<UserGoalDataResponseDTO> updateGoal(
      @Valid @RequestBody GoalAchievementUpdateRequest request) {

    UserGoalDataResponseDTO response = userGoalDataService.updateGoal(request);

    return ResponseEntity.ok(response);
  }
}
