package tapmind.bsrv.dto;

import java.time.LocalDate;

import lombok.Getter;
import lombok.Setter;
import tapmind.bsrv.model.TAMStatus;

@Getter
@Setter
public class TAMCreateRequest {

    private String publisherName;

    private TAMStatus status;

    private LocalDate entryDate;

    private Integer userID;
}