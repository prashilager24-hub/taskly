package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.Date;

@Entity
@Table(name = "DepartmentGoal")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DepartmentGoal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "GoalID")
    private Integer goalID;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "DepartmentID", nullable = false)
    private Department department;

    @Column(name = "GoalName", length = 400)
    private String goalName;

    @Column(name = "GoalMetric", length = 100, nullable = false)
    private String goalMetric;

    @Column(name = "MetricValue", length = 50)
    private String metricValue;

    @Column(name = "LiveAccounts")
    private Integer liveAccounts = 0;

    @Column(name = "Unit", length = 20)
    private String unit;

    @Column(name = "Frequency", length = 20)
    private String frequency;

    @Column(name = "TimingType", length = 100)
    private String timingType;

    @Column(name = "IsDynamic")
    private Boolean isDynamic = false;

    @Column(name = "Description", length = 255)
    private String description;

    @Column(name = "IsActive")
    private Boolean isActive = true;

    @Column(name = "approvedByEL")
    private Boolean approvedByEL = false;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "CreatedAt", nullable = false, updatable = false)
    private Date createdAt = new Date();

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "ModifiedAt")
    private Date modifiedAt = new Date();

    @Column(name = "RoleID")
    private Integer roleID;

    @PreUpdate
    public void preUpdate() {
        this.modifiedAt = new Date();
    }
}
