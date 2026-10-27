package tapmind.bsrv.dto;

import java.util.List;

public class DepartmentStatusRequestDTO {
    private List<Integer> departmentIDList;
    private Boolean departmentStatus;

    public List<Integer> getDepartmentIDList() {
        return departmentIDList;
    }

    public void setDepartmentIDList(List<Integer> departmentIDList) {
        this.departmentIDList = departmentIDList;
    }

    public Boolean getDepartmentStatus() {
        return departmentStatus;
    }

    public void setDepartmentStatus(Boolean departmentStatus) {
        this.departmentStatus = departmentStatus;
    }
}
