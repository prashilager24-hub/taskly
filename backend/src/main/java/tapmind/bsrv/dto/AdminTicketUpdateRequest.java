package tapmind.bsrv.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import tapmind.bsrv.model.PositionStatus;

import java.time.LocalDate;

@Data
public class AdminTicketUpdateRequest {

    private Long ticketID;
    private Integer goalID;
    private String title;
    private String description;
    private PositionStatus status;
    private Integer userID;  // creator user id
    @JsonFormat(pattern = "dd-MM-yyyy")
    private LocalDate openDate;
    @JsonFormat(pattern = "dd-MM-yyyy")
    private LocalDate pausedDate;
}
