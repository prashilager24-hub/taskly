package tapmind.bsrv.controller;

import jakarta.validation.Valid;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.ApiResponse;
import tapmind.bsrv.dto.DashBoardFilter;
import tapmind.bsrv.dto.GoalRequest;
import tapmind.bsrv.dto.GoalResponse;
import tapmind.bsrv.serviceNew.DashBoardService;
import tapmind.bsrv.serviceNew.GoalService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/")
@CrossOrigin
public class DashBoardController {

  @Autowired private DashBoardService lDashBoardService;
  @Autowired private GoalService goalService;

  @PostMapping("/DashBoard")
  public ResponseEntity<?> getEfficiencySummary(@RequestBody DashBoardFilter filter) {

    List<Map<String, Object>> result = lDashBoardService.listEfficiencySummary(filter);

    return ResponseEntity.ok(result);
  }

  @PostMapping("/DashBoardAll")
  public ResponseEntity<?> listEfficiencySummaryNewData(@RequestBody DashBoardFilter filter) {

    Map<String, Object> result = lDashBoardService.listEfficiencySummaryNewData(filter);

    return ResponseEntity.ok(result);
  }

  @PostMapping("/DashBoardAll/download/excel")
  public ResponseEntity<byte[]> downloadExcel(@RequestBody DashBoardFilter filter)
      throws IOException {

    byte[] file = lDashBoardService.downloadEfficiencySummaryExcel(filter);

    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=Efficiency-Summary.xlsx")
        .contentType(
            MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        .body(file);
  }
}
