package tapmind.bsrv.serviceNew;

import java.io.IOException;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import tapmind.bsrv.repository.AMRoleRepository;
import tapmind.bsrv.repository.UserRepository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import tapmind.bsrv.model.AMRole;
import tapmind.bsrv.dto.*;

import java.util.*;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.time.ZoneId;
import java.sql.Timestamp;
import java.util.stream.Collectors;

@Service
public class AMRoleService {

    @Autowired
    private AMRoleRepository amRoleRepository;

    @Autowired
    private UserRepository usersRepository;

    public AMRoleResponseDTO createRole(AMRoleRequestDTO requestDTO) {
        AMRoleResponseDTO response = new AMRoleResponseDTO();
        boolean flag = false;
        try {
            // Check if role already exists
            if (amRoleRepository.findByRoleName(requestDTO.getRoleName()).isPresent()) {
                response.setStatus(false);
                response.setStatusCode(409);
                response.setTimestamp(LocalDateTime.now());
                response.setMessage("RoleName already exists");
            } else {
                // Create new role
                AMRole newRole = new AMRole();
                newRole.setRoleName(requestDTO.getRoleName());
                newRole.setRolePrivileges(new ObjectMapper().writeValueAsString(requestDTO.getRolePrivileges()));
                newRole.setRoleDescription(requestDTO.getRoleDescription());
                newRole.setRoleCreateTime(new Date());
                newRole.setRoleModifyTime(new Date());

                amRoleRepository.save(newRole);

                response.setResponse(new HashMap<String, Object>());
                response.setStatus(true);
                response.setMessage("Created");
                response.setStatusCode(200);
                response.setTimestamp(LocalDateTime.now());

            }

            flag = true;
        } catch (org.springframework.dao.DataAccessException dae) {
            dae.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(900);
            response.setTimestamp(LocalDateTime.now());
            response.setMessage("Database error occurred. Please try again later or contact support.");
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setMessage("An unexpected error occurred while creating Role ");
            response.setStatusCode(500);
            response.setTimestamp(LocalDateTime.now());
        } finally {
        }
        return response;
    }

    public AMRole getRoleById(int id) {
        return amRoleRepository.findById(id).orElse(null);
    }

    public AMRoleResponseDTOList getAllAMRoles(AMRoleRequestDTOList amRoleRequest, Integer page, Integer size,
            String sortBy) {
        AMRoleResponseDTOList response = new AMRoleResponseDTOList();

        try {
            // Extract input parameters from the request DTO
            String searchText = amRoleRequest.getSearchText();
            String filter = amRoleRequest.getFilter();
            LocalDate startDate = amRoleRequest.getStartDate();
            LocalDate endDate = amRoleRequest.getEndDate();

            // Define filter conditions
            Boolean roleStatus = null;
            Boolean isRoleArchived = null;

            // Determine filter conditions based on the 'filter' value
            switch (filter) {
                case "Active":
                    roleStatus = true;
                    break;
                case "Inactive":
                    roleStatus = false;
                    isRoleArchived = false;
                    break;
                case "Archived":
                    isRoleArchived = true;
                    break;
                case "NonArchived":
                    isRoleArchived = false;
                    break;
            }

            // Set sorting
            String sortingField = (sortBy != null && sortBy.equals("roleModifyTime")) ? "roleModifyTime" : "roleID";
            Sort sort = Sort.by(Sort.Direction.DESC, sortingField);

            List<AMRoleDTO> amRoleDTOs;

            if (page != null && size != null && page > 0 && size > 0) {
                // If pagination is requested
                Pageable pageable = PageRequest.of(page - 1, size, sort);

                // Fetch paginated results from the repository
                Page<Object[]> amRolePage = amRoleRepository.findAllAMRolesBySearchText(searchText, roleStatus,
                        isRoleArchived, startDate, endDate, pageable);

                // Map results to AMRoleDTO
                amRoleDTOs = amRolePage.getContent().stream().map(objects -> {
                    String newStatus;
                    boolean isArchivedS = (Boolean) objects[3];
                    boolean isActiveS = (Boolean) objects[2];

                    if (isActiveS && !isArchivedS) {
                        newStatus = "Active";
                    } else if (isArchivedS) {
                        newStatus = "Archived";
                    } else {
                        newStatus = "Inactive";
                    }

                    Timestamp timestamp = (Timestamp) objects[4];
                    Timestamp timestamp1 = (Timestamp) objects[5];
                    return new AMRoleDTO(
                            (Integer) objects[0], // roleID
                            (String) objects[1], // roleName
                            (Boolean) objects[2], // roleStatus
                            (Boolean) objects[3], // isRoleArchived
                            timestamp.toInstant().atZone(ZoneId.systemDefault()).toLocalDate(), // roleCreateTime
                            timestamp1.toInstant().atZone(ZoneId.systemDefault()).toLocalDate(), // roleModifyTime
                            (String) objects[6], // roleDescription
                            newStatus, // Set new status
                            (objects[7] instanceof Map) ? (Map<String, Object>) objects[7]
                                    : (objects[7] instanceof String) ? parseStringToMap((String) objects[7]) : null);
                }).collect(Collectors.toList());

                // Prepare paginated response data
                tapmind.bsrv.dto.AMRoleResponseDTOList.AMRoleReadResponseDTO responseData = new tapmind.bsrv.dto.AMRoleResponseDTOList.AMRoleReadResponseDTO();
                responseData.setRoles(amRoleDTOs);
                responseData.setCurrentPage(page);
                responseData.setPageSize(size);
                responseData.setTotalRecords((int) amRolePage.getTotalElements());
                responseData.setTotalPages(amRolePage.getTotalPages());

                response.setResponse(responseData);
                response.setStatus(true);
                response.setMessage("AMRoles retrieved successfully");
                response.setStatusCode(200);

            } else {
                // If no pagination is requested, return all records without limit
                List<Object[]> allAMRoles = amRoleRepository.findAllAMRolesBySearchTextNoPagination(searchText,
                        roleStatus,
                        isRoleArchived, startDate, endDate, sort);

                // Mapping AMRoles
                amRoleDTOs = allAMRoles.stream().map(objects -> {
                    String newStatus;
                    boolean isArchivedS = (Boolean) objects[3];
                    boolean isActiveS = (Boolean) objects[2];

                    if (isActiveS && !isArchivedS) {
                        newStatus = "Active";
                    } else if (isArchivedS) {
                        newStatus = "Archived";
                    } else {
                        newStatus = "Inactive";
                    }

                    Timestamp timestamp = (Timestamp) objects[4];
                    Timestamp timestamp1 = (Timestamp) objects[5];
                    return new AMRoleDTO(
                            (Integer) objects[0], // roleID
                            (String) objects[1], // roleName
                            (Boolean) objects[2], // roleStatus
                            (Boolean) objects[3], // isRoleArchived
                            timestamp.toInstant().atZone(ZoneId.systemDefault()).toLocalDate(), // roleCreateTime
                            timestamp1.toInstant().atZone(ZoneId.systemDefault()).toLocalDate(), // roleModifyTime
                            (String) objects[6], // roleDescription
                            newStatus, // Set new status
                            (objects[7] instanceof Map) ? (Map<String, Object>) objects[7]
                                    : (objects[7] instanceof String) ? parseStringToMap((String) objects[7]) : null);
                }).collect(Collectors.toList());

                // Prepare response data for non-paginated response
                tapmind.bsrv.dto.AMRoleResponseDTOList.AMRoleReadResponseDTO responseData = new tapmind.bsrv.dto.AMRoleResponseDTOList.AMRoleReadResponseDTO();
                responseData.setRoles(amRoleDTOs);
                responseData.setTotalRecords(amRoleDTOs.size());
                responseData.setTotalPages(1); // Since it's non-paginated
                responseData.setCurrentPage(1); // Since it's non-paginated

                response.setResponse(responseData);
                response.setStatus(true);
                response.setMessage("All AMRoles retrieved successfully");
                response.setStatusCode(200);
            }

        } catch (org.springframework.dao.DataAccessException dae) {
            dae.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(900);
            response.setTimestamp(LocalDateTime.now());
            response.setMessage("Database error occurred. Please try again later or contact support.");
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setMessage("An unexpected error occurred while Listing Role ");
            response.setStatusCode(500);
            response.setTimestamp(LocalDateTime.now());
        }

        return response;
    }

    private Map<String, Object> parseStringToMap(String jsonString) {
        ObjectMapper objectMapper = new ObjectMapper();
        try {
            return objectMapper.readValue(jsonString, new TypeReference<Map<String, Object>>() {
            });
        } catch (IOException e) {
            return null;
        }
    }

    public AMRoleResponseDTO updateRole(int id, AMRoleRequestDTO requestDTO) {
        AMRoleResponseDTO response = new AMRoleResponseDTO();

        try {
            Optional<AMRole> existingRoleOpt = amRoleRepository.findById(id);
            if (!existingRoleOpt.isPresent()) {
                response.setStatus(false);
                response.setStatusCode(404);
                response.setTimestamp(LocalDateTime.now());
                response.setMessage("Role not found");
                return response;
            }
            Optional<AMRole> existingRoleByName = amRoleRepository.findByRoleName(requestDTO.getRoleName());
            if (existingRoleByName.isPresent() && existingRoleByName.get().getRoleID() != id) {
                response.setStatus(false);
                response.setStatusCode(409);
                response.setTimestamp(LocalDateTime.now());
                response.setMessage("RoleName already exists for another role");
                return response;
            }

            AMRole existingRole = existingRoleOpt.get();
            existingRole.setRoleName(requestDTO.getRoleName());
            existingRole.setRolePrivileges(new ObjectMapper().writeValueAsString(requestDTO.getRolePrivileges()));
            existingRole.setRoleDescription(requestDTO.getRoleDescription());
            existingRole.setRoleDescription(requestDTO.getRoleDescription());
            existingRole.setRoleModifyTime(new Date());

            amRoleRepository.save(existingRole);

            response.setStatus(true);
            response.setStatusCode(200);
            response.setTimestamp(LocalDateTime.now());
            response.setMessage("Role updated successfully");
            response.setResponse(new HashMap<String, Object>());
        } catch (org.springframework.dao.DataAccessException dae) {
            dae.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(900);
            response.setTimestamp(LocalDateTime.now());
            response.setMessage("Database error occurred. Please try again later or contact support.");
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setMessage("An unexpected error occurred while updating role");
            response.setStatusCode(500);
            response.setTimestamp(LocalDateTime.now());
        }
        return response;
    }

    @Transactional
    public AMRoleResponseDTO updateRoleStatus(RoleStatusRequestDTO request) {

        System.out.println(request);
        boolean roleStatus = request.getRoleStatus();
        System.out.println(roleStatus);
        AMRoleResponseDTO response = new AMRoleResponseDTO();
        String modifyTime = LocalDateTime.now().toString(); // Modify time

        try {
            for (Integer roleId : request.getRoleIDList()) {
                // Check user count and role name based on role ID
                Long userCount = amRoleRepository.findUserCountAndRoleNameByRoleID(roleId);
                // If the role is being deactivated and there are active users, return a message
                if (userCount != null && userCount > 0) {
                    response.setStatus(false);
                    response.setMessage(" this role has " + userCount + "many active users first deactivate Users");
                    return response;
                } else {
                    amRoleRepository.updateRoleStatus(roleStatus, modifyTime, roleId);
                }
                response.setStatus(true);
                response.setStatusCode(200);
                response.setMessage("Status updated successfully");

            }
        } catch (org.springframework.dao.DataAccessException dae) {
            dae.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(900);
            response.setTimestamp(LocalDateTime.now());
            response.setMessage("Database error occurred. Please try again later or contact support.");
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setMessage("An unexpected error occurred while updating status for the role");
            response.setStatusCode(500);
            response.setTimestamp(LocalDateTime.now());
        }

        return response;
    }

    @Transactional
    public AMRoleResponseDTO updateRoleArchive(RoleStatusRequestDTO request) {
        AMRoleResponseDTO response = new AMRoleResponseDTO();
        String modifyTime = LocalDateTime.now().toString(); // Modify time

        try {
            for (Integer roleId : request.getRoleIDList()) {
                // Check user count and role name based on role ID
                Long userCount = amRoleRepository.findUserCountAndRoleNameByRoleID(roleId);
                // If the role is being deactivated and there are active users, return a message
                if (userCount != null && userCount > 0) {
                    response.setStatus(false);
                    response.setMessage(" this role has " + userCount + " many active users");
                    return response;
                }
                // Update the role status
                else {
                    amRoleRepository.updateArchiveStatus(modifyTime, roleId);
                }
            }

            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("Archive updated successfully");

        } catch (org.springframework.dao.DataAccessException dae) {
            dae.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(900);
            response.setTimestamp(LocalDateTime.now());
            response.setMessage("Database error occurred. Please try again later or contact support.");
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setMessage("An unexpected error occurred while archive role");
            response.setStatusCode(500);
            response.setTimestamp(LocalDateTime.now());
        }

        return response;
    }

}