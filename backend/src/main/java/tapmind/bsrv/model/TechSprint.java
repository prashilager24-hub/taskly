package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.time.LocalDate;
import tapmind.bsrv.model.User;
@Entity
@Table(name = "TechSprint")
@Getter @Setter
public class TechSprint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long sprintID;

    private String sprintName;
    private Long projectID;

    private LocalDate startDate;
    private LocalDate endDate;

    private Integer plannedPoints;

    @Enumerated(EnumType.STRING)
    private SprintStatus status;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
