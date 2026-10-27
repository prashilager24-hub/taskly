package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserDTO {
  private Integer userID;
  private String userName;
  private String userEmail;
  private String userPasswordExpiryDate;
  private Boolean userStatus;
  private Boolean isUserArchived;
  private String userCreateTime;
  private String userModifyTime;
  private String newStatus;
  // Add Department details
  private Integer departmentID;
  private String departmentName;
  private Integer roleID;
  private Integer secondaryRoleID;
  private String roleName;
  private String employeeID;
  private String reportingManagerName;
  private String elManagerName;
  private Integer reportingManagerId;
  private Integer elManagerId;
  private String appraisalCycle;
  private String feedbackresolverteam;
  private List<DepartmentDTO> departments;
}
