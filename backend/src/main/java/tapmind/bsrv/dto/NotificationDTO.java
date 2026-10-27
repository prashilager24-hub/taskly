package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDTO {
    private int notificationID;
    private String message;
    private boolean isRead;
    private LocalDate timestamp;
}
