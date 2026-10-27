package tapmind.bsrv.dto;

import lombok.*;

@Data
@Builder
public class GoalEfficiencyResponseWrapperDTO {
    private Boolean status;
    private Integer statusCode;
    private String message;
    private GoalEfficiencyResponseDTO response;
}
