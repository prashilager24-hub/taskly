package tapmind.bsrv.dto;

import java.util.List;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PartnerCreateDTO {
    private String userName;
    private String userEmail;
    private String userRole;
    private Integer companyID;
    private String inventoryType;
    private Boolean generatePasswordEmail;

    private String partnerBeneficiaryName;
    private String partnerPaymentTerms;
    private String partnerContactDesignation;
    private String partnerRegion;
    private String partnerType;
    private String partnerCurrencyType;
    private String partnerBeneficiaryAddress;
    private String partnerBankBranchName;
    private String partnerFinanceContactName;
    private String partnerFinanceContactPhone;
    private String partnerFinanceContactEmail;
    private String partnerPaymentMode;
    private String partnerBeneficiaryAccountNo;
    private String partnerBankIFSOrSwiftCode;
    private String partnerBankName;
    private String partnerBankAddress;
    private String partnerOtherInfo;
    private String partnerPANTAXID;
    private String partnerGSTNo;
    private String partnerCIN;
    private String partnerAccountType;
    private String partnerLegalBusinessName;

    private Map<String,Object> partnerFORM10F;
    private Map<String,Object> partnerNoPermanentEstablishment;
    private Map<String,Object> partnerTaxResidencyCertificate;

    private List<Map<String,Object>> accountManager;
    private List<Map<String,Object>>  publisherManager;
    private List<Map<String,Object>>  adOpsManager;
    private String partnerInventoryType;
    private String partnerCountry;

    private Boolean isCDNEnabled;
    private String domainType;
    private String bucketType;

    private Boolean isTCDisabled = false;
    private Map<String,Object> partnerRolePrivilages;
    private String partnerRolePrivilagesType;
    private String password;

    private Boolean sendWelcomeMail = false;

    private List<Map<String,Object>> associatedUsers;
    private String cDNBucketCname;
    private String bucketName;
    private UserInfo userInfo;

     @Data
    public static class UserInfo{
         private String userName;
          private String userRole;
         private Integer userID;
         private Integer parentID;
         private Boolean isForSupplyPartner;

    }
}
