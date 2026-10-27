package tapmind.bsrv.serviceNew;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.model.Department;
import tapmind.bsrv.model.DepartmentTarget;
import tapmind.bsrv.repository.DepartmentRepository;
import tapmind.bsrv.repository.DepartmentTargetRepository;
import tapmind.bsrv.repository.UserWorkDataRepository;
import org.springframework.dao.DataAccessException;
import org.json.JSONArray;
import org.json.JSONObject;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DepartmentTargetService {

    @Autowired
    private DepartmentTargetRepository departmentTargetRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private UserWorkDataRepository userWorkDataRepository;

    // ✅ CREATE target
    @Transactional
    public DepartmentTargetResponseDTO createDepartmentTarget(DepartmentTargetRequestDTO request) {
        DepartmentTargetResponseDTO response = new DepartmentTargetResponseDTO();
        try {
            Optional<Department> dept = departmentRepository.findById(request.getDepartmentID());
            if (dept.isEmpty()) {
                response.setStatus(false);
                response.setStatusCode(404);
                response.setMessage("Department not found");
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            DepartmentTarget target = new DepartmentTarget();
            target.setDepartment(dept.get());
            target.setTargetName(request.getTargetName());
            target.setTargetMetric(request.getTargetMetric());
            target.setMetricValue(request.getMetricValue());
            target.setUnit(request.getUnit());
            target.setFrequency(request.getFrequency());
            target.setTimingType(request.getTimingType());
            target.setIsDynamic(request.getIsDynamic());
            target.setDescription(request.getDescription());
            target.setIsActive(true);

            // Resolve roles: prefer roleIds list, fall back to single roleID
            Set<Integer> roles = new HashSet<>();
            if (request.getRoleIds() != null && !request.getRoleIds().isEmpty()) {
                roles.addAll(request.getRoleIds());
            } else if (request.getRoleID() != null) {
                roles.add(request.getRoleID());
            }
            target.setRoleIds(roles);
            // Dual-write old column for backward compatibility
            target.setRoleID(roles.isEmpty() ? null : roles.iterator().next());

            departmentTargetRepository.save(target);

            Map<String, Object> data = new HashMap<>();
            data.put("targetID", target.getTargetID());
            data.put("targetMetric", target.getTargetMetric());
            data.put("departmentID", target.getDepartment().getDepartmentID());

            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("Department target created successfully");
            response.setTimestamp(LocalDateTime.now());
            response.setResponse(data);
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error creating department target");
            response.setTimestamp(LocalDateTime.now());
        }
        return response;
    }

    // ✅ UPDATE target
    @Transactional
    public DepartmentTargetResponseDTO updateDepartmentTarget(Integer targetID, DepartmentTargetRequestDTO request) {
        DepartmentTargetResponseDTO response = new DepartmentTargetResponseDTO();
        try {
            Optional<DepartmentTarget> existingOpt = departmentTargetRepository.findById(targetID);
            if (existingOpt.isEmpty()) {
                response.setStatus(false);
                response.setStatusCode(404);
                response.setMessage("Target not found with ID: " + targetID);
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            DepartmentTarget existing = existingOpt.get();

            if (request.getDepartmentID() != null) {
                Optional<Department> dept = departmentRepository.findById(request.getDepartmentID());
                if (dept.isEmpty()) {
                    response.setStatus(false);
                    response.setStatusCode(404);
                    response.setMessage("Department not found");
                    response.setTimestamp(LocalDateTime.now());
                    return response;
                }
                existing.setDepartment(dept.get());
            }

            existing.setTargetName(request.getTargetName());
            existing.setTargetMetric(request.getTargetMetric());
            existing.setMetricValue(request.getMetricValue());
            existing.setUnit(request.getUnit());
            existing.setFrequency(request.getFrequency());
            existing.setTimingType(request.getTimingType());
            existing.setIsDynamic(request.getIsDynamic());
            existing.setDescription(request.getDescription());
            existing.setModifiedAt(new Date());
            existing.setIsActive(request.getIsActive());

            // Resolve roles: prefer roleIds list, fall back to single roleID
            Set<Integer> roles = new HashSet<>();
            if (request.getRoleIds() != null && !request.getRoleIds().isEmpty()) {
                roles.addAll(request.getRoleIds());
            } else if (request.getRoleID() != null) {
                roles.add(request.getRoleID());
            }
            existing.setRoleIds(roles);
            // Dual-write old column for backward compatibility
            existing.setRoleID(roles.isEmpty() ? null : roles.iterator().next());

            departmentTargetRepository.save(existing);

            Map<String, Object> data = new HashMap<>();
            data.put("targetID", existing.getTargetID());
            data.put("targetMetric", existing.getTargetMetric());
            data.put("updatedAt", existing.getModifiedAt());

            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("Department target updated successfully");
            response.setTimestamp(LocalDateTime.now());
            response.setResponse(data);

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error updating department target");
            response.setTimestamp(LocalDateTime.now());
        }
        return response;
    }

    // ✅ UPDATE STATUS
    @Transactional
    public DepartmentTargetResponseDTO updateDepartmentTargetStatus(Integer targetID, Boolean isActive) {
        DepartmentTargetResponseDTO response = new DepartmentTargetResponseDTO();
        try {
            Optional<DepartmentTarget> targetOpt = departmentTargetRepository.findById(targetID);
            if (targetOpt.isEmpty()) {
                response.setStatus(false);
                response.setStatusCode(404);
                response.setMessage("Target not found with ID: " + targetID);
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            DepartmentTarget target = targetOpt.get();
            target.setIsActive(isActive);
            target.setModifiedAt(new Date());
            departmentTargetRepository.save(target);

            Map<String, Object> data = new HashMap<>();
            data.put("targetID", target.getTargetID());
            data.put("targetMetric", target.getTargetMetric());
            data.put("status", target.getIsActive() ? "Active" : "Inactive");
            data.put("updatedAt", target.getModifiedAt());

            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("Target status updated successfully");
            response.setTimestamp(LocalDateTime.now());
            response.setResponse(data);

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error updating target status");
            response.setTimestamp(LocalDateTime.now());
        }
        return response;
    }

    // GET targets by DepartmentID
    public JSONObject getTargetsByDepartmentId(Integer departmentId, Integer roleId) {
        JSONObject response = new JSONObject();
        try {
            List<DepartmentTarget> targets;
            if (roleId != null && roleId > 0) {
                targets = departmentTargetRepository.findByDepartmentAndRoleID(departmentId, roleId);
            } else {
                targets = departmentTargetRepository.findByDepartment_DepartmentID(departmentId);
            }
            if (targets == null || targets.isEmpty()) {
                response.put("status", "error");
                response.put("statusCode", 404);
                response.put("result", "No targets found for DepartmentID: " + departmentId);
            } else {
                Integer achievedUnitsToday = null;
                if (departmentId == 45) {
                    achievedUnitsToday = fetchDept36And46AchievedUnitsToday();
                }

                JSONArray arr = new JSONArray();
                for (DepartmentTarget t : targets) {
                    JSONObject obj = new JSONObject();
                    obj.put("targetID", t.getTargetID());
                    obj.put("targetName", t.getTargetName());
                    obj.put("targetMetric", t.getTargetMetric());
                    obj.put("metricValue", t.getMetricValue());
                    obj.put("unit", t.getUnit());
                    obj.put("frequency", t.getFrequency());
                    obj.put("timingType", t.getTimingType());
                    obj.put("isDynamic", t.getIsDynamic());
                    obj.put("description", t.getDescription());
                    obj.put("isActive", t.getIsActive());
                    obj.put("roleID", t.getRoleID());
                    obj.put("roleIds", new JSONArray(t.getRoleIds() != null ? t.getRoleIds() : Set.of()));
                    obj.put("createdAt", t.getCreatedAt());
                    obj.put("modifiedAt", t.getModifiedAt());

                    if (achievedUnitsToday != null) {
                        try {
                            double target = Double.parseDouble(t.getMetricValue());
                            if (target > 0) {
                                double percentage = Math.round((achievedUnitsToday / target) * 10000.0) / 100.0;
                                obj.put("achievedUnit", String.valueOf(percentage));
                            } else {
                                obj.put("achievedUnit", "0");
                            }
                        } catch (Exception e) {
                            obj.put("achievedUnit", "0");
                        }
                    }

                    arr.put(obj);
                }
                response.put("status", "success");
                response.put("statusCode", 200);
                response.put("result", arr);
            }
        } catch (Exception e) {
            response.put("status", "error");
            response.put("statusCode", 500);
            response.put("result", "An error occurred: " + e.getMessage());
        }
        return response;
    }

    // ✅ GET ALL targets (with optional pagination)

    public DepartmentTargetListResponseDTO getAllDepartmentTargets(
            DepartmentTargetRequestDTOList request, Integer page, Integer size, String sortBy) {

        DepartmentTargetListResponseDTO response = new DepartmentTargetListResponseDTO();

        try {
            String searchText = sanitizeSearchText(request.getSearchText());
            String filter = request.getFilter();
            String startDate = request.getStartDate();
            String endDate = request.getEndDate();

            Boolean targetStatus = null;
            if (filter != null) {
                switch (filter) {
                    case "Active":
                        targetStatus = true;
                        break;
                    case "Inactive":
                        targetStatus = false;
                        break;
                }
            }

            String sortingField = (sortBy != null && sortBy.equalsIgnoreCase("modifiedAt"))
                    ? "ModifiedAt"
                    : "TargetID";
            Sort sort = Sort.by(Sort.Direction.DESC, sortingField);

            List<DepartmentTargetDTO> targetDTOs;

            if (page != null && size != null && page > 0 && size > 0) {
                Pageable pageable = PageRequest.of(page - 1, size, sort);
                Page<Object[]> targetPage = departmentTargetRepository.findAllTargetsFiltered(
                        searchText, filter, startDate, endDate, pageable);

                targetDTOs = targetPage.getContent().stream().map(objects -> {
                    Timestamp createdTs = (Timestamp) objects[10];
                    Timestamp modifiedTs = (Timestamp) objects[11];
                    return new DepartmentTargetDTO(
                            (Integer) objects[0], // TargetID
                            (Integer) objects[1], // DepartmentID
                            (String) objects[2], // TargetName
                            (String) objects[3], // TargetMetric
                            (String) objects[4], // MetricValue
                            (String) objects[5], // Unit
                            (String) objects[6], // Frequency
                            (String) objects[7], // timingType
                            (Boolean) objects[8], // IsDynamic
                            (String) objects[9], // Description
                            (Boolean) objects[12], // IsActive
                            createdTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                            modifiedTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                            (Integer) objects[13], // RoleID
                            null // roleIds — populated by enrichRoleIds() below
                    );
                }).collect(Collectors.toList());

                enrichRoleIds(targetDTOs);
                applyDept45AverageMetric(targetDTOs);

                DepartmentTargetListResponseDTO.TargetReadResponse resp = new DepartmentTargetListResponseDTO.TargetReadResponse();
                resp.setTargets(targetDTOs);
                resp.setCurrentPage(page);
                resp.setPageSize(size);
                resp.setTotalRecords((int) targetPage.getTotalElements());
                resp.setTotalPages(targetPage.getTotalPages());

                response.setResponse(resp);
                response.setStatus(true);
                response.setStatusCode(200);
                response.setMessage("Department targets retrieved successfully");

            } else {
                List<Object[]> allTargets = departmentTargetRepository.findAllTargetsFilteredNoPagination(
                        searchText, filter, startDate, endDate, sortBy);

                targetDTOs = allTargets.stream().map(objects -> {
                    Timestamp createdTs = (Timestamp) objects[10];
                    Timestamp modifiedTs = (Timestamp) objects[11];
                    return new DepartmentTargetDTO(
                            (Integer) objects[0], // TargetID
                            (Integer) objects[1], // DepartmentID
                            (String) objects[2], // TargetName
                            (String) objects[3], // TargetMetric
                            (String) objects[4], // MetricValue
                            (String) objects[5], // Unit
                            (String) objects[6], // Frequency
                            (String) objects[7], // timingType
                            (Boolean) objects[8], // IsDynamic
                            (String) objects[9], // Description
                            (Boolean) objects[12], // IsActive
                            createdTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                            modifiedTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                            (Integer) objects[13], // RoleID
                            null // roleIds — populated by enrichRoleIds() below
                    );
                }).collect(Collectors.toList());

                enrichRoleIds(targetDTOs);
                applyDept45AverageMetric(targetDTOs);

                DepartmentTargetListResponseDTO.TargetReadResponse resp = new DepartmentTargetListResponseDTO.TargetReadResponse();
                resp.setTargets(targetDTOs);
                resp.setTotalRecords(targetDTOs.size());
                resp.setCurrentPage(1);
                resp.setTotalPages(1);

                response.setResponse(resp);
                response.setStatus(true);
                response.setStatusCode(200);
                response.setMessage("All department targets retrieved successfully");
            }

        } catch (DataAccessException dae) {
            dae.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(900);
            response.setMessage("Database error occurred. Please try again later.");
            // response.setTimestamp(LocalDateTime.now());
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Unexpected error occurred while listing department targets.");
            // response.setTimestamp(LocalDateTime.now());
        }
        return response;
    }

    // ✅ Simple getter by Department
    public List<DepartmentTarget> getTargetsByDepartment(Integer departmentID) {
        return departmentTargetRepository.findByDepartment_DepartmentID(departmentID);
    }

    private Integer fetchDept36And46AchievedUnitsToday() {
        Integer dept36Units = userWorkDataRepository.sumAchievedUnitsByDepartmentToday(36);
        Integer dept46Units = userWorkDataRepository.sumAchievedUnitsByDepartmentToday(46);
        return (dept36Units != null ? dept36Units : 0) + (dept46Units != null ? dept46Units : 0);
    }

    private String sanitizeSearchText(String raw) {
        if (raw == null)
            return null;
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void enrichRoleIds(List<DepartmentTargetDTO> targetDTOs) {
        if (targetDTOs == null || targetDTOs.isEmpty())
            return;
        List<Integer> ids = targetDTOs.stream()
                .map(DepartmentTargetDTO::getTargetID)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        if (ids.isEmpty())
            return;
        List<Object[]> rows = departmentTargetRepository.findRoleIdsByTargetIds(ids);
        Map<Integer, List<Integer>> roleMap = new HashMap<>();
        for (Object[] row : rows) {
            Integer tid = (Integer) row[0];
            Integer rid = (Integer) row[1];
            roleMap.computeIfAbsent(tid, k -> new ArrayList<>()).add(rid);
        }
        for (DepartmentTargetDTO dto : targetDTOs) {
            dto.setRoleIds(roleMap.getOrDefault(dto.getTargetID(), List.of()));
        }
    }

    private void applyDept45AverageMetric(List<DepartmentTargetDTO> targetDTOs) {
        boolean hasDept45 = targetDTOs.stream()
                .anyMatch(d -> d.getDepartmentID() != null && d.getDepartmentID() == 45);
        if (!hasDept45)
            return;

        Integer achievedUnits = fetchDept36And46AchievedUnitsToday();

        for (DepartmentTargetDTO dto : targetDTOs) {
            if (dto.getDepartmentID() != null && dto.getDepartmentID() == 45) {
                try {
                    double target = Double.parseDouble(dto.getMetricValue());
                    if (target > 0) {
                        double percentage = Math.round((achievedUnits / target) * 10000.0) / 100.0;
                        dto.setMetricValue(String.valueOf(percentage));
                    } else {
                        dto.setMetricValue("0");
                    }
                } catch (Exception e) {
                    dto.setMetricValue("0");
                }
            }
        }
    }
}
