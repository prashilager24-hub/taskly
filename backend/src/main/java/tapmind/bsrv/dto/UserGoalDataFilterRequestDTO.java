package tapmind.bsrv.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDate;

@Getter
@Setter
public class UserGoalDataFilterRequestDTO {

    private Integer userID;
    private Integer departmentID;
    private Integer goalID;
    @JsonProperty("eLID")
    private Integer eLID;
    @JsonProperty("fLID")
    private Integer fLID;
    private Boolean isHeExecutiveLeader;
    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate goalStartDate;
    private LocalDate goalEndDate;
    @JsonProperty("roleID")
    private Integer roleID; // optional (admin logic)
}
