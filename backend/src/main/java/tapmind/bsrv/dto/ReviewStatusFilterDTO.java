package tapmind.bsrv.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ReviewStatusFilterDTO {

    private Integer departmentID;

    @JsonProperty("filterType")
    private String filterType;

    @JsonProperty("quarter")
    private String quarter;

    @JsonProperty("month")
    private Integer month;

    @JsonProperty("year")
    private String year;
}
