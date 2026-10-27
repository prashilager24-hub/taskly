package tapmind.bsrv.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.json.JSONObject;
import jakarta.validation.Valid;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.serviceNew.DepartmentTargetService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/departmentTargets")
public class DepartmentTargetController {

    @Autowired
    private DepartmentTargetService departmentTargetService;

    // ✅ CREATE Department Target
    @PostMapping("/create")
    public ResponseEntity<DepartmentTargetResponseDTO> createDepartmentTarget(
            @Valid @RequestBody DepartmentTargetRequestDTO request) {
        DepartmentTargetResponseDTO response = departmentTargetService.createDepartmentTarget(request);
        return ResponseEntity.status(response.getStatusCode()).body(response);
    }

    // ✅ UPDATE Department Target
    @PutMapping("/update/{targetID}")
    public ResponseEntity<DepartmentTargetResponseDTO> updateDepartmentTarget(
            @PathVariable Integer targetID,
            @RequestBody DepartmentTargetRequestDTO request) {
        DepartmentTargetResponseDTO response = departmentTargetService.updateDepartmentTarget(targetID, request);
        return ResponseEntity.status(response.getStatusCode()).body(response);
    }

    // ✅ UPDATE Target Status (Activate/Deactivate)
    @PutMapping("/{targetID}/status")
    public ResponseEntity<DepartmentTargetResponseDTO> updateTargetStatus(
            @PathVariable Integer targetID,
            @RequestParam Boolean isActive) {
        DepartmentTargetResponseDTO response = departmentTargetService.updateDepartmentTargetStatus(targetID, isActive);
        return ResponseEntity.status(response.getStatusCode()).body(response);
    }

    // ✅ GET Targets by Department ID
    @PostMapping("/getTargetsByDepartment")
    public ResponseEntity<String> getTargetsByDepartment(@RequestBody String request) {
        JSONObject req = new JSONObject(request);
        Integer departmentId = req.optInt("departmentId", 0);
        Integer roleId = req.optInt("roleId", 0);
        JSONObject response = departmentTargetService.getTargetsByDepartmentId(departmentId, roleId);
        return ResponseEntity.status(response.optInt("statusCode", 500)).body(response.toString());
    }

    // ✅ LIST all Department Targets (with optional pagination)
    @PostMapping(path = "/list", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<DepartmentTargetListResponseDTO> listDepartmentTargets(
            @Valid @RequestBody DepartmentTargetRequestDTOList request,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "modifiedAt") String sortBy) {

        DepartmentTargetListResponseDTO response = departmentTargetService.getAllDepartmentTargets(request, page, size, sortBy);
        return ResponseEntity.status(response.getStatusCode()).body(response);
    }
}
