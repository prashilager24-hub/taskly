package tapmind.bsrv.dto;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PartnerUserUpdateRequestDTO {
    private String userName;
    private Integer companyID;
    private List<SubUserUpdateDTO> associatedUsers;

@Data
    public static class SubUserUpdateDTO {
    private String userName;
    private String userEmail;
    private String password;
    private boolean generatePasswordEmail;
    private Integer userID; 
}

}
