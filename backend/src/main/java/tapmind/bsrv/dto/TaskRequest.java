package tapmind.bsrv.dto;

import jakarta.validation.constraints.*;
import lombok.*;
import tapmind.bsrv.enums.Product;
import tapmind.bsrv.enums.TaskStatus;
import tapmind.bsrv.enums.TaskType;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class TaskRequest {

    @Size(max = 30)
    private String jiraId;

    @NotBlank(message = "Task name is required")
    @Size(max = 500)
    private String taskName;

    @Min(0)
    private Integer storyPoints = 0;

    @NotNull(message = "Product is required")
    private Product product;

    @NotNull(message = "Module is required")
    private tapmind.bsrv.enums.Module module;

    @NotNull(message = "Task type is required")
    private TaskType taskType;

    @NotNull(message = "Status is required")
    private TaskStatus status;

    private Integer sortOrder = 0;
}
