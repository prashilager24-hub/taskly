package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import lombok.Data;
import java.time.LocalDateTime;
import java.math.BigDecimal;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class DepartmentTaskDTO {
    private Integer taskID;
    private Integer departmentID;
    private String taskName;
    private BigDecimal standardTimeMins;
    private String frequency;
    private Boolean isDynamic;
    private String description;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime modifiedAt;
    private String departmentName;
    private Boolean isForTarget;
    private Integer targetNumber;
    private String timingType;
    private Integer roleID;
}
