package tapmind.bsrv.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.serviceNew.EfficiencyServiceImpl;
import java.time.LocalDate;
import org.springframework.beans.factory.annotation.Autowired;
@RestController
@RequestMapping("/t2.0/authentificationUtilization/")
public class EfficiencyUtilizationController {

     @Autowired
    private  EfficiencyServiceImpl efficiencyService;

  
   
    // @GetMapping("calculate")
    // public ResponseEntity<String> calculateAndSaveEfficiencyUtilization(@RequestParam(required = true) LocalDate date) {
    //     try {
    //         efficiencyService.calculateAndSaveDailyEfficiency(date);
    //         return ResponseEntity.ok(" Efficiency and Utilization summary calculated and saved successfully.");
    //     } catch (Exception e) {
    //         e.printStackTrace();
    //         return ResponseEntity.internalServerError()
    //                 .body(" Error calculating efficiency/utilization: " + e.getMessage());
    //     }
    // }

        @GetMapping("calculateAll")
    public ResponseEntity<String> calculateAndSaveEfficiencyUtilization() {
        try {
            efficiencyService.calculateAndSaveDailyEfficiency();
            return ResponseEntity.ok(" Efficiency and Utilization summary calculated and saved successfully.");
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError()
                    .body(" Error calculating efficiency/utilization: " + e.getMessage());
        }
    }
}
