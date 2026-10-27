package tapmind.bsrv.dto;

import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class OnboardingAdminResponse {
    private Double orgAvg;
    private Integer responseRate;
    private DeptStat lowestDept;
    private DeptStat highestDept;
    private List<DeptStat> departmentBreakdown;
    private EmailPreview notificationEmail;

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class DeptStat {
        private String dept;
        private Integer sent;
        private Integer responded;
        private Double avg;
        private Long below6;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class EmailPreview {
        private String to;
        private String subject;
        private String body;
    }
}
