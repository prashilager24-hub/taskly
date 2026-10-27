package tapmind.bsrv.model;
import jakarta.persistence.*;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class UserELDeptId implements Serializable {

    private Integer userId;
    private Integer departmentId;
    private Integer elId;

    // getters, setters, equals, hashCode
}
