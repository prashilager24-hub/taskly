package tapmind.bsrv.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.serviceNew.GoalEfficiencyService;
import tapmind.bsrv.serviceNew.GoalEfficiencyReportService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/goal-efficiency")
@RequiredArgsConstructor
public class GoalEfficiencyController {

    private final GoalEfficiencyService goalEfficiencyService;
    private final GoalEfficiencyReportService service;

    @PostMapping("/calculate")
    public ResponseEntity<GoalEfficiencyResponseWrapperDTO> calculate(
            @RequestBody GoalEfficiencyRequestDTO request) {

        return ResponseEntity.ok(
                goalEfficiencyService.calculate(request)
        );
    }

    @PostMapping("/list")
    public ResponseEntity<?> list(
            @RequestBody GoalEfficiencyFilterRequestDTO filter) {
        return ResponseEntity.ok(service.listGoalEfficiency(filter));
    }
}
