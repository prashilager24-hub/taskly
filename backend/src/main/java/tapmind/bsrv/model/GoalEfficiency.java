package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.sql.Timestamp;

@Entity
@Table(
    name = "GoalEfficiency",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"UserID","FromDate","ToDate"})
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GoalEfficiency {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer goalEfficiencyID;

    private Integer userID;
    private Integer departmentID;

    private LocalDate fromDate;
    private LocalDate toDate;

    private BigDecimal goalPercentage;

    private Timestamp generatedAt = new Timestamp(System.currentTimeMillis());
}
