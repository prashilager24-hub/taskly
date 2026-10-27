package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.*;
import tapmind.bsrv.enums.Product;
import tapmind.bsrv.enums.TaskStatus;
import tapmind.bsrv.enums.TaskType;

@Entity
@Table(name = "tasks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sprint_entry_id", nullable = false)
    private SprintEntry sprintEntry;

    @Column(name = "jira_id", length = 30)
    private String jiraId;

    @Column(name = "task_name", nullable = false, length = 500)
    private String taskName;

    @Column(name = "story_points")
    private Integer storyPoints = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private Product product;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private tapmind.bsrv.enums.Module module;

    @Enumerated(EnumType.STRING)
    @Column(name = "task_type", nullable = false, length = 30)
    private TaskType taskType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskStatus status;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;
}
