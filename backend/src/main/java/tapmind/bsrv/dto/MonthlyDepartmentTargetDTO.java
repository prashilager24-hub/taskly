package tapmind.bsrv.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MonthlyDepartmentTargetDTO {
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate openDate;
}
