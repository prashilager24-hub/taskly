package tapmind.bsrv.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class TaskResponse {
    private Long id;
    private String jiraId;
    private String jiraUrl;
    private String taskName;
    private Integer storyPoints;
    private String product;
    private String module;
    private String taskType;
    private String status;
    private Integer sortOrder;
}
