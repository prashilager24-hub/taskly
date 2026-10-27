package tapmind.bsrv.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.*;
import lombok.*;


@Entity
@Table(
    name = "sprint_entries",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uq_user_sprint",
            columnNames = {"user_id", "sprint_label"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SprintEntry {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  // ── Link to existing Users table ──────────────────────────────────────
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", referencedColumnName = "UserID", nullable = false)
  private User user;

  @Column(name = "sprint_label", nullable = false, length = 50)
  private String sprintLabel;

  @Column(name = "week_start", nullable = false)
  private LocalDate weekStart;

  @Column(name = "week_end", nullable = false)
  private LocalDate weekEnd;

  @Column(name = "days_present", nullable = false)
  private Integer daysPresent = 0;

  @Column(name = "sp_committed", nullable = false)
  private Integer spCommitted = 0;

  @Column(name = "sp_completed", nullable = false)
  private Integer spCompleted = 0;

  @Column(name = "bugs_introduced", nullable = false)
  private Integer bugsIntroduced = 0;

  @Column(name = "pr_reviews", nullable = false)
  private Integer prReviews = 0;

  @Column(name = "sp_carryover", nullable = false)
  private Integer spCarryover = 0;

  @Column(name = "blockers", nullable = false)
  private Integer blockers = 0;

  @Column(name = "self_rating", nullable = false)
  private Integer selfRating = 0;

  // ── Stored generated columns (read-only from Java side) ──────────────
  @Column(name = "score_completion", insertable = false, updatable = false)
  private BigDecimal scoreCompletion;

  @Column(name = "score_utilisation", insertable = false, updatable = false)
  private BigDecimal scoreUtilisation;

  @Column(name = "score_quality", insertable = false, updatable = false)
  private BigDecimal scoreQuality;

  @Column(name = "score_efficiency", insertable = false, updatable = false)
  private BigDecimal scoreEfficiency;

  @Column(name = "score_overall", insertable = false, updatable = false)
  private BigDecimal scoreOverall;

  // ── Free-text reflection ──────────────────────────────────────────────
  @Column(columnDefinition = "TEXT")
  private String achievements;

  @Column(columnDefinition = "TEXT")
  private String challenges;

  @Column(name = "next_focus", columnDefinition = "TEXT")
  private String nextFocus;

  @Column(name = "manager_note", columnDefinition = "TEXT")
  private String managerNote;

  @CreationTimestamp
  @Column(name = "entry_timestamp", updatable = false)
  private LocalDateTime entryTimestamp;

  @UpdateTimestamp
  @Column(name = "updated_at")
  private LocalDateTime updatedAt;

  // ── Child collections ─────────────────────────────────────────────────
  @OneToMany(mappedBy = "sprintEntry", cascade = CascadeType.ALL, orphanRemoval = true)
  @Builder.Default
  @OrderBy("sortOrder ASC")
  private List<Task> tasks = new ArrayList<>();

  @OneToMany(mappedBy = "sprintEntry", cascade = CascadeType.ALL, orphanRemoval = true)
  @Builder.Default
  @OrderBy("sortOrder ASC")
  private List<Goal> goals = new ArrayList<>();

  // ── Helpers ───────────────────────────────────────────────────────────
  public void addTask(Task task) {
    task.setSprintEntry(this);
    this.tasks.add(task);
  }

  public void addGoal(Goal goal) {
    goal.setSprintEntry(this);
    this.goals.add(goal);
  }

  public void replaceTasks(List<Task> newTasks) {
    this.tasks.clear();
    newTasks.forEach(this::addTask);
  }

  public void replaceGoals(List<Goal> newGoals) {
    this.goals.clear();
    newGoals.forEach(this::addGoal);
  }
}
