
package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserCreateDTO {
  private String userName;
  private String userEmail;
  private String password;
  private Integer departmentID;
  private Integer RoleID;
  private Integer secondaryRoleID;
  private Integer userID;
  private String employeeID;
  private Integer reportingManagerId;
  private Integer elManagerId;
  private String appraisalCycle;
  private String feedbackresolverteam;
  // private UserInfo userInfo;
  // private String companyName;
  // private String companyType;
  // private String country;
  // private Boolean termsAndConditionAggred;
  // private String howDoYouKnowAboutUs;

  // @Data
  // public static class UserInfo{
  // private String userName;
  // private String userRole;
  // private Integer userID;
  // private Integer parentID;
  // private Boolean isForSupplyPartner;

  // }

}
