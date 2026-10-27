package tapmind.bsrv.dto.jwt;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class UserSwitchResponseDTO {

    private Boolean status;

    private Integer statusCode;

    private String message;

    private String token;

    private Integer userID;

    private String userName;

    private Integer departmentID;

    private String role;

}