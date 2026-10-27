package tapmind.bsrv.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class CombinedWorkResponseWrapperDTO {

    private boolean status;
    private int statusCode;
    private String message;
    private PageMeta pagination;
    private List<DailyWorkSummaryDTO> data;

    @Data
    @Builder
    public static class PageMeta {
        private int currentPage;
        private int pageSize;
        private int totalPages;
        private long totalRecords;
    }

    @Data
    @Builder
    public static class DailyWorkSummaryDTO {
        private LocalDate workDate;
        private Integer userID;
        private String userName;
        private Integer departmentID;
        private String departmentName;
        private String leaveType;
        private Double totalAllocatedHrs;
        private Double totalWorkedHrs;
        private Double targetAchievedPct;
        private List<CombinedEntryDTO> entries;
    }

    @Data
    @Builder
    public static class GoalSummaryDTO {
        private Integer userGoalDataID;
        private Integer goalID;
        private String goalName;
        private BigDecimal fixedGoal;
        private BigDecimal achievedGoal;
        private String goalType;
        private Boolean isTarget;
        private Boolean approvedByEL;
        private String commentForRejection;
    }

    @Data
    @Builder
    public static class WorkEntryDTO {
        private Integer dailyTaskLogID;
        private Integer taskID;
        private String taskName;
        private Double allocatedTime;
        private Double timeTakenToWork;
        private Double units;
        private Integer achievedUnits;
        private Boolean isForTarget;
        private String leaveType;
        private String remarks;
        private Boolean approvedByEL;
        private String commentForRejection;
    }

    @Data
    @Builder
    public static class CombinedEntryDTO {

        private Integer id;

        // COMMON

        private Integer userID;

        private Integer departmentID;

        private LocalDate workDate;

        private Boolean approvedByEL;

        private String commentForRejection;

        // TYPE IDS

        private Integer taskID;

        private Integer targetID;

        private Integer goalID;

        // NAMES

        private String taskName;

        private String targetName;

        private String goalName;

        // TASK/TARGET

        private Integer dailyTaskLogID;

        private Integer setUp;

        private Double allocatedTime;

        private Double timeTakenToWork;

        private Boolean isForTarget;

        private Double overAllTime;

        private String remarks;

        private Double units;

        private Integer achievedUnits;

        private String totalUnitValues;

        private Boolean isHalfDayLeave;

        private String leaveType;

        // GOAL

        private Integer userGoalDataID;

        private Double fixedGoal;

        private Double achievedGoal;

        private String goalType;

        private Boolean isTarget;
    }
}