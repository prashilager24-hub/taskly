package tapmind.bsrv.dto;

import java.util.List;
import java.time.LocalDateTime;

public class AMRoleResponseDTOList {

    private AMRoleReadResponseDTO response;
    private boolean status;
    private String message;
    private int statusCode;
  private LocalDateTime timestamp;

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }


   public AMRoleResponseDTOList(){

   }
    // Getter and Setter for response
    public AMRoleReadResponseDTO getResponse() {
        return response;
    }

    public void setResponse(AMRoleReadResponseDTO response) {
        this.response = response;
    }

    // Getter and Setter for status
    public boolean isStatus() {
        return status;
    }

    public void setStatus(boolean status) {
        this.status = status;
    }

    // Getter and Setter for message
    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    // Getter and Setter for statusCode
    public int getStatusCode() {
        return statusCode;
    }

    public void setStatusCode(int statusCode) {
        this.statusCode = statusCode;
    }

    // Inner class AMRoleReadResponseDTO
    public static class AMRoleReadResponseDTO {
        private List<AMRoleDTO> roles;
        private Integer totalRecords;
        private Integer totalPages;
        private Integer currentPage;
        private Integer pageSize;


       public AMRoleReadResponseDTO(){}
        // Getter and Setter for roles
        public List<AMRoleDTO> getRoles() {
            return roles;
        }

        public void setRoles(List<AMRoleDTO> roles) {
            this.roles = roles;
        }

        // Getter and Setter for totalRecords
        public Integer getTotalRecords() {
            return totalRecords;
        }

        public void setTotalRecords(Integer totalRecords) {
            this.totalRecords = totalRecords;
        }

        // Getter and Setter for totalPages
        public Integer getTotalPages() {
            return totalPages;
        }

        public void setTotalPages(Integer totalPages) {
            this.totalPages = totalPages;
        }

        // Getter and Setter for currentPage
        public Integer getCurrentPage() {
            return currentPage;
        }

        public void setCurrentPage(Integer currentPage) {
            this.currentPage = currentPage;
        }

        // Getter and Setter for pageSize
        public Integer getPageSize() {
            return pageSize;
        }

        public void setPageSize(Integer pageSize) {
            this.pageSize = pageSize;
        }
    }
}
