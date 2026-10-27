package tapmind.bsrv.serviceNew;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.model.User;
import tapmind.bsrv.repository.UserRepository;
import tapmind.bsrv.dto.DepartmentGoalDTO;
import tapmind.bsrv.dto.DepartmentGoalListResponseDTO;
import tapmind.bsrv.dto.DepartmentGoalRequestDTO;
import tapmind.bsrv.dto.DepartmentGoalRequestDTOList;
import tapmind.bsrv.dto.DepartmentGoalResponseDTO;
import tapmind.bsrv.dto.DepartmentGoalApproveRequestDTO;
import tapmind.bsrv.model.Department;
import tapmind.bsrv.model.DepartmentGoal;

import tapmind.bsrv.repository.DepartmentGoalRepository;
import tapmind.bsrv.repository.DepartmentRepository;
import tapmind.bsrv.repository.UserGoalDataRepository;

import org.json.JSONArray;
import org.json.JSONObject;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class DepartmentGoalService {
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private DepartmentGoalRepository goalRepository;
    @Autowired
    private UserGoalDataRepository userGoalDataRepository;
    @Autowired
    private DepartmentRepository departmentRepository;

    // ✅ CREATE
    @Transactional
    public DepartmentGoalResponseDTO createDepartmentGoal(
            DepartmentGoalRequestDTO request) {

        DepartmentGoalResponseDTO response = new DepartmentGoalResponseDTO();

        try {
            Optional<Department> dept = departmentRepository.findById(request.getDepartmentID());

            if (dept.isEmpty()) {
                response.setStatus(false);
                response.setStatusCode(404);
                response.setMessage("Department not found");
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            DepartmentGoal goal = new DepartmentGoal();
            goal.setDepartment(dept.get());
            goal.setGoalName(request.getGoalName());
            goal.setGoalMetric(request.getGoalMetric());
            goal.setLiveAccounts(
                    request.getLiveAccounts() != null
                            ? request.getLiveAccounts()
                            : 0);
            goal.setMetricValue(request.getMetricValue());
            goal.setUnit(request.getUnit());
            goal.setFrequency(request.getFrequency());
            goal.setTimingType(request.getTimingType());
            goal.setIsDynamic(request.getIsDynamic());
            goal.setDescription(request.getDescription());
            goal.setIsActive(true);
            goal.setRoleID(request.getRoleID());

            goalRepository.save(goal);

            Map<String, Object> data = new HashMap<>();
            data.put("goalID", goal.getGoalID());
            data.put("departmentID", goal.getDepartment().getDepartmentID());

            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("Department goal created successfully");
            response.setTimestamp(LocalDateTime.now());
            response.setResponse(data);

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error creating department goal");
            response.setTimestamp(LocalDateTime.now());
        }
        return response;
    }

    // UPDATE
    @Transactional
    public DepartmentGoalResponseDTO updateDepartmentGoal(
            Integer goalID, DepartmentGoalRequestDTO request) {

        DepartmentGoalResponseDTO response = new DepartmentGoalResponseDTO();

        try {
            Optional<DepartmentGoal> opt = goalRepository.findById(goalID);

            if (opt.isEmpty()) {
                response.setStatus(false);
                response.setStatusCode(404);
                response.setMessage("Goal not found with ID: " + goalID);
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            DepartmentGoal goal = opt.get();

            if (request.getDepartmentID() != null) {
                Department dept = departmentRepository
                        .findById(request.getDepartmentID())
                        .orElseThrow();
                goal.setDepartment(dept);
            }

            goal.setGoalName(request.getGoalName());
            goal.setGoalMetric(request.getGoalMetric());
            goal.setLiveAccounts(
                    request.getLiveAccounts() != null
                            ? request.getLiveAccounts()
                            : 0);
            goal.setMetricValue(request.getMetricValue());
            goal.setUnit(request.getUnit());
            goal.setFrequency(request.getFrequency());
            goal.setTimingType(request.getTimingType());
            goal.setIsDynamic(request.getIsDynamic());
            goal.setDescription(request.getDescription());
            goal.setIsActive(request.getIsActive());
            goal.setModifiedAt(new Date());
            goal.setRoleID(request.getRoleID());

            goalRepository.save(goal);

            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("Department goal updated successfully");
            response.setTimestamp(LocalDateTime.now());

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error updating department goal");
            response.setTimestamp(LocalDateTime.now());
        }
        return response;
    }

    // ✅ STATUS
    @Transactional
    public DepartmentGoalResponseDTO updateDepartmentGoalStatus(
            Integer goalID, Boolean isActive) {

        DepartmentGoalResponseDTO response = new DepartmentGoalResponseDTO();

        DepartmentGoal goal = goalRepository.findById(goalID).orElse(null);

        if (goal == null) {
            response.setStatus(false);
            response.setStatusCode(404);
            response.setMessage("Goal not found");
            response.setTimestamp(LocalDateTime.now());
            return response;
        }

        goal.setIsActive(isActive);
        goal.setModifiedAt(new Date());
        goalRepository.save(goal);

        response.setStatus(true);
        response.setStatusCode(200);
        response.setMessage("Goal status updated successfully");
        response.setTimestamp(LocalDateTime.now());

        return response;
    }

    // ✅ GET GOALS BY DEPARTMENT OR ADMIN
    public JSONObject getGoalsByDepartmentId(Integer departmentId, Integer roleId) {

        JSONObject response = new JSONObject();

        List<DepartmentGoal> goals;

        // ✅ ADMIN MODE
        if (departmentId == null || departmentId == 0) {
            goals = goalRepository.findByDepartment_Admin();
        }
        // ✅ DEPARTMENT + ROLE MODE
        else if (roleId != null && roleId > 0) {
            goals = goalRepository.findByDepartmentAndRoleID(departmentId, roleId);
        }
        // ✅ DEPARTMENT MODE
        else {
            goals = goalRepository.findByDepartment_DepartmentID(departmentId);
        }

        if (goals == null || goals.isEmpty()) {
            response.put("statusCode", 404);
            response.put("status", "error");
            response.put("result", "No goals found");
            return response;
        }

        JSONArray arr = new JSONArray();

        for (DepartmentGoal g : goals) {
            JSONObject obj = new JSONObject();
            obj.put("goalID", g.getGoalID());
            obj.put("goalName", g.getGoalName());
            obj.put("goalMetric", g.getGoalMetric());
            if (g.getDepartment().getDepartmentID() == 1
                    && g.getGoalID() == 65) {

                BigDecimal last7DaysSum = userGoalDataRepository.getLast7DaysAchievedGoalSumByDepartment(
                        1,
                        LocalDate.now().minusDays(7),
                        LocalDate.now().minusDays(1));

                BigDecimal metricValue = last7DaysSum
                        .multiply(BigDecimal.valueOf(1.05))
                        .setScale(2, RoundingMode.HALF_UP);

                obj.put("metricValue", metricValue.toPlainString());

            } else {
                obj.put("metricValue", g.getMetricValue());
            }
            obj.put("unit", g.getUnit());
            obj.put("frequency", g.getFrequency());
            obj.put("timingType", g.getTimingType());
            obj.put("isDynamic", g.getIsDynamic());
            obj.put("isActive", g.getIsActive());
            obj.put("roleID", g.getRoleID());
            arr.put(obj);
        }

        response.put("statusCode", 200);
        response.put("status", "success");
        response.put("result", arr);

        return response;
    }

    // ✅ LIST WITH PAGINATION
    public DepartmentGoalListResponseDTO getAllDepartmentGoals(
            DepartmentGoalRequestDTOList request,
            Integer page,
            Integer size,
            String sortBy) {

        DepartmentGoalListResponseDTO response = new DepartmentGoalListResponseDTO();

        // ✅ DEFAULT VALUES (VERY IMPORTANT)
        response.setStatus(true);
        response.setStatusCode(200);
        response.setMessage("Department goals retrieved successfully");

        try {

            String searchText = request.getSearchText();
            String filter = request.getFilter();
            String startDate = request.getStartDate();
            String endDate = request.getEndDate();

            // ✅ Sorting
            String sortingField = (sortBy != null && sortBy.equalsIgnoreCase("modifiedAt"))
                    ? "ModifiedAt"
                    : "GoalID";

            Sort sort = Sort.by(Sort.Direction.DESC, sortingField);

            List<DepartmentGoalDTO> goalDTOs;

            // =====================================================
            // ✅ PAGINATION MODE
            // =====================================================
            if (page != null && size != null && page > 0 && size > 0) {

                Pageable pageable = PageRequest.of(page - 1, size, sort);

                Page<Object[]> goalPage = goalRepository.findAllGoalsFiltered(
                        searchText,
                        filter,
                        startDate,
                        endDate,
                        pageable);

                goalDTOs = goalPage.getContent().stream().map(obj -> {

                    Timestamp createdTs = (Timestamp) obj[11];
                    Timestamp modifiedTs = (Timestamp) obj[12];

                    Boolean isActive = (Boolean) obj[13];
                    Boolean isDeptArchived = obj[17] != null && Boolean.TRUE.equals(obj[17]);

                    String newStatus;
                    if (Boolean.TRUE.equals(isActive) && !isDeptArchived)
                        newStatus = "Active";
                    else if (isDeptArchived)
                        newStatus = "Archived";
                    else
                        newStatus = "Inactive";

                    return new DepartmentGoalDTO(
                            (Integer) obj[0],
                            (Integer) obj[1],
                            (String) obj[2],
                            (String) obj[3],
                            (String) obj[4],
                            (String) obj[5],
                            (Integer) obj[14],
                            (String) obj[6],
                            (String) obj[7],
                            (String) obj[8],
                            (Boolean) obj[9],
                            (String) obj[10],
                            isActive,
                            createdTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                            modifiedTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                            obj[15] != null && Boolean.TRUE.equals(obj[15]),
                            (Integer) obj[16],
                            isDeptArchived,
                            newStatus
                    );
                }).collect(Collectors.toList());

                DepartmentGoalListResponseDTO.TargetReadResponse resp = new DepartmentGoalListResponseDTO.TargetReadResponse();

                resp.setGoals(goalDTOs);
                resp.setCurrentPage(page);
                resp.setPageSize(size);
                resp.setTotalRecords((int) goalPage.getTotalElements());
                resp.setTotalPages(goalPage.getTotalPages());

                response.setResponse(resp);
            }

            // =====================================================
            // ✅ NON-PAGINATION MODE
            // =====================================================
            else {

                List<Object[]> allGoals = goalRepository.findAllGoalsFilteredNoPagination(
                        searchText,
                        filter,
                        startDate,
                        endDate,
                        sortBy);

                goalDTOs = allGoals.stream().map(obj -> {

                    Timestamp createdTs = (Timestamp) obj[11];
                    Timestamp modifiedTs = (Timestamp) obj[12];

                    Boolean isActive = (Boolean) obj[13];
                    Boolean isDeptArchived = obj[17] != null && Boolean.TRUE.equals(obj[17]);

                    String newStatus;
                    if (Boolean.TRUE.equals(isActive) && !isDeptArchived)
                        newStatus = "Active";
                    else if (isDeptArchived)
                        newStatus = "Archived";
                    else
                        newStatus = "Inactive";

                    return new DepartmentGoalDTO(
                            (Integer) obj[0],
                            (Integer) obj[1],
                            (String) obj[2],
                            (String) obj[3],
                            (String) obj[4],
                            (String) obj[5],
                            (Integer) obj[14],
                            (String) obj[6],
                            (String) obj[7],
                            (String) obj[8],
                            (Boolean) obj[9],
                            (String) obj[10],
                            isActive,
                            createdTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                            modifiedTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                            obj[15] != null && Boolean.TRUE.equals(obj[15]),
                            (Integer) obj[16],
                            isDeptArchived,
                            newStatus
                    );
                }).collect(Collectors.toList());

                DepartmentGoalListResponseDTO.TargetReadResponse resp = new DepartmentGoalListResponseDTO.TargetReadResponse();

                resp.setGoals(goalDTOs);
                resp.setCurrentPage(1);
                resp.setTotalPages(1);
                resp.setTotalRecords(goalDTOs.size());

                response.setResponse(resp);
            }

        } catch (Exception e) {

            e.printStackTrace();

            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error retrieving department goals");
        }

        return response;
    }

    @Transactional
    public DepartmentGoalResponseDTO approveGoals(DepartmentGoalApproveRequestDTO request) {

        DepartmentGoalResponseDTO response = new DepartmentGoalResponseDTO();

        try {
            // ─── Validate input ───────────────────────────────────────────
            if (request.getUserId() == null) {
                response.setStatus(false);
                response.setStatusCode(400);
                response.setMessage("userId is required");
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            if (request.getGoalIds() == null || request.getGoalIds().isEmpty()) {
                response.setStatus(false);
                response.setStatusCode(400);
                response.setMessage("goalIds must not be empty");
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            // ─── Check user exists and is EL ──────────────────────────────
            Optional<User> userOpt = userRepository.findById(request.getUserId());

            if (userOpt.isEmpty()) {
                response.setStatus(false);
                response.setStatusCode(404);
                response.setMessage("User not found with ID: " + request.getUserId());
                response.setTimestamp(LocalDateTime.now());
                return response;
            }
            System.out.println("==== DEBUG USER CHECK ====");
            System.out.println("Request UserId: " + request.getUserId());

            // From entity
            User user = userOpt.get();
            System.out.println("User Name: " + user.getName());
            Integer roleId = userRepository.findRoleIdByUserId(request.getUserId());
            System.out.println("RoleID from Query: " + roleId);

            if (roleId == null || !roleId.equals(3)) {
                response.setStatus(false);
                response.setStatusCode(403);
                response.setMessage("Access denied. Only EL users can approve goals.");
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            // ─── Validate all goalIds exist ───────────────────────────────
            List<DepartmentGoal> goals = goalRepository.findAllById(request.getGoalIds());

            if (goals.size() != request.getGoalIds().size()) {
                // Find which IDs are missing
                List<Integer> foundIds = goals.stream()
                        .map(DepartmentGoal::getGoalID)
                        .collect(Collectors.toList());

                List<Integer> missingIds = request.getGoalIds().stream()
                        .filter(id -> !foundIds.contains(id))
                        .collect(Collectors.toList());

                response.setStatus(false);
                response.setStatusCode(404);
                response.setMessage("Goal(s) not found with ID(s): " + missingIds);
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            // ─── Perform bulk approval ────────────────────────────────────
            int updatedCount = goalRepository.approveGoals(request.getGoalIds());

            Map<String, Object> data = new HashMap<>();
            data.put("approvedGoalIds", request.getGoalIds());
            data.put("approvedCount", updatedCount);
            data.put("approvedByUserId", request.getUserId());

            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("Goal(s) approved successfully");
            response.setTimestamp(LocalDateTime.now());
            response.setResponse(data);

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error approving goals");
            response.setTimestamp(LocalDateTime.now());
        }

        return response;
    }

}
