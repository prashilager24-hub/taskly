package tapmind.bsrv.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DepartmentTargetResponseDTO {
    private boolean status;
    private int statusCode;
    private String message;
    private LocalDateTime timestamp;
    private Map<String, Object> response;
}
