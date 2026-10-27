package tapmind.bsrv.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class QueryResolveResponse {
    private String queryId;
    private String status;
}
