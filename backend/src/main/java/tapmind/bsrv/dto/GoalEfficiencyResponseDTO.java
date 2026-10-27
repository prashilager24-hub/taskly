package tapmind.bsrv.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@AllArgsConstructor
@Builder
public class GoalEfficiencyResponseDTO {
    private Integer userID;
    private Integer departmentID;
    private LocalDate fromDate;
    private LocalDate toDate;
    private BigDecimal goalPercentage;
}
