package tapmind.bsrv.dto;

import java.util.*;
import lombok.Data;
public class AMRoleRequestDTO {

    private String roleName;
    private Map<String,Object> rolePrivileges;
    private String roleDescription;
    
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



    // Getters and Setters

    public String getRoleName() {
        return roleName;
    }

    public void setRoleName(String roleName) {
        this.roleName = roleName;
    }

    public Map<String,Object> getRolePrivileges() {
        return rolePrivileges;
    }

    public void setRolePrivileges(Map<String,Object> rolePrivileges) {
        this.rolePrivileges = rolePrivileges;
    }

    public String getRoleDescription() {
        return roleDescription;
    }

    public void setRoleDescription(String roleDescription) {
        this.roleDescription = roleDescription;
    }
}