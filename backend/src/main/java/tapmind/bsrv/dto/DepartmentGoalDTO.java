package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime; // ✅ REQUIRED

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentGoalDTO {

    private Integer goalID;
    private Integer departmentID;
    private String departmentName;
    private String goalName;
    private String goalMetric;
    private String metricValue;
    private Integer liveAccounts; // ❌ NEW PARAM
    private String unit;
    private String frequency;
    private String timingType;
    private Boolean isDynamic;
    private String description;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime modifiedAt;
    private Boolean approvedByEL;
    private Integer roleID;
    private Boolean isDepartmentArchived;
    private String newStatus;
}
