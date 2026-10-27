package tapmind.bsrv.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "TACallRescheduleLog")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TACallRescheduleLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long rescheduleID;

    private Long callID;
    private LocalDateTime oldDatetime;
    private LocalDateTime newDatetime;

    @Enumerated(EnumType.STRING)
    private RescheduledBy rescheduledBy;

    private String reason;

    private LocalDateTime createdAt;

    public enum RescheduledBy {
        CANDIDATE, INTERNAL
    }
}
