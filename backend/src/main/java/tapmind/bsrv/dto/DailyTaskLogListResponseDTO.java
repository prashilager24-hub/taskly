package tapmind.bsrv.dto;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DailyTaskLogListResponseDTO {
    private boolean success;
    private String message;
    private int statusCode;
    private TaskLogReadResponse response;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TaskLogReadResponse {
        private int currentPage;
        private long pageSize;
        private long totalRecords;
        private int totalPages;
        private List<DailyTaskLogDTO> logs;
    }
}
