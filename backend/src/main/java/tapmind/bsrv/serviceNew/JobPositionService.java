package tapmind.bsrv.serviceNew;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import tapmind.bsrv.dto.PositionCreateRequest;
import tapmind.bsrv.dto.PositionResponse;
import tapmind.bsrv.dto.PositionUpdateRequest;
import tapmind.bsrv.model.JobPosition;
import tapmind.bsrv.model.PositionStatus;
import tapmind.bsrv.model.UserGoalData;
import tapmind.bsrv.repository.JobPositionRepository;
import tapmind.bsrv.repository.UserGoalDataRepository;

@Service
public class JobPositionService {

  @Autowired
  private JobPositionRepository repo;
  @Autowired
  private UserGoalDataRepository userGoalDataRepository;

  // ================= CREATE =================
  public PositionResponse create(PositionCreateRequest req) {

    JobPosition jp = new JobPosition();
    jp.setPositionName(req.getPositionName());
    jp.setJD_Details(req.getJdDetails());
    jp.setCreatedByUserID(req.getUserID());
    jp.setStatus(PositionStatus.OPEN); // ENUM usage
    jp.setOpenDate(req.getOpenDate());
    repo.save(jp);
    return mapToResponse(jp);
  }

  // Replace the two listAll methods with these:

  // No pagination — filter by status or return all
  public List<PositionResponse> listAll(Integer userId, String statusFilter) {
    List<JobPosition> positions;

    if (statusFilter != null && !statusFilter.equalsIgnoreCase("all")) {
      PositionStatus status = PositionStatus.valueOf(statusFilter.toUpperCase());
      positions = repo.findAllByCreatedByUserIDAndStatus(userId, status);
    } else {
      positions = repo.findAllByCreatedByUserID(userId);
    }

    return positions.stream().map(this::mapToResponse).collect(Collectors.toList());
  }

  // Paginated — filter by status or return all
  public Map<String, Object> listAll(int page, int size, String sortBy, String sortDirection, String statusFilter) {

    Sort sort = sortDirection.equalsIgnoreCase("DESC")
        ? Sort.by(sortBy).descending()
        : Sort.by(sortBy).ascending();

    Pageable pageable = PageRequest.of(page - 1, size, sort);

    Page<JobPosition> result;
    if (statusFilter != null && !statusFilter.equalsIgnoreCase("all")) {
      PositionStatus status = PositionStatus.valueOf(statusFilter.toUpperCase());
      result = repo.findAllByStatus(status, pageable);
    } else {
      result = repo.findAll(pageable);
    }

    Map<String, Object> response = new HashMap<>();
    response.put("data", result.getContent().stream().map(this::mapToResponse).collect(Collectors.toList()));
    response.put("currentPage", page);
    response.put("totalItems", result.getTotalElements());
    response.put("totalPages", result.getTotalPages());
    response.put("sortBy", sortBy);
    response.put("sortDirection", sortDirection);
    response.put("statusFilter", statusFilter);

    return response;
  }

  // ================= UPDATE =================
  // public PositionResponse update(PositionUpdateRequest req) {

  // JobPosition jp = repo.findById(req.getPositionID())
  // .orElseThrow(() -> new RuntimeException("Position not found"));

  // if (req.getPositionName() != null)
  // jp.setPositionName(req.getPositionName());

  // if (req.getJdDetails() != null)
  // jp.setJD_Details(req.getJdDetails());

  // if (req.getStatus() != null) {

  // // If closing
  // if (req.getStatus() == PositionStatus.CLOSED && jp.getStatus() !=
  // PositionStatus.CLOSED) {

  // jp.setCloseDate(LocalDate.now());
  // jp.setClosedByUserID(req.getUserID());
  // }
  // if (req.getStatus() == PositionStatus.PAUSED && jp.getStatus() !=
  // PositionStatus.PAUSED) {

  // jp.setCloseDate(LocalDate.now());
  // jp.setClosedByUserID(req.getUserID());
  // }

  // // If reopening
  // if (req.getStatus() == PositionStatus.OPEN) {
  // jp.setCloseDate(null);
  // jp.setClosedByUserID(null);
  // }
  // jp.setStatus(req.getStatus());
  // }
  // repo.save(jp);

  // long days = ChronoUnit.DAYS.between(req.getOpenDate(), LocalDate.now());

  // // Reduce 10% for every 10 days after 40(30 working days)
  // long extraDays = days - 40;
  // if (req.getStatus() == PositionStatus.CLOSED && jp.getStatus() !=
  // PositionStatus.CLOSED) {
  // UserGoalData userGoalData = new UserGoalData();
  // userGoalData.setGoalID(33);
  // userGoalData.setDepartmentID(22);
  // userGoalData.setUserID(req.getUserID());
  // userGoalData.setWorkDate(LocalDate.now());
  // userGoalData.setFixedGoal(BigDecimal.valueOf(40));
  // userGoalData.setAchievedGoal(BigDecimal.valueOf(extraDays + 40));
  // userGoalDataRepository.save(userGoalData);
  // }
  // return mapToResponse(jp);
  // }

  public PositionResponse update(PositionUpdateRequest req) {

    JobPosition jp = repo.findById(req.getPositionID())
        .orElseThrow(() -> new RuntimeException("Position not found"));

    // Capture OLD status BEFORE any mutation
    PositionStatus oldStatus = jp.getStatus();

    if (req.getPositionName() != null)
      jp.setPositionName(req.getPositionName());
    if (req.getJdDetails() != null)
      jp.setJD_Details(req.getJdDetails());

    if (req.getStatus() != null) {

      if (req.getStatus() == PositionStatus.CLOSED && oldStatus != PositionStatus.CLOSED) {
        jp.setCloseDate(LocalDate.now()); // set closeDate only on actual close
        jp.setClosedByUserID(req.getUserID());
      }

      if (req.getStatus() == PositionStatus.PAUSED && oldStatus != PositionStatus.PAUSED) {
        jp.setPausedDate(LocalDate.now()); // use pausedDate, not closeDate
        jp.setClosedByUserID(req.getUserID());
      }

      if (req.getStatus() == PositionStatus.OPEN) {
        jp.setCloseDate(null);
        jp.setClosedByUserID(null);
      }

      jp.setStatus(req.getStatus());
    }

    repo.save(jp);

    // NOW safe to check oldStatus for goal saving
    if ((req.getStatus() == PositionStatus.CLOSED && oldStatus != PositionStatus.CLOSED)
        || (req.getStatus() == PositionStatus.PAUSED && oldStatus != PositionStatus.PAUSED)) {
      long days = ChronoUnit.DAYS.between(req.getOpenDate(), LocalDate.now());

      UserGoalData userGoalData = new UserGoalData();
      userGoalData.setGoalID(33);
      userGoalData.setDepartmentID(22);
      userGoalData.setUserID(req.getUserID());
      userGoalData.setWorkDate(LocalDate.now());
      userGoalData.setFixedGoal(BigDecimal.valueOf(40));
      userGoalData.setAchievedGoal(BigDecimal.valueOf(days));
      userGoalDataRepository.save(userGoalData);
    }

    return mapToResponse(jp);
  }

  // ================= MAPPER =================
  private PositionResponse mapToResponse(JobPosition jp) {
    PositionResponse res = new PositionResponse();
    res.setPositionID(jp.getPositionID());
    res.setPositionName(jp.getPositionName());
    res.setJdDetails(jp.getJD_Details());

    // Convert enum to string for response
    res.setStatus(jp.getStatus());
    if (jp.getStatus() == PositionStatus.CLOSED
        || jp.getStatus() == PositionStatus.PAUSED) {
      LocalDate openDate = jp.getOpenDate();
      LocalDate endDate = jp.getStatus() == PositionStatus.CLOSED
          ? jp.getCloseDate()
          : jp.getPausedDate();

      if (openDate != null && endDate != null) {
        long days = ChronoUnit.DAYS.between(openDate, endDate);

        if (days < 40) {
          res.setWorkedDays(days);
          res.setAchievedPerct(100);
        } else {
          long extraDays = days - 40;
          long reductionSteps = extraDays / 10;
          int percentage = 100 - (int) (reductionSteps * 10);
          percentage = Math.max(percentage, 0);

          res.setWorkedDays(days);
          res.setAchievedPerct(percentage);
        }
      }
    } else {
      res.setAchievedPerct(0);
    }
    res.setOpenDate(jp.getOpenDate());
    res.setCreatedAt(jp.getCreatedAt() != null ? jp.getCreatedAt().toString() : null);
    res.setUpdatedAt(jp.getUpdatedAt() != null ? jp.getUpdatedAt().toString() : null);
    res.setCreatedByUserID(jp.getCreatedByUserID());
    res.setClosedByUserID(jp.getClosedByUserID());
    res.setCloseDate(jp.getCloseDate() != null ? jp.getCloseDate().toString() : null);
    res.setPausedDate(jp.getPausedDate() != null ? jp.getPausedDate().toString() : null);
    return res;
  }
}
