package tapmind.bsrv.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class QueryReassignRequest {
    private String reason;
}
