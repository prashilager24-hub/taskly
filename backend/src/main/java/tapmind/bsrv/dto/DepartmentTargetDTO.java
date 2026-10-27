package tapmind.bsrv.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentTargetDTO {
    private Integer targetID;
    private Integer departmentID;
    private String targetName;
    private String targetMetric;
    private String metricValue;
    private String unit;
    private String frequency;
    private String timingType;
    private Boolean isDynamic;
    private String description;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime modifiedAt;
    private Integer roleID;
    private List<Integer> roleIds;
}
