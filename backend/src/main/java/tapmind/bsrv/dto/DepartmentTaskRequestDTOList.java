package tapmind.bsrv.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentTaskRequestDTOList {
    private String searchText;  // keyword search by task name
    private String filter;      // "Active" or "Inactive"
    private String startDate;
    private String endDate;
}
