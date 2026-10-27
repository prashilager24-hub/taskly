package tapmind.bsrv.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Data;

@Data
public class GoalAchievementUpdateRequest {

    @NotNull
    private Long userId;

    @NotNull
    private Long goalId;

    @NotNull
    private BigDecimal achievedGoal;

    @NotNull
    private LocalDate workDate;
    private String comment;
}