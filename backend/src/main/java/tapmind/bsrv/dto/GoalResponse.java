package tapmind.bsrv.dto;

import java.math.BigDecimal;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class GoalResponse {
    private Long id;
    private String goalName;
    private Integer targetPct;
    private Integer achievedPct;
    private Boolean isAchieved;
    private BigDecimal progressPct;   // MIN(100, achieved / target * 100)
    private Integer sortOrder;
}
