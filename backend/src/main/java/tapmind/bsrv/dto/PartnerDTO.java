package tapmind.bsrv.dto;

import java.util.Date;
import java.util.List;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PartnerDTO {

    private Integer partnerID;
    private String partnerLegalBusinessName;
    private String partnerBeneficiaryName;
    private String partnerPaymentTerms;
    private String partnerContactDesignation;
    private String partnerRegion;
    private String partnerType;
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
    private String partnerCountry;
    private Integer companyID;
     private Map<String,Object> partnerFORM10F;
    private Map<String,Object> partnerNoPermanentEstablishment;
    private Map<String,Object> partnerTaxResidencyCertificate;

    private String userName;
    private Date userCreateTime;
    private String userEmail;
    private Boolean userStatus;
    private Boolean isUserArchived;
    private String partnerInventoryType;
    private String partnerBeneficiaryAddress;
    private String partnerBankBranchName;
    private Boolean isCDNEnabled;
    private String domainType;
    private String bucketType;
    private String partnerRolePrivilagesType;
    private String partnerCurrencyType;

    private Map<String,Object> partnerRolePrivilages; // Use appropriate type if deserialized, else keep as Object
    private List<SimpleUserDTO> accountManager;
    private List<SimpleUserDTO> publisherManager;
    private List<SimpleUserDTO> adOpsManager;
    private List<SimpleUserDTO> associatedUsers;

    private String newStatus;

    // private BucketDTO bucket;

    // Getters and Setters

    public Integer getPartnerID() {
        return partnerID;
    }

    public void setPartnerID(Integer partnerID) {
        this.partnerID = partnerID;
    }

    public String getPartnerLegalBusinessName() {
        return partnerLegalBusinessName;
    }

    public void setPartnerLegalBusinessName(String partnerLegalBusinessName) {
        this.partnerLegalBusinessName = partnerLegalBusinessName;
    }

    public String getPartnerBeneficiaryName() {
        return partnerBeneficiaryName;
    }

    public void setPartnerBeneficiaryName(String partnerBeneficiaryName) {
        this.partnerBeneficiaryName = partnerBeneficiaryName;
    }

    public String getPartnerPaymentTerms() {
        return partnerPaymentTerms;
    }

    public void setPartnerPaymentTerms(String partnerPaymentTerms) {
        this.partnerPaymentTerms = partnerPaymentTerms;
    }

    public String getPartnerContactDesignation() {
        return partnerContactDesignation;
    }

    public void setPartnerContactDesignation(String partnerContactDesignation) {
        this.partnerContactDesignation = partnerContactDesignation;
    }

    public String getPartnerRegion() {
        return partnerRegion;
    }

    public void setPartnerRegion(String partnerRegion) {
        this.partnerRegion = partnerRegion;
    }

    public String getPartnerType() {
        return partnerType;
    }

    public void setPartnerType(String partnerType) {
        this.partnerType = partnerType;
    }

    public String getPartnerFinanceContactName() {
        return partnerFinanceContactName;
    }

    public void setPartnerFinanceContactName(String partnerFinanceContactName) {
        this.partnerFinanceContactName = partnerFinanceContactName;
    }

    public String getPartnerFinanceContactPhone() {
        return partnerFinanceContactPhone;
    }

    public void setPartnerFinanceContactPhone(String partnerFinanceContactPhone) {
        this.partnerFinanceContactPhone = partnerFinanceContactPhone;
    }

    public String getPartnerFinanceContactEmail() {
        return partnerFinanceContactEmail;
    }

    public void setPartnerFinanceContactEmail(String partnerFinanceContactEmail) {
        this.partnerFinanceContactEmail = partnerFinanceContactEmail;
    }

    public String getPartnerPaymentMode() {
        return partnerPaymentMode;
    }

    public void setPartnerPaymentMode(String partnerPaymentMode) {
        this.partnerPaymentMode = partnerPaymentMode;
    }

    public String getPartnerBeneficiaryAccountNo() {
        return partnerBeneficiaryAccountNo;
    }

    public void setPartnerBeneficiaryAccountNo(String partnerBeneficiaryAccountNo) {
        this.partnerBeneficiaryAccountNo = partnerBeneficiaryAccountNo;
    }

    public String getPartnerBankIFSOrSwiftCode() {
        return partnerBankIFSOrSwiftCode;
    }

    public void setPartnerBankIFSOrSwiftCode(String partnerBankIFSOrSwiftCode) {
        this.partnerBankIFSOrSwiftCode = partnerBankIFSOrSwiftCode;
    }

    public String getPartnerBankName() {
        return partnerBankName;
    }

    public void setPartnerBankName(String partnerBankName) {
        this.partnerBankName = partnerBankName;
    }

    public String getPartnerBankAddress() {
        return partnerBankAddress;
    }

    public void setPartnerBankAddress(String partnerBankAddress) {
        this.partnerBankAddress = partnerBankAddress;
    }

    public String getPartnerOtherInfo() {
        return partnerOtherInfo;
    }

    public void setPartnerOtherInfo(String partnerOtherInfo) {
        this.partnerOtherInfo = partnerOtherInfo;
    }

    public String getPartnerPANTAXID() {
        return partnerPANTAXID;
    }

    public void setPartnerPANTAXID(String partnerPANTAXID) {
        this.partnerPANTAXID = partnerPANTAXID;
    }

    public String getPartnerGSTNo() {
        return partnerGSTNo;
    }

    public void setPartnerGSTNo(String partnerGSTNo) {
        this.partnerGSTNo = partnerGSTNo;
    }

    public String getPartnerCIN() {
        return partnerCIN;
    }

    public void setPartnerCIN(String partnerCIN) {
        this.partnerCIN = partnerCIN;
    }

    public String getPartnerCountry() {
        return partnerCountry;
    }

    public void setPartnerCountry(String partnerCountry) {
        this.partnerCountry = partnerCountry;
    }

    public Integer getCompanyID() {
        return companyID;
    }

    public void setCompanyID(Integer companyID) {
        this.companyID = companyID;
    }

    public Map<String,Object> getPartnerFORM10F() {
        return partnerFORM10F;
    }

    public void setPartnerFORM10F(Map<String,Object> partnerFORM10F) {
        this.partnerFORM10F = partnerFORM10F;
    }

    public Map<String,Object> getPartnerNoPermanentEstablishment() {
        return partnerNoPermanentEstablishment;
    }

    public void setPartnerNoPermanentEstablishment(Map<String,Object> partnerNoPermanentEstablishment) {
        this.partnerNoPermanentEstablishment = partnerNoPermanentEstablishment;
    }

    public Map<String,Object> getPartnerTaxResidencyCertificate() {
        return partnerTaxResidencyCertificate;
    }

    public void setPartnerTaxResidencyCertificate(Map<String,Object> partnerTaxResidencyCertificate) {
        this.partnerTaxResidencyCertificate = partnerTaxResidencyCertificate;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public Date getUserCreateTime() {
        return userCreateTime;
    }

    public void setUserCreateTime(Date userCreateTime) {
        this.userCreateTime = userCreateTime;
    }

    public String getUserEmail() {
        return userEmail;
    }

    public void setUserEmail(String userEmail) {
        this.userEmail = userEmail;
    }

    public Boolean getUserStatus() {
        return userStatus;
    }

    public void setUserStatus(Boolean userStatus) {
        this.userStatus = userStatus;
    }

    public Boolean getIsUserArchived() {
        return isUserArchived;
    }

    public void setIsUserArchived(Boolean isUserArchived) {
        this.isUserArchived = isUserArchived;
    }

    public String getPartnerInventoryType() {
        return partnerInventoryType;
    }

    public void setPartnerInventoryType(String partnerInventoryType) {
        this.partnerInventoryType = partnerInventoryType;
    }

    public String getPartnerBeneficiaryAddress() {
        return partnerBeneficiaryAddress;
    }

    public void setPartnerBeneficiaryAddress(String partnerBeneficiaryAddress) {
        this.partnerBeneficiaryAddress = partnerBeneficiaryAddress;
    }

    public String getPartnerBankBranchName() {
        return partnerBankBranchName;
    }

    public void setPartnerBankBranchName(String partnerBankBranchName) {
        this.partnerBankBranchName = partnerBankBranchName;
    }

    public Boolean getIsCDNEnabled() {
        return isCDNEnabled;
    }

    public void setIsCDNEnabled(Boolean isCDNEnabled) {
        this.isCDNEnabled = isCDNEnabled;
    }

    public String getDomainType() {
        return domainType;
    }

    public void setDomainType(String domainType) {
        this.domainType = domainType;
    }

    public String getBucketType() {
        return bucketType;
    }

    public void setBucketType(String bucketType) {
        this.bucketType = bucketType;
    }

    public String getPartnerRolePrivilagesType() {
        return partnerRolePrivilagesType;
    }

    public void setPartnerRolePrivilagesType(String partnerRolePrivilagesType) {
        this.partnerRolePrivilagesType = partnerRolePrivilagesType;
    }

    public String getPartnerCurrencyType() {
        return partnerCurrencyType;
    }

    public void setPartnerCurrencyType(String partnerCurrencyType) {
        this.partnerCurrencyType = partnerCurrencyType;
    }

    public Map<String,Object> getPartnerRolePrivilages() {
        return partnerRolePrivilages;
    }

    public void setPartnerRolePrivilages(Map<String,Object> partnerRolePrivilages) {
        this.partnerRolePrivilages = partnerRolePrivilages;
    }

    public List<SimpleUserDTO> getAccountManager() {
        return accountManager;
    }

    public void setAccountManager(List<SimpleUserDTO> accountManager) {
        this.accountManager = accountManager;
    }

    public List<SimpleUserDTO> getPublisherManager() {
        return publisherManager;
    }

    public void setPublisherManager(List<SimpleUserDTO> publisherManager) {
        this.publisherManager = publisherManager;
    }

    public List<SimpleUserDTO> getAdOpsManager() {
        return adOpsManager;
    }

    public void setAdOpsManager(List<SimpleUserDTO> adOpsManager) {
        this.adOpsManager = adOpsManager;
    }

    public List<SimpleUserDTO> getAssociatedUsers() {
        return associatedUsers;
    }

    public void setAssociatedUsers(List<SimpleUserDTO> associatedUsers) {
        this.associatedUsers = associatedUsers;
    }

    public String getNewStatus() {
        return newStatus;
    }

    public void setNewStatus(String newStatus) {
        this.newStatus = newStatus;
    }

    // public BucketDTO getBucket() {
    //     return bucket;
    // }

    // public void setBucket(BucketDTO bucket) {
    //     this.bucket = bucket;
    // }
}
