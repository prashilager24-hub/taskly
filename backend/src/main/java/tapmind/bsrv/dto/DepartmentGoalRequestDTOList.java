package tapmind.bsrv.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DepartmentGoalRequestDTOList {

    private String searchText;
    private String filter;
    private String startDate;
    private String endDate;
}
