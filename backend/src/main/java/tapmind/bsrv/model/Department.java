package tapmind.bsrv.model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(name = "Department")
public class Department {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "DepartmentID")
    private int departmentID;

    @Column(name = "DepartmentName", length = 220)
    private String departmentName;

    @Column(name = "DepartmentStatus")
    private boolean departmentStatus = true;

    @Column(name = "IsDepartmentArchived")
    private boolean isDepartmentArchived = false;

    @Column(name = "DepartmentDescription", columnDefinition = "TEXT")
    private String departmentDescription;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "DepartmentCreateTime")
    private Date departmentCreateTime;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "DepartmentModifyTime")
    private Date departmentModifyTime;


     @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ExecutiveLeaderID", referencedColumnName = "UserID")
    private User executiveLeader;


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "FunctionalLeaderID", referencedColumnName = "UserID")
    private User functionalLeader;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "PrimaryDepartmentId", referencedColumnName = "PrimaryDepartmentId")
    private PrimaryDepartment primaryDepartment;

    

    // Getters and Setters
    public int getDepartmentID() {
        return departmentID;
    }

    public void setDepartmentID(int departmentID) {
        this.departmentID = departmentID;
    }

        // Getters and Setters
    public User getExecutiveLeader() {
        return executiveLeader;
    }

    public void setExecutiveLeader(User executiveLeader) {
        this.executiveLeader = executiveLeader;
    }
    public User getFunctionalLeader() {
        return functionalLeader;
    }

    public void setFunctionalLeader(User functionalLeader) {
        this.functionalLeader = functionalLeader;
    }

    public String getDepartmentName() {
        return departmentName;
    }

    public void setDepartmentName(String departmentName) {
        this.departmentName = departmentName;
    }

    public boolean isDepartmentStatus() {
        return departmentStatus;
    }

    public void setDepartmentStatus(boolean departmentStatus) {
        this.departmentStatus = departmentStatus;
    }

    public boolean isDepartmentArchived() {
        return isDepartmentArchived;
    }

    public void setDepartmentArchived(boolean departmentArchived) {
        isDepartmentArchived = departmentArchived;
    }

    public String getDepartmentDescription() {
        return departmentDescription;
    }

    public void setDepartmentDescription(String departmentDescription) {
        this.departmentDescription = departmentDescription;
    }

    public Date getDepartmentCreateTime() {
        return departmentCreateTime;
    }

    public void setDepartmentCreateTime(Date departmentCreateTime) {
        this.departmentCreateTime = departmentCreateTime;
    }

    public Date getDepartmentModifyTime() {
        return departmentModifyTime;
    }

    public void setDepartmentModifyTime(Date departmentModifyTime) {
        this.departmentModifyTime = departmentModifyTime;
    }

    public PrimaryDepartment getPrimaryDepartment() {
        return primaryDepartment;
    }

    public void setPrimaryDepartment(PrimaryDepartment primaryDepartment) {
        this.primaryDepartment = primaryDepartment;
    }
}