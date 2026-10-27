package tapmind.bsrv.dto;

import lombok.*;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserWorkDataRequestDTO {
    private Integer dailyTaskLogID; // new

    private Integer taskID;
    private Integer userID;
    private LocalDate workDate;
    private Integer setUp;
    private Double allocatedTime;
    private Double timeTakenToWork;
    private Boolean isForTarget;
    private Double overAllTime;
    private String remarks;
    private Double units;
    private Integer departmentID;
    private Integer achivedUnits;
    private String totalUnitValues;
    private Integer targetID;
    private Double totalTimePerSetup;
    private Boolean isHalfDayLeave;
    private String leaveType;
    private List<Integer> taskMeta;
}
