package tapmind.bsrv.model;

import java.io.Serializable;
import java.util.Objects;

public class DepartmentUserID implements Serializable {

    private Integer department;
    private Integer user;

    public DepartmentUserID() {}

    public DepartmentUserID(Integer department, Integer user) {
        this.department = department;
        this.user = user;
    }

    public Integer getDepartment() {
        return department;
    }

    public void setDepartment(Integer department) {
        this.department = department;
    }

    public Integer getUser() {
        return user;
    }

    public void setUser(Integer user) {
        this.user = user;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof DepartmentUserID)) return false;
        DepartmentUserID that = (DepartmentUserID) o;
        return Objects.equals(department, that.department) &&
               Objects.equals(user, that.user);
    }

    @Override
    public int hashCode() {
        return Objects.hash(department, user);
    }
}
