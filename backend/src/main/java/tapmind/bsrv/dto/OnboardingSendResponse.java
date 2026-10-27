package tapmind.bsrv.dto;

import java.util.List;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class OnboardingSendResponse {
    private Integer sent;
    private List<String> surveyIds;
}
