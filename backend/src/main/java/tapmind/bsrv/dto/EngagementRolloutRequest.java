package tapmind.bsrv.dto;

import jakarta.validation.constraints.*;
import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class EngagementRolloutRequest {

    @NotBlank(message = "Quarter is required")
    private String quarter;

    @NotEmpty(message = "Months are required")
    private List<String> months;

    @NotBlank(message = "Close date is required")
    private String closes;

    private String notifyList;
}
