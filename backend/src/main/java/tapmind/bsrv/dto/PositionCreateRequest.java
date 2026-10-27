package tapmind.bsrv.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDate;

@Data
public class PositionCreateRequest {
    private String positionName;
    private String jdDetails;
    private Integer userID;  // creator user id
    @JsonFormat(pattern = "dd-MM-yyyy")
    private LocalDate openDate;
}
    