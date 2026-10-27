package tapmind.bsrv.dto;

import lombok.Data;

@Data
public class EfficiencyResponseDTO {
    private Integer userID;
    private Integer departmentID;
    private Double efficiencyPercent;
    private String efficiencyLevel;
    private Double tatPercent;
    private Double totalActualHours;
    private Double utilizationPercent;

}
