package tapmind.bsrv.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.*;
import lombok.NoArgsConstructor;
import java.sql.Timestamp;

@Entity
@NoArgsConstructor
@AllArgsConstructor
@Data
@Table(name = "MonthlyDepartmentTargets")
public class MonthlyDepartmentTargets {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer targetID;

    private String targetName;
    private Integer dayOfMonth;
    private Integer departmentID;

}
