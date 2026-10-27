package tapmind.bsrv.dto;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@NoArgsConstructor
@AllArgsConstructor
@Data
public class SalesCallRescheduleDTO {
    private Long callID;
    private LocalDateTime newDatetime;
    private String reason;
    private String rescheduledBy; // INTERNAL or PUBLISHER
}
