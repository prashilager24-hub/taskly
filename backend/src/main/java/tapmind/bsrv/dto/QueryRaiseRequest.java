package tapmind.bsrv.dto;

import jakarta.validation.constraints.*;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class QueryRaiseRequest {

    @NotNull(message = "Team is required")
    private String team;

    @NotNull(message = "Category is required")
    private String category;

    @NotBlank(message = "Subject is required")
    @Size(max = 200)
    private String subject;

    @NotBlank(message = "Description is required")
    private String description;

    private String priority = "NORMAL";
}
