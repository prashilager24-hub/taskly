package tapmind.bsrv.dto;

import java.time.LocalDate;
import java.util.List;

import lombok.*;
import com.fasterxml.jackson.annotation.JsonProperty;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class EfficiencySummaryFilterRequest {

    private LocalDate startDate;

    private LocalDate endDate;

    private Integer userID; // optional filter

    private String groupBy; // "day", "week", "month"

    private Integer departmentID;

    @JsonProperty("eLID")
    private Integer eLID;
    private Boolean query;

    @JsonProperty("isHeExecutiveLeader")
    private Boolean isHeExecutiveLeader;
    private Boolean history;

    private String efficiencyLevel;

    @JsonProperty("isQuarterly")
    private Boolean isQuarterly;

    // Optional dynamic filters
    private List<Filter> filters;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Filter {

        private String field; // Name, Department, Target Achieved, etc.

        private String operator; // =, >, <, >=, <=, contains

        private String value;
    }
}