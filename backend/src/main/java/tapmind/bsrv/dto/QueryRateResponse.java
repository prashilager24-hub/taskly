package tapmind.bsrv.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class QueryRateResponse {
    private String queryId;
    private String status;
    private Double overallScore;
}
