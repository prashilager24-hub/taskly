package tapmind.bsrv.dto;

import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class QueryQueueResponse {
    private String team;
    private Long openCount;
    private Long overdueCount;
    private Long resolvedClosedCount;
    private Double avgSupportScore;
    private Long surveysCompleted;
    private Integer slaHours;
    private List<QueryQueueItem> queries;

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class QueryQueueItem {
        private String id;
        private String employee;
        private String subject;
        private String category;
        private String status;
        private Integer ageHrs;
        private Boolean overdue;
        private String raisedOn;
        private Double supportScore;
        private List<Reply> replies;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class Reply {
        private String who;
        private String at;
        private String text;
    }
}
