package tapmind.bsrv.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class TrendDataPoint {
    private String sprintLabel;
    private LocalDate weekStart;
    private BigDecimal completion;
    private BigDecimal utilisation;
    private BigDecimal quality;
    private BigDecimal efficiency;
    private BigDecimal overall;
    private Integer totalGoals;
    private Integer metGoals;
}
