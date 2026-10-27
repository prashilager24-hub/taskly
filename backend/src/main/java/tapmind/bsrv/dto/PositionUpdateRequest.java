package tapmind.bsrv.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;
import tapmind.bsrv.model.PositionStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class PositionUpdateRequest {

    private Long positionID;
    private String positionName;
    private String jdDetails;
    private PositionStatus status;
    private Integer userID;

    @JsonFormat(pattern = "dd-MM-yyyy")
    private LocalDate openDate;

    @JsonFormat(pattern = "dd-MM-yyyy")
    private LocalDate pausedDate;

    @JsonFormat(pattern = "dd-MM-yyyy")
    private LocalDate closeDate;
}
