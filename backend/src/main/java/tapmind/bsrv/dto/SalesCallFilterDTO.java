package tapmind.bsrv.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class SalesCallFilterDTO {
    private Long salesUserID;
    private String publisherName;
    private LocalDate startDate;
    private LocalDate endDate;
    private String status;
}
