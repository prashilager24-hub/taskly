package tapmind.bsrv.dto;
import lombok.Data;
import java.time.LocalDate;

@Data
public class SprintStoryFilterRequest {
    private Long sprintId;
    private Integer userId;   
    private LocalDate startDate;
    private LocalDate endDate;
    private int page;
    private int size;
}
