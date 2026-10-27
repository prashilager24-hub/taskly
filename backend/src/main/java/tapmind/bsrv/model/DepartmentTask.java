package tapmind.bsrv.model;

import jakarta.persistence.*;
import java.sql.Timestamp;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.*;
import lombok.NoArgsConstructor;

@Data
@Entity
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "DepartmentTask")
public class DepartmentTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "TaskID")
    private Integer taskID;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "DepartmentID", nullable = false)
    private Department department;

    @Column(name = "TaskName", nullable = false, length = 150)
    private String taskName;

    @Column(name = "StandardTimeMins", precision = 6, scale = 2)
    private Double standardTimeMins;

   
    @Column(name = "Frequency", length = 20)
    private String frequency;

    @Column(name = "IsDynamic")
    private Boolean isDynamic = false;

    @Column(name = "Description", length = 255)
    private String description;

    @Column(name = "IsActive")
    private Boolean isActive = true;

   @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "CreatedAt")
    private Date createdAt;

   @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "ModifiedAt")
    private Date modifiedAt;

    
    @Column(name = "TimingType", nullable = false, length = 150)
    private String timingType;



    @Column(name = "IsForTarget")
    private Boolean isForTarget = false;

    @Column(name = "TargetNumber")
    private Integer targetNumber;

    @Column(name = "RoleID")
    private Integer roleID;

}
