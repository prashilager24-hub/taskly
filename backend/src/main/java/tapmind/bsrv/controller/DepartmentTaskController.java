package tapmind.bsrv.controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import tapmind.bsrv.dto.*;
import org.springframework.http.*;
import tapmind.bsrv.serviceNew.DepartmentTaskService;
import jakarta.validation.Valid;
import org.json.JSONObject;
@RestController
@RequestMapping("/t2.0/authentificationUtilization/departmentTasks")
public class DepartmentTaskController {

    @Autowired
    private DepartmentTaskService departmentTaskService;

    @PostMapping("/create")
    public DepartmentTaskResponseDTO createTask(@RequestBody DepartmentTaskRequestDTO request) {
        return departmentTaskService.createDepartmentTask(request);
    }

    @PostMapping(path = "/list", produces = MediaType.APPLICATION_JSON_VALUE)
public ResponseEntity<?> getAllDepartmentTasks(
        @Valid @RequestBody DepartmentTaskRequestDTOList request,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "modifiedAt") String sortBy) {

    try {
        DepartmentTaskListResponseDTO response = departmentTaskService.getAllDepartmentTasks(request, page, size, sortBy);
        return new ResponseEntity<>(response, HttpStatus.OK);
    } catch (Exception e) {
        e.printStackTrace();
        DepartmentTaskListResponseDTO errorResponse = new DepartmentTaskListResponseDTO();
        errorResponse.setStatus(false);
        errorResponse.setMessage(e.getMessage());
        return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}


 @PostMapping("/getTasksByDepartment")
    public ResponseEntity<String> getTasksByDepartment(@RequestBody String request) {
        JSONObject req = new JSONObject(request);
        Integer departmentId = req.getInt("departmentId");
        Integer roleId = req.has("roleId") ? req.getInt("roleId") : null;
        JSONObject response = departmentTaskService.getTasksByDepartmentId(departmentId, roleId);
        return ResponseEntity.ok(response.toString());
    }


      // ✅ Update Department Task
    @PutMapping("/update/{id}")
    public ResponseEntity<?> updateDepartmentTask(
            @PathVariable Integer id,
            @RequestBody DepartmentTaskRequestDTO requestDTO) {

        DepartmentTaskResponseDTO response = departmentTaskService.updateDepartmentTask(id, requestDTO);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{taskID}/status")
    public ResponseEntity<DepartmentTaskResponseDTO> updateTaskStatus(
            @PathVariable Integer taskID,
            @RequestParam Boolean isActive) {

        DepartmentTaskResponseDTO response = departmentTaskService.updateDepartmentTaskStatus(taskID, isActive);
        return ResponseEntity.status(response.getStatusCode()).body(response);
    }
}
