package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TaskEntryStatusDTO {

    private Integer userID;

    private String employeeName;
}