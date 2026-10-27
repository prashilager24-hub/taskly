package tapmind.bsrv.dto;

import jakarta.validation.constraints.*;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class GoalRequest {

    @NotBlank(message = "Goal name is required")
    @Size(max = 500)
    private String goalName;

    @Min(0) @Max(100)
    private Integer targetPct = 100;

    @Min(0) @Max(100)
    private Integer achievedPct = 0;

    private Integer sortOrder = 0;
}
