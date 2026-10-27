package tapmind.bsrv.dto;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyReviewResponseDTO {

    private Integer id;

    private Integer empId;

    private String month;

    private Integer year;

    private BigDecimal target;

    private BigDecimal goal;

    private BigDecimal utilization;

    private BigDecimal efficiency;

    private String efficiencyLabel;

    private String status;
    private LocalDate startDate;

    private LocalDate endDate;

    // JSON ARRAY
    private List<Map<String, Object>> feedback;

    // JSON ARRAY
    private List<Map<String, Object>> accessor;

    private Long timestamp;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}