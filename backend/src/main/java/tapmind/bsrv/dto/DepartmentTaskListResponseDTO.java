package tapmind.bsrv.dto;

import lombok.Data;
import java.util.List;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentTaskListResponseDTO {
    private boolean status;
    private int statusCode;
    private String message;
    private LocalDateTime timestamp;
    private TaskReadResponse response;

    @Data
    @NoArgsConstructor
@AllArgsConstructor
    public static class TaskReadResponse {
        private List<DepartmentTaskDTO> tasks;
        private int totalRecords;
        private int totalPages;
        private int currentPage;
        private int pageSize;
    }
}
