package tapmind.bsrv.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentTaskRequestDTO {
    private Integer departmentID;
    private String taskName;
    private Double standardTimeMins;
    private String frequency;  // Daily / Weekly / Monthly / Dynamic
    private Boolean isDynamic;
    private String description;
    private Integer executiveLeaderID;
     private Integer targetNumber;
    private Boolean isForTarget;
    private String timingType;
    private Integer roleID;
}
