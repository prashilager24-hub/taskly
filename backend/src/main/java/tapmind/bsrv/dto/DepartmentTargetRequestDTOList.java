package tapmind.bsrv.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentTargetRequestDTOList {

   
     private String searchText; 
      private String filter; 
    private String startDate;
    private String endDate;
    
}
