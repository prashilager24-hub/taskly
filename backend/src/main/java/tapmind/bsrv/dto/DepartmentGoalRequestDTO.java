package tapmind.bsrv.dto;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentGoalRequestDTO {

    private Integer departmentID;
    private String goalName;
    private String goalMetric;
    private String metricValue;
    // ✅ NEW FIELD
    private Integer liveAccounts;
    private String unit;
    private String frequency;
    private String timingType;
    private Boolean isDynamic;
    private String description;
    private Boolean isActive;
    private Integer roleID;
}
