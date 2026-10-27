package tapmind.bsrv.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class GoalEfficiencyRequestDTO {
    private Integer userID;
    private Integer departmentID;
    private LocalDate fromDate;
    private LocalDate toDate;
    private Boolean saveResult; // true → save to table
}
