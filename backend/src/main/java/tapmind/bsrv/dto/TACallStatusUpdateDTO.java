package tapmind.bsrv.dto;

import lombok.Data;

@Data
public class TACallStatusUpdateDTO {
    private Long callID;
    private String status;  // COMPLETED, NO_SHOW, CANDIDATE_NOT_INTERESTED, CANCELLED_BY_INTERNAL
}
