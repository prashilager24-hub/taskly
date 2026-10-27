package tapmind.bsrv.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EfficiencyReportRequest {
    private Integer departmentId;
    private Integer userId; // 0 means all users
    private String startDate;
    private String endDate;
    private String frequncy;
}
