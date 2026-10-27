package tapmind.bsrv.serviceNew;

import org.springframework.stereotype.Service;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.model.*;

import java.util.List;

import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Map;
import java.time.LocalDateTime;

import tapmind.bsrv.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Collections;
@Service
@RequiredArgsConstructor
public class SalesCallService {

    private final JdbcTemplate jdbcTemplate;
    private final SalesCallScheduleRepository scheduleRepo;
    private final SalesCallRescheduleLogRepository logRepo;

    // -------------------------------------
    // CREATE NEW CALL
    // -------------------------------------
    public SalesCallSchedule createCall(SalesCallCreateDTO dto) {
        SalesCallSchedule call = new SalesCallSchedule();
        call.setCreaterUserID(dto.getCreaterUserID());
        call.setPublisherName(dto.getPublisherName());
        call.setSalesUserID(dto.getSalesUserID());
        call.setScheduledDatetime(dto.getScheduledDatetime());
        call.setStatus(SalesCallSchedule.CallStatus.SCHEDULED);

        return scheduleRepo.save(call);
    }

    // -------------------------------------
    // RESCHEDULE CALL
    // -------------------------------------
    public SalesCallSchedule rescheduleCall(SalesCallRescheduleDTO dto) {

        SalesCallSchedule call = scheduleRepo.findById(dto.getCallID())
                .orElseThrow(() -> new RuntimeException("Call Not Found"));

        // Save old date
        LocalDateTime oldDate = call.getScheduledDatetime();

        // Update schedule
        call.setScheduledDatetime(dto.getNewDatetime());
        call.setStatus(SalesCallSchedule.CallStatus.RESCHEDULED);
        call.setRescheduleCount(call.getRescheduleCount() + 1);

        scheduleRepo.save(call);

        // Save log
        SalesCallRescheduleLog log = new SalesCallRescheduleLog();
        log.setSalesCallSchedule(call);
        log.setOldDatetime(oldDate);
        log.setNewDatetime(dto.getNewDatetime());
        log.setReason(dto.getReason());
        log.setRescheduledBy(
                SalesCallRescheduleLog.RescheduledByType.valueOf(dto.getRescheduledBy())
        );

        logRepo.save(log);

        return call;
    }

    // -------------------------------------
    // UPDATE STATUS (COMPLETED / NO_SHOW / CANCEL)
    // -------------------------------------
    public SalesCallSchedule updateStatus(CallStatusUpdateDTO dto) {

        SalesCallSchedule call = scheduleRepo.findById(dto.getCallID())
                .orElseThrow(() -> new RuntimeException("Call Not Found"));

        call.setStatus(SalesCallSchedule.CallStatus.valueOf(dto.getStatus()));

        if (dto.getActualCallDatetime() != null) {
            call.setActualCallDatetime(dto.getActualCallDatetime());
        }

        return scheduleRepo.save(call);
    }


@Transactional(readOnly = true)
public List<Map<String, Object>> listCalls(SalesCallFilterDTO filter) {
    try {

        StringBuilder sql = new StringBuilder("""
            SELECT 
                c.CallID,
                c.CreaterUserID,
                c.PublisherName,
                c.SalesUserID,
                c.ScheduledDatetime,
                c.ActualCallDatetime,
                c.status,
                c.reschedule_count,
                c.created_at,
                c.updated_at
            FROM SalesCallSchedule c
            WHERE 1 = 1
        """);

        List<Object> params = new ArrayList<>();

        // ---------- FILTERS ----------
        if (filter.getSalesUserID() != null) {
            sql.append(" AND c.SalesUserID = ? ");
            params.add(filter.getSalesUserID());
        }

        if (filter.getPublisherName() != null && !filter.getPublisherName().isEmpty()) {
            sql.append(" AND c.PublisherName LIKE ? ");
            params.add("%" + filter.getPublisherName() + "%");
        }

        if (filter.getStatus() != null && !filter.getStatus().isEmpty()) {
            sql.append(" AND c.status = ? ");
            params.add(filter.getStatus());
        }

        if (filter.getStartDate() != null && filter.getEndDate() != null) {
            sql.append(" AND DATE(c.ScheduledDatetime) BETWEEN ? AND ? ");
            params.add(filter.getStartDate());
            params.add(filter.getEndDate());
        }

        sql.append(" ORDER BY c.ScheduledDatetime DESC ");

        // ---------- MAIN QUERY ----------
        List<Map<String, Object>> calls =
                jdbcTemplate.queryForList(sql.toString(), params.toArray());

        // ---------- RESCHEDULE LOGS ----------
        for (Map<String, Object> call : calls) {
            Long callID = ((Number) call.get("CallID")).longValue();

            List<Map<String, Object>> logs = jdbcTemplate.queryForList(
                    """
                    SELECT 
                        r.OldDatetime,
                        r.NewDatetime,
                        r.RescheduledBy,
                        r.Reason,
                        r.CreatedAt
                    FROM Salescallreschedulelog r
                    WHERE r.CallID = ?
                    ORDER BY r.CreatedAt ASC
                    """,
                    callID
            );

            call.put("RescheduleLogs", logs);
        }

        return calls;

    } catch (Exception ex) {
        ex.printStackTrace();
        return Collections.emptyList();
    }
}



@Transactional(readOnly = true)
public SalesCallListResponseDTO listCalls(
        SalesCallFilterDTO filter,
        int page,
        int size,
        String sortBy,
        String sortDirection
) {

    int offset = (page - 1) * size;

    try {

        // ---------- BASE QUERY ----------
        StringBuilder sql = new StringBuilder("""
            SELECT 
                c.CallID,
                c.CreaterUserID,
                c.PublisherName,
                c.SalesUserID,
                c.ScheduledDatetime,
                c.ActualCallDatetime,
                c.status,
                c.reschedule_count,
                c.created_at,
                c.updated_at
            FROM SalesCallSchedule c
            WHERE 1 = 1
        """);

        StringBuilder countSql = new StringBuilder("""
            SELECT COUNT(*) 
            FROM SalesCallSchedule c
            WHERE 1 = 1
        """);

        List<Object> params = new ArrayList<>();
        List<Object> countParams = new ArrayList<>();

        // ---------- FILTERS ----------
        if (filter.getSalesUserID() != null) {
            sql.append(" AND c.SalesUserID = ? ");
            countSql.append(" AND c.SalesUserID = ? ");
            params.add(filter.getSalesUserID());
            countParams.add(filter.getSalesUserID());
        }

        if (filter.getPublisherName() != null && !filter.getPublisherName().isEmpty()) {
            sql.append(" AND c.PublisherName LIKE ? ");
            countSql.append(" AND c.PublisherName LIKE ? ");
            params.add("%" + filter.getPublisherName() + "%");
            countParams.add("%" + filter.getPublisherName() + "%");
        }

        if (filter.getStatus() != null && !filter.getStatus().isEmpty()) {
            sql.append(" AND c.status = ? ");
            countSql.append(" AND c.status = ? ");
            params.add(filter.getStatus());
            countParams.add(filter.getStatus());
        }

        if (filter.getStartDate() != null && filter.getEndDate() != null) {
            sql.append(" AND DATE(c.ScheduledDatetime) BETWEEN ? AND ? ");
            countSql.append(" AND DATE(c.ScheduledDatetime) BETWEEN ? AND ? ");
            params.add(filter.getStartDate());
            params.add(filter.getEndDate());
            countParams.add(filter.getStartDate());
            countParams.add(filter.getEndDate());
        }

        // ---------- SORT ----------
        sql.append(" ORDER BY c.")
                .append(sortBy)
                .append(" ")
                .append(sortDirection);

        // ---------- PAGINATION ----------
        sql.append(" LIMIT ? OFFSET ? ");
        params.add(size);
        params.add(offset);

        // ---------- EXECUTE ----------
        Long totalRecords = jdbcTemplate.queryForObject(
                countSql.toString(),
                Long.class,
                countParams.toArray()
        );

        List<Map<String, Object>> calls =
                jdbcTemplate.queryForList(sql.toString(), params.toArray());

        // ---------- RESCHEDULE LOGS ----------
        for (Map<String, Object> call : calls) {

            Long callID = ((Number) call.get("CallID")).longValue();

            List<Map<String, Object>> logs = jdbcTemplate.queryForList(
                    """
                    SELECT 
                        r.OldDatetime,
                        r.NewDatetime,
                        r.RescheduledBy,
                        r.Reason,
                        r.CreatedAt
                    FROM Salescallreschedulelog r
                    WHERE r.CallID = ?
                    ORDER BY r.CreatedAt ASC
                    """,
                    callID
            );

            call.put("RescheduleLogs", logs);
        }

        int totalPages = (int) Math.ceil((double) totalRecords / size);

        return SalesCallListResponseDTO.builder()
                .calls(calls)
                .currentPage(page)
                .pageSize(size)
                 .totalPages(totalPages)
                .totalRecords(totalRecords)
                .message("Call list fetched successfully")
                .status(true)
                .statusCode(200)
                .build();

    } catch (Exception e) {

        return SalesCallListResponseDTO.builder()
                .calls(Collections.emptyList())
                .currentPage(page)
                .pageSize(size)
                .totalPages(0)
                .totalRecords(0L)
                 .message("Error fetching list")
                .status(false)
                 .statusCode(500)
                .build();
    }
}


}
