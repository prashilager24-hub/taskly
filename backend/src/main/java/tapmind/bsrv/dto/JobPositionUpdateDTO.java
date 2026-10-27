package tapmind.bsrv.dto;

import lombok.Data;

@Data
public class JobPositionUpdateDTO {
    private Long positionID;
    private String positionName;
    private String jdDetails;
}
