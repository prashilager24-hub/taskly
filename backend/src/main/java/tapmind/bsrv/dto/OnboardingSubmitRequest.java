package tapmind.bsrv.dto;

import jakarta.validation.constraints.*;
import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class OnboardingSubmitRequest {

    @NotBlank(message = "Survey ID is required")
    private String surveyId;

    @NotNull(message = "Answers are required")
    @Size(min = 7, max = 7, message = "Exactly 7 answers required")
    private List<Integer> answers;

    private String feedback;
}
