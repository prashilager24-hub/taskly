package tapmind.bsrv.dto;

import java.math.BigDecimal;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class RadarData {
    private BigDecimal utilisation;  // (days / 5) * 100
    private BigDecimal velocity;     // completion rate
    private BigDecimal reviews;      // MIN(100, prReviews * 20)
    private BigDecimal quality;      // 100 - bugs * 15, floor 0
    private BigDecimal goals;        // (goalsMet / totalGoals) * 100
    private BigDecimal self;         // selfRating * 10
}
