package tapmind.bsrv.serviceNew;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.entity.*;
import tapmind.bsrv.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.domain.Pageable;
import java.time.LocalDateTime;
import java.util.List;
import java.util.*;
@Service
@RequiredArgsConstructor
public class TACallService {

    private final TACallScheduleRepository callRepo;
    private final TACallRescheduleLogRepository logRepo;

    // CREATE CALL
    public TACallSchedule createCall(TACallCreateDTO dto) {
        TACallSchedule call = TACallSchedule.builder()
                .taUserID(dto.getTaUserID())
                .candidateName(dto.getCandidateName())
                .positionID(dto.getPositionID())
                .scheduledDatetime(dto.getScheduledDatetime())
                .status(TACallSchedule.Status.SCHEDULED)
                .rescheduleCount(0)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        return callRepo.save(call);
    }

    // RESCHEDULE CALL
    public TACallSchedule rescheduleCall(TACallRescheduleDTO dto) {

        TACallSchedule call = callRepo.findById(dto.getCallID())
                .orElseThrow(() -> new RuntimeException("Call not found"));

        // Save log
        TACallRescheduleLog log = TACallRescheduleLog.builder()
                .callID(dto.getCallID())
                .oldDatetime(call.getScheduledDatetime())
                .newDatetime(dto.getNewDatetime())
                .rescheduledBy(TACallRescheduleLog.RescheduledBy.valueOf(dto.getRescheduledBy()))
                .reason(dto.getReason())
                .createdAt(LocalDateTime.now())
                .build();

        logRepo.save(log);

        // Update schedule table
        call.setScheduledDatetime(dto.getNewDatetime());
        call.setStatus(TACallSchedule.Status.RESCHEDULED);
        call.setRescheduleCount(call.getRescheduleCount() + 1);
        call.setUpdatedAt(LocalDateTime.now());

        return callRepo.save(call);
    }

    // UPDATE STATUS
    public TACallSchedule updateStatus(TACallStatusUpdateDTO dto) {
        TACallSchedule call = callRepo.findById(dto.getCallID())
                .orElseThrow(() -> new RuntimeException("Call not found"));

        call.setStatus(TACallSchedule.Status.valueOf(dto.getStatus()));
        call.setUpdatedAt(LocalDateTime.now());

        return callRepo.save(call);
    }

    // LIST FILTER
    public List<TACallSchedule> listCalls(TACallFilterDTO filter) {
        LocalDateTime start = filter.getStartDate() == null ? null : filter.getStartDate().atStartOfDay();
        LocalDateTime end = filter.getEndDate() == null ? null : filter.getEndDate().atTime(23, 59, 59);

        return callRepo.filterCalls(
                filter.getTaUserID(),
                filter.getPositionID(),
                start,
                end
        );
    }


    public Map<String, Object> listCalls(
        TACallFilterDTO filter,
        int page, int size,
        String sortBy, String sortDirection
) {

    Sort sort = sortDirection.equalsIgnoreCase("DESC")
            ? Sort.by(sortBy).descending()
            : Sort.by(sortBy).ascending();

    Pageable pageable = PageRequest.of(page - 1, size, sort);

    LocalDateTime start = filter.getStartDate() == null ? null : filter.getStartDate().atStartOfDay();
    LocalDateTime end = filter.getEndDate() == null ? null : filter.getEndDate().atTime(23, 59, 59);

    Page<TACallSchedule> p = callRepo.filterCallsPaged(
            filter.getTaUserID(),
            filter.getPositionID(),
            start,
            end,
            pageable
    );

    Map<String, Object> res = new HashMap<>();
    res.put("data", p.getContent());
    res.put("currentPage", page);
    res.put("totalItems", p.getTotalElements());
    res.put("totalPages", p.getTotalPages());
    res.put("sortBy", sortBy);
    res.put("sortDirection", sortDirection);

    return res;
}

}
