package tapmind.bsrv.model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(name = "AMRole")
public class AMRole {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "RoleID")
    private int roleID;

    @Column(name = "RoleName", length = 220)
    private String roleName;

   @Lob
    @Column(name = "RolePrivileges", columnDefinition = "LONGTEXT")
    private String rolePrivileges;  // Store JSON as String

    @Column(name = "RoleStatus")
    private boolean roleStatus=true;;

    @Column(name = "IsRoleArchived")
    private boolean isRoleArchived=false;

    @Column(name = "RoleDescription", columnDefinition = "TEXT")
    private String roleDescription;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "RoleCreateTime")
    private Date roleCreateTime;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "RoleModifyTime")
    private Date roleModifyTime;

  

    public int getRoleID() {
        return roleID;
    }

    public void setRoleID(int roleID) {
        this.roleID = roleID;
    }

    public String getRoleName() {
        return roleName;
    }

    public void setRoleName(String roleName) {
        this.roleName = roleName;
    }

    public String getRolePrivileges() {
        return rolePrivileges;
    }

    public void setRolePrivileges(String rolePrivileges) {
        this.rolePrivileges = rolePrivileges;
    }

    public boolean isRoleStatus() {
        return roleStatus;
    }

    public void setRoleStatus(boolean roleStatus) {
        this.roleStatus = roleStatus;
    }

    public boolean isRoleArchived() {
        return isRoleArchived;
    }

    public void setRoleArchived(boolean roleArchived) {
        this.isRoleArchived = roleArchived;
    }

    public String getRoleDescription() {
        return roleDescription;
    }

    public void setRoleDescription(String roleDescription) {
        this.roleDescription = roleDescription;
    }

    public Date getRoleCreateTime() {
        return roleCreateTime;
    }

    public void setRoleCreateTime(Date roleCreateTime) {
        this.roleCreateTime = roleCreateTime;
    }

    public Date getRoleModifyTime() {
        return roleModifyTime;
    }

    public void setRoleModifyTime(Date roleModifyTime) {
        this.roleModifyTime = roleModifyTime;
    }

  
}
