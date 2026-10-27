package tapmind.bsrv.serviceNew;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.model.Department;
import tapmind.bsrv.model.DepartmentTask;
import tapmind.bsrv.repository.DepartmentRepository;
import tapmind.bsrv.repository.DepartmentTaskRepository;
import org.springframework.transaction.annotation.Transactional;
import java.time.ZoneId;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import java.sql.Timestamp;
import java.math.BigDecimal;
import org.json.JSONObject;
import org.json.JSONArray;
import org.springframework.dao.DataAccessException;

@Service
public class DepartmentTaskService {

    @Autowired
    private DepartmentTaskRepository departmentTaskRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    public DepartmentTaskResponseDTO createDepartmentTask(DepartmentTaskRequestDTO request) {
        DepartmentTaskResponseDTO response = new DepartmentTaskResponseDTO();
        try {
            Optional<Department> dept = departmentRepository.findById(request.getDepartmentID());
            if (dept.isEmpty()) {
                response.setStatus(false);
                response.setStatusCode(404);
                response.setMessage("Department not found");
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            DepartmentTask task = new DepartmentTask();
            task.setDepartment(dept.get());
            task.setTaskName(request.getTaskName());
            task.setStandardTimeMins(request.getStandardTimeMins());
            task.setFrequency(request.getFrequency());
            task.setIsDynamic(request.getIsDynamic());
            task.setDescription(request.getDescription());
            task.setIsActive(true);
            task.setIsForTarget(request.getIsForTarget());
            task.setTargetNumber(request.getTargetNumber());
            task.setTimingType(request.getTimingType());
            task.setRoleID(request.getRoleID());

            departmentTaskRepository.save(task);

            Map<String, Object> data = new HashMap<>();
            data.put("taskID", task.getTaskID());
            data.put("taskName", task.getTaskName());
            data.put("departmentID", task.getDepartment().getDepartmentID());

            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("Task created successfully");
            response.setTimestamp(LocalDateTime.now());
            response.setResponse(data);
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error creating department task");
            response.setTimestamp(LocalDateTime.now());
        }
        return response;
    }

    public JSONObject getTasksByDepartmentId(Integer departmentId, Integer roleId) {
        JSONObject response = new JSONObject();

        try {
            List<DepartmentTask> tasks;
            // if (roleId != null && roleId > 0) {
            // tasks =
            // departmentTaskRepository.findTasksByDepartmentIdAndRoleId(departmentId,
            // roleId);
            // } else {
            // }
            tasks = departmentTaskRepository.findTasksByDepartmentId(departmentId);

            if (tasks == null || tasks.isEmpty()) {
                response.put("status", "error");
                response.put("statusCode", 404);
                response.put("result", "No tasks found for DepartmentID: " + departmentId);
            } else {
                JSONArray resultArray = new JSONArray();

                for (DepartmentTask task : tasks) {
                    JSONObject taskObj = new JSONObject();
                    taskObj.put("taskID", task.getTaskID());
                    taskObj.put("departmentID", task.getDepartment().getDepartmentID());
                    taskObj.put("taskName", task.getTaskName());
                    taskObj.put("standardTimeMins", task.getStandardTimeMins());
                    taskObj.put("frequency", task.getFrequency());
                    taskObj.put("timingType", task.getTimingType());
                    taskObj.put("isDynamic", task.getIsDynamic());
                    taskObj.put("description", task.getDescription());
                    taskObj.put("isForTarget", task.getIsForTarget());
                    taskObj.put("targetNumber", task.getTargetNumber());
                    taskObj.put("roleID", task.getRoleID());
                    taskObj.put("isActive", task.getIsActive());
                    taskObj.put("createdAt", task.getCreatedAt());
                    taskObj.put("modifiedAt", task.getModifiedAt());
                    resultArray.put(taskObj);
                }

                response.put("status", "success");
                response.put("statusCode", 200);
                response.put("result", resultArray);
            }

        } catch (Exception e) {
            response.put("status", "error");
            response.put("statusCode", 500);
            response.put("result", "An error occurred: " + e.getMessage());
        }

        return response;
    }

    public DepartmentTaskListResponseDTO getAllDepartmentTasks(
            DepartmentTaskRequestDTOList request,
            Integer page,
            Integer size,
            String sortBy) {

        DepartmentTaskListResponseDTO response = new DepartmentTaskListResponseDTO();

        try {
            // 🔹 Extract filters
            String searchText = request.getSearchText();
            String filter = request.getFilter();
            String startDate = request.getStartDate();
            String endDate = request.getEndDate();

            // 🔹 Define task status based on filter
            Boolean taskStatus = null;
            if (filter != null) {
                switch (filter) {
                    case "Active":
                        taskStatus = true;
                        break;
                    case "Inactive":
                        taskStatus = false;
                        break;
                }
            }

            // 🔹 Sorting configuration
            String sortingField = (sortBy != null && sortBy.equalsIgnoreCase("modifiedAt"))
                    ? "ModifiedAt"
                    : "TaskID";
            Sort sort = Sort.by(Sort.Direction.DESC, sortingField);

            List<DepartmentTaskDTO> taskDTOs;

            // ✅ Paginated case
            if (page != null && size != null && page > 0 && size > 0) {
                Pageable pageable = PageRequest.of(page - 1, size, sort);

                Page<Object[]> taskPage = departmentTaskRepository.findAllTasksFiltered(
                        searchText, filter, startDate, endDate, pageable);

                List<Object[]> pageContent = taskPage.getContent();

                taskDTOs = pageContent.stream().map(objects -> {
                    Timestamp createdTs = (Timestamp) objects[8];
                    Timestamp modifiedTs = (Timestamp) objects[9];

                    return new DepartmentTaskDTO(
                            (Integer) objects[0], // TaskID
                            (Integer) objects[1], // DepartmentID
                            (String) objects[2], // TaskName
                            (BigDecimal) objects[3], // StandardTimeMins
                            (String) objects[4], // Frequency
                            (Boolean) objects[5], // IsDynamic
                            (String) objects[6], // Description
                            (Boolean) objects[7], // IsActive
                            createdTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                            modifiedTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                            (String) objects[10],
                            (Boolean) objects[11],
                            (Integer) objects[12],
                            (String) objects[13], // TimingType
                            (Integer) objects[14] // RoleID

                    );
                }).collect(Collectors.toList());

                DepartmentTaskListResponseDTO.TaskReadResponse resp = new DepartmentTaskListResponseDTO.TaskReadResponse();
                resp.setTasks(taskDTOs);
                resp.setCurrentPage(page);
                resp.setPageSize(size);
                resp.setTotalRecords((int) taskPage.getTotalElements());
                resp.setTotalPages(taskPage.getTotalPages());

                response.setResponse(resp);
                response.setStatus(true);
                response.setStatusCode(200);
                response.setMessage("Department tasks retrieved successfully");

            } else {
                // ✅ No pagination case
                List<Object[]> allTasks = departmentTaskRepository.findAllTasksFilteredNoPagination(
                        searchText, filter, startDate, endDate, sortBy);

                taskDTOs = allTasks.stream().map(objects -> {
                    Timestamp createdTs = (Timestamp) objects[8];
                    Timestamp modifiedTs = (Timestamp) objects[9];

                    return new DepartmentTaskDTO(
                            (Integer) objects[0],
                            (Integer) objects[1],
                            (String) objects[2],
                            (BigDecimal) objects[3],
                            (String) objects[4],
                            (Boolean) objects[5],
                            (String) objects[6],
                            (Boolean) objects[7],
                            createdTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                            modifiedTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                            (String) objects[10],
                            (Boolean) objects[11],
                            (Integer) objects[12],
                            (String) objects[13], // TimingType
                            (Integer) objects[14] // RoleID
                    );
                }).collect(Collectors.toList());

                DepartmentTaskListResponseDTO.TaskReadResponse resp = new DepartmentTaskListResponseDTO.TaskReadResponse();
                resp.setTasks(taskDTOs);
                resp.setTotalRecords(taskDTOs.size());
                resp.setCurrentPage(1);
                resp.setTotalPages(1);

                response.setResponse(resp);
                response.setStatus(true);
                response.setStatusCode(200);
                response.setMessage("All department tasks retrieved successfully");
            }

        } catch (DataAccessException dae) {
            dae.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(900);
            response.setMessage("Database error occurred. Please try again later.");
            response.setTimestamp(LocalDateTime.now());

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Unexpected error occurred while listing department tasks.");
            response.setTimestamp(LocalDateTime.now());
        }

        return response;
    }

    /*
     * public JSONObject getTasksByDepartmentId(Integer departmentId) {
     * JSONObject response = new JSONObject();
     * 
     * try {
     * List<DepartmentTaskProjection> tasks =
     * departmentTaskRepository.findTasksByDepartmentId(departmentId);
     * 
     * if (tasks == null || tasks.isEmpty()) {
     * response.put("status", "error");
     * response.put("statusCode", 404);
     * response.put("result", "No tasks found for DepartmentID: " + departmentId);
     * } else {
     * JSONArray resultArray = new JSONArray();
     * 
     * for (DepartmentTaskProjection task : tasks) {
     * JSONObject taskObj = new JSONObject();
     * taskObj.put("taskID", task.getTaskID());
     * taskObj.put("taskName", task.getTaskName());
     * resultArray.put(taskObj);
     * }
     * 
     * response.put("status", "success");
     * response.put("statusCode", 200);
     * response.put("result", resultArray);
     * }
     * 
     * } catch (Exception e) {
     * response.put("status", "error");
     * response.put("statusCode", 500);
     * response.put("result", "An error occurred: " + e.getMessage());
     * }
     * 
     * return response;
     * }
     * 
     */
    @Transactional
    public DepartmentTaskResponseDTO updateDepartmentTask(Integer taskID, DepartmentTaskRequestDTO request) {
        DepartmentTaskResponseDTO response = new DepartmentTaskResponseDTO();
        try {
            Optional<DepartmentTask> existingTaskOpt = departmentTaskRepository.findById(taskID);
            if (existingTaskOpt.isEmpty()) {
                response.setStatus(false);
                response.setStatusCode(404);
                response.setMessage("Task not found with ID: " + taskID);
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            DepartmentTask existingTask = existingTaskOpt.get();

            // Validate department if provided in request
            if (request.getDepartmentID() != null) {
                Optional<Department> dept = departmentRepository.findById(request.getDepartmentID());
                if (dept.isEmpty()) {
                    response.setStatus(false);
                    response.setStatusCode(404);
                    response.setMessage("Department not found");
                    response.setTimestamp(LocalDateTime.now());
                    return response;
                }
                existingTask.setDepartment(dept.get());
            }

            // Map updatable fields from DTO to entity
            existingTask.setTaskName(request.getTaskName());
            existingTask.setStandardTimeMins(request.getStandardTimeMins());
            existingTask.setFrequency(
                    request.getFrequency());
            existingTask.setIsDynamic(request.getIsDynamic());
            existingTask.setDescription(request.getDescription());
            existingTask.setModifiedAt(new Date());
            existingTask.setIsForTarget(request.getIsForTarget());
            existingTask.setTargetNumber(request.getTargetNumber());
            existingTask.setTimingType(request.getTimingType());
            existingTask.setRoleID(request.getRoleID());

            departmentTaskRepository.save(existingTask);

            // Prepare response body
            Map<String, Object> data = new HashMap<>();
            data.put("taskID", existingTask.getTaskID());
            data.put("taskName", existingTask.getTaskName());
            data.put("departmentID", existingTask.getDepartment().getDepartmentID());
            data.put("updatedAt", existingTask.getModifiedAt());

            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("Task updated successfully");
            response.setTimestamp(LocalDateTime.now());
            response.setResponse(data);

        } catch (IllegalArgumentException e) {
            // Frequency enum parsing error
            response.setStatus(false);
            response.setStatusCode(400);
            response.setMessage("Invalid frequency value provided");
            response.setTimestamp(LocalDateTime.now());
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error updating department task");
            response.setTimestamp(LocalDateTime.now());
        }

        return response;
    }

    @Transactional
    public DepartmentTaskResponseDTO updateDepartmentTaskStatus(Integer taskID, Boolean isActive) {
        DepartmentTaskResponseDTO response = new DepartmentTaskResponseDTO();
        try {
            Optional<DepartmentTask> taskOpt = departmentTaskRepository.findById(taskID);
            if (taskOpt.isEmpty()) {
                response.setStatus(false);
                response.setStatusCode(404);
                response.setMessage("Task not found with ID: " + taskID);
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            DepartmentTask task = taskOpt.get();
            task.setIsActive(isActive);
            task.setModifiedAt(new Date());
            departmentTaskRepository.save(task);

            // Build response data
            Map<String, Object> data = new HashMap<>();
            data.put("taskID", task.getTaskID());
            data.put("taskName", task.getTaskName());
            data.put("status", task.getIsActive() ? "Active" : "Inactive");
            data.put("updatedAt", task.getModifiedAt());

            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("Task status updated successfully");
            response.setTimestamp(LocalDateTime.now());
            response.setResponse(data);
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error updating task status");
            response.setTimestamp(LocalDateTime.now());
        }
        return response;
    }

    // // ✅ Get all tasks by department
    // public List<DepartmentTask> getTasksByDepartment(Integer departmentID) {
    // return departmentTaskRepository.findByDepartment_DepartmentID(departmentID);
    // }
}
