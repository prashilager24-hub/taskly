package tapmind.bsrv.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.*;
import lombok.NoArgsConstructor;
import java.sql.Timestamp;

@Entity
@NoArgsConstructor
@AllArgsConstructor
@Data
@Table(name = "SalesCallSchedule")
public class SalesCallSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "CallID")
    private Long callId;

    @Column(name = "CreaterUserID", nullable = false)
    private Long createrUserID;

    @Column(name = "PublisherName", length = 300)
    private String publisherName;

    @Column(name = "SalesUserID", nullable = false)
    private Long salesUserID;

    @Column(name = "ScheduledDatetime", nullable = false)
    private LocalDateTime scheduledDatetime;

    @Column(name = "ActualCallDatetime")
    private LocalDateTime actualCallDatetime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private CallStatus status = CallStatus.SCHEDULED;

    @Column(name = "reschedule_count")
    private Integer rescheduleCount = 0;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;


    // Automatically set timestamps
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }


    // -------------------------
    // ENUM FOR STATUS FIELD
    // -------------------------
    public enum CallStatus {
        SCHEDULED,
        COMPLETED,
        NO_SHOW,
        RESCHEDULED,
        CANCELLED_BY_PUBLISHER,
        CANCELLED_BY_INTERNAL
    }


}
