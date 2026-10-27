package tapmind.bsrv.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class QueryReplyRequest {

    @NotBlank(message = "Reply text is required")
    private String text;
}
