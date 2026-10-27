package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserReadDTO {

    private String filter;
    private String searchText;
    private Integer departmentID;
    private Integer roleID;

   


 
     
    
}
