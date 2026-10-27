package tapmind.bsrv.dto;

import lombok.*;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DepartmentTargetListResponseDTO {
    private boolean status;
    private int statusCode;
    private String message;
    private Object response;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TargetReadResponse {
        private List<DepartmentTargetDTO> targets;
        private int currentPage;
        private int pageSize;
        private int totalRecords;
        private int totalPages;
    }
}
