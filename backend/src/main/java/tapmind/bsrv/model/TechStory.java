package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import tapmind.bsrv.model.User;
@Entity
@Table(name = "TechStory")
@Getter @Setter
public class TechStory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long storyID;

    private Long sprintID;
    private String storyKey;
    private Integer storyPoints;

    @Enumerated(EnumType.STRING)
    private StoryStatus status;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
