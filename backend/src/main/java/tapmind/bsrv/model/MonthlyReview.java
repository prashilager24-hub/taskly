// MonthlyReview.java
package tapmind.bsrv.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalDate;

@Entity
@Table(name = "MonthlyReview")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "emp_id", nullable = false)
    private Integer empId;

    @Column(name = "target", precision = 10, scale = 2)
    private BigDecimal target;

    @Column(name = "goal", precision = 10, scale = 2)
    private BigDecimal goal;

    @Column(name = "utilization", precision = 10, scale = 2)
    private BigDecimal utilization;

    @Column(name = "efficiency", precision = 10, scale = 2)
    private BigDecimal efficiency;

    @Column(name = "efficiency_label", length = 50)
    private String efficiencyLabel;

    @Column(name = "month", nullable = false, length = 20)
    private String month;

    @Column(name = "year", nullable = false)
    private Integer year;

    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "feedback", columnDefinition = "LONGTEXT")
    private String feedback;

    @Column(name = "accessor", columnDefinition = "LONGTEXT")
    private String accessor;

    @Column(name = "timestamp")
    private Long timestamp;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}