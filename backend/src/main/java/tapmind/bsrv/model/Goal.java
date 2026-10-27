package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "goals")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Goal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sprint_entry_id", nullable = false)
    private SprintEntry sprintEntry;

    @Column(name = "goal_name", nullable = false, length = 500)
    private String goalName;

    @Column(name = "target_pct", nullable = false)
    private Integer targetPct = 100;

    @Column(name = "achieved_pct", nullable = false)
    private Integer achievedPct = 0;

    // generated stored column – read-only from Java
    @Column(name = "is_achieved", insertable = false, updatable = false)
    private Boolean isAchieved;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;
}
