package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import tapmind.bsrv.model.User;
@Entity
@Table(name = "TechSprintUserMapping")
@Getter @Setter
public class TechSprintUserMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long mappingID;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "SprintID")
    private TechSprint sprint;   

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "UserID")
    private User user;

    private LocalDateTime createdAt;
}
