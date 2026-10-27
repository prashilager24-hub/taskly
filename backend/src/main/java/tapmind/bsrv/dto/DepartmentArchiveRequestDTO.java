package tapmind.bsrv.dto;

import java.util.List;

public class DepartmentArchiveRequestDTO {
    private List<Integer> departmentIDList;

    public List<Integer> getDepartmentIDList() {
        return departmentIDList;
    }

    public void setDepartmentIDList(List<Integer> departmentIDList) {
        this.departmentIDList = departmentIDList;
    }
}
