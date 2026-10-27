package tapmind.bsrv.dto;

import jakarta.validation.constraints.*;
import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class EngagementSubmitRequest {

    @NotBlank(message = "Survey ID is required")
    private String surveyId;

    @NotNull(message = "Months ratings are required")
    @Size(min = 3, max = 3, message = "Exactly 3 month ratings required")
    private List<Integer> months;

    @NotNull(message = "Rest ratings are required")
    @Size(min = 2, max = 2, message = "Exactly 2 rest ratings required")
    private List<Integer> rest;

    private String feedback;

    private Boolean anonymous = false;
}
