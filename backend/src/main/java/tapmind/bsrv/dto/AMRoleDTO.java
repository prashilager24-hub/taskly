package tapmind.bsrv.dto;

import java.time.LocalDate;
import java.util.*;
public class AMRoleDTO {

    private Integer roleID;
    private String roleName;
    private Boolean roleStatus;
    private Boolean isRoleArchived;
    private LocalDate roleCreateTime;
    private LocalDate roleModifyTime;
    private String roleDescription;
    private String newStatus;
    private Map<String,Object> rolePrivileges;

    // Constructor
    public AMRoleDTO(Integer roleID, String roleName, Boolean roleStatus, Boolean isRoleArchived,
                     LocalDate roleCreateTime, LocalDate roleModifyTime, String roleDescription, String newStatus,Map<String,Object> rolePrivileges) {
        this.roleID = roleID;
        this.roleName = roleName;
        this.roleStatus = roleStatus;
        this.isRoleArchived = isRoleArchived;
        this.roleCreateTime = roleCreateTime;
        this.roleModifyTime = roleModifyTime;
        this.roleDescription = roleDescription;
        this.newStatus = newStatus;
        this.rolePrivileges=rolePrivileges;
    }

    // Getters and Setters
    public Map<String,Object> getRolePrivileges() {
        return rolePrivileges;
    }

    public void setRolePrivileges(Map<String,Object> rolePrivileges) {
        this.rolePrivileges = rolePrivileges;
    }

     public Integer getRoleID() {
        return roleID;
    }

    public void setRoleID(Integer roleID) {
        this.roleID = roleID;
    }

    public String getRoleName() {
        return roleName;
    }

    public void setRoleName(String roleName) {
        this.roleName = roleName;
    }

    public Boolean getRoleStatus() {
        return roleStatus;
    }

    public void setRoleStatus(Boolean roleStatus) {
        this.roleStatus = roleStatus;
    }

    public Boolean getIsRoleArchived() {
        return isRoleArchived;
    }

    public void setIsRoleArchived(Boolean isRoleArchived) {
        this.isRoleArchived = isRoleArchived;
    }

    public LocalDate getRoleCreateTime() {
        return roleCreateTime;
    }

    public void setRoleCreateTime(LocalDate roleCreateTime) {
        this.roleCreateTime = roleCreateTime;
    }

    public LocalDate getRoleModifyTime() {
        return roleModifyTime;
    }

    public void setRoleModifyTime(LocalDate roleModifyTime) {
        this.roleModifyTime = roleModifyTime;
    }

    public String getRoleDescription() {
        return roleDescription;
    }

    public void setRoleDescription(String roleDescription) {
        this.roleDescription = roleDescription;
    }

    public String getNewStatus() {
        return newStatus;
    }

    public void setNewStatus(String newStatus) {
        this.newStatus = newStatus;
    }

}
