package tapmind.bsrv.dto;

import lombok.*;
import java.time.LocalDate;
import com.fasterxml.jackson.annotation.JsonProperty;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashBoardFilter {

    private Integer departmentID; // Optional
    private Integer elID; // Optional (UserID)
    private LocalDate startDate; // Required
    private LocalDate endDate; // Required
    private Integer userID;
    private Integer roleID;
    private Integer flID;
    private LocalDate goalStartDate;
    private LocalDate goalEndDate;

    @JsonProperty("isHeExecutiveLeader")
    private boolean isHeExecutiveLeader;

    @JsonProperty("isHeFunctionalLeader")
    private boolean isHeFunctionalLeader;

    // ✅ NEW FIELD
    private String departmentType; // "business", "support", or "all"

    // ✅ HELPER METHOD
    public String getDepartmentTypeOrDefault() {
        return departmentType != null ? departmentType : "all";
    }
}