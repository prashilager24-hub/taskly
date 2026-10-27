package tapmind.bsrv.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import tapmind.bsrv.enums.OnboardingStatus;

@Entity
@Table(name = "onboarding_surveys")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OnboardingSurvey {

    @Id
    @Column(name = "id", length = 10)
    private String id;

    @Column(name = "employee_id", nullable = false)
    private Integer employeeId;

    @Column(name = "employee_name", nullable = false, length = 100)
    private String employeeName;

    @Column(name = "department", nullable = false, length = 100)
    private String department;

    @Column(name = "joined_date", nullable = false)
    private LocalDate joinedDate;

    @Column(name = "sent_on", nullable = false)
    private LocalDate sentOn;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private OnboardingStatus status;

    @Column(name = "answers", columnDefinition = "JSON")
    private String answers;

    @Column(name = "feedback", columnDefinition = "TEXT")
    private String feedback;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
