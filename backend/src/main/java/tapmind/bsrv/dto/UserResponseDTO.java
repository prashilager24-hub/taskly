
package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserResponseDTO {
    private boolean status;
    private int statusCode;
    private String message;
    private LocalDateTime timestamp;
    private Map<String, Object> response;
    private String link;

}
