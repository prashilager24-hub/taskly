package tapmind.bsrv.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import tapmind.bsrv.dto.*;
import tapmind.bsrv.serviceNew.TACallService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/ta/calls")
@RequiredArgsConstructor
public class TACallController {

    private final TACallService service;

    @PostMapping("/create")
    public ResponseEntity<?> createCall(@RequestBody TACallCreateDTO dto) {
        return ResponseEntity.ok(service.createCall(dto));
    }

    @PostMapping("/reschedule")
    public ResponseEntity<?> reschedule(@RequestBody TACallRescheduleDTO dto) {
        return ResponseEntity.ok(service.rescheduleCall(dto));
    }

    @PostMapping("/update-status")
    public ResponseEntity<?> updateStatus(@RequestBody TACallStatusUpdateDTO dto) {
        return ResponseEntity.ok(service.updateStatus(dto));
    }

    @PostMapping("/list")
public ResponseEntity<?> list(
        @RequestBody TACallFilterDTO filter,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "scheduledDatetime") String sortBy,
        @RequestParam(defaultValue = "DESC") String sortDirection
) {

    // Excel export when page = 0
    if (page == 0 && size == 0) {
       return ResponseEntity.ok(service.listCalls(filter));
    }

    return ResponseEntity.ok(service.listCalls(filter, page, size, sortBy, sortDirection));
}

}
