package tapmind.bsrv.dto;

import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class EngagementScoresResponse {
    private String surveyId;
    private String quarter;
    private Double quarterAvg;
    private Long responseCount;
    private Integer sentTo;
    private Double responseRate;
    private List<String> monthLabels;
    private List<Double> monthAvgs;
    private List<Double> restAvgs;
    private List<String> restLabels;
    private Long commentCount;
    private List<Integer> distribution;
    private List<CommentItem> comments;

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CommentItem {
        private Double score;
        private String feedback;
        private String by;
    }
}
