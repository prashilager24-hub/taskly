package tapmind.bsrv.serviceNew;
import java.io.IOException;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import tapmind.bsrv.model.Department;
import tapmind.bsrv.model.DepartmentUser;
import tapmind.bsrv.model.PrimaryDepartment;
import tapmind.bsrv.repository.DepartmentRepository;
import tapmind.bsrv.repository.PrimaryDepartmentRepository;
import tapmind.bsrv.repository.UserRepository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import tapmind.bsrv.model.User;

import tapmind.bsrv.dto.*;
import tapmind.bsrv.repository.DepartmentUserRepository;

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
public class DepartmentService {

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private PrimaryDepartmentRepository primaryDepartmentRepository;

    @Autowired
    private UserRepository usersRepository;

    @Autowired
    private DepartmentUserRepository departmentUserRepository;





 public DepartmentResponseDTO createDepartment(DepartmentRequestDTO requestDTO) {
    DepartmentResponseDTO response = new DepartmentResponseDTO();

    try {
        // Check if department already exists by name
        if (departmentRepository.findByDepartmentName(requestDTO.getDepartmentName()).isPresent()) {
            response.setStatus(false);
            response.setStatusCode(409);
            response.setTimestamp(LocalDateTime.now());
            response.setMessage("Department name already exists");
            return response;
        }

        // Create new Department
        Department department = new Department();
        department.setDepartmentName(requestDTO.getDepartmentName());
        department.setDepartmentDescription(requestDTO.getDepartmentDescription());
        department.setDepartmentCreateTime(new Date());
        department.setDepartmentModifyTime(new Date());
      if (requestDTO.getExecutiveLeaderID() != null) {
            User executiveLeader = usersRepository.findById(requestDTO.getExecutiveLeaderID())
                    .orElseThrow(() -> new RuntimeException("Executive Leader not found with ID: " + requestDTO.getExecutiveLeaderID()));
            department.setExecutiveLeader(executiveLeader);
        } 
         else if (requestDTO.getFunctionalLeaderID() != null) {
            User executiveLeader = usersRepository.findById(requestDTO.getFunctionalLeaderID())
                    .orElseThrow(() -> new RuntimeException("Functional Leader not found with ID: " + requestDTO.getFunctionalLeaderID()));
            department.setFunctionalLeader(executiveLeader);
        }
        
         else {
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Executive Leader not found with ID: missing");
            return  response;
     
        }

        if (requestDTO.getPrimaryDepartmentId() != null) {
            PrimaryDepartment pd = primaryDepartmentRepository.findById(requestDTO.getPrimaryDepartmentId())
                    .orElseThrow(() -> new RuntimeException("Primary Department not found with ID: " + requestDTO.getPrimaryDepartmentId()));
            department.setPrimaryDepartment(pd);
        }


        departmentRepository.save(department); // Auto-increment ID from DB

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("departmentID", department.getDepartmentID());
        responseData.put("departmentName", department.getDepartmentName());
        responseData.put("departmentDescription", department.getDepartmentDescription());

        response.setResponse(responseData);
        response.setStatus(true);
        response.setStatusCode(200);
        response.setTimestamp(LocalDateTime.now());
        response.setMessage("Department created successfully");

    } catch (org.springframework.dao.DataAccessException dae) {
        dae.printStackTrace();
        response.setStatus(false);
        response.setStatusCode(900);
        response.setTimestamp(LocalDateTime.now());
        response.setMessage("Database error occurred. Please try again later or contact support.");
    } catch (Exception e) {
        e.printStackTrace();
        response.setStatus(false);
        response.setStatusCode(500);
        response.setTimestamp(LocalDateTime.now());
        response.setMessage("An unexpected error occurred while creating the department");
    }

    return response;
}




   public DepartmentResponseDTOList getAllDepartments(
        DepartmentRequestDTOList departmentRequest,
        Integer page,
        Integer size,
        String sortBy) {

    DepartmentResponseDTOList response = new DepartmentResponseDTOList();

    try {
        // Extract filters from request
        String searchText = (departmentRequest.getSearchText() != null && departmentRequest.getSearchText().isEmpty()) ? null : departmentRequest.getSearchText();
        String filter = (departmentRequest.getFilter() != null && departmentRequest.getFilter().isEmpty()) ? null : departmentRequest.getFilter();
        LocalDate startDate = departmentRequest.getStartDate();
        LocalDate endDate = departmentRequest.getEndDate();
         Integer roleID=departmentRequest.getRoleID();
         Integer userID=departmentRequest.getUserID();

        // Define filter conditions
        Boolean departmentStatus = null;
        Boolean isDepartmentArchived = null;

        // Determine filter type
        if (filter != null) {
            switch (filter) {
                case "Active":
                    departmentStatus = true;
                    break;
                case "Inactive":
                    departmentStatus = false;
                    isDepartmentArchived = false;
                    break;
                case "Archived":
                    isDepartmentArchived = true;
                    break;
                case "NonArchived":
                    isDepartmentArchived = false;
                    break;
            }
        }
        Integer elID=null;
        if(roleID==3 && userID!=null && userID!=0) elID=userID;
        Integer flID=null;
        if(roleID==4 && userID!=null && userID!=0) flID=userID;

        // Sorting configuration
        String sortingField = (sortBy != null && sortBy.equals("modifiedTime"))
                ? "departmentModifyTime"
                : "departmentID";
        Sort sort = Sort.by(Sort.Direction.DESC, sortingField);

        List<DepartmentDTO> departmentDTOs;

        // ✅ PAGINATED CASE
        if (page != null && size != null && page > 0 && size > 0) {
            Pageable pageable = PageRequest.of(page - 1, size, sort);

            Page<Object[]> departmentPage =
                    departmentRepository.findAllDepartmentsBySearchText(
                            searchText,
                            departmentStatus,
                            isDepartmentArchived,
                            startDate,
                            endDate,
                            elID,
                            flID,
                            pageable);

            departmentDTOs = departmentPage.getContent().stream().map(objects -> {
                boolean isActive = (Boolean) objects[2];
                boolean isArchived = (Boolean) objects[3];

                String newStatus;
                if (isActive && !isArchived)
                    newStatus = "Active";
                else if (isArchived)
                    newStatus = "Archived";
                else
                    newStatus = "Inactive";

                Timestamp createTs = (Timestamp) objects[4];
                Timestamp modifyTs = (Timestamp) objects[5];
                 System.out.println((String)objects[8]);
                return new DepartmentDTO(
                        (Integer) objects[0], // departmentId
                        (String) objects[1],  // departmentName
                        (Boolean) objects[2], // departmentStatus
                        (Boolean) objects[3], // isDepartmentArchived
                        createTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDate(),
                        modifyTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDate(),
                        (String) objects[6],  // departmentDescription
                         (String) objects[7],
                         (String) objects[8],
                         (Integer) objects[9],
                         (Integer) objects[10],
                         objects[11] != null ? ((Number) objects[11]).longValue() : null,
                         (String) objects[12],
                        newStatus
                );
            }).collect(Collectors.toList());

            // Prepare paginated response
            DepartmentResponseDTOList.DepartmentReadResponseDTO responseData =
                    new DepartmentResponseDTOList.DepartmentReadResponseDTO();
            responseData.setDepartments(departmentDTOs);
            responseData.setCurrentPage(page);
            responseData.setPageSize(size);
            responseData.setTotalRecords((int) departmentPage.getTotalElements());
            responseData.setTotalPages(departmentPage.getTotalPages());

            response.setResponse(responseData);
            response.setStatus(true);
            response.setMessage("Departments retrieved successfully");
            response.setStatusCode(200);

        } else {
         
            List<Object[]> allDepartments =
                    departmentRepository.findAllDepartmentsBySearchTextNoPagination(
                            searchText,
                            departmentStatus,
                            isDepartmentArchived,
                            startDate,
                            endDate,
                            elID,
                            flID
                            );

            departmentDTOs = allDepartments.stream().map(objects -> {
                boolean isActive = (Boolean) objects[2];
                boolean isArchived = (Boolean) objects[3];

                String newStatus;
                if (isActive && !isArchived)
                    newStatus = "Active";
                else if (isArchived)
                    newStatus = "Archived";
                else
                    newStatus = "Inactive";

                Timestamp createTs = (Timestamp) objects[4];
                Timestamp modifyTs = (Timestamp) objects[5];
               
                return new DepartmentDTO(
                        (Integer) objects[0],
                        (String) objects[1],
                        (Boolean) objects[2],
                        (Boolean) objects[3],
                        createTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDate(),
                        modifyTs.toInstant().atZone(ZoneId.systemDefault()).toLocalDate(),
                        (String) objects[6],
                         (String) objects[7],
                         (String) objects[8],
                         (Integer) objects[9],
                         (Integer) objects[10],
                         objects[11] != null ? ((Number) objects[11]).longValue() : null,
                         (String) objects[12],
                        newStatus
                       
                );
            }).collect(Collectors.toList());

            // Prepare non-paginated response
            DepartmentResponseDTOList.DepartmentReadResponseDTO responseData =
                    new DepartmentResponseDTOList.DepartmentReadResponseDTO();
            responseData.setDepartments(departmentDTOs);
            responseData.setTotalRecords(departmentDTOs.size());
            responseData.setTotalPages(1);
            responseData.setCurrentPage(1);

            response.setResponse(responseData);
            response.setStatus(true);
            response.setMessage("All departments retrieved successfully");
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
        response.setStatusCode(500);
        response.setTimestamp(LocalDateTime.now());
        response.setMessage("An unexpected error occurred while listing departments");
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


    public DepartmentResponseDTO updateDepartment(int departmentId, DepartmentRequestDTO requestDTO) {
    DepartmentResponseDTO response = new DepartmentResponseDTO();

    try {
        Optional<Department> existingDeptOpt = departmentRepository.findById(departmentId);
        if (existingDeptOpt.isEmpty()) {
            response.setStatus(false);
            response.setStatusCode(404);
            response.setTimestamp(LocalDateTime.now());
            response.setMessage("Department not found");
            return response;
        }

        Department existingDept = existingDeptOpt.get();

        // Check duplicate name (excluding self) - only if name is provided
        if (requestDTO.getDepartmentName() != null && !requestDTO.getDepartmentName().trim().isEmpty()) {
            Optional<Department> existingByName = departmentRepository.findByDepartmentName(requestDTO.getDepartmentName());
            if (existingByName.isPresent() && existingByName.get().getDepartmentID() != departmentId) {
                response.setStatus(false);
                response.setStatusCode(409);
                response.setTimestamp(LocalDateTime.now());
                response.setMessage("Another department with the same name already exists");
                return response;
            }
        }

        // Update fields only if provided (partial update)
        if (requestDTO.getDepartmentName() != null && !requestDTO.getDepartmentName().trim().isEmpty()) {
            existingDept.setDepartmentName(requestDTO.getDepartmentName());
        }
        if (requestDTO.getDepartmentDescription() != null) {
            existingDept.setDepartmentDescription(requestDTO.getDepartmentDescription());
        }
        existingDept.setDepartmentModifyTime(new Date());
        
        if (requestDTO.getExecutiveLeaderID() != null) {
            User executiveLeader = usersRepository.findById(requestDTO.getExecutiveLeaderID())
                    .orElseThrow(() -> new RuntimeException("Executive Leader not found with ID: " + requestDTO.getExecutiveLeaderID()));
            existingDept.setExecutiveLeader(executiveLeader);
        } 
        if (requestDTO.getFunctionalLeaderID() != null) {
            User functionalLeader = usersRepository.findById(requestDTO.getFunctionalLeaderID())
                    .orElseThrow(() -> new RuntimeException("Functional Leader not found with ID: " + requestDTO.getFunctionalLeaderID()));
            existingDept.setFunctionalLeader(functionalLeader);
        }
        
        if (requestDTO.getPrimaryDepartmentId() != null) {
            PrimaryDepartment pd = primaryDepartmentRepository.findById(requestDTO.getPrimaryDepartmentId())
                    .orElseThrow(() -> new RuntimeException("Primary Department not found with ID: " + requestDTO.getPrimaryDepartmentId()));
            existingDept.setPrimaryDepartment(pd);
        }

        //  Save
        departmentRepository.save(existingDept);

        //  Build success response
        Map<String, Object> resultData = new HashMap<>();
        resultData.put("departmentID", existingDept.getDepartmentID());
        resultData.put("departmentName", existingDept.getDepartmentName());

        response.setStatus(true);
        response.setStatusCode(200);
        response.setTimestamp(LocalDateTime.now());
        response.setMessage("Department updated successfully");
        response.setResponse(resultData);

    } catch (org.springframework.dao.DataAccessException dae) {
        dae.printStackTrace();
        response.setStatus(false);
        response.setStatusCode(900);
        response.setTimestamp(LocalDateTime.now());
        response.setMessage("Database error occurred while updating department");
    } catch (Exception e) {
        e.printStackTrace();
        response.setStatus(false);
        response.setStatusCode(500);
        response.setTimestamp(LocalDateTime.now());
        response.setMessage("Unexpected error occurred while updating department");
    }

    return response;
}
      

    @Transactional
public DepartmentResponseDTO updateDepartmentStatus(DepartmentStatusRequestDTO request) {
    System.out.println("Incoming DepartmentStatusRequestDTO: " + request);

    boolean departmentStatus = request.getDepartmentStatus(); // renamed for clarity
    System.out.println("Department status to update: " + departmentStatus);

    DepartmentResponseDTO response = new DepartmentResponseDTO();
    String modifyTime = LocalDateTime.now().toString();

    try {
        for (Integer departmentId : request.getDepartmentIDList()) {

            //  Check if any active users are still linked to this department
            Long userCount = departmentRepository.findActiveUserCountByDepartmentId(departmentId);

            if (userCount != null && userCount > 0 && !departmentStatus) {
                // If trying to deactivate a department that still has active users
                response.setStatus(false);
                response.setStatusCode(400);
                response.setMessage("Department ID " + departmentId +
                        " has " + userCount + " active users. Please deactivate users first.");
                response.setTimestamp(LocalDateTime.now());
                return response;
            } else {
                //  Update department status
                departmentRepository.updateDepartmentStatus(departmentStatus, modifyTime, departmentId);
            }
        }

        // If all departments updated successfully
        response.setStatus(true);
        response.setStatusCode(200);
        response.setMessage("Department status updated successfully");
        response.setTimestamp(LocalDateTime.now());

    } catch (org.springframework.dao.DataAccessException dae) {
        dae.printStackTrace();
        response.setStatus(false);
        response.setStatusCode(900);
        response.setMessage("Database error occurred. Please try again later or contact support.");
        response.setTimestamp(LocalDateTime.now());
    } catch (Exception e) {
        e.printStackTrace();
        response.setStatus(false);
        response.setStatusCode(500);
        response.setMessage("An unexpected error occurred while updating department status.");
        response.setTimestamp(LocalDateTime.now());
    }

    return response;
}


    @Transactional
public DepartmentResponseDTO updateDepartmentArchive(DepartmentArchiveRequestDTO request) {
    DepartmentResponseDTO response = new DepartmentResponseDTO();
    String modifyTime = LocalDateTime.now().toString(); // modify timestamp

    try {
        for (Integer departmentId : request.getDepartmentIDList()) {

            // ✅ Check if department exists
            Optional<Department> deptOpt = departmentRepository.findById(departmentId);
            if (!deptOpt.isPresent()) {
                response.setStatus(false);
                response.setStatusCode(404);
                response.setTimestamp(LocalDateTime.now());
                response.setMessage("Department with ID " + departmentId + " not found");
                return response;
            }

            // Optional: check for active users in that department
            Long userCount = departmentRepository.findActiveUserCountByDepartmentId(departmentId);
            if (userCount != null && userCount > 0) {
                response.setStatus(false);
                response.setStatusCode(409);
                response.setTimestamp(LocalDateTime.now());
                response.setMessage("This department has " + userCount + " active users. Please deactivate them before archiving.");
                return response;
            }

            // Update archive flag
            departmentRepository.updateArchiveStatus(modifyTime, departmentId);
        }

        response.setStatus(true);
        response.setStatusCode(200);
        response.setTimestamp(LocalDateTime.now());
        response.setMessage("Department archive status updated successfully");

    } catch (org.springframework.dao.DataAccessException dae) {
        dae.printStackTrace();
        response.setStatus(false);
        response.setStatusCode(900);
        response.setTimestamp(LocalDateTime.now());
        response.setMessage("Database error occurred. Please try again later or contact support.");
    } catch (Exception e) {
        e.printStackTrace();
        response.setStatus(false);
        response.setStatusCode(500);
        response.setTimestamp(LocalDateTime.now());
        response.setMessage("An unexpected error occurred while archiving department");
    }

    return response;
}

    public List<DepartmentHierarchyDTO> getDepartmentHierarchy() {
        List<DepartmentHierarchyDTO> result = new ArrayList<>();

        try {
            // Step 1: Fetch all active PrimaryDepartments
            List<PrimaryDepartment> primaryDepartments = primaryDepartmentRepository.findByIsActiveTrueOrderByPrimaryDepartmentNameAsc();

            if (primaryDepartments.isEmpty()) {
                return result;
            }

            // Step 2: Batch fetch all active Departments grouped by PrimaryDepartment
            List<Long> primaryDeptIds = primaryDepartments.stream()
                    .map(PrimaryDepartment::getPrimaryDepartmentId)
                    .collect(Collectors.toList());

            List<Department> allDepartments = departmentRepository.findActiveDepartmentsByPrimaryDepartmentIds(primaryDeptIds);

            if (allDepartments.isEmpty()) {
                for (PrimaryDepartment pd : primaryDepartments) {
                    DepartmentHierarchyDTO dto = new DepartmentHierarchyDTO();
                    dto.setPrimaryDepartmentId(pd.getPrimaryDepartmentId());
                    dto.setPrimaryDepartmentName(pd.getPrimaryDepartmentName());
                    dto.setType(pd.getType());
                    dto.setActive(pd.isActive());
                    dto.setDepartments(new ArrayList<>());
                    result.add(dto);
                }
                return result;
            }

            // Step 3: Batch fetch all active DepartmentUser mappings (with User+Role+Manager fetched)
            List<Integer> deptIds = allDepartments.stream()
                    .map(Department::getDepartmentID)
                    .collect(Collectors.toList());

            List<DepartmentUser> allDeptUsers = departmentUserRepository.findActiveDepartmentUsersByDepartmentIds(deptIds);

            // Step 4: Group DepartmentUser by departmentID
            Map<Integer, List<DepartmentUser>> deptUsersMap = allDeptUsers.stream()
                    .collect(Collectors.groupingBy(du -> du.getDepartment().getDepartmentID()));

            // Step 5: Group departments by primaryDepartmentId
            Map<Long, List<Department>> deptsByPrimary = allDepartments.stream()
                    .collect(Collectors.groupingBy(d -> d.getPrimaryDepartment().getPrimaryDepartmentId()));

            // Step 6: Assemble the hierarchy
            for (PrimaryDepartment pd : primaryDepartments) {
                DepartmentHierarchyDTO hierarchyDto = new DepartmentHierarchyDTO();
                hierarchyDto.setPrimaryDepartmentId(pd.getPrimaryDepartmentId());
                hierarchyDto.setPrimaryDepartmentName(pd.getPrimaryDepartmentName());
                hierarchyDto.setType(pd.getType());
                hierarchyDto.setActive(pd.isActive());

                List<Department> subDepts = deptsByPrimary.getOrDefault(pd.getPrimaryDepartmentId(), new ArrayList<>());
                List<DepartmentHierarchyDTO.SubDepartmentDTO> subDeptDtos = new ArrayList<>();

                for (Department dept : subDepts) {
                    DepartmentHierarchyDTO.SubDepartmentDTO subDto = new DepartmentHierarchyDTO.SubDepartmentDTO();
                    subDto.setDepartmentID(dept.getDepartmentID());
                    subDto.setDepartmentName(dept.getDepartmentName());
                    subDto.setDepartmentDescription(dept.getDepartmentDescription());
                    subDto.setDepartmentStatus(dept.isDepartmentStatus());
                    subDto.setDepartmentArchived(dept.isDepartmentArchived());

                    if (dept.getExecutiveLeader() != null) {
                        subDto.setExecutiveLeaderId(dept.getExecutiveLeader().getUserID());
                        subDto.setExecutiveLeaderName(dept.getExecutiveLeader().getName());
                    }
                    if (dept.getFunctionalLeader() != null) {
                        subDto.setFunctionalLeaderId(dept.getFunctionalLeader().getUserID());
                        subDto.setFunctionalLeaderName(dept.getFunctionalLeader().getName());
                    }

                    // Map users for this department from pre-fetched DepartmentUser mappings
                    List<DepartmentUser> deptUserMappings = deptUsersMap.getOrDefault(dept.getDepartmentID(), new ArrayList<>());
                    List<DepartmentHierarchyDTO.UserDetailDTO> userDtos = new ArrayList<>();

                    for (DepartmentUser du : deptUserMappings) {
                        User user = du.getUser();
                        DepartmentHierarchyDTO.UserDetailDTO userDto = new DepartmentHierarchyDTO.UserDetailDTO();
                        userDto.setUserID(user.getUserID());
                        userDto.setName(user.getName());
                        userDto.setUserEmail(user.getUserEmail());
                        userDto.setEmployeeID(user.getEmployeeID());
                        userDto.setUserStatus(user.isUserStatus());
                        userDto.setRoleID(user.getRole() != null ? user.getRole().getRoleID() : null);
                        userDto.setRoleName(user.getRole() != null ? user.getRole().getRoleName() : null);
                        userDto.setReportingManagerId(user.getReportingManager() != null ? user.getReportingManager().getUserID() : null);
                        userDto.setReportingManagerName(user.getReportingManager() != null ? user.getReportingManager().getName() : null);
                        userDtos.add(userDto);
                    }

                    subDto.setUsers(userDtos);
                    subDeptDtos.add(subDto);
                }

                hierarchyDto.setDepartments(subDeptDtos);
                result.add(hierarchyDto);
            }

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Error fetching department hierarchy: " + e.getMessage());
        }

        return result;
    }

 
    
   
   
}