package tapmind.bsrv.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UserListResponseDTO {


     private ResponseData response;
    private boolean success;
    private String message;
    private int statusCode;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class ResponseData {
     private int currentPage;
    private int pageSize;
    private long totalRecords;
    private int totalPages;
    private List<UserDTO> users;
     }
}
