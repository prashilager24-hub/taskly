package tapmind.bsrv.dto;

import java.time.LocalDate;

import lombok.Data;
public class AMRoleRequestDTOList {


    private String searchText;
    private String filter; 
    private LocalDate startDate;
    private LocalDate endDate;
    public UserInfo getUserInfo() {
        return userInfo;
    }

    public void setUserInfo(UserInfo userInfo) {
        this.userInfo = userInfo;
    }

    private UserInfo userInfo;

     @Data
    public static class UserInfo{
         private String userName;
          private String userRole;
         private Integer userID;
         private Integer parentID;
         private Boolean isForSupplyPartner;

    }


     public String getSearchText() {
        return searchText;
    }

    public void setSearchText(String searchText) {
        this.searchText = searchText;
    }



    public String getFilter() {
        return filter;
    }

    public void setFilter(String filter) {
        this.filter = filter;
    }


     public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }


    
}
