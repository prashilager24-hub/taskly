package tapmind.bsrv.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class UserGoalDataResponseWrapperDTO {

    private Boolean status;
    private Integer statusCode;
    private String message;
    private UserGoalDataReadResponseDTO response;

    @Getter
    @Setter
    @Builder
    public static class UserGoalDataReadResponseDTO {

        private List<UserGoalDataResponseDTO> userGoalDataList;
        private BigDecimal avgPercent;
        private Integer currentPage;
        private Integer pageSize;
        private Integer totalRecords;
        private Integer totalPages;
        private List<Map<String, Object>> monthlyAvgBreakdown;
    }
}
