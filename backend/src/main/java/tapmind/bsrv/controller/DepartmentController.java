
package tapmind.bsrv.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.json.JSONObject;
import org.json.JSONArray;
import org.springframework.http.MediaType;
import jakarta.validation.Valid;
import tapmind.bsrv.serviceNew.DepartmentService;

import tapmind.bsrv.dto.*;
import java.time.LocalDateTime;
import java.util.List;
import tapmind.bsrv.model.DepartmentTarget;
import tapmind.bsrv.model.DepartmentTask;
import tapmind.bsrv.model.PrimaryDepartment;
import tapmind.bsrv.enums.Criteria;
import tapmind.bsrv.repository.DepartmentTargetRepository;
import tapmind.bsrv.repository.DepartmentTaskRepository;
import tapmind.bsrv.repository.PrimaryDepartmentRepository;

import java.util.HashMap;
import java.util.Map;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@RestController
public class DepartmentController {

    @Autowired
    private DepartmentService DepartmentService;

        @Autowired
    private DepartmentTargetRepository departmentTargetRepository;

      @Autowired
    private DepartmentTaskRepository departmentTaskRepository;

      @Autowired
    private PrimaryDepartmentRepository primaryDepartmentRepository;

    @PersistenceContext
    private EntityManager entityManager;



    @PostMapping(path = "/t2.0/authentificationUtilization/Department/list", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getAllDepartments(
            @Valid @RequestBody DepartmentRequestDTOList Department,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "RoleID") String sortBy) {
        try {
            DepartmentResponseDTOList response = DepartmentService.getAllDepartments(Department, page, size, sortBy);
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            DepartmentResponseDTOList errorResponse = new DepartmentResponseDTOList();
            errorResponse.setStatus(false);
            errorResponse.setMessage(e.getMessage());
            return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);   
        }
    }

 

    @PostMapping("/t2.0/authentificationUtilization/Department/create")
    public ResponseEntity<DepartmentResponseDTO> createDepartment(
            @Valid @RequestBody DepartmentRequestDTO requestDTO) {
        DepartmentResponseDTO response = new DepartmentResponseDTO();
        try {
            DepartmentResponseDTO createdRole = DepartmentService.createDepartment(requestDTO);
            return new ResponseEntity<>(createdRole, HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setMessage(e.getMessage());
            response.setTimestamp(LocalDateTime.now());
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


  @PostMapping("/t2.0/authentificationUtilization/Department/update/{id}")
public ResponseEntity<DepartmentResponseDTO> updateDepartment(
        @PathVariable("id") int id,
        @Valid @RequestBody DepartmentRequestDTO requestDTO) {

    DepartmentResponseDTO response = new DepartmentResponseDTO();

    try {
        DepartmentResponseDTO updatedDept = DepartmentService.updateDepartment(id, requestDTO);

        if (!updatedDept.isStatus()) {
            // Return appropriate status code from service
            HttpStatus status = switch (updatedDept.getStatusCode()) {
                case 404 -> HttpStatus.NOT_FOUND;
                case 409 -> HttpStatus.CONFLICT;
                default -> HttpStatus.BAD_REQUEST;
            };
            return new ResponseEntity<>(updatedDept, status);
        }

        // Success
        return new ResponseEntity<>(updatedDept, HttpStatus.OK);

    } catch (Exception e) {
        e.printStackTrace();
        response.setStatus(false);
        response.setStatusCode(500);
        response.setMessage("An unexpected error occurred while updating department: " + e.getMessage());
        response.setTimestamp(LocalDateTime.now());
        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}


    @PostMapping("/t2.0/authentificationUtilization/Department/status")
    public ResponseEntity<DepartmentResponseDTO> updateDepartmentStatus(
            @Valid @RequestBody DepartmentStatusRequestDTO requestDTO) {
        DepartmentResponseDTO response = new DepartmentResponseDTO();
        try {
            DepartmentResponseDTO updatedResponse = DepartmentService.updateDepartmentStatus(requestDTO);
            return new ResponseEntity<>(updatedResponse, HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage(e.getMessage());
            response.setTimestamp(LocalDateTime.now());
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

     

    @PostMapping("/t2.0/authentificationUtilization/Department/archive")
    public ResponseEntity<DepartmentResponseDTO> updateDepartmentArchive(
            @Valid @RequestBody DepartmentArchiveRequestDTO requestDTO) {
        DepartmentResponseDTO response = new DepartmentResponseDTO();
        try {
            DepartmentResponseDTO updatedResponse = DepartmentService.updateDepartmentArchive(requestDTO);
            return new ResponseEntity<>(updatedResponse, HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage(e.getMessage());
            response.setTimestamp(LocalDateTime.now());
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
   


@GetMapping("/t2.0/authentificationUtilization/Department/taskTarget/{departmentId}")
public ResponseEntity<?> getDepartmentTargetsAndTasks(@PathVariable Integer departmentId) {

    JSONObject response = new JSONObject();

    try {
        JSONArray targetsArray = new JSONArray();
        List<DepartmentTarget> targets = departmentTargetRepository.findByDepartment_DepartmentID(departmentId);

        if (targets != null && !targets.isEmpty()) {
            for (DepartmentTarget t : targets) {
                JSONObject obj = new JSONObject();
                obj.put("targetID", t.getTargetID());
                obj.put("targetName", t.getTargetName());
                targetsArray.put(obj);
            }
        }

        JSONArray tasksArray = new JSONArray();
        List<DepartmentTask> tasks = departmentTaskRepository.findTasksByDepartmentId(departmentId);

        if (tasks != null && !tasks.isEmpty()) {
            for (DepartmentTask task : tasks) {
                JSONObject obj = new JSONObject();
                obj.put("taskID", task.getTaskID());
                obj.put("taskName", task.getTaskName());
                tasksArray.put(obj);
            }
        }

        JSONObject result = new JSONObject();
        result.put("targets", targetsArray);
        result.put("tasks", tasksArray);

        response.put("status", "success");
        response.put("statusCode", 200);
        response.put("result", result);

    } catch (Exception e) {
        response.put("status", "error");
        response.put("statusCode", 500);
        response.put("result", "An error occurred: " + e.getMessage());
    }

    return ResponseEntity.ok(response.toString());
}

    // ========== Department Hierarchy ==========

    @GetMapping("/t2.0/authentificationUtilization/Department/hierarchy")
    public ResponseEntity<?> getDepartmentHierarchy() {
        try {
            List<DepartmentHierarchyDTO> hierarchy = DepartmentService.getDepartmentHierarchy();
            return ResponseEntity.ok(ApiResponse.ok("Department hierarchy retrieved successfully", hierarchy));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Failed to fetch department hierarchy: " + e.getMessage()));
        }
    }



    // ========== PrimaryDepartment CRUD ==========

    @PostMapping("/t2.0/authentificationUtilization/PrimaryDepartment/create")
    public ResponseEntity<?> createPrimaryDepartment(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();
        try {
            String name = (String) body.get("primaryDepartmentName");
            if (name == null || name.trim().isEmpty()) {
                response.put("status", false);
                response.put("statusCode", 400);
                response.put("message", "PrimaryDepartmentName is required");
                return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
            }

            if (primaryDepartmentRepository.findByPrimaryDepartmentName(name).isPresent()) {
                response.put("status", false);
                response.put("statusCode", 409);
                response.put("message", "Primary Department name already exists");
                return new ResponseEntity<>(response, HttpStatus.CONFLICT);
            }

            PrimaryDepartment pd = new PrimaryDepartment();
            pd.setPrimaryDepartmentName(name);
            pd.setActive(true);
            String type = (String) body.get("type");
            if (type != null) {
                pd.setType(type);
            }
            if (body.containsKey("goalCriteria")) {
                pd.setGoalCriteria(Criteria.valueOf(((String) body.get("goalCriteria")).toUpperCase()));
            }
            if (body.containsKey("targetCriteria")) {
                pd.setTargetCriteria(Criteria.valueOf(((String) body.get("targetCriteria")).toUpperCase()));
            }
            primaryDepartmentRepository.save(pd);

            response.put("status", true);
            response.put("statusCode", 200);
            response.put("message", "Primary Department created successfully");
            response.put("primaryDepartmentId", pd.getPrimaryDepartmentId());
            response.put("primaryDepartmentName", pd.getPrimaryDepartmentName());
            response.put("goalCriteria", pd.getGoalCriteria() != null ? pd.getGoalCriteria().name() : null);
            response.put("targetCriteria", pd.getTargetCriteria() != null ? pd.getTargetCriteria().name() : null);
            return new ResponseEntity<>(response, HttpStatus.OK);

        } catch (IllegalArgumentException e) {
            response.put("status", false);
            response.put("statusCode", 400);
            response.put("message", "Invalid criteria value. Allowed values: DAILY, WEEKLY, MONTHLY, QUARTERLY, COMBINED");
            return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            e.printStackTrace();
            response.put("status", false);
            response.put("statusCode", 500);
            response.put("message", "An unexpected error occurred: " + e.getMessage());
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/t2.0/authentificationUtilization/PrimaryDepartment/list")
    public ResponseEntity<?> getAllPrimaryDepartments() {
        Map<String, Object> response = new HashMap<>();
        try {
            List<PrimaryDepartment> list = primaryDepartmentRepository.findAll();
            response.put("status", true);
            response.put("statusCode", 200);
            response.put("message", "Primary Departments retrieved successfully");
            response.put("data", list);
            return new ResponseEntity<>(response, HttpStatus.OK);

        } catch (Exception e) {
            e.printStackTrace();
            response.put("status", false);
            response.put("statusCode", 500);
            response.put("message", "An unexpected error occurred: " + e.getMessage());
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/t2.0/authentificationUtilization/PrimaryDepartment/update/{id}")
    public ResponseEntity<?> updatePrimaryDepartment(
            @PathVariable("id") Long id,
            @RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();
        try {
            java.util.Optional<PrimaryDepartment> existingOpt = primaryDepartmentRepository.findById(id);
            if (existingOpt.isEmpty()) {
                response.put("status", false);
                response.put("statusCode", 404);
                response.put("message", "Primary Department not found");
                return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
            }

            PrimaryDepartment existing = existingOpt.get();
            String name = (String) body.get("primaryDepartmentName");
            if (name != null && !name.trim().isEmpty()) {
                existing.setPrimaryDepartmentName(name);
            }
            if (body.containsKey("isActive")) {
                existing.setActive((Boolean) body.get("isActive"));
            }
            if (body.containsKey("type")) {
                existing.setType((String) body.get("type"));
            }
            if (body.containsKey("goalCriteria")) {
                existing.setGoalCriteria(Criteria.valueOf(((String) body.get("goalCriteria")).toUpperCase()));
            }
            if (body.containsKey("targetCriteria")) {
                existing.setTargetCriteria(Criteria.valueOf(((String) body.get("targetCriteria")).toUpperCase()));
            }

            primaryDepartmentRepository.save(existing);

            response.put("status", true);
            response.put("statusCode", 200);
            response.put("message", "Primary Department updated successfully");
            response.put("primaryDepartmentId", existing.getPrimaryDepartmentId());
            response.put("primaryDepartmentName", existing.getPrimaryDepartmentName());
            response.put("isActive", existing.isActive());
            response.put("type", existing.getType());
            response.put("goalCriteria", existing.getGoalCriteria() != null ? existing.getGoalCriteria().name() : null);
            response.put("targetCriteria", existing.getTargetCriteria() != null ? existing.getTargetCriteria().name() : null);
            return new ResponseEntity<>(response, HttpStatus.OK);

        } catch (IllegalArgumentException e) {
            response.put("status", false);
            response.put("statusCode", 400);
            response.put("message", "Invalid criteria value. Allowed values: DAILY, WEEKLY, MONTHLY, QUARTERLY, COMBINED");
            return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            e.printStackTrace();
            response.put("status", false);
            response.put("statusCode", 500);
            response.put("message", "An unexpected error occurred: " + e.getMessage());
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/t2.0/authentificationUtilization/PrimaryDepartment/status")
    public ResponseEntity<?> updatePrimaryDepartmentStatus(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();
        try {
            Long id = body.get("primaryDepartmentId") != null
                    ? ((Number) body.get("primaryDepartmentId")).longValue() : null;
            Boolean isActive = (Boolean) body.get("isActive");

            if (id == null || isActive == null) {
                response.put("status", false);
                response.put("statusCode", 400);
                response.put("message", "primaryDepartmentId and isActive are required");
                return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
            }

            java.util.Optional<PrimaryDepartment> existingOpt = primaryDepartmentRepository.findById(id);
            if (existingOpt.isEmpty()) {
                response.put("status", false);
                response.put("statusCode", 404);
                response.put("message", "Primary Department not found");
                return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
            }

            PrimaryDepartment existing = existingOpt.get();
            existing.setActive(isActive);
            primaryDepartmentRepository.save(existing);

            response.put("status", true);
            response.put("statusCode", 200);
            response.put("message", "Primary Department status updated successfully");
            return new ResponseEntity<>(response, HttpStatus.OK);

        } catch (Exception e) {
            e.printStackTrace();
            response.put("status", false);
            response.put("statusCode", 500);
            response.put("message", "An unexpected error occurred: " + e.getMessage());
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }



}