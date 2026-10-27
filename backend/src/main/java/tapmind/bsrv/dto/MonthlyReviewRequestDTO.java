package tapmind.bsrv.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyReviewRequestDTO {

    @NotNull(message = "Employee ID is required")
    private Integer empId;

    @NotBlank(message = "Month is required")
    private String month;

    @NotNull(message = "Year is required")
    private Integer year;

    private BigDecimal target;

    private BigDecimal goal;

    private BigDecimal utilization;

    private BigDecimal efficiency;
    private LocalDate startDate;

    private LocalDate endDate;

    private String efficiencyLabel;

    private String status;

    // JSON ARRAY
    private List<Map<String, Object>> feedback;

    // JSON ARRAY
    private List<Map<String, Object>> accessor;

    private Long timestamp;
}