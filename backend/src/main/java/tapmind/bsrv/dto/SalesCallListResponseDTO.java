package tapmind.bsrv.dto;

import lombok.Data;
import lombok.Builder;
import java.util.*;

@Data
@Builder
public class SalesCallListResponseDTO {

    private List<Map<String, Object>> calls;

    private Integer currentPage;
    private Integer pageSize;
    private Integer totalPages;
    private Long totalRecords;
    private String message;
    private boolean status;
    private int statusCode;
 
}
