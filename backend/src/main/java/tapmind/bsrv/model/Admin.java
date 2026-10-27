package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;

@Data
@Entity
@Table(name = "AdminTasks")
public class Admin {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long ticketID;

    @Column(nullable = false, length = 250)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PositionStatus status = PositionStatus.OPEN;

    @Column(nullable = false, updatable = false)
    private java.sql.Timestamp createdAt;

    private java.sql.Timestamp updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = new java.sql.Timestamp(System.currentTimeMillis());
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new java.sql.Timestamp(System.currentTimeMillis());
    }
    @Column(name = "GoalID")
private Integer goalID;

    @Column(name = "CreatedByUserID")
    private Integer createdByUserID;

    @Column(name = "ClosedByUserID")
    private Integer closedByUserID;

    @Column(name = "OpenDate")
    private LocalDate openDate;

    @Column(name = "CloseDate")
    private LocalDate closeDate;

    @Column(name = "PausedDate")
    private LocalDate pausedDate;

}
