package tapmind.bsrv.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserWorkDataRequestDTOList {

    @NotEmpty(message = "User work data list cannot be empty")
    private List<UserWorkDataRequestDTO> workDataList;
}
