package tapmind.bsrv.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class EngagementRolloutResponse {
    private String id;
    private String quarter;
    private Integer sentTo;
    private String status;
}
