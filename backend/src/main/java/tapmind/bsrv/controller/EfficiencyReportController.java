package tapmind.bsrv.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.serviceNew.EfficiencyReportService;

import java.util.*;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/")
@RequiredArgsConstructor
public class EfficiencyReportController {

    private final EfficiencyReportService efficiencyReportService;

  
//     @PostMapping("/report")
//     public ResponseEntity<Map<String, Object>> getEfficiencyReport(
//             @RequestBody EfficiencyReportRequest request) {
//         try {
//             Map<String, Object> result = efficiencyReportService.getEfficiencyAndUtilization(request);
//             return ResponseEntity.ok(result);
//         } catch (Exception e) {
//             return ResponseEntity
//                     .internalServerError()
//                     .body(Map.of(
//                             "status", false,
//                             "message", "Error generating report: " + e.getMessage()
//                     ));
//         }
//     }

//     @PostMapping("/update")
// public ResponseEntity<String> updateEfficiencySummary(@RequestBody String request) {
//     try {
//         JSONObject req=new JSONObject(request);
//          String workDateStr = req.optString("workDate", null);
//         LocalDate workDate = LocalDate.parse(workDateStr);
//         efficiencyReportService.updateEfficiencySummaryForDept28(
//               workDate
//         );
//         return ResponseEntity.ok("Efficiency summary updated successfully for Department " );
//     } catch (Exception e) {
//         return ResponseEntity.internalServerError()
//                 .body("Error while updating efficiency summary: " + e.getMessage());
//     }
// }

  @PostMapping("/list-efficiency-summary")
public ResponseEntity<?> listEfficiencySummary(@RequestBody EfficiencySummaryFilterRequest filter) {
    try {
      System.out.println(filter.getIsHeExecutiveLeader());
      
      boolean isEL = Boolean.TRUE.equals(filter.getIsHeExecutiveLeader());
      boolean hasDeptID = filter.getDepartmentID() != null && !filter.getDepartmentID().toString().trim().isEmpty();
      
      Map<String, Object> result;
      
      if (isEL && !hasDeptID) {
        // EL viewing all their departments
        result = efficiencyReportService.listEfficiencySummaryEl(filter);
      } else {
        // Normal flow: admin, EL with specific dept, or regular user
        result = efficiencyReportService.listEfficiencySummary(filter);
      }
      
        return ResponseEntity.ok(result);
    } catch (Exception e) {
        e.printStackTrace();
        return ResponseEntity.internalServerError()
                .body(Map.of("status", false, "message", e.getMessage()));
    }
}

@PostMapping("/download-efficiency-summary")
public ResponseEntity<byte[]> downloadEfficiencySummary(
        @RequestBody EfficiencySummaryFilterRequest filter) {

    try {
        byte[] file =
                efficiencyReportService.downloadEfficiencySummaryExcel(filter);

        return ResponseEntity.ok()
                .header("Content-Disposition",
                        "attachment; filename=Efficiency_Summary.xlsx")
                .body(file);

    } catch (Exception e) {
        e.printStackTrace();
        return ResponseEntity.internalServerError().build();
    }
}




}
