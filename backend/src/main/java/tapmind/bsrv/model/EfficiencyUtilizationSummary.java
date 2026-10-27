package tapmind.bsrv.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.*;
import lombok.NoArgsConstructor;
import java.sql.Timestamp;

@Entity
@NoArgsConstructor
@AllArgsConstructor
@Data
@Table(name = "EfficiencyUtilizationSummary")
public class EfficiencyUtilizationSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "SummaryID")
    private Integer summaryID;

    @Column(name = "UserID")
    private Integer userID;

    @Column(name = "DepartmentID")
    private Integer departmentID;

    @Column(name = "WorkDate")
    private LocalDate workDate;

    @Column(name = "UtilizationPercent")
    private BigDecimal utilizationPercent;

   
    @Column(name = "EfficiencyLevel")
    private String efficiencyLevel;

    @Column(name = "TargetAchievedPercent")
    private BigDecimal targetAchievedPercent;

    @Column(name = "AllocatedTimeHrs")
    private BigDecimal allocatedTimeHrs;

    @Column(name = "TotalTimeOfWork")
    private BigDecimal totalTimeOfWork;

    @Column(name = "DayType")
    private String dayType = "Working";

    @Column(name = "DataStatus")
    private String dataStatus = "Draft";

    @Column(name = "Remarks")
    private String remarks;

    @Column(name = "CreatedAt", updatable = false, insertable = false)
    private Timestamp createdAt;

    @Column(name = "UpdatedAt", insertable = false)
    private Timestamp updatedAt;
}
