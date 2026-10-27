package tapmind.bsrv.dto;

import java.math.BigDecimal;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class TeamSprintRow {
    private Long developerId;
    private String developerName;
    private String developerRole;
    private String sprintLabel;
    private Integer spCommitted;
    private Integer spCompleted;
    private Integer bugsIntroduced;
    private Integer prReviews;
    private BigDecimal scoreEfficiency;
    private BigDecimal scoreOverall;
    private String overallRating;
}
