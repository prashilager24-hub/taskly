package tapmind.bsrv.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class QuarterlyReviewRequestDTO {

    private Integer empId;

    private String quarter;

    private Integer quarterYear;

    private String quarterStartDate;
    private Object grade;
    private String quarterEndDate;

    private BigDecimal targetPercent;

    private BigDecimal goalAchievement;

    private BigDecimal utilizationPercent;

    private BigDecimal efficiencyPercent;

    private String efficiencyLabel;

    private Integer systemGrade;

    private BigDecimal managerAvgRating;

    private BigDecimal finalRating;

    // JSON Object
    private Map<String, Object> managerRatings;

    // JSON Array
    private List<Map<String, Object>> feedback;

    private String status;

    private Long submittedAt;
}