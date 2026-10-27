

package tapmind.bsrv.dto;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuthenticationResponseDTO {
    private String username;
    private String name;
    private String token;
    private int userID;
    private int companyID;
    private String userRole;
    private int parentID;
    private boolean isSupplyPartner;
    private String inventoryType;
    private boolean isAccepted;
    private String link;
    private String authorization;
    private int status;
    private List<NotificationDTO> notifications;
}