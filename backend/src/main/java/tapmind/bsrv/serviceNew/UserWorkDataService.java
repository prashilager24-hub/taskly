package tapmind.bsrv.serviceNew;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.dto.UserWorkDataResponseWrapperDTO.UserWorkDataResponseDTO;
import tapmind.bsrv.exception.ResourceNotFoundException;
import tapmind.bsrv.model.*;
import tapmind.bsrv.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

@Service
public class UserWorkDataService {

  private static final DateTimeFormatter AUDIT_TIME_FORMAT =
      DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

  @Autowired
  private UserWorkDataRepository userWorkDataRepository;
  @Autowired
  private TAMAccountRepository tamAccountRepository;
  @Autowired
  private UserGoalDataRepository repository;

  @Autowired
  private UserRepository userRepository;

  @Autowired
  private AsyncReportService asyncService;

  @Autowired
  private DepartmentRepository departmentRepository;

  @Autowired
  private DepartmentTargetRepository targetRepository;

  @Autowired
  private DepartmentTaskRepository taskRepository;

  @Autowired
  private MISUpdateLogRepository misUpdateLogRepository;

  // Create
  public List<UserWorkDataResponseDTO> bulkCreateUserWorkData(
      List<UserWorkDataRequestDTO> requestList) {

    List<UserWorkDataResponseDTO> responseList = new ArrayList<>();
    for (UserWorkDataRequestDTO request : requestList) {

      UserWorkData userWorkData = new UserWorkData();

      String leaveType = request.getLeaveType() == null ? "NONE" : request.getLeaveType();

      // ---------------- FULL DAY LEAVE ----------------
      if ("FULL_DAY".equalsIgnoreCase(leaveType)) {

        userWorkData.setTaskID(null);
        userWorkData.setAllocatedTime(0.0);
        userWorkData.setTimeTakenToWork(0.0);
        userWorkData.setAchivedUnits(0);
        userWorkData.setUnits(0.0);
        userWorkData.setIsForTarget(false);
        userWorkData.setLeaveType("FULL_DAY");

      } else {
        // ---------------- NORMAL / HALF DAY ----------------
        if (request.getTaskID() != null && request.getTaskID() == 0) {
          userWorkData.setTaskID(request.getTargetID());
        } else {
          userWorkData.setTaskID(request.getTaskID());
        }

        userWorkData.setAllocatedTime(request.getTotalTimePerSetup());
        userWorkData.setTimeTakenToWork(request.getTimeTakenToWork());
        userWorkData.setAchivedUnits(
            request.getAchivedUnits() != null ? request.getAchivedUnits() : 0);
        userWorkData.setUnits(request.getUnits());
        userWorkData.setIsForTarget(request.getIsForTarget());
        userWorkData.setLeaveType(leaveType);
      }

      userWorkData.setUserID(request.getUserID());
      userWorkData.setWorkDate(request.getWorkDate());
      userWorkData.setDepartmentID(request.getDepartmentID());
      userWorkData.setRemarks(request.getRemarks());
      try {
        if (request.getTaskMeta() != null) {
          ObjectMapper mapper = new ObjectMapper();
          userWorkData.setTaskMeta(
              mapper.writeValueAsString(request.getTaskMeta()));
        }
      } catch (Exception e) {
        throw new RuntimeException("Failed to serialize taskMeta", e);
      }
      Timestamp now = Timestamp.valueOf(LocalDateTime.now());
      userWorkData.setCreatedAt(now);
      userWorkData.setUpdatedAt(now);

      UserWorkData saved = userWorkDataRepository.save(userWorkData);
      // if (request.getDepartmentID() != null
      // && (request.getDepartmentID() == 14
      // || request.getDepartmentID() == 31
      // || request.getDepartmentID() == 32)) {
      // processGroupedDepartments(userWorkData);
      // }
      responseList.add(mapToResponse(saved));
    }
    return responseList;
  }

  public void processGroupedDepartments(UserWorkData userWorkData) {

    Integer deptId = userWorkData.getDepartmentID();
    if (!List.of(14, 31, 32).contains(deptId)) {
      return;
    }
    Integer goalId = switch (deptId) {
      case 14 -> 34;
      case 31 -> 35;
      case 32 -> 36;
      default -> null;
    };

    Optional<UserGoalData> existingOpt = repository.findByWorkDateAndDepartmentIDAndGoalID(
        userWorkData.getWorkDate(), deptId, goalId);

    if (existingOpt.isPresent()) {

      UserGoalData existing = existingOpt.get();

      // If already TARGET → ignore non-target
      if (existing.getTarget() && !userWorkData.getIsForTarget()) {
        return;
      }

      if (userWorkData.getIsForTarget()) {
        // overwrite and mark target
        existing.setTarget(true);
        existing.setFixedGoal(BigDecimal.valueOf(userWorkData.getUnits()));
        existing.setAchievedGoal(BigDecimal.valueOf(userWorkData.getAchivedUnits()));
      } else {
        // normal sum
        existing.setFixedGoal(
            existing.getFixedGoal().add(BigDecimal.valueOf(userWorkData.getAllocatedTime())));
        existing.setAchievedGoal(
            existing.getAchievedGoal().add(BigDecimal.valueOf(userWorkData.getTimeTakenToWork())));
      }

      repository.save(existing);

    } else {

      UserGoalData newRow = new UserGoalData();
      newRow.setWorkDate(userWorkData.getWorkDate());
      newRow.setDepartmentID(deptId);
      newRow.setGoalID(goalId);
      newRow.setUserID(userWorkData.getUserID());

      if (userWorkData.getIsForTarget()) {
        newRow.setTarget(true);
        newRow.setFixedGoal(BigDecimal.valueOf(userWorkData.getUnits()));
        newRow.setAchievedGoal(BigDecimal.valueOf(userWorkData.getAchivedUnits()));
      } else {
        newRow.setTarget(false);
        newRow.setFixedGoal(BigDecimal.valueOf(userWorkData.getAllocatedTime()));
        newRow.setAchievedGoal(BigDecimal.valueOf(userWorkData.getTimeTakenToWork()));
      }

      repository.save(newRow);
    }
  }

  @Transactional
  public void bulkUpsertUserGoalData(List<UserGoalDataRequestDTO> goals) {

    for (UserGoalDataRequestDTO dto : goals) {
      if (dto.getDepartmentID() != null && dto.getDepartmentID() != 18) {
        UserGoalData data = repository
            .findByWorkDateAndUserIDAndGoalIDAndGoalType(
                dto.getWorkDate(), dto.getUserID(), dto.getGoalID(), null)
            .orElse(new UserGoalData());

        data.setWorkDate(dto.getWorkDate());
        data.setUserID(dto.getUserID());
        data.setDepartmentID(dto.getDepartmentID());
        data.setGoalID(dto.getGoalID());
        BigDecimal fixedGoal = dto.getFixedGoal();

        // if (dto.getDepartmentID() == 43
        //     || dto.getDepartmentID() == 44
        //     || dto.getDepartmentID() == 49
        //     || dto.getDepartmentID() == 25
        //     || dto.getDepartmentID() == 26) {

        //   BigDecimal fivePercentBuffer = fixedGoal.multiply(
        //       BigDecimal.valueOf(0.05));

        //   fixedGoal = fixedGoal.add(fivePercentBuffer)
        //       .setScale(2, RoundingMode.HALF_UP);
        // }

        data.setFixedGoal(fixedGoal);
        data.setAchievedGoal(dto.getAchievedGoal());
        data.setComment(dto.getComment());
        if (dto.getMetaData() != null && !dto.getMetaData().isEmpty()) {
          try {
            ObjectMapper mapper = new ObjectMapper();
            data.setMetaData(mapper.writeValueAsString(dto.getMetaData()));
          } catch (Exception e) {
            data.setMetaData(null);
          }
        }
        repository.save(data);
      }
      // else {
      //   insertMISDataInGoalAndMISLog(dto);
      // }
    }
  }

  // public void insertMISDataInGoalAndMISLog(UserGoalDataRequestDTO dto) {
  //
  //   BigDecimal totalAchievement = BigDecimal.ZERO;
  //   int count = 0;
  //   String goalType = null;
  //
  //   for (MISUpdateSlot slot : dto.getUpdates()) {
  //
  //     LocalTime expected = slot.getExpectedTime();
  //     LocalTime actual = slot.getActualTime();
  //
  //     goalType = String.valueOf(expected); // last value retained (same as your logic)
  //
  //     BigDecimal slotAchievement = BigDecimal.valueOf(100);
  //
  //     if (actual == null) {
  //       slotAchievement = BigDecimal.ZERO;
  //
  //     } else if (actual.isAfter(expected)) {
  //
  //       long minutes = Duration.between(expected, actual).toMinutes();
  //       long hours = (long) Math.ceil(minutes / 60.0);
  //
  //       BigDecimal penalty = BigDecimal.valueOf(hours * 10);
  //       slotAchievement = BigDecimal.valueOf(100).subtract(penalty);
  //
  //       if (slotAchievement.compareTo(BigDecimal.ZERO) < 0) {
  //         slotAchievement = BigDecimal.ZERO;
  //       }
  //     }
  //
  //     totalAchievement = totalAchievement.add(slotAchievement);
  //     count++;
  //   }
  //
  //   BigDecimal finalAchievement = count > 0
  //       ? totalAchievement.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)
  //       : BigDecimal.ZERO;
  //
  //   UserGoalData data = repository
  //       .findByWorkDateAndUserIDAndGoalIDAndGoalType(
  //           dto.getWorkDate(), dto.getUserID(), dto.getGoalID(), goalType)
  //       .orElse(new UserGoalData());
  //
  //   data.setWorkDate(dto.getWorkDate());
  //   data.setUserID(dto.getUserID());
  //   data.setDepartmentID(dto.getDepartmentID());
  //   data.setGoalID(dto.getGoalID());
  //   data.setFixedGoal(BigDecimal.valueOf(100));
  //   data.setAchievedGoal(finalAchievement);
  //   data.setGoalType(goalType);
  //   data.setComment(dto.getComment()); // ⬅ ADD THIS LINE
  //
  //   repository.save(data);
  // }

  @Transactional(readOnly = true)
  public UserWorkDataResponseWrapperDTO listAll(UserWorkDataFilterRequestDTO filter) {

    UserWorkDataResponseWrapperDTO wrapper = new UserWorkDataResponseWrapperDTO();

    try {
      List<UserWorkData> list = userWorkDataRepository.findFilteredWorkData(
          filter.getUserID(),
          filter.getDepartmentID(),
          filter.getStartDate(),
          filter.getEndDate(),
          filter.getIsForTarget(),
          filter.getTaskID(),
          filter.getELID());

      List<UserWorkDataResponseWrapperDTO.UserWorkDataResponseDTO> dtoList = list.stream().map(this::mapToResponse)
          .collect(Collectors.toList());

      UserWorkDataResponseWrapperDTO.UserWorkDataReadResponseDTO resp = UserWorkDataResponseWrapperDTO.UserWorkDataReadResponseDTO
          .builder()
          .userWorkDataList(dtoList) // FIXED
          .currentPage(1)
          .pageSize(dtoList.size())
          .totalPages(1)
          .totalRecords(dtoList.size())
          .build();

      wrapper.setResponse(resp);
      wrapper.setStatus(true);
      wrapper.setStatusCode(200);
      wrapper.setMessage("User work data retrieved successfully");

    } catch (DataAccessException e) {
      wrapper.setStatus(false);
      wrapper.setStatusCode(900);
      wrapper.setMessage("Database error occurred.");
    }

    return wrapper;
  }

  @Transactional(readOnly = true)
  public UserWorkDataResponseWrapperDTO listAllDownload(UserWorkDataFilterRequestDTO filter) {

    UserWorkDataResponseWrapperDTO wrapper = new UserWorkDataResponseWrapperDTO();

    try {

      // --------------------------------------------------
      // Trigger async CSV + Email processing
      // --------------------------------------------------
      asyncService.generateCsvAndSendEmail(filter);

      // --------------------------------------------------
      // Immediate response to caller
      // --------------------------------------------------
      wrapper.setStatus(true);
      wrapper.setStatusCode(200);
      wrapper.setMessage(
          "Your request has been received. "
              + "The report is being generated and will be emailed to you shortly.");

      wrapper.setResponse(null); // No need to return data since mail is async

    } catch (Exception e) {
      wrapper.setStatus(false);
      wrapper.setStatusCode(900);
      wrapper.setMessage("Failed to process request: " + e.getMessage());
    }

    return wrapper;
  }

  // With Pagination
  // ===============================
  // WITH PAGINATION (SEPARATE METHOD)
  // ===============================
  // @Transactional(readOnly = true)
  // public UserWorkDataResponseWrapperDTO listPaginated(
  // UserWorkDataFilterRequestDTO filter, Integer page, Integer size, String
  // sortBy) {

  // UserWorkDataResponseWrapperDTO wrapper = new
  // UserWorkDataResponseWrapperDTO();

  // try {
  // System.out.println("EL FILTER VALUE = " + filter.getELID());

  // int pageIndex = (page != null && page > 0) ? page - 1 : 0;

  // String sortingField =
  // (sortBy != null && sortBy.equalsIgnoreCase("workDate")) ? "workDate" :
  // "dailyTaskLogID";

  // Pageable pageable = PageRequest.of(pageIndex, size,
  // Sort.by(sortingField).descending());
  // Integer roleID = filter.getRoleID() != null ? filter.getRoleID() : null;
  // Integer userID = filter.getUserID() != null ? filter.getUserID() : null;
  // Integer lRoleID = userRepository.findRoleIdByUserId(userID);

  // System.out.println("lRoleID" + lRoleID);
  // if ((roleID == lRoleID) && (roleID == 1 || roleID == 3)) {
  // userID = null;
  // }

  // System.out.println("userID" + userID);

  // Page<UserWorkData> pageData =
  // userWorkDataRepository.findFilteredWorkDataPaginated(
  // userID,
  // filter.getDepartmentID(),
  // filter.getStartDate(),
  // filter.getEndDate(),
  // filter.getIsForTarget(),
  // filter.getTaskID(),
  // filter.getELID(),
  // pageable);

  // List<UserWorkDataResponseDTO> dtoList =
  // pageData.getContent().stream().map(this::mapToResponse).collect(Collectors.toList());

  // // 2️ OVERALL AVERAGES (WITHOUT PAGINATION)
  // Map<String, Object> avgData =
  // userWorkDataRepository.findOverallAverages(
  // userID,
  // filter.getDepartmentID(),
  // filter.getStartDate(),
  // filter.getEndDate(),
  // filter.getIsForTarget(),
  // filter.getTaskID(),
  // filter.getELID());

  // System.out.println("avgData" + avgData.get("avgAllocated"));
  // System.out.println("avgWork" + avgData.get("avgWork"));
  // // Extract values
  // Double avgAllocated =
  // avgData.get("avgAllocated") != null
  // ? ((Number) avgData.get("avgAllocated")).doubleValue()
  // : 0.0;

  // Double avgWork =
  // avgData.get("avgWork") != null ? ((Number)
  // avgData.get("avgWork")).doubleValue() : 0.0;

  // UserWorkDataResponseWrapperDTO.UserWorkDataReadResponseDTO resp =
  // UserWorkDataResponseWrapperDTO.UserWorkDataReadResponseDTO.builder()
  // .userWorkDataList(dtoList)
  // .currentPage(page)
  // .pageSize(size)
  // .totalRecords((int) pageData.getTotalElements())
  // .totalPages(pageData.getTotalPages())
  // .avgAllocatedHrs(avgAllocated)
  // .avgTotalWork(avgWork)
  // .build();

  // wrapper.setResponse(resp);
  // wrapper.setStatus(true);
  // wrapper.setStatusCode(200);
  // wrapper.setMessage("Paginated user work data retrieved successfully");

  // } catch (DataAccessException e) {
  // wrapper.setStatus(false);
  // wrapper.setStatusCode(900);
  // wrapper.setMessage("Database error occurred.");
  // }

  // return wrapper;
  // }

  @Transactional(readOnly = true)
  public UserWorkDataResponseWrapperDTO listPaginated(
      UserWorkDataFilterRequestDTO filter, Integer page, Integer size, String sortBy) {

    UserWorkDataResponseWrapperDTO wrapper = new UserWorkDataResponseWrapperDTO();

    try {

      int pageIndex = (page != null && page > 0) ? page - 1 : 0;
      int pageSize = (size != null && size > 0 && size <= 100) ? size : 10;

      String sortingField = ("workDate".equalsIgnoreCase(sortBy)) ? "workDate" : "dailyTaskLogID";

      Pageable pageable = PageRequest.of(pageIndex, pageSize, Sort.by(sortingField).descending());

      Integer roleID = filter.getRoleID();
      Integer userID = filter.getUserID();

      Integer lRoleID = (userID != null) ? userRepository.findRoleIdByUserId(userID) : null;

      if (roleID != null && roleID.equals(lRoleID) && (roleID == 1 || roleID == 3)) {
        userID = null;
      }

      Page<UserWorkData> pageData = userWorkDataRepository.findFilteredWorkDataPaginated(
          userID,
          filter.getDepartmentID(),
          filter.getStartDate(),
          filter.getEndDate(),
          filter.getIsForTarget(),
          filter.getTaskID(),
          filter.getELID(),
          pageable);

      List<UserWorkDataResponseDTO> dtoList = pageData.getContent().stream().map(this::mapToResponse).toList();

      Map<String, Object> avgData = userWorkDataRepository.findOverallAverages(
          userID,
          filter.getDepartmentID(),
          filter.getStartDate(),
          filter.getEndDate(),
          filter.getIsForTarget(),
          filter.getTaskID(),
          filter.getELID());

      double avgAllocated = avgData.get("avgAllocated") != null
          ? ((Number) avgData.get("avgAllocated")).doubleValue()
          : 0.0;

      double avgWork = avgData.get("avgWork") != null
          ? ((Number) avgData.get("avgWork")).doubleValue()
          : 0.0;

      wrapper.setResponse(
          UserWorkDataResponseWrapperDTO.UserWorkDataReadResponseDTO.builder()
              .userWorkDataList(dtoList)
              .currentPage(page)
              .pageSize(pageSize)
              .totalRecords((int) pageData.getTotalElements())
              .totalPages(pageData.getTotalPages())
              .avgAllocatedHrs(avgAllocated)
              .avgTotalWork(avgWork)
              .build());

      wrapper.setStatus(true);
      wrapper.setStatusCode(200);
      wrapper.setMessage("Paginated user work data retrieved successfully");

    } catch (DataAccessException e) {
      wrapper.setStatus(false);
      wrapper.setStatusCode(900);
      wrapper.setMessage("Database error occurred.");
    }

    return wrapper;
  }

  public UserWorkDataResponseDTO mapToResponse(UserWorkData entity) {

    String userName = userRepository.findById(entity.getUserID()).map(User::getName).orElse(null);

    String departmentName = departmentRepository
        .findById(entity.getDepartmentID())
        .map(Department::getDepartmentName)
        .orElse(null);

    String taskName = null;

    if ("FULL_DAY".equals(entity.getLeaveType())) {
      taskName = "FULL DAY LEAVE";
    } else if (Boolean.FALSE.equals(entity.getIsForTarget())) {
      taskName = taskRepository.findById(entity.getTaskID()).map(DepartmentTask::getTaskName).orElse(null);
    } else {
      taskName = targetRepository
          .findById(entity.getTaskID())
          .map(DepartmentTarget::getTargetName)
          .orElse(null);
    }
    List<Integer> taskMeta = null;

    try {
      if (entity.getTaskMeta() != null) {
        ObjectMapper mapper = new ObjectMapper();
        taskMeta = mapper.readValue(
            entity.getTaskMeta(),
            new TypeReference<List<Integer>>() {
            });
      }
    } catch (Exception e) {
      throw new RuntimeException("Failed to parse taskMeta", e);
    }
    // TAM accounts for dept 23 users
    // TAM accounts for dept 23 users
    List<TAMResponse> tamAccounts = null;
    if (entity.getDepartmentID() != null && entity.getDepartmentID() == 23) {

      System.out.println("=== TAM DEBUG ===");
      System.out.println("Entity UserID: " + entity.getUserID());
      System.out.println("Entity DeptID: " + entity.getDepartmentID());

      List<TAMAccount> rawAccounts = tamAccountRepository
          .findAllByCreatedByUserID(entity.getUserID());

      System.out.println("TAM accounts found: " + rawAccounts.size());
      rawAccounts.forEach(a -> System.out.println(
          "  → accountId=" + a.getAccountId()
              + " user=" + a.getCreatedByUserID()
              + " status=" + a.getStatus()));

      tamAccounts = rawAccounts.stream()
          .map(account -> {
            TAMResponse dto = new TAMResponse();
            dto.setAccountId(account.getAccountId());
            dto.setPublisherName(account.getPublisherName());
            dto.setStatus(account.getStatus());
            dto.setEntryDate(account.getEntryDate() != null ? account.getEntryDate().toString() : null);
            dto.setLiveDate(account.getLiveDate() != null ? account.getLiveDate().toString() : null);
            dto.setCreatedByUserID(account.getCreatedByUserID());
            dto.setUpdatedByUserID(account.getUpdatedByUserID());
            dto.setCreatedAt(account.getCreatedAt() != null ? account.getCreatedAt().toString() : null);
            dto.setUpdatedAt(account.getUpdatedAt() != null ? account.getUpdatedAt().toString() : null);
            return dto;
          })
          .collect(Collectors.toList());
    }

    return UserWorkDataResponseDTO.builder()
        .dailyTaskLogID(entity.getDailyTaskLogID())
        .taskID(entity.getTaskID())
        .taskName(taskName)
        .leaveType(entity.getLeaveType())
        .userID(entity.getUserID())
        .userName(userName)
        .departmentID(entity.getDepartmentID())
        .departmentName(departmentName)
        .workDate(entity.getWorkDate())
        .setUp(entity.getSetUp())
        .units(entity.getUnits())
        .revisedTarget(parseRevisedTarget(entity.getRevisedTarget()))
        .approvedByEL(entity.getApprovedByEL())
        .allocatedTime(entity.getAllocatedTime())
        .timeTakenToWork(entity.getTimeTakenToWork())
        .isForTarget(entity.getIsForTarget())
        .overAllTime(entity.getOverAllTime())
        .remarks(entity.getRemarks())
        .achivedUnits(entity.getAchivedUnits())
        .totalUnitValues(entity.getTotalUnitValues())
        .createdAt(entity.getCreatedAt())
        .updatedAt(entity.getUpdatedAt())
        .tamAccounts(tamAccounts) // new field
        .taskMeta(taskMeta)
        .build();
  }

  @Transactional
  public UserWorkDataResponseDTO updateRevisedTarget(
      RevisedTargetUpdateRequestDTO request, Integer currentUserId) {

    UserWorkData row = resolveWorkRow(
        request.getDailyTaskLogID(), request.getUserID(), request.getTaskID(),
        request.getWorkDate(), request.getIsForTarget());

    // Only the revised object is written — the row's ApprovedByEL column is
    // never touched here. Payload fields merge into what is already stored, so
    // an APPROVE call (no revisedTarget body) keeps value / enteredBy / enteredAt.
    String action = request.getAction() != null
        ? request.getAction().trim().toUpperCase()
        : null;
    String now = LocalDateTime.now().format(AUDIT_TIME_FORMAT);

    RevisedTargetDetailsDTO merged;
    if (Boolean.TRUE.equals(request.getClear())) {
      merged = null;
    } else if (request.getRevisedTarget() != null) {
      merged = parseRevisedTarget(row.getRevisedTarget());
      if (merged == null) {
        merged = new RevisedTargetDetailsDTO();
      }
      RevisedTargetDetailsDTO incoming = request.getRevisedTarget();
      if (incoming.getValue() != null) {
        merged.setValue(incoming.getValue());
      }
      if (incoming.getComment() != null) {
        merged.setComment(incoming.getComment());
      }
      if (incoming.getEnteredBy() != null) {
        merged.setEnteredBy(incoming.getEnteredBy());
      }
      if (incoming.getEnteredAt() != null) {
        merged.setEnteredAt(incoming.getEnteredAt());
      }
      if (incoming.getElApproved() != null) {
        merged.setElApproved(incoming.getElApproved());
      }
      if (incoming.getApprovedBy() != null) {
        merged.setApprovedBy(incoming.getApprovedBy());
      }
      if (incoming.getApprovedAt() != null) {
        merged.setApprovedAt(incoming.getApprovedAt());
      }
    } else {
      merged = parseRevisedTarget(row.getRevisedTarget());
    }

    if (merged == null && action != null) {
      merged = new RevisedTargetDetailsDTO();
    }

    if (merged != null) {
      if ("APPROVE".equals(action)) {
        merged.setElApproved(true);
        merged.setApprovedBy(currentUserId);
        merged.setApprovedAt(now);
      } else if ("REJECT".equals(action)) {
        merged.setElApproved(false);
        merged.setApprovedBy(currentUserId);
        merged.setApprovedAt(now);
      }
      if (merged.getValue() != null && merged.getEnteredAt() == null) {
        merged.setEnteredAt(now);
      }
      if (merged.getValue() != null && merged.getEnteredBy() == null) {
        merged.setEnteredBy(currentUserId);
      }
    }

    row.setRevisedTarget(toJson(merged));
    UserWorkData saved = userWorkDataRepository.save(row);

    return mapToResponse(saved);
  }

  @Transactional(readOnly = true)
  public RevisedTargetDetailsDTO getRevisedTarget(Integer dailyTaskLogID) {
    UserWorkData row = userWorkDataRepository.findById(dailyTaskLogID)
        .orElseThrow(() -> new ResourceNotFoundException(
            "UserWorkData not found with id: " + dailyTaskLogID));
    RevisedTargetDetailsDTO details = parseRevisedTarget(row.getRevisedTarget());
    return details != null ? details : new RevisedTargetDetailsDTO();
  }

  @Transactional(readOnly = true)
  public RevisedTargetDetailsDTO getRevisedTarget(
      Integer userID, Integer taskID, java.time.LocalDate workDate, Boolean isForTarget) {
    UserWorkData row = resolveWorkRow(null, userID, taskID, workDate, isForTarget);
    RevisedTargetDetailsDTO details = parseRevisedTarget(row.getRevisedTarget());
    return details != null ? details : new RevisedTargetDetailsDTO();
  }

  private UserWorkData resolveWorkRow(
      Integer dailyTaskLogID, Integer userID, Integer taskID,
      java.time.LocalDate workDate, Boolean isForTarget) {

    if (dailyTaskLogID != null) {
      return userWorkDataRepository.findById(dailyTaskLogID)
          .orElseThrow(() -> new ResourceNotFoundException(
              "UserWorkData not found with id: " + dailyTaskLogID));
    }

    if (userID != null && taskID != null && workDate != null) {
      List<UserWorkData> matches = userWorkDataRepository.findByUserTaskAndWorkDate(
          userID, taskID, workDate, isForTarget);
      if (matches.isEmpty()) {
        throw new ResourceNotFoundException(
            "UserWorkData not found for userID=" + userID
                + ", taskID=" + taskID
                + ", workDate=" + workDate);
      }
      return matches.get(0);
    }

    throw new IllegalArgumentException(
        "Provide either dailyTaskLogID or userID + taskID + workDate");
  }

  private RevisedTargetDetailsDTO parseRevisedTarget(String json) {
    if (json == null || json.isBlank()) {
      return null;
    }
    try {
      return new ObjectMapper().readValue(json, RevisedTargetDetailsDTO.class);
    } catch (Exception e) {
      return null;
    }
  }

  private String toJson(RevisedTargetDetailsDTO details) {
    if (details == null) {
      return null;
    }
    try {
      return new ObjectMapper().writeValueAsString(details);
    } catch (Exception e) {
      throw new RuntimeException("Failed to serialize revisedTarget", e);
    }
  }

  @Transactional
  public void bulkUpdateWorkAndGoals(
      UserWorkAndGoalRequest request) {

    // UPDATE TASKS
    if (request.getActivities() != null &&
        !request.getActivities().isEmpty()) {

      updateActivities(request.getActivities());
    }

    // UPDATE GOALS
    if (request.getGoals() != null &&
        !request.getGoals().isEmpty()) {

      updateGoals(request.getGoals());
    }
  }

  private void updateActivities(
      List<UserWorkDataRequestDTO> activities) {

    for (UserWorkDataRequestDTO dto : activities) {

      if (dto.getDailyTaskLogID() == null)
        continue;

      UserWorkData entity = userWorkDataRepository
          .findById(dto.getDailyTaskLogID())
          .orElseThrow(() -> new RuntimeException(
              "Task not found"));

      entity.setAllocatedTime(dto.getAllocatedTime());
      entity.setTimeTakenToWork(dto.getTimeTakenToWork());
      entity.setRemarks(dto.getRemarks());
      entity.setUnits(dto.getUnits());
      entity.setAchivedUnits(dto.getAchivedUnits());
      entity.setSetUp(dto.getSetUp());
      try {
        if (dto.getTaskMeta() != null) {
          ObjectMapper mapper = new ObjectMapper();
          entity.setTaskMeta(
              mapper.writeValueAsString(dto.getTaskMeta()));
        }
      } catch (Exception e) {
        throw new RuntimeException("Failed to serialize taskMeta", e);
      }
      // reset rejection after update
      entity.setCommentForRejection(null);

      userWorkDataRepository.save(entity);
    }
  }

  private void updateGoals(
      List<UserGoalDataRequestDTO> goals) {

    for (UserGoalDataRequestDTO dto : goals) {

      if (dto.getUserGoalDataID() == null)
        continue;

      UserGoalData entity = repository
          .findById(dto.getUserGoalDataID())
          .orElseThrow(() -> new RuntimeException(
              "Goal not found"));

      entity.setAchievedGoal(dto.getAchievedGoal());
      entity.setFixedGoal(dto.getFixedGoal());

      // reset rejection after update
      entity.setCommentForRejection(null);

      repository.save(entity);
    }
  }
}
