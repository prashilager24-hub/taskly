package tapmind.bsrv.dto;

import jakarta.validation.constraints.*;
import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class QueryRateRequest {

    @NotNull(message = "Ratings are required")
    @Size(min = 6, max = 6, message = "Exactly 6 ratings required")
    private List<Integer> ratings;

    private String comment;
}
