package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PartnerRequestDTO {


    private String filter;
    private String partnerType;
    private String partnerCountry;
    private String searchText;
  private UserInfo userInfo;

     @Data
    public static class UserInfo{
         private String userName;
          private String userRole;
         private Integer userID;
         private Integer parentID;
         private Boolean isForSupplyPartner;

    }
    
    
}
