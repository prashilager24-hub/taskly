package tapmind.bsrv.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.AdminResponse;
import tapmind.bsrv.dto.AdminTicketCreateRequest;
import tapmind.bsrv.dto.AdminTicketUpdateRequest;
import tapmind.bsrv.serviceNew.AdminService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/adminTickets")
public class AdminController {
  @Autowired private AdminService service;

  @PostMapping("/create")
  public AdminResponse create(@RequestBody AdminTicketCreateRequest req) {
    return service.create(req);
  }

  @GetMapping("/list")
  public ResponseEntity<?> list(
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int size,
      @RequestParam(defaultValue = "ticketID") String sortBy,
      @RequestParam(defaultValue = "ASC") String sortDirection,
      @RequestParam(defaultValue = "0") Integer userId) {

    // Return ALL records (no pagination)
    if (page == 0 && size == 0) {
      return ResponseEntity.ok(service.listAll(userId));
    }

    // Return paginated results
    return ResponseEntity.ok(service.listAll(page, size, sortBy, sortDirection));
  }

  @PutMapping("/update")
  public AdminResponse update(@RequestBody AdminTicketUpdateRequest req) {
    return service.update(req);
  }
}
