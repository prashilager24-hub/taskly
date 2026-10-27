package tapmind.bsrv.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class QueryReopenResponse {
    private String queryId;
    private String status;
    private String reopenReason;
}
