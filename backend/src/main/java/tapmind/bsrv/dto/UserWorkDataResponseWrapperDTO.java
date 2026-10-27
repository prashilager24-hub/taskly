package tapmind.bsrv.dto;

import lombok.*;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import tapmind.bsrv.dto.TAMResponse;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserWorkDataResponseWrapperDTO {
    private boolean status;
    private int statusCode;
    private String message;
    private UserWorkDataReadResponseDTO response;

    // -----------------------------
    // Inner Read Response DTO (for pagination)
    // -----------------------------
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserWorkDataReadResponseDTO {
        private List<UserWorkDataResponseDTO> userWorkDataList;
        private int totalRecords;
        private int totalPages;
        private int currentPage;
        private int pageSize;
        private Double avgAllocatedHrs;
        private Double avgTotalWork;

    }

    // -----------------------------
    // Actual Work Data DTO
    // -----------------------------
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserWorkDataResponseDTO {

        private Integer dailyTaskLogID;
        private Integer taskID;
        private String taskName;

        private Integer userID;
        private String userName;

        private Integer departmentID;
        private String departmentName;

        private LocalDate workDate;
        private Integer setUp;
        private Double units;
        private RevisedTargetDetailsDTO revisedTarget;
        private Boolean approvedByEL;
        private List<Integer> taskMeta;
        private Double allocatedTime;
        private Double timeTakenToWork;
        private Boolean isForTarget;

        private Double overAllTime;
        private String remarks;

        private Integer achivedUnits;
        private String totalUnitValues;

        private Timestamp createdAt;
        private Timestamp updatedAt;
        private String leaveType;
        private List<TAMResponse> tamAccounts;

    }

}
