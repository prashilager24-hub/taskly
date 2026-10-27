package tapmind.bsrv.dto;

import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Map;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class OnboardingSendRequest {

    @NotEmpty(message = "Recipients list cannot be empty")
    private List<String> recipients;

    @NotBlank(message = "Due date is required")
    private String dueDate;

    private String notifyList;

    private Map<String, String> departmentOverrides;
}
