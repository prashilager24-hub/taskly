package tapmind.bsrv.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDate;

@Data
public class AdminTicketCreateRequest {
    private String title;
    private String description;
    private Integer goalID;
    private Integer userID;  // creator user id
    @JsonFormat(pattern = "dd-MM-yyyy")
    private LocalDate openDate;
}
