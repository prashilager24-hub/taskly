package tapmind.bsrv.dto;

import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class OnboardingSurveyHRResponse {
    private List<OnboardingSurveyHRSurveyItem> surveys;

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class OnboardingSurveyHRSurveyItem {
        private String id;
        private String employee;
        private String dept;
        private String joined;
        private String sentOn;
        private String due;
        private String status;
        private List<Integer> answers;
        private String feedback;
        private Double score;
        private Double hrBlockAvg;
    }
}
