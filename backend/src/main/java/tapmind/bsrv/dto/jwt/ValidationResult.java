


package tapmind.bsrv.dto.jwt;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ValidationResult {
     private boolean tokenValid;
    private boolean hasAccess;
    private String reason;

}
