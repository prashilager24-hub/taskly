package tapmind.bsrv.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class SprintSubmitRequest {

    @NotNull(message = "User ID is required")
    private Integer userId;

    @NotBlank(message = "Sprint label is required")
    @Size(max = 50)
    private String sprintLabel;

    @NotNull(message = "Week start is required")
    private LocalDate weekStart;

    @NotNull(message = "Week end is required")
    private LocalDate weekEnd;

    @Min(0) @Max(5)
    private Integer daysPresent = 0;

    @Min(0)
    private Integer spCommitted = 0;

    @Min(0)
    private Integer spCompleted = 0;

    @Min(0)
    private Integer bugsIntroduced = 0;

    @Min(0)
    private Integer prReviews = 0;

    @Min(0)
    private Integer spCarryover = 0;

    @Min(0)
    private Integer blockers = 0;

    @Min(0) @Max(10)
    private Integer selfRating = 0;

    private String achievements;
    private String challenges;
    private String nextFocus;

    @Valid
    @Builder.Default
    private List<TaskRequest> tasks = new ArrayList<>();

    @Valid
    @Builder.Default
    private List<GoalRequest> goals = new ArrayList<>();
}
