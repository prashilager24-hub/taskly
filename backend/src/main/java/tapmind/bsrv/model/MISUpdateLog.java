package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.sql.Timestamp;

@Entity
@Table(name = "MISUpdateLog",indexes = {
        @Index(name = "idx_user_date_goal", columnList = "UserID, WorkDate, GoalID"),
        @Index(name = "idx_department", columnList = "DepartmentID")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MISUpdateLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Integer id;

    @Column(name = "UserID", nullable = false)
    private Integer userID;

    @Column(name = "DepartmentID", nullable = false)
    private Integer departmentID;

    @Column(name = "GoalID", nullable = false)
    private Integer goalID;

    @Column(name = "WorkDate", nullable = false)
    private LocalDate workDate;

    @Column(name = "ExpectedTime", nullable = false)
    private LocalTime expectedTime;

    @Column(name = "ActualTime")
    private LocalTime actualTime;

    @Column(name = "CreatedAt", insertable = false, updatable = false)
    private Timestamp createdAt;
}