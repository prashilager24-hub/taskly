package tapmind.bsrv.controller;

import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.PositionCreateRequest;
import tapmind.bsrv.dto.PositionResponse;
import tapmind.bsrv.dto.PositionUpdateRequest;
import tapmind.bsrv.serviceNew.JobPositionService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/positions")
public class JobPositionController {

  @Autowired
  private JobPositionService service;

  @PostMapping("/create")
  public PositionResponse create(@RequestBody PositionCreateRequest req) {
    return service.create(req);
  }

  @GetMapping("/list")
  public ResponseEntity<?> list(
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int size,
      @RequestParam(defaultValue = "positionID") String sortBy,
      @RequestParam(defaultValue = "ASC") String sortDirection,
      @RequestParam(defaultValue = "0") Integer userId,
      @RequestParam(defaultValue = "all") String status) {

    if (page == 0 && size == 0) {
      return ResponseEntity.ok(service.listAll(userId, status));
    }

    return ResponseEntity.ok(service.listAll(page, size, sortBy, sortDirection, status));
  }

  @PutMapping("/update")
  public PositionResponse update(@RequestBody PositionUpdateRequest req) {
    return service.update(req);
  }
}
