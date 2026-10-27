package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.*;
import java.sql.Timestamp;
import java.time.LocalDate;

@Entity
@Table(name = "UserWorkData")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserWorkData {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        @Column(name = "DailyTaskLogID")
        private Integer dailyTaskLogID;

        @Column(name = "TaskID")
        private Integer taskID;

        @Column(name = "UserID", nullable = false)
        private Integer userID;

        @Column(name = "WorkDate", nullable = false)
        private LocalDate workDate;

        @Column(name = "setUp")
        private Integer setUp = 1;

        @Column(name = "AllocatedTime", precision = 5, scale = 2, nullable = false)
        private Double allocatedTime;

        @Column(name = "TimeTakenToWork", precision = 5, scale = 2, nullable = false)
        private Double timeTakenToWork;

        @Column(name = "IsForTarget")
        private Boolean isForTarget = false;

        @Column(name = "OverAllTime", precision = 5, scale = 2)
        private Double overAllTime;

        @Column(name = "Remarks", columnDefinition = "TEXT")
        private String remarks;

        @Column(name = "CreatedAt", nullable = false, updatable = false, columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        private Timestamp createdAt;

        @Column(name = "UpdatedAt", columnDefinition = "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
        private Timestamp updatedAt;

        @Column(name = "Units", precision = 5, scale = 2)
        private Double units = 1.0;

        @Column(name = "RevisedTarget", columnDefinition = "longtext")
        private String revisedTarget;

        @Column(name = "DepartmentID", nullable = false)
        private Integer departmentID;

        @Column(name = "AchivedUnits", nullable = false)
        private Integer achivedUnits;

        @Column(name = "TotalUnitValues", length = 45)
        private String totalUnitValues;

        @Column(name = "IsHalfDayLeave", nullable = false)
        private Boolean isHalfDayLeave = false;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "DepartmentID", insertable = false, updatable = false)
        private Department department;
        @Column(name = "TaskMeta")
        private String taskMeta;
        // New column
        @Column(name = "LeaveType", length = 20)
        private String leaveType = "NONE"; // NONE, HALF_DAY, FULL_DAY

        @Column(name = "ApprovedByEL")
        private Boolean approvedByEL;

        @Column(name = "CommentForRejection")
        private String commentForRejection;

}
