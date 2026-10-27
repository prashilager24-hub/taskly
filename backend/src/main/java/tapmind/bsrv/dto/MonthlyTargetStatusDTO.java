
package tapmind.bsrv.dto;


import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class MonthlyTargetStatusDTO {

    private Integer targetID;
    private String targetName;
    private Integer dayOfMonth;

    private boolean completed;   // YES/NO
    private Double totalUnitValue;  // If completed, value stored
    private String status; // "Completed" / "Pending"

    // Constructor, Getters, Setters
}
