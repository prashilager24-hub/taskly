
package tapmind.bsrv.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.MediaType;
import jakarta.validation.Valid;
import tapmind.bsrv.serviceNew.AMRoleService;
import tapmind.bsrv.model.AMRole;
import tapmind.bsrv.dto.*;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/AMRole")
public class AMRoleController {

    @Autowired
    private AMRoleService aMRoleService;

    @PostMapping(path = "/list", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getAllRoles(
            @Valid @RequestBody AMRoleRequestDTOList amrole,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "RoleID") String sortBy) {
        try {
            AMRoleResponseDTOList response = aMRoleService.getAllAMRoles(amrole, page, size, sortBy);
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            AMRoleResponseDTOList errorResponse = new AMRoleResponseDTOList();
            errorResponse.setStatus(false);
            errorResponse.setMessage(e.getMessage());
            return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/create")
    public ResponseEntity<AMRoleResponseDTO> createRole(
            @Valid @RequestBody AMRoleRequestDTO requestDTO) {
        AMRoleResponseDTO response = new AMRoleResponseDTO();
        try {
            AMRoleResponseDTO createdRole = aMRoleService.createRole(requestDTO);
            return new ResponseEntity<>(createdRole, HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setMessage(e.getMessage());
            response.setTimestamp(LocalDateTime.now());
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<AMRoleResponseDTO> getRoleById(@PathVariable int id) {
        AMRoleResponseDTO response = new AMRoleResponseDTO();
        try {
            AMRole role = aMRoleService.getRoleById(id);

            if (role == null) {
                response.setStatus(false);
                response.setMessage("Role not found");
                response.setStatusCode(404);
                return new ResponseEntity<>(response, HttpStatus.NOT_FOUND);
            }

            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("Role fetched successfully");
            Map<String, Object> roleMap = new HashMap<>();
            roleMap.put("roleId", role.getRoleID());
            roleMap.put("roleName", role.getRoleName());
            roleMap.put("roleDescription", role.getRoleDescription());
            roleMap.put("rolePrivileges", role.getRolePrivileges());

            response.setResponse(roleMap);
            return new ResponseEntity<>(response, HttpStatus.OK);

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error fetching role");
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/update/{id}")
    public ResponseEntity<AMRoleResponseDTO> updateRole(
            @PathVariable("id") int id,
            @Valid @RequestBody AMRoleRequestDTO requestDTO) {
        AMRoleResponseDTO response = new AMRoleResponseDTO();
        try {
            AMRoleResponseDTO updatedRole = aMRoleService.updateRole(id, requestDTO);
            return new ResponseEntity<>(updatedRole, HttpStatus.OK);

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage(e.getMessage());
            response.setTimestamp(LocalDateTime.now());
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/v2.0/authentification/AMRole/status")
    public ResponseEntity<AMRoleResponseDTO> updateRoleStatus(@Valid @RequestBody RoleStatusRequestDTO reuqest) {
        AMRoleResponseDTO response = new AMRoleResponseDTO();
        try {
            // Calling service method to update role status
            AMRoleResponseDTO updatedResponse = aMRoleService.updateRoleStatus(reuqest);
            return new ResponseEntity<>(updatedResponse, HttpStatus.OK);

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error updating status: " + e.getMessage());
            response.setTimestamp(LocalDateTime.now());
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/v2.0/authentification/AMRole/archive")
    public ResponseEntity<AMRoleResponseDTO> updateRoleArchive(@RequestBody RoleStatusRequestDTO reuqest) {
        AMRoleResponseDTO response = new AMRoleResponseDTO();
        try {
            // Calling service method to update role status
            AMRoleResponseDTO updatedResponse = aMRoleService.updateRoleArchive(reuqest);
            return new ResponseEntity<>(updatedResponse, HttpStatus.OK);

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error updating status: " + e.getMessage());
            response.setTimestamp(LocalDateTime.now());
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

}