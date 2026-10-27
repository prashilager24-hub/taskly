package tapmind.bsrv.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "TACallSchedule")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TACallSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long callID;

    private Long taUserID;
    private String candidateName;

    private Long positionID;

    private LocalDateTime scheduledDatetime;
    private LocalDateTime actualCallDatetime;

    @Enumerated(EnumType.STRING)
    private Status status;

    private Integer rescheduleCount;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public enum Status {
        SCHEDULED,
        COMPLETED,
        NO_SHOW,
        RESCHEDULED,
        CANDIDATE_NOT_INTERESTED,
        CANCELLED_BY_INTERNAL
    }
}
