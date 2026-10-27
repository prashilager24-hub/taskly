package tapmind.bsrv.serviceNew;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.List;
import java.util.*;


import tapmind.bsrv.model.TechSprint;
import tapmind.bsrv.model.TechSprintUserMapping;
import tapmind.bsrv.model.TechStory;
import tapmind.bsrv.model.User;
import tapmind.bsrv.model.TechStoryAssignment;
import tapmind.bsrv.model.SprintStatus;
import tapmind.bsrv.model.StoryStatus;
import tapmind.bsrv.repository.TechSprintRepository;
import tapmind.bsrv.repository.TechSprintUserMappingRepository;
import tapmind.bsrv.repository.TechStoryRepository;
import tapmind.bsrv.repository.TechStoryAssignmentRepository;
import tapmind.bsrv.repository.EfficiencyUtilizationSummaryRepository;
import tapmind.bsrv.dto.SprintFilterRequest;
import tapmind.bsrv.dto.SprintStoryFilterRequest;

@Service
@RequiredArgsConstructor
public class TechSprintService {

    private final TechSprintRepository sprintRepo;
    private final TechSprintUserMappingRepository mappingRepo;
    private final TechStoryRepository storyRepo;
    private final TechStoryAssignmentRepository assignmentRepo;
    private final EfficiencyUtilizationSummaryRepository efficiencyRepo;


    @Transactional
    public TechSprint createSprint(TechSprint sprint) {
        sprint.setStatus(SprintStatus.PLANNED);
        sprint.setCreatedAt(LocalDateTime.now());
        return sprintRepo.save(sprint);
    }

    @Transactional
    public void assignUsersToSprint(
            Long sprintId,
            List<Long> userIds
    ) {
        for (Long userId : userIds) {
             User user = new User();
            user.setUserID(userId.intValue()); 
            TechSprintUserMapping mapping =
                    new TechSprintUserMapping();
            TechSprint techSprint=new TechSprint();
            techSprint.setSprintID(sprintId);
            mapping.setSprint(techSprint);
            mapping.setUser(user);
            mapping.setCreatedAt(LocalDateTime.now());

            mappingRepo.save(mapping);
        }
    }

    @Transactional
    public List<TechStory> createStories(List<TechStory> stories) {
     for (TechStory story : stories) {
        story.setStatus(StoryStatus.TODO);
        story.setCreatedAt(LocalDateTime.now());
    }

    return storyRepo.saveAll(stories);
    }

    @Transactional
    public void assignStoryToUser(
            Long storyId,
            Long userId,
            Integer pointsWorked
    ) { 

        try{
        TechStory story = storyRepo.findById(storyId)
            .orElseThrow(() -> new RuntimeException("Story not found"));
        TechStoryAssignment assignment =
                new TechStoryAssignment();
                

        assignment.setStoryID(storyId);
        User user = new User();
        user.setUserID(userId.intValue()); 
        assignment.setUser(user);
        assignment.setPointsWorked(pointsWorked);
        assignment.setCreatedAt(LocalDateTime.now());

        assignmentRepo.save(assignment);
        }
       catch (Exception ex) {
        ex.printStackTrace();
    }
    }

   
    @Transactional
    public void updateStoryStatus(
            Long storyId,
            StoryStatus status
    ) {
        TechStory story = storyRepo.findById(storyId)
                .orElseThrow(() ->
                        new RuntimeException("Story not found"));

        story.setStatus(status);
        story.setUpdatedAt(LocalDateTime.now());

        storyRepo.save(story);
    }


public Object getSprintList(SprintFilterRequest filter) throws Exception {

    List<Map<String, Object>> rawData =
            sprintRepo.findSprintSummaryByUser(
                    filter.getStartDate(),
                    filter.getEndDate()
            );

    ObjectMapper mapper = new ObjectMapper();
    List<Map<String, Object>> data = new ArrayList<>();

    for (Map<String, Object> row : rawData) {

        // create modifiable map
        Map<String, Object> newRow = new HashMap<>(row);

        Object userIdsObj = row.get("userMappedIds");

        if (userIdsObj != null) {
            List<Long> userIds = mapper.readValue(
                    userIdsObj.toString(),
                    new TypeReference<List<Long>>() {}
            );
            newRow.put("userMappedIds", userIds);
        } else {
            newRow.put("userMappedIds", List.of());
        }

        data.add(newRow);
    }

    if (filter.getPage() == 0 && filter.getSize() == 0) {
        return data;
    }

    int fromIndex = Math.min(filter.getPage() * filter.getSize(), data.size());
    int toIndex   = Math.min(fromIndex + filter.getSize(), data.size());

    return Map.of(
            "totalRecords", data.size(),
            "page", filter.getPage(),
            "size", filter.getSize(),
            "data", data.subList(fromIndex, toIndex)
    );
}



 
public Object getStories(SprintStoryFilterRequest filter) {

    List<Object[]> rows = storyRepo.findStoriesBySprintAndUser(
            filter.getSprintId(),
            filter.getUserId(),
            filter.getStartDate(),
            filter.getEndDate()
    );

    List<Map<String, Object>> data = new ArrayList<>();

    for (Object[] row : rows) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("storyId", row[0]);
        map.put("storyKey", row[1]);
        map.put("storyPoints", row[2]);
        map.put("status", row[3]);
        map.put("assignedUser", row[4]);
        map.put("sprintId", row[5]);
        data.add(map);
    }

    //  No pagination
    if (filter.getPage() == 0 && filter.getSize() == 0) {
        return data;
    }

    //  Manual pagination
    int fromIndex = Math.min(filter.getPage() * filter.getSize(), data.size());
    int toIndex   = Math.min(fromIndex + filter.getSize(), data.size());

    return Map.of(
            "totalRecords", data.size(),
            "page", filter.getPage(),
            "size", filter.getSize(),
            "data", data.subList(fromIndex, toIndex)
    );
}



//     
//     @Transactional
//     public void completeSprintAndCalculateEfficiency(
//             Long sprintId,
//             Integer departmentId
//     ) {
//         TechSprint sprint = sprintRepo.findById(sprintId)
//                 .orElseThrow(() ->
//                         new RuntimeException("Sprint not found"));

//         sprint.setStatus(SprintStatus.COMPLETED);
//         sprint.setUpdatedAt(LocalDateTime.now());
//         sprintRepo.save(sprint);

//         List<TechSprintUserMapping> users =
//                 mappingRepo.findBySprintID(sprintId);

//         long sprintDays =
//                 ChronoUnit.DAYS.between(
//                         sprint.getStartDate(),
//                         sprint.getEndDate()
//                 ) + 1;

//         for (TechSprintUserMapping u : users) {

//             Integer completedPoints =
//                     assignmentRepo.totalPointsByUser(
//                             sprintId,
//                             u.getUserID()
//                     );

//             completedPoints =
//                     completedPoints == null ? 0 : completedPoints;

//             BigDecimal achievedPercent =
//                     BigDecimal.valueOf(completedPoints)
//                             .multiply(BigDecimal.valueOf(100))
//                             .divide(
//                                     BigDecimal.valueOf(
//                                             sprint.getPlannedPoints()
//                                     ),
//                                     2,
//                                     RoundingMode.HALF_UP
//                             );

//             EfficiencyUtilizationSummary efficiency =
//                     new EfficiencyUtilizationSummary();

//             efficiency.setUserID(u.getUserID());
//             efficiency.setDepartmentID(departmentId);
//             efficiency.setWorkDate(sprint.getEndDate());
//             efficiency.setTargetAchievedPercent(achievedPercent);
//             efficiency.setUtilizationPercent(achievedPercent);
//             efficiency.setEfficiencyLevel(
//                     resolveEfficiency(achievedPercent)
//             );
//             efficiency.setAllocatedTimeHrs(
//                     BigDecimal.valueOf(sprintDays)
//             );
//             efficiency.setTotalTimeOfWork(
//                     BigDecimal.valueOf(sprintDays)
//             );
//             efficiency.setDataStatus("FINAL");
//             efficiency.setRemarks("Sprint Based Calculation");

//             efficiencyRepo.save(efficiency);
//         }
//     }

//     
//     private String resolveEfficiency(BigDecimal percent) {
//         if (percent.compareTo(BigDecimal.valueOf(90)) >= 0)
//             return "High";
//         if (percent.compareTo(BigDecimal.valueOf(70)) >= 0)
//             return "At Par";
//         return "Low";
//     }
}
