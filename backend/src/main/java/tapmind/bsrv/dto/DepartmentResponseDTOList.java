package tapmind.bsrv.dto;

import java.time.LocalDateTime;
import java.util.List;

public class DepartmentResponseDTOList {

    private DepartmentReadResponseDTO response;
    private boolean status;
    private String message;
    private int statusCode;
    private LocalDateTime timestamp;

    // Constructors
    public DepartmentResponseDTOList() {
    }

    // ===== Getters and Setters =====
    public DepartmentReadResponseDTO getResponse() {
        return response;
    }

    public void setResponse(DepartmentReadResponseDTO response) {
        this.response = response;
    }

    public boolean isStatus() {
        return status;
    }

    public void setStatus(boolean status) {
        this.status = status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public void setStatusCode(int statusCode) {
        this.statusCode = statusCode;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    // ===== Inner Class =====
    public static class DepartmentReadResponseDTO {

        private List<DepartmentDTO> departments;
        private Integer totalRecords;
        private Integer totalPages;
        private Integer currentPage;
        private Integer pageSize;

        public DepartmentReadResponseDTO() {
        }

        // ===== Getters and Setters =====
        public List<DepartmentDTO> getDepartments() {
            return departments;
        }

        public void setDepartments(List<DepartmentDTO> departments) {
            this.departments = departments;
        }

        public Integer getTotalRecords() {
            return totalRecords;
        }

        public void setTotalRecords(Integer totalRecords) {
            this.totalRecords = totalRecords;
        }

        public Integer getTotalPages() {
            return totalPages;
        }

        public void setTotalPages(Integer totalPages) {
            this.totalPages = totalPages;
        }

        public Integer getCurrentPage() {
            return currentPage;
        }

        public void setCurrentPage(Integer currentPage) {
            this.currentPage = currentPage;
        }

        public Integer getPageSize() {
            return pageSize;
        }

        public void setPageSize(Integer pageSize) {
            this.pageSize = pageSize;
        }
    }
}
