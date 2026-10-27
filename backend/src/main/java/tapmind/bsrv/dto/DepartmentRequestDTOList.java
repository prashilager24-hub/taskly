package tapmind.bsrv.dto;

import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.*;

@Data                   // Generates getters, setters, toString, equals, hashCode
@NoArgsConstructor       // Generates a no-argument constructor
@AllArgsConstructor
public class DepartmentRequestDTOList {


    private String searchText;
    private String filter; 
    private LocalDate startDate;
    private LocalDate endDate;
     private String userName;
      private Integer RoleID;
     private Integer userID;
    



   


    
}
