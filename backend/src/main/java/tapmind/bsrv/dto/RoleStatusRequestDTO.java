package tapmind.bsrv.dto;
import java.util.List;
import lombok.Data;
public class RoleStatusRequestDTO {
    private boolean roleStatus;  // The status to set for the roles
    private List<Integer> roleIDList;  // List of role IDs to update


    
    private UserInfo userInfo;

     public UserInfo getUserInfo() {
        return userInfo;
    }

    public void setUserInfo(UserInfo userInfo) {
        this.userInfo = userInfo;
    }

     @Data
    public static class UserInfo{
         private String userName;
          private String userRole;
         private Integer userID;
         private Integer parentID;
         private Boolean isForSupplyPartner;

    }

    // Getters and setters
    public boolean getRoleStatus() {
        return roleStatus;
    }

    public void setRoleStatus(boolean roleStatus) {
        this.roleStatus = roleStatus;
    }

    public List<Integer> getRoleIDList() {
        return roleIDList;
    }

    public void setRoleIDList(List<Integer> roleIDList) {
        this.roleIDList = roleIDList;
    }
}
