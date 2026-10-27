package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data                   // Generates getters, setters, toString, equals, hashCode
@NoArgsConstructor       // Generates a no-argument constructor
@AllArgsConstructor      // Generates an all-argument constructor
public class DepartmentRequestDTO {

    private String departmentName;
    private String departmentDescription;
    private Integer executiveLeaderID;
    private Integer functionalLeaderID;
    private Long primaryDepartmentId;
    
}
