package tapmind.bsrv.dto;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDate;

@Getter
@Setter
public class GoalEfficiencyFilterRequestDTO {

    private Integer userID;           // 0 or null = all
    private Integer departmentID;     // 0 or null = all
    private Integer ELID;             // executive leader
    private Boolean isHeExecutiveLeader;

    private LocalDate startDate;
    private LocalDate endDate;
}
