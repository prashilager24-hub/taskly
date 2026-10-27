package tapmind.bsrv.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.json.JSONObject;
import jakarta.validation.Valid;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.model.Department;
import tapmind.bsrv.serviceNew.DepartmentGoalService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/departmentGoals")
public class DepartmentGoalController {

        @Autowired
        private DepartmentGoalService departmentGoalService;

        // ✅ CREATE GOAL
        @PostMapping("/create")
        public ResponseEntity<DepartmentGoalResponseDTO> createDepartmentGoal(
                        @Valid @RequestBody DepartmentGoalRequestDTO request) {

                DepartmentGoalResponseDTO response = departmentGoalService.createDepartmentGoal(request);

                return ResponseEntity.status(response.getStatusCode()).body(response);
        }

        // ✅ UPDATE GOAL
        @PutMapping("/update/{goalID}")
        public ResponseEntity<DepartmentGoalResponseDTO> updateDepartmentGoal(
                        @PathVariable Integer goalID,
                        @RequestBody DepartmentGoalRequestDTO request) {

                DepartmentGoalResponseDTO response = departmentGoalService.updateDepartmentGoal(goalID, request);

                return ResponseEntity.status(response.getStatusCode()).body(response);
        }

        // ✅ ACTIVATE / DEACTIVATE
        @PutMapping("/{goalID}/status")
        public ResponseEntity<DepartmentGoalResponseDTO> updateGoalStatus(
                        @PathVariable Integer goalID,
                        @RequestParam Boolean isActive) {

                DepartmentGoalResponseDTO response = departmentGoalService.updateDepartmentGoalStatus(goalID, isActive);

                return ResponseEntity.status(response.getStatusCode()).body(response);
        }

        // ✅ GET BY DEPARTMENT
        @PostMapping("/getGoalsByDepartment")
        public ResponseEntity<String> getGoalsByDepartment(
                        @RequestBody String request) {

                JSONObject req = new JSONObject(request);
                Integer departmentId = req.optInt("departmentId", 0);
                Integer roleId = req.optInt("roleId", 0);

                JSONObject response = departmentGoalService.getGoalsByDepartmentId(departmentId, roleId);

                return ResponseEntity
                                .status(response.optInt("statusCode", 500))
                                .body(response.toString());
        }

        @PutMapping("/approve")
        public ResponseEntity<DepartmentGoalResponseDTO> approveGoals(
                        @RequestBody DepartmentGoalApproveRequestDTO request) {

                DepartmentGoalResponseDTO response = departmentGoalService.approveGoals(request);

                return ResponseEntity.status(response.getStatusCode()).body(response);
        }

        // ✅ LIST (pagination)
        @PostMapping(value = "/list", produces = MediaType.APPLICATION_JSON_VALUE)
        public ResponseEntity<DepartmentGoalListResponseDTO> listDepartmentGoals(
                        @Valid @RequestBody DepartmentGoalRequestDTOList request,
                        @RequestParam(defaultValue = "1") int page,
                        @RequestParam(defaultValue = "10") int size,
                        @RequestParam(defaultValue = "modifiedAt") String sortBy) {

                DepartmentGoalListResponseDTO response = departmentGoalService.getAllDepartmentGoals(
                                request, page, size, sortBy);

                return ResponseEntity.status(response.getStatusCode()).body(response);
        }
}
