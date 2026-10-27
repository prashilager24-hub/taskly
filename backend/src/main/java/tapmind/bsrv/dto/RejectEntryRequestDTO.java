package tapmind.bsrv.dto;

import lombok.Data;

@Data
public class RejectEntryRequestDTO {

    private Integer id;

    private String type; // Task / Goal

    private String comment;
}