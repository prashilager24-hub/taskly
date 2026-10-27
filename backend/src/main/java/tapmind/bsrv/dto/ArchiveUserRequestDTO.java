package tapmind.bsrv.dto;

import java.util.List;

import lombok.Data;

@Data
public class ArchiveUserRequestDTO {
    private List<Integer> userIdList;
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
