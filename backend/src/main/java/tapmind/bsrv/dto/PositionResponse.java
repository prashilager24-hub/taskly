package tapmind.bsrv.dto;

import lombok.Data;
import org.springframework.cglib.core.Local;
import tapmind.bsrv.model.PositionStatus;

import java.time.LocalDate;

@Data
public class PositionResponse {
    private Long positionID;
    private String positionName;
    private String jdDetails;
    private PositionStatus status;
    private String createdAt;
    private String updatedAt;
    private Integer createdByUserID;
    private Integer closedByUserID;
    private String closeDate;
    private LocalDate openDate;
    private Integer achievedPerct;
    private String pausedDate;
    private Long workedDays;

}
