package tapmind.bsrv.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "DepartmentUser")
@IdClass(DepartmentUserID.class)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentUser {

    @Id
    @ManyToOne
    @JoinColumn(name = "DepartmentID", referencedColumnName = "DepartmentID")
    private Department department;

    @Id
    @ManyToOne
    @JoinColumn(name = "UserID", referencedColumnName = "UserID")
    private User user;
}
