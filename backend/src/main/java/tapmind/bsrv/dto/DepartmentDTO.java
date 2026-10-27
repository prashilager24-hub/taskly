package tapmind.bsrv.dto;

import java.time.LocalDate;

public class DepartmentDTO {

    private Integer departmentID;
    private String departmentName;
    private Boolean departmentStatus;
    private Boolean isDepartmentArchived;
    private LocalDate departmentCreateTime;
    private LocalDate departmentModifyTime;
    private String departmentDescription;
    private String executiveLeaderName;
    private String functionalLeaderName;
    private String newStatus;
    private Boolean isExecutiveLeader;
    private Integer executiveLeaderID;
    private Integer functionalLeaderID;
    private Long primaryDepartmentId;
    private String primaryDepartmentName;

    public DepartmentDTO(Integer departmentID, String departmentName) {
        this.departmentID = departmentID;
        this.departmentName = departmentName;

    }

    public DepartmentDTO(
            Integer departmentID,
            String departmentName,
            Integer executiveLeaderID,
            Integer functionalLeaderID) {

        this.departmentID = departmentID;
        this.departmentName = departmentName;
        this.executiveLeaderID = executiveLeaderID;
        this.functionalLeaderID = functionalLeaderID;
    }

    public DepartmentDTO(Integer departmentID, String departmentName, Boolean departmentStatus,
            Boolean isDepartmentArchived,
            LocalDate departmentCreateTime, LocalDate departmentModifyTime, String departmentDescription,
            String executiveLeaderName, String functionalLeaderName, Integer executiveLeaderID,
            Integer functionalLeaderID,
            Long primaryDepartmentId, String primaryDepartmentName,
            String newStatus) {
        this.departmentID = departmentID;
        this.departmentName = departmentName;
        this.departmentStatus = departmentStatus;
        this.isDepartmentArchived = isDepartmentArchived;
        this.departmentCreateTime = departmentCreateTime;
        this.departmentModifyTime = departmentModifyTime;
        this.departmentDescription = departmentDescription;
        this.executiveLeaderName = executiveLeaderName;
        this.functionalLeaderName = functionalLeaderName;
        this.executiveLeaderID = executiveLeaderID;
        this.functionalLeaderID = functionalLeaderID;
        this.primaryDepartmentId = primaryDepartmentId;
        this.primaryDepartmentName = primaryDepartmentName;
        this.newStatus = newStatus;

    }

    public Integer getDepartmentID() {
        return departmentID;
    }

    public void setDepartmentID(Integer departmentID) {
        this.departmentID = departmentID;
    }

    public Integer getExecutiveLeaderID() {
        return executiveLeaderID;
    }

    public void setExecutiveLeaderID(Integer executiveLeaderID) {
        this.executiveLeaderID = executiveLeaderID;
    }

    public Integer getFunctionalLeaderID() {
        return functionalLeaderID;
    }

    public void setFunctionalLeaderID(Integer functionalLeaderID) {
        this.functionalLeaderID = functionalLeaderID;
    }

    public String getDepartmentName() {
        return departmentName;
    }

    public void setDepartmentName(String departmentName) {
        this.departmentName = departmentName;
    }

    public String getExecutiveLeaderName() {
        return executiveLeaderName;
    }

    public void setExecutiveLeaderName(String executiveLeaderName) {
        this.executiveLeaderName = executiveLeaderName;
    }

    public String getFunctionalLeaderName() {
        return functionalLeaderName;
    }

    public void setFunctionalLeaderName(String functionalLeaderName) {
        this.functionalLeaderName = functionalLeaderName;
    }

    public Boolean getDepartmentStatus() {
        return departmentStatus;
    }

    public void setDepartmentStatus(Boolean departmentStatus) {
        this.departmentStatus = departmentStatus;
    }

    public Boolean getIsDepartmentArchived() {
        return isDepartmentArchived;
    }

    public void setIsDepartmentArchived(Boolean isDepartmentArchived) {
        this.isDepartmentArchived = isDepartmentArchived;
    }

    public LocalDate getDepartmentCreateTime() {
        return departmentCreateTime;
    }

    public void setDepartmentCreateTime(LocalDate departmentCreateTime) {
        this.departmentCreateTime = departmentCreateTime;
    }

    public LocalDate getDepartmentModifyTime() {
        return departmentModifyTime;
    }

    public void setDepartmentModifyTime(LocalDate departmentModifyTime) {
        this.departmentModifyTime = departmentModifyTime;
    }

    public String getDepartmentDescription() {
        return departmentDescription;
    }

    public void setDepartmentDescription(String departmentDescription) {
        this.departmentDescription = departmentDescription;
    }

    public String getNewStatus() {
        return newStatus;
    }

    public void setNewStatus(String newStatus) {
        this.newStatus = newStatus;
    }

    public Long getPrimaryDepartmentId() {
        return primaryDepartmentId;
    }

    public void setPrimaryDepartmentId(Long primaryDepartmentId) {
        this.primaryDepartmentId = primaryDepartmentId;
    }

    public String getPrimaryDepartmentName() {
        return primaryDepartmentName;
    }

    public void setPrimaryDepartmentName(String primaryDepartmentName) {
        this.primaryDepartmentName = primaryDepartmentName;
    }

}
