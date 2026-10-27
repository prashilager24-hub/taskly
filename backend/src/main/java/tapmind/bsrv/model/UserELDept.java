package tapmind.bsrv.model;



import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.*;
import lombok.NoArgsConstructor;


@Entity
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "UserELDept")
public class UserELDept {

    @EmbeddedId
    private UserELDeptId id;

    @ManyToOne
    @MapsId("userId")
    @JoinColumn(name = "UserID")
    private User user;

    @ManyToOne
    @MapsId("departmentId")
    @JoinColumn(name = "DepartmentID")
    private Department department;

    @ManyToOne
    @MapsId("elId")
    @JoinColumn(name = "ELID")
    private User executiveLeader;

    // getters and setters
}
