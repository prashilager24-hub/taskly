package tapmind.bsrv.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class DailyTaskLogDTO {
    private Integer dailyTaskLogID;
    private Integer taskID;
    private String taskName;
    private Integer userID;
    private String userName;
    private String workDate;
    private String actualTimeOfWork;
    private String remarks;
    private String createdAt;
    private String updatedAt;
    private String dataPercentage;
    private String totalTimePerSetup;
}
