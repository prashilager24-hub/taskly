package tapmind.bsrv.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentTaskResponseDTO {
    private boolean status;
    private int statusCode;
    private String message;
    private LocalDateTime timestamp;
    private Map<String, Object> response;
}
