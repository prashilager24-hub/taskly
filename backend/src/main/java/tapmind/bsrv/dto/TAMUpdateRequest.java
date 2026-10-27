package tapmind.bsrv.dto;

import lombok.Getter;
import lombok.Setter;
import tapmind.bsrv.model.TAMStatus;

@Getter
@Setter
public class TAMUpdateRequest {

    private Long accountId;

    private String publisherName;

    private TAMStatus status;

    private Integer userID;
}