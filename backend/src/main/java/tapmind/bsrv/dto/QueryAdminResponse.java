package tapmind.bsrv.dto;

import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class QueryAdminResponse {
    private Double avgSupportScore;
    private Long totalRaised;
    private Long totalResolved;
    private Long totalOpen;
    private Long slaBreached;
    private Long scoresBelow6;
    private List<Double> questionAverages;
    private List<Integer> distribution;
    private List<TeamStat> byTeam;
    private List<LowScoringItem> lowScoring;

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class TeamStat {
        private String team;
        private Long raised;
        private Long resolved;
        private Double avg;
        private Long below6;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class LowScoringItem {
        private String id;
        private String team;
        private String subject;
        private Double avg;
        private String weakest;
        private String comment;
    }
}
