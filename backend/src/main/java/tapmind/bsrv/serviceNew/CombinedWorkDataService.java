package tapmind.bsrv.serviceNew;

import lombok.RequiredArgsConstructor;
import tapmind.bsrv.dto.BulkApprovalRequestDTO;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.dto.CombinedWorkFilterRequestDTO;
import tapmind.bsrv.dto.CombinedWorkResponseWrapperDTO;
import tapmind.bsrv.dto.CombinedWorkResponseWrapperDTO.*;
import tapmind.bsrv.model.*;
import tapmind.bsrv.repository.*;
import tapmind.bsrv.dto.RejectEntryRequestDTO;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CombinedWorkDataService {

        private final UserWorkDataRepository userWorkDataRepository;
        private final UserGoalDataRepository userGoalDataRepository;
        private final UserRepository userRepository;
        private final DepartmentRepository departmentRepository;
        private final DepartmentTaskRepository taskRepository;
        private final DepartmentTargetRepository targetRepository;
        private final DepartmentGoalRepository goalRepository;

        @Transactional(readOnly = true)
        public CombinedWorkResponseWrapperDTO getCombinedData(
                        CombinedWorkFilterRequestDTO filter,
                        int page,
                        int size) {

                CombinedWorkResponseWrapperDTO wrapper = new CombinedWorkResponseWrapperDTO();

                try {
                        // ── Validation: only proceed with comment-filter when BOTH ids are present ──
                        boolean fetchOnlyCommented = false;

                        // ── Determine isForTarget filter from entryType ──────────────────────────
                        // null = all, false = TASK only, true = TARGET only
                        Boolean isForTargetFilter = null;
                        boolean fetchGoals = true;
                        if (filter.getEntryType() != null) {
                                String type = filter.getEntryType().trim().toUpperCase();
                                switch (type) {
                                        case "TASK":
                                                isForTargetFilter = false;
                                                fetchGoals = false;
                                                break;
                                        case "TARGET":
                                                isForTargetFilter = true;
                                                fetchGoals = false;
                                                break;
                                        case "GOAL":
                                                // skip work entries, only goals
                                                break;
                                        default:
                                                // unknown type — return all
                                                break;
                                }
                        }

                        int pageIndex = Math.max(page - 1, 0);
                        int pageSize = (size > 0 && size <= 100) ? size : 10;

                        // ── Step 1: Paginate — push comment + isForTarget filter into DB query ───
                        Pageable pageable = PageRequest.of(pageIndex, pageSize,
                                        Sort.by("workDate").descending());

                        boolean finalFetchGoals = fetchGoals;
                        Page<UserWorkData> pageData = ("GOAL".equalsIgnoreCase(filter.getEntryType()))
                                        ? null
                                        : userWorkDataRepository
                                                        .findByUserAndDepartmentPaginatedWithCommentFilter(
                                                                        filter.getUserID(),
                                                                        filter.getDepartmentID(),
                                                                        fetchOnlyCommented,
                                                                        isForTargetFilter,
                                                                        filter.getStartDate(),
                                                                        filter.getEndDate(),
                                                                        pageable);

                        // ── Step 2: Extract dates + pagination meta ──────────────────────────────
                        boolean isGoalOnly = "GOAL".equalsIgnoreCase(filter.getEntryType());
                        long totalElements;
                        int totalPages;

                        List<LocalDate> datesOnPage;

                        if (isGoalOnly) {
                                // Paginate goals instead of work entries
                                Page<UserGoalData> goalPage = userGoalDataRepository
                                                .findByUserAndDepartmentPaginatedWithCommentFilter(
                                                                filter.getUserID(),
                                                                filter.getDepartmentID(),
                                                                fetchOnlyCommented,
                                                                filter.getStartDate(),
                                                                filter.getEndDate(),
                                                                pageable);
                                totalElements = goalPage.getTotalElements();
                                totalPages = goalPage.getTotalPages();
                                datesOnPage = goalPage.getContent().stream()
                                                .map(UserGoalData::getWorkDate)
                                                .distinct()
                                                .collect(Collectors.toList());
                        } else {
                                totalElements = pageData.getTotalElements();
                                totalPages = pageData.getTotalPages();
                                datesOnPage = pageData.getContent().stream()
                                                .map(UserWorkData::getWorkDate)
                                                .distinct()
                                                .collect(Collectors.toList());
                        }

                        if (datesOnPage.isEmpty()) {
                                wrapper.setData(Collections.emptyList());
                                wrapper.setStatus(true);
                                wrapper.setStatusCode(200);
                                wrapper.setMessage("No records found");
                                wrapper.setPagination(PageMeta.builder()
                                                .currentPage(page)
                                                .pageSize(pageSize)
                                                .totalPages(totalPages)
                                                .totalRecords(totalElements)
                                                .build());
                                return wrapper;
                        }

                        // ── Step 3: Fetch all work entries for those dates (with isForTarget filter) ─
                        List<UserWorkData> workEntries = isGoalOnly
                                        ? Collections.emptyList()
                                        : userWorkDataRepository
                                                        .findByUserAndDepartmentAndDatesWithCommentFilter(
                                                                        filter.getUserID(),
                                                                        filter.getDepartmentID(),
                                                                        datesOnPage,
                                                                        fetchOnlyCommented,
                                                                        isForTargetFilter,
                                                                        filter.getStartDate(),
                                                                        filter.getEndDate());

                        // ── Step 4: Fetch all goal entries for those dates (if needed) ─────────────
                        List<UserGoalData> goalEntries = finalFetchGoals
                                        ? userGoalDataRepository
                                                        .findByUserAndDepartmentAndDatesWithCommentFilter(
                                                                        filter.getUserID(),
                                                                        filter.getDepartmentID(),
                                                                        datesOnPage,
                                                                        fetchOnlyCommented,
                                                                        filter.getStartDate(),
                                                                        filter.getEndDate())
                                        : Collections.emptyList();

                        // ── Step 5: Preload all lookup maps to avoid N+1 ─────────────────────────

                        Set<Integer> userIDs = workEntries.stream()
                                        .map(UserWorkData::getUserID)
                                        .collect(Collectors.toSet());
                        if (isGoalOnly) {
                                userIDs.addAll(goalEntries.stream()
                                                .map(UserGoalData::getUserID)
                                                .collect(Collectors.toSet()));
                        }
                        Map<Integer, String> userNames = userIDs.isEmpty() ? Map.of()
                                        : userRepository.findAllById(userIDs).stream()
                                                        .collect(Collectors.toMap(User::getUserID, User::getName));

                        Set<Integer> deptIDs = workEntries.stream()
                                        .map(UserWorkData::getDepartmentID)
                                        .collect(Collectors.toSet());
                        if (isGoalOnly) {
                                deptIDs.addAll(goalEntries.stream()
                                                .map(UserGoalData::getDepartmentID)
                                                .collect(Collectors.toSet()));
                        }
                        Map<Integer, String> deptNames = deptIDs.isEmpty() ? Map.of()
                                        : departmentRepository.findAllById(deptIDs).stream()
                                                        .collect(Collectors.toMap(Department::getDepartmentID,
                                                                        Department::getDepartmentName));

                        Set<Integer> taskIDs = workEntries.stream()
                                        .filter(w -> Boolean.FALSE.equals(w.getIsForTarget()) && w.getTaskID() != null)
                                        .map(UserWorkData::getTaskID)
                                        .collect(Collectors.toSet());
                        Map<Integer, String> taskNames = taskIDs.isEmpty() ? Map.of()
                                        : taskRepository.findAllById(taskIDs).stream()
                                                        .collect(Collectors.toMap(DepartmentTask::getTaskID,
                                                                        DepartmentTask::getTaskName));

                        Set<Integer> targetIDs = workEntries.stream()
                                        .filter(w -> Boolean.TRUE.equals(w.getIsForTarget()) && w.getTaskID() != null)
                                        .map(UserWorkData::getTaskID)
                                        .collect(Collectors.toSet());
                        Map<Integer, String> targetNames = targetIDs.isEmpty() ? Map.of()
                                        : targetRepository.findAllById(targetIDs).stream()
                                                        .collect(Collectors.toMap(DepartmentTarget::getTargetID,
                                                                        DepartmentTarget::getTargetName));

                        Set<Integer> goalIDs = goalEntries.stream()
                                        .map(UserGoalData::getGoalID)
                                        .collect(Collectors.toSet());
                        Map<Integer, String> goalNames = goalIDs.isEmpty() ? Map.of()
                                        : goalRepository.findAllById(goalIDs).stream()
                                                        .collect(Collectors.toMap(DepartmentGoal::getGoalID,
                                                                        DepartmentGoal::getGoalName));

                        // ── Step 6: Group by workDate ─────────────────────────────────────────────
                        Map<LocalDate, List<UserWorkData>> workByDate = workEntries.stream()
                                        .collect(Collectors.groupingBy(UserWorkData::getWorkDate));

                        Map<LocalDate, List<UserGoalData>> goalByDate = goalEntries.stream()
                                        .collect(Collectors.groupingBy(UserGoalData::getWorkDate));

                        // ── Step 7: Build daily summaries ─────────────────────────────────────────
                        List<DailyWorkSummaryDTO> summaries = datesOnPage.stream()
                                        .map(date -> buildDailySummary(
                                                        date,
                                                        filter.getUserID(),
                                                        filter.getDepartmentID(),
                                                        workByDate.getOrDefault(date, List.of()),
                                                        goalByDate.getOrDefault(date, List.of()),
                                                        userNames,
                                                        deptNames,
                                                        taskNames,
                                                        targetNames,
                                                        goalNames))
                                        .collect(Collectors.toList());

                        // ── Step 8: Build and return wrapper ──────────────────────────────────────
                        wrapper.setData(summaries);
                        wrapper.setStatus(true);
                        wrapper.setStatusCode(200);
                        wrapper.setMessage("Data retrieved successfully");
                        wrapper.setPagination(PageMeta.builder()
                                        .currentPage(page)
                                        .pageSize(pageSize)
                                        .totalPages(totalPages)
                                        .totalRecords(totalElements)
                                        .build());

                } catch (Exception e) {
                        wrapper.setStatus(false);
                        wrapper.setStatusCode(900);
                        wrapper.setMessage("Error: " + e.getMessage());
                }

                return wrapper;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Build one DailyWorkSummaryDTO for a single date
        // ─────────────────────────────────────────────────────────────────────────
        private DailyWorkSummaryDTO buildDailySummary(
                        LocalDate date,
                        Integer userID,
                        Integer departmentID,
                        List<UserWorkData> workList,
                        List<UserGoalData> goalList,
                        Map<Integer, String> userNames,
                        Map<Integer, String> deptNames,
                        Map<Integer, String> taskNames,
                        Map<Integer, String> targetNames,
                        Map<Integer, String> goalNames) {

                // Leave type — prefer FULL_DAY or HALF_DAY over NONE
                String leaveType = workList.stream()
                                .map(UserWorkData::getLeaveType)
                                .filter(lt -> lt != null && !"NONE".equals(lt))
                                .findFirst()
                                .orElse("NONE");

                // Total allocated hours (non-target only, minutes → hours)
                double totalAllocated = workList.stream()
                                .filter(w -> Boolean.FALSE.equals(w.getIsForTarget()))
                                .mapToDouble(w -> w.getAllocatedTime() != null ? w.getAllocatedTime() / 60.0 : 0)
                                .sum();

                // Total worked hours (non-target only, minutes → hours)
                double totalWorked = workList.stream()
                                .filter(w -> Boolean.FALSE.equals(w.getIsForTarget()))
                                .mapToDouble(w -> w.getTimeTakenToWork() != null ? w.getTimeTakenToWork() / 60.0 : 0)
                                .sum();

                // Target achievement % (target rows)
                double totalUnits = workList.stream()
                                .filter(w -> Boolean.TRUE.equals(w.getIsForTarget()))
                                .mapToDouble(w -> w.getUnits() != null ? w.getUnits() : 0)
                                .sum();
                double achievedUnits = workList.stream()
                                .filter(w -> Boolean.TRUE.equals(w.getIsForTarget()))
                                .mapToDouble(w -> w.getAchivedUnits() != null ? w.getAchivedUnits() : 0)
                                .sum();
                Double targetPct = totalUnits > 0
                                ? Math.round((achievedUnits / totalUnits) * 10000.0) / 100.0
                                : null;

                // Resolve IDs from first available record
                Integer resolvedUserID = workList.isEmpty() ? userID : workList.get(0).getUserID();
                Integer resolvedDeptID = workList.isEmpty() ? departmentID : workList.get(0).getDepartmentID();

                List<CombinedEntryDTO> entries = new ArrayList<>();

                // TASKS
                workList.stream()
                                .filter(w -> w.getLeaveType() == null ||
                                                !"FULL_DAY".equals(w.getLeaveType()))
                                .forEach(w -> {

                                        String taskName;

                                        if (Boolean.TRUE.equals(w.getIsForTarget())) {
                                                taskName = targetNames.getOrDefault(w.getTaskID(), null);
                                        } else {
                                                taskName = taskNames.getOrDefault(w.getTaskID(), null);
                                        }

                                        entries.add(
                                                        CombinedEntryDTO.builder()

                                                                        .id(w.getDailyTaskLogID())

                                                                        .userID(w.getUserID())

                                                                        .departmentID(w.getDepartmentID())

                                                                        .workDate(w.getWorkDate())

                                                                        .dailyTaskLogID(w.getDailyTaskLogID())

                                                                        .taskID(
                                                                                        Boolean.FALSE.equals(w
                                                                                                        .getIsForTarget())
                                                                                                                        ? w.getTaskID()
                                                                                                                        : null)

                                                                        .targetID(
                                                                                        Boolean.TRUE.equals(w
                                                                                                        .getIsForTarget())
                                                                                                                        ? w.getTaskID()
                                                                                                                        : null)

                                                                        .taskName(
                                                                                        Boolean.FALSE.equals(w
                                                                                                        .getIsForTarget())
                                                                                                                        ? taskNames.getOrDefault(
                                                                                                                                        w.getTaskID(),
                                                                                                                                        null)
                                                                                                                        : null)

                                                                        .targetName(
                                                                                        Boolean.TRUE.equals(w
                                                                                                        .getIsForTarget())
                                                                                                                        ? targetNames.getOrDefault(
                                                                                                                                        w.getTaskID(),
                                                                                                                                        null)
                                                                                                                        : null)

                                                                        .setUp(w.getSetUp())

                                                                        .allocatedTime(
                                                                                        w.getAllocatedTime() != null
                                                                                                        ? w.getAllocatedTime()
                                                                                                        : 0)

                                                                        .timeTakenToWork(
                                                                                        w.getTimeTakenToWork() != null
                                                                                                        ? w.getTimeTakenToWork()
                                                                                                        : 0)

                                                                        .isForTarget(w.getIsForTarget())

                                                                        .overAllTime(
                                                                                        w.getOverAllTime() != null
                                                                                                        ? w.getOverAllTime()
                                                                                                        : 0)

                                                                        .remarks(w.getRemarks())

                                                                        .units(w.getUnits())

                                                                        .achievedUnits(w.getAchivedUnits())

                                                                        .totalUnitValues(w.getTotalUnitValues())

                                                                        .isHalfDayLeave(w.getIsHalfDayLeave())

                                                                        .leaveType(w.getLeaveType())
                                                                        .approvedByEL(w.getApprovedByEL())

                                                                        .commentForRejection(w.getCommentForRejection())

                                                                        .build());
                                });

                // GOALS
                goalList.forEach(g -> {

                        entries.add(
                                        CombinedEntryDTO.builder()

                                                        .id(g.getUserGoalDataID())

                                                        .userID(g.getUserID())

                                                        .departmentID(g.getDepartmentID())

                                                        .workDate(g.getWorkDate())

                                                        .userGoalDataID(g.getUserGoalDataID())

                                                        .goalID(g.getGoalID())

                                                        .goalName(
                                                                        goalNames.getOrDefault(g.getGoalID(), null))

                                                        .fixedGoal(
                                                                        g.getFixedGoal() != null
                                                                                        ? g.getFixedGoal().doubleValue()
                                                                                        : 0)

                                                        .achievedGoal(
                                                                        g.getAchievedGoal() != null
                                                                                        ? g.getAchievedGoal()
                                                                                                        .doubleValue()
                                                                                        : 0)

                                                        .goalType(g.getGoalType())

                                                        .isTarget(g.getTarget())

                                                        .approvedByEL(g.getApprovedByEL())

                                                        .commentForRejection(g.getCommentForRejection())

                                                        .build());
                });

                return DailyWorkSummaryDTO.builder()
                                .workDate(date)
                                .userID(resolvedUserID)
                                .userName(userNames.getOrDefault(resolvedUserID, null))
                                .departmentID(resolvedDeptID)
                                .departmentName(deptNames.getOrDefault(resolvedDeptID, null))
                                .leaveType(leaveType)
                                .totalAllocatedHrs(Math.round(totalAllocated * 100.0) / 100.0)
                                .totalWorkedHrs(Math.round(totalWorked * 100.0) / 100.0)
                                .targetAchievedPct(targetPct)
                                .entries(entries)
                                .build();
        }

        @Transactional
        public void approveEntries(BulkApprovalRequestDTO request) {

                if (request.getTaskEntryIDs() != null &&
                                !request.getTaskEntryIDs().isEmpty()) {

                        userWorkDataRepository.approveTaskEntries(
                                        request.getTaskEntryIDs());
                }

                if (request.getGoalEntryIDs() != null &&
                                !request.getGoalEntryIDs().isEmpty()) {

                        userGoalDataRepository.approveGoalEntries(
                                        request.getGoalEntryIDs());
                }
        }

        @Transactional
        public void rejectEntry(RejectEntryRequestDTO request) {

                if ("Task".equalsIgnoreCase(request.getType())
                                || "Target".equalsIgnoreCase(request.getType())) {

                        userWorkDataRepository.rejectTaskEntry(
                                        request.getId(),
                                        request.getComment());

                } else if ("Goal".equalsIgnoreCase(request.getType())) {

                        userGoalDataRepository.rejectGoalEntry(
                                        request.getId(),
                                        request.getComment());

                } else {
                        throw new RuntimeException("Invalid type: " + request.getType());
                }
        }

}