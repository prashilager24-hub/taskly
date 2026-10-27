package tapmind.bsrv.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class SprintEntryResponse {

    private Long id;
    private Integer userId;
    private String  userName;
    private String  userEmail;
    private String sprintLabel;
    private LocalDate weekStart;
    private LocalDate weekEnd;

    // raw inputs
    private Integer daysPresent;
    private Integer spCommitted;
    private Integer spCompleted;
    private Integer bugsIntroduced;
    private Integer prReviews;
    private Integer spCarryover;
    private Integer blockers;
    private Integer selfRating;

    // computed scores (from DB generated columns)
    private BigDecimal scoreCompletion;
    private BigDecimal scoreUtilisation;
    private BigDecimal scoreQuality;
    private BigDecimal scoreEfficiency;
    private BigDecimal scoreOverall;

    // threshold bands
    private ScoreBand completionBand;
    private ScoreBand utilisationBand;
    private ScoreBand qualityBand;
    private ScoreBand efficiencyBand;
    private String overallRating;   // EXCELLENT / GOOD / FAIR / NEEDS_FOCUS

    // radar chart data
    private RadarData radar;

    // reflection
    private String achievements;
    private String challenges;
    private String nextFocus;
    private String managerNote;

    private LocalDateTime entryTimestamp;
    private LocalDateTime updatedAt;

    // child lists
    private List<TaskResponse> tasks;
    private List<GoalResponse> goals;

    // goal summary
    private Integer totalGoals;
    private Integer metGoals;
}
