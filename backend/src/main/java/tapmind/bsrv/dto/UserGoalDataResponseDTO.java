package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserGoalDataResponseDTO {

    private Integer userGoalDataID;
    private LocalDate workDate;

    private Integer userID;
    private String userName;

    private Integer departmentID;

    private Integer goalID;
    private String goalName;

    private BigDecimal fixedGoal;
    private BigDecimal achievedGoal;

    private BigDecimal goalEfficiencyPercent;

    private BigDecimal recalculatedTarget;
    private String comment;
    private RevisedGoalDetailsDTO revisedGoal;
    private Boolean approvedByEL;
}
