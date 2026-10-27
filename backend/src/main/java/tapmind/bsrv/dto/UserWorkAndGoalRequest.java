package tapmind.bsrv.dto;
import lombok.*;
import java.util.List;
import java.time.LocalDate;

@Getter
@Setter
public class UserWorkAndGoalRequest {

    private String leaveType;      // optional
    private Integer userID;        // optional
    private Integer departmentID;  // optional
    private LocalDate workDate;    // optional


    private List<UserWorkDataRequestDTO> activities;
    private List<UserGoalDataRequestDTO> goals;
}
