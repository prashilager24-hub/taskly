package tapmind.bsrv.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class UserResponse {
    private Integer userId;
    private String  name;
    private String  userEmail;
    private Boolean userStatus;
     private String employeeID;

    private String appraisalCycle;

    private String feedbackresolverteam;

    private Integer reportingManagerId;
    private String reportingManagerName;

    private Integer elManagerId;
    private String elManagerName;
}
