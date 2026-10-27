package tapmind.bsrv.dto;

import lombok.Data;

import java.util.List;

@Data
public class BulkApprovalRequestDTO {

    private Integer departmentID;

    private List<Integer> taskEntryIDs;

    private List<Integer> goalEntryIDs;
}