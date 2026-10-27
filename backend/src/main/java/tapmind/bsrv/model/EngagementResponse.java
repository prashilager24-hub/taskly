package tapmind.bsrv.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(
    name = "engagement_responses",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_one_response_per_person",
        columnNames = {"survey_id", "respondent_id"}
    ))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EngagementResponse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "survey_id", nullable = false)
    private EngagementSurvey survey;

    @Column(name = "respondent_id", nullable = false)
    private Integer respondentId;

    @Column(name = "respondent_name", nullable = false, length = 100)
    private String respondentName;

    @Column(name = "anonymous", nullable = false)
    private Boolean anonymous = false;

    @Column(name = "months", nullable = false, columnDefinition = "JSON")
    private String months;

    @Column(name = "rest", nullable = false, columnDefinition = "JSON")
    private String rest;

    @Column(name = "feedback", columnDefinition = "TEXT")
    private String feedback;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
