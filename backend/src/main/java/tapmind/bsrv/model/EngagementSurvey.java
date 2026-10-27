package tapmind.bsrv.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import tapmind.bsrv.enums.EngagementStatus;

@Entity
@Table(name = "engagement_surveys")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EngagementSurvey {

    @Id
    @Column(name = "id", length = 10)
    private String id;

    @Column(name = "quarter", nullable = false, length = 100)
    private String quarter;

    @Column(name = "months", nullable = false, columnDefinition = "JSON")
    private String months;

    @Column(name = "sent_to", nullable = false)
    private Integer sentTo;

    @Column(name = "opens", nullable = false)
    private LocalDate opens;

    @Column(name = "closes", nullable = false)
    private LocalDate closes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private EngagementStatus status;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
