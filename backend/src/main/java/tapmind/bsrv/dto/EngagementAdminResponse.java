package tapmind.bsrv.dto;

import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class EngagementAdminResponse {
    private String latestQuarter;
    private Double latestQuarterAvg;
    private Double avgAcrossQuarters;
    private Double avgResponseRate;
    private Long detractorPct;
    private String notifyTo;
    private List<QuarterOnQuarterItem> quarterOnQuarter;
    private EmailPreview emailPreview;

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class QuarterOnQuarterItem {
        private String quarter;
        private Long responseCount;
        private Integer sentTo;
        private Double responseRate;
        private Double activities;
        private Double planning;
        private Double approachability;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class EmailPreview {
        private String to;
        private String subject;
        private String body;
    }
}
