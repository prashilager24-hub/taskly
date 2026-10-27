package tapmind.bsrv.dto;

import java.time.LocalDateTime;
import java.util.*;



public class DepartmentResponseDTO  {
    private Map<String,Object> response;
    private String message;
    private boolean status;
    private int statusCode;
    private LocalDateTime timestamp;

    public Map<String,Object> getResponse() {
        return response;
    }

    public void setResponse(Map<String,Object> response) {
        this.response = response;
    }

    // Getter and Setter for String message
    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    // Getter and Setter for boolean status
    public boolean isStatus() {
        return status;
    }

    public void setStatus(boolean status) {
        this.status = status;
    }

    // Getter and Setter for int statusCode
    public int getStatusCode() {
        return statusCode;
    }

    public void setStatusCode(int statusCode) {
        this.statusCode = statusCode;
    }

    // Getter and Setter for LocalDateTime timestamp
    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

   
}
