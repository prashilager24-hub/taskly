package tapmind.bsrv.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class TACallFilterDTO {
    private Integer taUserID;
    private Integer positionID;
    private LocalDate startDate;
    private LocalDate endDate;
}
