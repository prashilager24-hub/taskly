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
@Table(name = "Salescallreschedulelog")
@Data
public class SalesCallRescheduleLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "CallID", nullable = false)
    private SalesCallSchedule salesCallSchedule;

    @Column(name = "OldDatetime", nullable = false)
    private LocalDateTime oldDatetime;

    @Column(name = "NewDatetime", nullable = false)
    private LocalDateTime newDatetime;

    @Enumerated(EnumType.STRING)
    @Column(name = "RescheduledBy", nullable = false)
    private RescheduledByType rescheduledBy;

    @Column(name = "Reason")
    private String reason;

    @Column(name = "CreatedAt", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void prePersist() {
        createdAt = LocalDateTime.now();
    }

    public enum RescheduledByType {
        PUBLISHER,
        INTERNAL
    }
}
