package tapmind.bsrv.dto;

import lombok.Data;

@Data
public class DailyTaskLogListRequestDTO {

    private String searchText;     // search by username or task
    private String startDate;
    private String endDate;
    private Integer departmentID;
}
