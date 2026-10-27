
package tapmind.bsrv.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.serviceNew.MonthlyTargetStatusService;

import java.time.LocalDate;
import java.util.List;


@RestController
@RequestMapping("/t2.0/authentificationUtilization/monthly-targets")
public class MonthlyTargetController {

    @Autowired
    private MonthlyTargetStatusService monthlyTargetService;

    @PostMapping("/today/{departmentId}")
    public ResponseEntity<List<MonthlyTargetStatusDTO>> getTargetsForToday(
            @PathVariable Integer departmentId, @RequestBody MonthlyDepartmentTargetDTO monthlyDepartmentTargetDTO) {

        LocalDate today = monthlyDepartmentTargetDTO.getOpenDate();
        List<MonthlyTargetStatusDTO> result =
                monthlyTargetService.getTargetsForToday(departmentId, today);
        return ResponseEntity.ok(result);
    }
}
