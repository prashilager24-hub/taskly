package tapmind.bsrv.dto;

import lombok.Getter;
import lombok.Setter;
import tapmind.bsrv.model.TAMStatus;

@Getter
@Setter
public class TAMResponse {

    private Long accountId;

    private String publisherName;

    private TAMStatus status;

    private String entryDate;

    private String liveDate;

    private Integer createdByUserID;

    private Integer updatedByUserID;

    private String createdAt;

    private String updatedAt;
}