package tapmind.bsrv.dto;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RevisedGoalDetailsDTO {

    private BigDecimal value;
    private Integer enteredBy;
    private String enteredAt;
    private Boolean elApproved;
    private Integer approvedBy;
    private String approvedAt;
    private String comment;
}
