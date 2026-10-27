package tapmind.bsrv.dto;

import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
public class DepartmentGoalApproveRequestDTO {
    private List<Integer> goalIds; // array of goal IDs to approve
    private Integer userId; // must be an EL user
}