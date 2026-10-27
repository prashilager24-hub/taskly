package tapmind.bsrv.dto;

import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class QueryReplyResponse {
    private String queryId;
    private String status;
    private List<QueryEmployeeResponse.ThreadMessage> thread;
}
