package tapmind.bsrv.dto;

import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class OnboardingScoresResponse {
    private Double overallAvg;
    private Double processBlockAvg;
    private Double hrBlockAvg;
    private Integer responseRate;
    private Long pending;
    private Long scoresBelow6;
    private Long submittedCount;
    private List<Integer> distribution;
    private List<Double> questionAverages;
    private List<Q8FeedbackItem> q8Feedback;

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class Q8FeedbackItem {
        private Double score;
        private String employee;
        private String dept;
        private String feedback;
    }
}
