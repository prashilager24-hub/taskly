package tapmind.bsrv.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@Builder
public class ReviewStatusSummaryDTO {

    private Integer departmentID;
    private String filterType;
    private String periodLabel;
    private Integer totalUsers;
    private Integer reviewedCount;
    private Integer nonReviewedCount;
    private List<UserReviewStatus> reviewedUsers;
    private List<UserReviewStatus> nonReviewedUsers;

    @Getter
    @Setter
    @Builder
    public static class UserReviewStatus {
        private Integer userID;
        private String userName;
        private String userEmail;
        private Integer entryCount;
        private Integer systemGrade;
        private BigDecimal managerAvgRating;
        private BigDecimal finalRating;
        private String managerRatings;
        private BigDecimal targetPercent;
        private BigDecimal goalAchievement;
        private String empId;
        private String department;
        private String accessor1;
        private String accessor2;
        private String elName;
        private String reportingManagerName;
    }
}
