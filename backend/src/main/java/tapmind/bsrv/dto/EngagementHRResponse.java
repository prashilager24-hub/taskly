package tapmind.bsrv.dto;

import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class EngagementHRResponse {
    private List<EngagementHRSurveyItem> surveys;

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class EngagementHRSurveyItem {
        private String id;
        private String quarter;
        private List<String> months;
        private Integer sentTo;
        private String opens;
        private String closes;
        private String status;
        private Long responseCount;
        private Double responseRate;
        private List<EngagementHRResponse.ResponseItem> responses;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ResponseItem {
        private String by;
        private Boolean anonymous;
        private List<Integer> months;
        private List<Integer> rest;
        private String feedback;
    }
}
