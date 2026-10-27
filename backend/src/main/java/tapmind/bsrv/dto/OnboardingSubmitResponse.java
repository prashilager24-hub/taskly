package tapmind.bsrv.dto;

import java.time.LocalDateTime;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class OnboardingSubmitResponse {
    private String surveyId;
    private Double overallScore;
    private LocalDateTime submittedAt;
}
