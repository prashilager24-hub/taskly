package tapmind.bsrv.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class TACallCreateDTO {
    private Long taUserID;
    private String candidateName;
    private Long positionID;
    private LocalDateTime scheduledDatetime;
}
