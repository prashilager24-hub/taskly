package tapmind.bsrv.dto;

import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class EngagementEmployeeResponse {
    private List<EngagementSurveyItem> surveys;

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class EngagementSurveyItem {
        private String id;
        private String quarter;
        private List<String> months;
        private String closes;
        private String status;
        private Boolean submitted;
    }
}
