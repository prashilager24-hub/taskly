package tapmind.bsrv.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Data;

@Data
public class RevisedGoalUpdateRequestDTO {

    private Integer userGoalDataID;

    private Long userId;

    private Long goalId;

    private LocalDate workDate;

    private RevisedGoalDetailsDTO revisedGoal;

    private String action;

    private Boolean clear;
}
