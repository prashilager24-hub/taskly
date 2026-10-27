package tapmind.bsrv.dto;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@Data
public class SalesCallCreateDTO {
    private Long createrUserID;
    private String publisherName;
    private Long salesUserID;
    private LocalDateTime scheduledDatetime;
}
