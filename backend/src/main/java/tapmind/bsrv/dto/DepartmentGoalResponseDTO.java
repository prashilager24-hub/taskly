package tapmind.bsrv.dto;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;   // ✅ REQUIRED

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentGoalResponseDTO {

    private Boolean status;
    private Integer statusCode;
    private String message;
    private LocalDateTime timestamp;
    private Object response;
}
