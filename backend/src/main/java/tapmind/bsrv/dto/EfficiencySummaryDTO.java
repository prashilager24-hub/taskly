// DTO for summary calculation input/output


package tapmind.bsrv.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;


@Data
@NoArgsConstructor
@AllArgsConstructor
public class EfficiencySummaryDTO{
        Integer userId;
        Integer departmentId;
        LocalDate workDate;
        BigDecimal targetAchievedPercent;
        String efficiencyLevel;
        BigDecimal utilizationPercent;
        BigDecimal allocatedTimeHrs;
}
