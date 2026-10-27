package tapmind.bsrv.dto;

import java.time.LocalDate;
import lombok.Data;

@Data
public class RevisedTargetUpdateRequestDTO {

    private Integer dailyTaskLogID;

    private Integer userID;

    private Integer taskID;

    private LocalDate workDate;

    private Boolean isForTarget;

    private RevisedTargetDetailsDTO revisedTarget;

    private String action;

    private Boolean clear;
}
