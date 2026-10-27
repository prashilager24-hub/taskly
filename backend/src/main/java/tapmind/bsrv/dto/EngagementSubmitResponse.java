package tapmind.bsrv.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class EngagementSubmitResponse {
    private Boolean recorded;
    private Double overallScore;
}
