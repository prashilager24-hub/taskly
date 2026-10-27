package tapmind.bsrv.dto;

import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class QueryEmployeeResponse {
    private List<QueryEmployeeItem> queries;

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class QueryEmployeeItem {
        private String id;
        private String employee;
        private String dept;
        private String team;
        private String category;
        private String subject;
        private String priority;
        private String raisedOn;
        private Integer ageHrs;
        private String status;
        private List<Integer> ratings;
        private String ratingComment;
        private Double supportScore;
        private List<ThreadMessage> thread;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ThreadMessage {
        private String who;
        private String at;
        private String text;
    }
}
