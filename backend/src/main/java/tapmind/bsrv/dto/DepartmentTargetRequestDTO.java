package tapmind.bsrv.dto;

import lombok.*;
import java.util.List;


@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DepartmentTargetRequestDTO {
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
    private String startDate;
    private String endDate;
    private String searchText;
    private Integer roleID;
    private List<Integer> roleIds;
}
