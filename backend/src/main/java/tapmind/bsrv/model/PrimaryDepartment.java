package tapmind.bsrv.model;

import jakarta.persistence.*;
import tapmind.bsrv.enums.Criteria;
import java.util.Date;

@Entity
@Table(name = "PrimaryDepartment")
public class PrimaryDepartment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "PrimaryDepartmentId")
    private Long primaryDepartmentId;

    @Column(name = "PrimaryDepartmentName", length = 150, nullable = false)
    private String primaryDepartmentName;

    @Column(name = "Type", length = 50)
    private String type;

    @Enumerated(EnumType.STRING)
    @Column(name = "GoalCriteria", length = 20)
    private Criteria goalCriteria;

    @Enumerated(EnumType.STRING)
    @Column(name = "TargetCriteria", length = 20)
    private Criteria targetCriteria;

    @Column(name = "IsActive", nullable = false)
    private boolean isActive = true;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "CreatedAt", nullable = false, updatable = false)
    private Date createdAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "UpdatedAt", nullable = false)
    private Date updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
        updatedAt = new Date();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
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

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Criteria getGoalCriteria() {
        return goalCriteria;
    }

    public void setGoalCriteria(Criteria goalCriteria) {
        this.goalCriteria = goalCriteria;
    }

    public Criteria getTargetCriteria() {
        return targetCriteria;
    }

    public void setTargetCriteria(Criteria targetCriteria) {
        this.targetCriteria = targetCriteria;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        isActive = active;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
    }
}
