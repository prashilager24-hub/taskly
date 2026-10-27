package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentHierarchyDTO {

    private Long primaryDepartmentId;
    private String primaryDepartmentName;
    private String type;
    private boolean isActive;

    private List<SubDepartmentDTO> departments;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubDepartmentDTO {
        private Integer departmentID;
        private String departmentName;
        private String departmentDescription;
        private boolean departmentStatus;
        private boolean isDepartmentArchived;
        private Integer executiveLeaderId;
        private String executiveLeaderName;
        private Integer functionalLeaderId;
        private String functionalLeaderName;
        private List<UserDetailDTO> users;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserDetailDTO {
        private Integer userID;
        private String name;
        private String userEmail;
        private String employeeID;
        private Boolean userStatus;
        private Integer roleID;
        private String roleName;
        private Integer reportingManagerId;
        private String reportingManagerName;
    }
}
