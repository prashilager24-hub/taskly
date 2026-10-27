package tapmind.bsrv.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class QuarterlyReviewResponseDTO {

    private Integer id;

    private Integer empId;

    private String employeeName;

    private String employeeEmail;

    private String departmentName;

    private String quarter;
    private Object grade;

    private Integer quarterYear;

    private LocalDate quarterStartDate;

    private LocalDate quarterEndDate;

    private BigDecimal targetPercent;

    private BigDecimal goalAchievement;

    private BigDecimal utilizationPercent;

    private BigDecimal efficiencyPercent;

    private String efficiencyLabel;

    private Integer systemGrade;

    private BigDecimal managerAvgRating;

    private BigDecimal finalRating;

    private String managerRatings;

    private String feedback;

    private String status;

    private Long submittedAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}