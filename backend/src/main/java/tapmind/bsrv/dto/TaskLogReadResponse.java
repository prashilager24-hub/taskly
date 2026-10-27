package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public  class TaskLogReadResponse {
    private List<DailyTaskLogDTO> logs;
    private int currentPage;
    private int pageSize;
    private int totalRecords;
    private int totalPages;
}
