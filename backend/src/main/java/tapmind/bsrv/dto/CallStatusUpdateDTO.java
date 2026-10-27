package tapmind.bsrv.dto;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@Data
public class CallStatusUpdateDTO {
    private Long callID;
    private String status;
    private LocalDateTime actualCallDatetime;
}
