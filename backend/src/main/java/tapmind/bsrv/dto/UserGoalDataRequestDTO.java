package tapmind.bsrv.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class UserGoalDataRequestDTO {
    private Integer userGoalDataID;// new

    private LocalDate workDate;
    private Integer userID;
    private Integer departmentID;
    private Integer goalID;
    private BigDecimal fixedGoal;
    private BigDecimal achievedGoal;
    private String goalType;
    private List<MISUpdateSlot> updates;
    private String comment;
    private List<Map<String, Object>> metaData;
}
