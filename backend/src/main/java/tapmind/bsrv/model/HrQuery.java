package tapmind.bsrv.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import tapmind.bsrv.enums.QueryCategory;
import tapmind.bsrv.enums.QueryPriority;
import tapmind.bsrv.enums.QueryStatus;
import tapmind.bsrv.enums.QueryTeam;

@Entity
@Table(name = "queries")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HrQuery {

    @Id
    @Column(name = "id", length = 10)
    private String id;

    @Column(name = "employee_id", nullable = false)
    private Integer employeeId;

    @Column(name = "employee_name", nullable = false, length = 100)
    private String employeeName;

    @Column(name = "department", nullable = false, length = 100)
    private String department;

    @Enumerated(EnumType.STRING)
    @Column(name = "team", nullable = false, length = 10)
    private QueryTeam team;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 20)
    private QueryCategory category;

    @Column(name = "subject", nullable = false, length = 200)
    private String subject;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 10)
    private QueryPriority priority;

    @Column(name = "raised_on", nullable = false)
    private LocalDate raisedOn;

    @Column(name = "age_hours", nullable = false)
    private Integer ageHours = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private QueryStatus status;

    @Column(name = "ratings", columnDefinition = "JSON")
    private String ratings;

    @Column(name = "rating_comment", columnDefinition = "TEXT")
    private String ratingComment;

    @Column(name = "reopen_reason", columnDefinition = "TEXT")
    private String reopenReason;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "query", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<QueryMessage> messages = new ArrayList<>();
}
