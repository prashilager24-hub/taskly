package tapmind.bsrv.dto;
import lombok.Getter;
import lombok.Setter;

import java.util.List;   // ✅ REQUIRED



@Getter
@Setter
public class DepartmentGoalListResponseDTO {

    private Boolean status;
    private Integer statusCode;
    private String message;
    private TargetReadResponse response;

    @Getter
    @Setter
    public static class TargetReadResponse {
        private List<DepartmentGoalDTO> goals;
        private Integer currentPage;
        private Integer pageSize;
        private Integer totalRecords;
        private Integer totalPages;
    }
}
