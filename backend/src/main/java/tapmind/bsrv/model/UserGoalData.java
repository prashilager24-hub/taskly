package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;

@Entity
@Table(name = "UserGoalData", uniqueConstraints = {
    @UniqueConstraint(columnNames = { "WorkDate", "UserID", "GoalID", "GoalType" })
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserGoalData {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "UserGoalDataID")
  private Integer userGoalDataID;

  /* ================= BASIC COLUMNS ================= */

  @Column(name = "WorkDate", nullable = false)
  private LocalDate workDate;

  @Column(name = "UserID", nullable = false)
  private Integer userID;

  @Column(name = "DepartmentID", nullable = false)
  private Integer departmentID;

  @Column(name = "GoalID", nullable = false)
  private Integer goalID;

  @Column(name = "FixedGoal", precision = 10, scale = 2, nullable = false)
  private BigDecimal fixedGoal;

  @Column(name = "AchievedGoal", precision = 10, scale = 2)
  private BigDecimal achievedGoal = BigDecimal.ZERO;

  @Column(name = "CreatedAt", updatable = false)
  private Timestamp createdAt;

  @Column(name = "ModifiedAt")
  private Timestamp modifiedAt;

  @Column(name = "GoalType")
  private String goalType;
  @Column(name = "Comment")
  private String comment;
  @Column(name = "Target")
  private Boolean target = false;

  @Column(name = "RevisedGoal", columnDefinition = "longtext")
  private String revisedGoal;

  /* ================= RELATIONSHIPS ================= */

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "UserID", insertable = false, updatable = false)
  private User user;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "GoalID", insertable = false, updatable = false)
  private DepartmentGoal goal;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "DepartmentID", insertable = false, updatable = false)
  private Department department;

  @Column(name = "ApprovedByEL")
  private Boolean approvedByEL;

  @Column(name = "CommentForRejection")
  private String commentForRejection;

  @Column(name = "MetaData", columnDefinition = "TEXT")
  private String metaData;

  /* ================= LIFECYCLE ================= */

  @PrePersist
  protected void onCreate() {
    Timestamp now = new Timestamp(System.currentTimeMillis());
    this.createdAt = now;
    this.modifiedAt = now;
  }

  @PreUpdate
  protected void onUpdate() {
    this.modifiedAt = new Timestamp(System.currentTimeMillis());
  }
}
