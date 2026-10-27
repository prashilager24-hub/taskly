package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.time.LocalDate;
import tapmind.bsrv.model.User;
@Entity
@Table(name = "TechStoryAssignment")
@Getter @Setter
public class TechStoryAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long assignmentID;

    private Long storyID;

    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "UserID")
    private User user;


    private Integer pointsWorked;

    private LocalDateTime createdAt;
}
