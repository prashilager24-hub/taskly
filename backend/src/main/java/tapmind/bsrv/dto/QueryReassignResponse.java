package tapmind.bsrv.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class QueryReassignResponse {
    private String queryId;
    private String team;
    private String status;
}
