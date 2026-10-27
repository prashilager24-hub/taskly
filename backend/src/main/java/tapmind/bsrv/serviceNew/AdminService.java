// package tapmind.bsrv.serviceNew;

// import java.math.BigDecimal;
// import java.time.DayOfWeek;
// import java.time.LocalDate;
// import java.time.temporal.ChronoUnit;
// import java.util.HashMap;
// import java.util.List;
// import java.util.Map;
// import java.util.stream.Collectors;
// import org.springframework.beans.factory.annotation.Autowired;
// import org.springframework.data.domain.Page;
// import org.springframework.data.domain.PageRequest;
// import org.springframework.data.domain.Pageable;
// import org.springframework.data.domain.Sort;
// import org.springframework.stereotype.Service;
// import tapmind.bsrv.dto.*;
// import tapmind.bsrv.model.Admin;
// import tapmind.bsrv.model.PositionStatus;
// import tapmind.bsrv.model.UserGoalData;
// import tapmind.bsrv.repository.AdminRepository;
// import tapmind.bsrv.repository.UserGoalDataRepository;

// @Service
// public class AdminService {

//   @Autowired private AdminRepository repo;
//   @Autowired private UserGoalDataRepository userGoalDataRepository;

//   // ================= CREATE =================
//   public AdminResponse create(AdminTicketCreateRequest req) {

//     Admin jp = new Admin();
//     jp.setTitle(req.getTitle());
//     jp.setDescription(req.getDescription());
//     jp.setCreatedByUserID(req.getUserID());
//     jp.setStatus(PositionStatus.OPEN); // ENUM usage
//     jp.setOpenDate(req.getOpenDate());
//     repo.save(jp);
//     return mapToResponse(jp);
//   }

//   // ================= LIST ALL =================
//   public List<AdminResponse> listAll(Integer userId) {
//     return repo.findAllByCreatedByUserID(userId).stream()
//         .map(this::mapToResponse)
//         .collect(Collectors.toList());
//   }

//   // ================= PAGINATED LIST =================
//   public Map<String, Object> listAll(int page, int size, String sortBy, String sortDirection) {
//     Sort sort =
//         sortDirection.equalsIgnoreCase("DESC")
//             ? Sort.by(sortBy).descending()
//             : Sort.by(sortBy).ascending();

//     Pageable pageable = PageRequest.of(page - 1, size, sort);
//     Page<Admin> result = repo.findAll(pageable);
//     Map<String, Object> response = new HashMap<>();
//     response.put(
//         "data", result.getContent().stream().map(this::mapToResponse).collect(Collectors.toList()));
//     response.put("currentPage", page);
//     response.put("totalItems", result.getTotalElements());
//     response.put("totalPages", result.getTotalPages());
//     response.put("sortBy", sortBy);
//     response.put("sortDirection", sortDirection);

//     return response;
//   }

//   // ================= UPDATE =================
//   public AdminResponse update(AdminTicketUpdateRequest req) {

//     Admin jp =
//         repo.findById(req.getTicketID())
//             .orElseThrow(() -> new RuntimeException("Ticket id not found"));

//     if (req.getTitle() != null) jp.setTitle(req.getTitle());

//     if (req.getDescription() != null) jp.setDescription(req.getDescription());

//     if (req.getStatus() != null) {

//       // If closing
//       if (req.getStatus() == PositionStatus.CLOSED && jp.getStatus() != PositionStatus.CLOSED) {

//         jp.setCloseDate(LocalDate.now());
//         jp.setClosedByUserID(req.getUserID());
//       }
//       if (req.getStatus() == PositionStatus.PAUSED && jp.getStatus() != PositionStatus.PAUSED) {

//         jp.setCloseDate(LocalDate.now());
//         jp.setClosedByUserID(req.getUserID());
//       }

//       // If reopening
//       if (req.getStatus() == PositionStatus.OPEN) {
//         jp.setCloseDate(null);
//         jp.setClosedByUserID(null);
//       }
//       jp.setStatus(req.getStatus());
//     }
//     repo.save(jp);

//     long days = ChronoUnit.DAYS.between(req.getOpenDate(), LocalDate.now());

//     // Reduce 10% for every 10 days after 40(30 working days)
//     if (req.getStatus() == PositionStatus.CLOSED && jp.getStatus() != PositionStatus.CLOSED) {

//       int goalId = req.getGoalID(); // coming from request
//       int tatDays = getTatDaysByGoalId(goalId);

//       LocalDate openDate = jp.getOpenDate();
//       LocalDate closeDate = LocalDate.now();

//       long workingDays = calculateWorkingDays(openDate, closeDate);

//       long extraDays = workingDays - tatDays;

//       UserGoalData userGoalData = new UserGoalData();
//       userGoalData.setGoalID(goalId);
//       userGoalData.setDepartmentID(42); // Admin Department
//       userGoalData.setUserID(req.getUserID());
//       userGoalData.setWorkDate(LocalDate.now());

//       userGoalData.setFixedGoal(BigDecimal.valueOf(tatDays));
//       userGoalData.setAchievedGoal(BigDecimal.valueOf(workingDays));

//       userGoalDataRepository.save(userGoalData);
//     }
//     return mapToResponse(jp);
//   }

//   public long calculateWorkingDays(LocalDate start, LocalDate end) {
//     long days = 0;

//     while (!start.isAfter(end)) {
//       DayOfWeek day = start.getDayOfWeek();

//       if (day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY) {
//         days++;
//       }
//       start = start.plusDays(1);
//     }

//     return days;
//   }

//   private int getTatDaysByGoalId(int goalId) {
//     switch (goalId) {
//       case 1:
//         return 2;
//       case 2:
//         return 7;
//       case 3:
//         return 1;
//       default:
//         throw new RuntimeException("Invalid Goal ID");
//     }
//   }

//   // ================= MAPPER =================
//   private AdminResponse mapToResponse(Admin jp) {
//     AdminResponse res = new AdminResponse();
//     res.setTicketID(jp.getTicketID());
//     res.setTitle(jp.getTitle());
//     res.setDescription(jp.getDescription());

//     // Convert enum to string for response
//     res.setStatus(jp.getStatus());
//     if (jp.getStatus().equals(PositionStatus.CLOSED)) {
//       LocalDate openDate = jp.getOpenDate();
//       LocalDate closedDate = jp.getCloseDate();
//       if (openDate != null && closedDate != null) {
//         long days = ChronoUnit.DAYS.between(openDate, closedDate);

//         if (days < 40) {
//           res.setAchievedPerct(100);
//         } else {
//           // Reduce 10% for every 10 days after 40(30 working days)
//           long extraDays = days - 40;
//           long reductionSteps = extraDays / 10;
//           int percentage = 100 - (int) (reductionSteps * 10);
//           // Ensure it doesn't go below 0
//           percentage = Math.max(percentage, 0);
//           res.setWorkedDays(days);
//           res.setAchievedPerct(percentage);
//         }
//       }
//     } else {
//       res.setAchievedPerct(0);
//     }
//     res.setOpenDate(jp.getOpenDate());
//     res.setCreatedAt(jp.getCreatedAt() != null ? jp.getCreatedAt().toString() : null);
//     res.setUpdatedAt(jp.getUpdatedAt() != null ? jp.getUpdatedAt().toString() : null);
//     res.setCreatedByUserID(jp.getCreatedByUserID());
//     res.setClosedByUserID(jp.getClosedByUserID());
//     res.setCloseDate(jp.getCloseDate() != null ? jp.getCloseDate().toString() : null);
//     res.setPausedDate(jp.getPausedDate() != null ? jp.getPausedDate().toString() : null);
//     return res;
//   }
// }



package tapmind.bsrv.serviceNew;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import java.util.Optional;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.model.Admin;
import tapmind.bsrv.model.PositionStatus;
import tapmind.bsrv.model.UserGoalData;
import tapmind.bsrv.repository.AdminRepository;
import tapmind.bsrv.repository.UserGoalDataRepository;

@Service
public class AdminService {

    @Autowired
    private AdminRepository repo;

    @Autowired
    private UserGoalDataRepository userGoalDataRepository;

    // ================= CREATE =================
    public AdminResponse create(AdminTicketCreateRequest req) {

        Admin jp = new Admin();
        jp.setTitle(req.getTitle());
        jp.setGoalID(req.getGoalID()); 
        jp.setDescription(req.getDescription());
        jp.setCreatedByUserID(req.getUserID());
        jp.setStatus(PositionStatus.OPEN);
        jp.setOpenDate(req.getOpenDate());

        repo.save(jp);
        return mapToResponse(jp);
    }

    // ================= LIST =================
    public List<AdminResponse> listAll(Integer userId) {
        return repo.findAllByCreatedByUserID(userId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // ================= PAGINATION =================
    public Map<String, Object> listAll(int page, int size, String sortBy, String sortDirection) {

        Sort sort = sortDirection.equalsIgnoreCase("DESC")
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();

        Pageable pageable = PageRequest.of(page - 1, size, sort);

        Page<Admin> result = repo.findAll(pageable);

        Map<String, Object> response = new HashMap<>();
        response.put("data", result.getContent().stream().map(this::mapToResponse).toList());
        response.put("currentPage", page);
        response.put("totalItems", result.getTotalElements());
        response.put("totalPages", result.getTotalPages());

        return response;
    }

    // ================= UPDATE =================
    public AdminResponse update(AdminTicketUpdateRequest req) {

        Admin jp = repo.findById(req.getTicketID())
                .orElseThrow(() -> new RuntimeException("Ticket not found"));

        // 🔥 IMPORTANT: capture old status BEFORE update
        PositionStatus oldStatus = jp.getStatus();

        // Update basic fields
        if (req.getTitle() != null) jp.setTitle(req.getTitle());
        if (req.getDescription() != null) jp.setDescription(req.getDescription());
        if (req.getGoalID() != null) jp.setGoalID(req.getGoalID());

        // 🔥 Detect transition
        boolean isClosingNow =
                req.getStatus() == PositionStatus.CLOSED &&
                oldStatus != PositionStatus.CLOSED;

        boolean isPausingNow =
                req.getStatus() == PositionStatus.PAUSED &&
                oldStatus != PositionStatus.PAUSED;

        boolean isReopening =
                req.getStatus() == PositionStatus.OPEN;

        // Apply status changes
        if (isClosingNow || isPausingNow) {
            jp.setCloseDate(LocalDate.now());
            jp.setClosedByUserID(req.getUserID());
        }

        if (isReopening) {
            jp.setCloseDate(null);
            jp.setClosedByUserID(null);
        }

        if (req.getStatus() != null) {
            jp.setStatus(req.getStatus());
        }

        repo.save(jp);

        // ================= GOAL LOGIC =================
        if (isClosingNow) {

         Integer goalIdObj = jp.getGoalID();

    if (goalIdObj == null) {
        throw new RuntimeException("GoalID is missing for ticket: " + jp.getTicketID());
    }

    int goalId = goalIdObj;

    System.out.println("🔥 Goal ID: " + goalId);


            int tatDays = getTatDaysByGoalId(goalId);

            LocalDate openDate = jp.getOpenDate();
            LocalDate closeDate = LocalDate.now();

            long workingDays = calculateWorkingDays(openDate, closeDate);

            System.out.println("👉 Working Days: " + workingDays);
            System.out.println("👉 TAT Days: " + tatDays);

           Optional<UserGoalData> existing =
    userGoalDataRepository.findByWorkDateAndUserIDAndGoalIDAndGoalType(
        LocalDate.now(),
        req.getUserID(),
        goalId,
        "ADMIN"
    );

UserGoalData userGoalData = existing.orElse(new UserGoalData());

userGoalData.setGoalID(goalId);
userGoalData.setDepartmentID(42);
userGoalData.setUserID(req.getUserID());
userGoalData.setWorkDate(LocalDate.now());
userGoalData.setGoalType("ADMIN"); // 🔥 VERY IMPORTANT

userGoalData.setFixedGoal(BigDecimal.valueOf(tatDays));
userGoalData.setAchievedGoal(BigDecimal.valueOf(workingDays));

userGoalDataRepository.save(userGoalData);
        }

        return mapToResponse(jp);
    }

    // ================= WORKING DAYS =================
    public long calculateWorkingDays(LocalDate start, LocalDate end) {

        long days = 0;

        while (!start.isAfter(end)) {
            DayOfWeek day = start.getDayOfWeek();

            if (day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY) {
                days++;
            }

            start = start.plusDays(1);
        }

        return days;
    }

    // ================= TAT =================
private int getTatDaysByGoalId(int goalId) {

    System.out.println("👉 Received Goal ID: " + goalId);

    return switch (goalId) {

        case 53 -> 2;  // IT Support → 48 hrs = 2 days
        case 54 -> 1;  // Exit Asset → 24 hrs = 1 day
        case 55 -> 7;  // Travel Booking → 7 days

        case 56 -> 0;  // Vendor → no fixed TAT (handled separately)

        default -> throw new RuntimeException("Invalid Goal ID: " + goalId);
    };
}

    // ================= RESPONSE =================
    private AdminResponse mapToResponse(Admin jp) {

        AdminResponse res = new AdminResponse();

        res.setTicketID(jp.getTicketID());
        res.setTitle(jp.getTitle());
        res.setGoalID(jp.getGoalID());
        res.setDescription(jp.getDescription());
        res.setStatus(jp.getStatus());

        if (jp.getStatus() == PositionStatus.CLOSED) {

            LocalDate openDate = jp.getOpenDate();
            LocalDate closeDate = jp.getCloseDate();

            if (openDate != null && closeDate != null) {

                // ✅ use working days (consistent)
                long days = calculateWorkingDays(openDate, closeDate);

                if (days <= 40) {
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
