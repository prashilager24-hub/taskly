package tapmind.bsrv.dto;

import java.util.List;

import lombok.Data;

@Data
public class AttachPartnerRequestDTO {
    private Integer userId;
    private String userRole;
    private List<Integer> partnerList;

    // Getters and Setters
}
