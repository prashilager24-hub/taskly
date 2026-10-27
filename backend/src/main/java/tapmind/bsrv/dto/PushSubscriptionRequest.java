package tapmind.bsrv.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class PushSubscriptionRequest {
    @NotBlank
    private String endpoint;

    @NotBlank
    private String p256dh;

    @NotBlank
    private String auth;

    private String team;
}
