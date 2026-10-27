package tapmind.bsrv.dto;

import lombok.Data;
import tapmind.bsrv.model.PositionStatus;

import java.time.LocalDate;

@Data
public class AdminResponse {
    private Long ticketID;
    private Integer goalID;
    private String title;
    private String description;
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
