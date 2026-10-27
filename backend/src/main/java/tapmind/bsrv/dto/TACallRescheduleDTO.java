package tapmind.bsrv.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class TACallRescheduleDTO {
    private Long callID;
    private LocalDateTime newDatetime;
    private String rescheduledBy;  // INTERNAL or CANDIDATE
    private String reason;
}
