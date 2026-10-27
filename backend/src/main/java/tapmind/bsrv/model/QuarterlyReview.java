package tapmind.bsrv.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;
import tapmind.bsrv.model.User;

@Getter
@Setter
@Entity
@Table(name = "QuarterlyReview", uniqueConstraints = {
                @UniqueConstraint(name = "uq_emp_quarter_year", columnNames = {
                                "emp_id",
                                "quarter",
                                "quarter_year"
                })
})
public class QuarterlyReview {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Integer id;

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "emp_id", referencedColumnName = "UserID")
        private User employee;

        @Column(name = "quarter")
        private String quarter;

        @Column(name = "quarter_year")
        private Integer quarterYear;
        @Column(columnDefinition = "LONGTEXT")
        private String grade;

        @Column(name = "quarter_start_date")
        private LocalDate quarterStartDate;

        @Column(name = "quarter_end_date")
        private LocalDate quarterEndDate;

        @Column(name = "target_percent")
        private BigDecimal targetPercent;

        @Column(name = "goal_achievement")
        private BigDecimal goalAchievement;

        @Column(name = "utilization_percent")
        private BigDecimal utilizationPercent;

        @Column(name = "efficiency_percent")
        private BigDecimal efficiencyPercent;

        @Column(name = "efficiency_label")
        private String efficiencyLabel;

        @Column(name = "system_grade")
        private Integer systemGrade;

        @Column(name = "manager_avg_rating")
        private BigDecimal managerAvgRating;

        @Column(name = "final_rating")
        private BigDecimal finalRating;

        @Column(name = "manager_ratings", columnDefinition = "json")
        private String managerRatings;

        @Column(name = "feedback", columnDefinition = "json")
        private String feedback;

        @Column(name = "status")
        private String status;

        @Column(name = "submitted_at")
        private Long submittedAt;

        @Column(name = "created_at", insertable = false, updatable = false)
        private LocalDateTime createdAt;

        @Column(name = "updated_at", insertable = false, updatable = false)
        private LocalDateTime updatedAt;
}