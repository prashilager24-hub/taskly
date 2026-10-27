
package tapmind.bsrv.dto;

import lombok.Getter;
import lombok.*;
import java.time.LocalDate;
import com.fasterxml.jackson.annotation.JsonProperty;
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserWorkDataFilterRequestDTO {
    private Integer userID;
    private Integer roleID;
    private Integer departmentID;
    private LocalDate startDate;
    private LocalDate endDate;
    private Boolean isForTarget;
    private Integer taskID;
    @JsonProperty("eLID")
    private Integer eLID;
}
