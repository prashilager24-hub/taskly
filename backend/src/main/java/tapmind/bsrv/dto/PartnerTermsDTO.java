package tapmind.bsrv.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PartnerTermsDTO {
    private Integer partnerId;
    private String tcAcceptedTime; // Optional if you want to send it
}
