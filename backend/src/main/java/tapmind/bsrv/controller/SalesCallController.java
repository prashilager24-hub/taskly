package tapmind.bsrv.controller;
import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.serviceNew.SalesCallService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/sales/calls")
@RequiredArgsConstructor
public class SalesCallController {

    private final SalesCallService salesCallService;

    @PostMapping("/create")
    public ResponseEntity<?> createCall(@RequestBody SalesCallCreateDTO dto) {
        return ResponseEntity.ok(salesCallService.createCall(dto));
    }

    @PostMapping("/reschedule")
    public ResponseEntity<?> reschedule(@RequestBody SalesCallRescheduleDTO dto) {
        return ResponseEntity.ok(salesCallService.rescheduleCall(dto));
    }

    @PostMapping("/update-status")
    public ResponseEntity<?> updateStatus(@RequestBody CallStatusUpdateDTO dto) {
        return ResponseEntity.ok(salesCallService.updateStatus(dto));
    }

  @PostMapping("/list")
public ResponseEntity<?> listCalls(
        @RequestBody SalesCallFilterDTO filter,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "ScheduledDatetime") String sortBy,
        @RequestParam(defaultValue = "DESC") String sortDirection
) {

    //  Condition for Excel Export (Non-Pagination)
    if (page == 0 && size == 0) {
       return ResponseEntity.ok(salesCallService.listCalls(filter));
    }

    //  Regular paginated listing
    return ResponseEntity.ok(
            salesCallService.listCalls(filter, page, size, sortBy, sortDirection)
    );
}


}
