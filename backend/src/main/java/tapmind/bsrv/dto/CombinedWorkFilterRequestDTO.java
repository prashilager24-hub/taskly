package tapmind.bsrv.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class CombinedWorkFilterRequestDTO {
    private Integer userID;
    private Integer departmentID;
    private LocalDate startDate;
    private LocalDate endDate;
    private String entryType; // TASK, TARGET, GOAL — null means all
}