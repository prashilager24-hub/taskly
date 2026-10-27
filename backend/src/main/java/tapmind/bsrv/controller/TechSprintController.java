package tapmind.bsrv.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import lombok.RequiredArgsConstructor;

import java.util.List;

import tapmind.bsrv.model.TechSprint;
import tapmind.bsrv.model.TechStory;
import tapmind.bsrv.model.StoryStatus;
import tapmind.bsrv.serviceNew.TechSprintService;
import tapmind.bsrv.dto.SprintFilterRequest;
import tapmind.bsrv.dto.SprintStoryFilterRequest;
@RestController
@RequestMapping("/t2.0/authentificationUtilization/tech")
@RequiredArgsConstructor
public class TechSprintController {

    private final TechSprintService techSprintService;

    @PostMapping("/sprint")
    public ResponseEntity<?> createSprint(
            @RequestBody TechSprint sprint
    ) {
        return ResponseEntity.ok(
                techSprintService.createSprint(sprint)
        );
    }


    @PostMapping("/sprint/{sprintId}/users")
    public ResponseEntity<?> assignUsersToSprint(
            @PathVariable Long sprintId,
            @RequestBody List<Long> userIds
    ) {
        techSprintService.assignUsersToSprint(sprintId, userIds);
        return ResponseEntity.ok("Users assigned to sprint");
    }

    @PostMapping("/story")
    public ResponseEntity<?> createStories(
            @RequestBody List<TechStory> stories
    ) {
        return ResponseEntity.ok(
                techSprintService.createStories(stories)
        );
    }
    @PostMapping("/story/{storyId}/assign/{userId}")
    public ResponseEntity<?> assignStoryToUser(
            @PathVariable Long storyId,
            @PathVariable Long userId,
            @RequestParam Integer pointsWorked
    ) {
        techSprintService.assignStoryToUser(
                storyId,
                userId,
                pointsWorked
        );
        return ResponseEntity.ok("Story assigned to user");
    }


    @PutMapping("/story/{storyId}/status")
    public ResponseEntity<?> updateStoryStatus(
            @PathVariable Long storyId,
            @RequestParam StoryStatus status
    ) {
        techSprintService.updateStoryStatus(storyId, status);
        return ResponseEntity.ok("Story status updated");
    }

     @PostMapping("/list")
    public ResponseEntity<?> listSprints(@RequestBody SprintFilterRequest filter) throws Exception {
        return ResponseEntity.ok(techSprintService.getSprintList(filter));
    }
    @PostMapping("/stories")
public ResponseEntity<?> listStories(@RequestBody SprintStoryFilterRequest filter) {
    return ResponseEntity.ok(techSprintService.getStories(filter));
}

//     
//     @PostMapping("/sprint/{sprintId}/complete")
//     public ResponseEntity<?> completeSprint(
//             @PathVariable Long sprintId,
//             @RequestParam Integer departmentId
//     ) {
//         techSprintService.completeSprintAndCalculateEfficiency(
//                 sprintId,
//                 departmentId
//         );
//         return ResponseEntity.ok(
//                 "Sprint completed & efficiency generated"
//         );
//     }
}
