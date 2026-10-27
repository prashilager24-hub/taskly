// package tapmind.bsrv.controller;

// import org.springframework.beans.factory.annotation.Autowired;
// import org.springframework.http.ResponseEntity;
// import org.springframework.web.bind.annotation.*;

// import tapmind.bsrv.dto.PmsGoalsDTO;
// import tapmind.bsrv.model.PmsGoals;
// import tapmind.bsrv.serviceNew.PmsGoalsService;

// import java.util.List;

// @RestController
// @RequestMapping("/t2.0/authentificationUtilization/PmsGoals")
// @CrossOrigin
// public class PmsGoalsController {

// @Autowired
// private PmsGoalsService service;

// // Save goals (bulk)
// @PostMapping("/save")
// public ResponseEntity<?> saveGoals(@RequestBody List<PmsGoalsDTO> dtos) {
// return ResponseEntity.ok(service.saveGoals(dtos));
// }

// // Fetch goals
// @GetMapping
// public ResponseEntity<?> getGoals(
// @RequestParam Integer userId,
// @RequestParam String quarter,
// @RequestParam Integer year) {

// return ResponseEntity.ok(service.getGoals(userId, quarter, year));
// }
// }