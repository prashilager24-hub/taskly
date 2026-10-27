package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "DepartmentTarget")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DepartmentTarget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "TargetID")
    private Integer targetID;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "DepartmentID", nullable = false)
    private Department department;

    @Column(name = "TargetName", length = 400)
    private String targetName;

    @Column(name = "TargetMetric", length = 100, nullable = false)
    private String targetMetric;

    @Column(name = "MetricValue", length = 50)
    private String metricValue;

    @Column(name = "Unit", length = 20)
    private String unit;

   
    @Column(name = "Frequency", length = 20)
    private String frequency ;

    @Column(name = "TimingType", length = 100)
    private String timingType;

    @Column(name = "IsDynamic")
    private Boolean isDynamic = false;

    @Column(name = "Description", length = 255)
    private String description;

    @Column(name = "IsActive")
    private Boolean isActive = true;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "CreatedAt", nullable = false, updatable = false)
    private Date createdAt = new Date();

    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "ModifiedAt")
    private Date modifiedAt = new Date();

    @Column(name = "RoleID")
    private Integer roleID;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "DepartmentTargetRole", joinColumns = @JoinColumn(name = "TargetID"))
    @Column(name = "RoleID")
    private Set<Integer> roleIds = new HashSet<>();

    @PreUpdate
    public void preUpdate() {
        this.modifiedAt = new Date();
    }

}
