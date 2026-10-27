package tapmind.bsrv.dto;

import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class QueryRaiseResponse {
    private String id;
    private String team;
    private String category;
    private String subject;
    private String priority;
    private String raisedOn;
    private String status;
    private List<QueryEmployeeResponse.ThreadMessage> thread;
}
