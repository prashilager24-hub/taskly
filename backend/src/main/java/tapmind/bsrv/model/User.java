package tapmind.bsrv.model;

import jakarta.persistence.*;

import java.util.*;

@Entity
@Table(name = "Users")
public class User {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "UserID")
	private Integer userID;

	@Column(name = "UserName")
	private String name;

	@Column(name = "UserEmail", insertable = false, updatable = false)
	private String username;

	@Column(name = "UserPassword")
	private String password;

	@Column(name = "UserStatus")
	private Boolean userStatus = true;

	@Column(name = "IsUserArchived")
	private Boolean isUserArchived = false;

	@Temporal(value = TemporalType.TIMESTAMP)
	@Column(name = "UserCreateTime")
	private Date userCreateTime;

	@Temporal(value = TemporalType.TIMESTAMP)
	@Column(name = "UserModifyTime")
	private Date userModifyTime;

	@Temporal(value = TemporalType.TIMESTAMP)
	@Column(name = "UserPasswordExpiryDate")
	private Date userPasswordExpiryDate;

	@Column(name = "UserEmail")
	private String userEmail;

	@Column(name = "EmployeeID")
	private String employeeID;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "ReportingManagerID")
	private User reportingManager;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "ELManagerID")
	private User elManager;

	@Column(name = "AppraisalCycle")
	private String appraisalCycle;

	@Column(name = "FeedbackResolverTeam")
	private String feedbackResolverTeam;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "RoleID", referencedColumnName = "RoleID")
	private AMRole role;

	@Column(name = "SecondaryRoleID")
	private Integer secondaryRoleID;

	public Integer getSecondaryRoleID() {
		return secondaryRoleID;
	}

	public void setSecondaryRoleID(Integer secondaryRoleID) {
		this.secondaryRoleID = secondaryRoleID;
	}

	@OneToMany(mappedBy = "user", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
	private Set<DepartmentUser> departmentUsers = new HashSet<>();

	public Set<DepartmentUser> getDepartmentUsers() {
		return departmentUsers;
	}

	public void setDepartmentUsers(Set<DepartmentUser> departmentUsers) {
		this.departmentUsers = departmentUsers;
	}

	public AMRole getRole() {
		return role;
	}

	public void setRole(AMRole role) {
		this.role = role;
	}

	@Transient
	private String token;

	public Integer getUserID() {
		return userID;
	}

	public void setUserID(Integer userID) {
		this.userID = userID;
	}

	public String getEmployeeID() {
		return employeeID;
	}

	public void setEmployeeID(String employeeID) {
		this.employeeID = employeeID;
	}

	public User getReportingManager() {
		return reportingManager;
	}

	public void setReportingManager(User reportingManager) {
		this.reportingManager = reportingManager;
	}

	public User getElManager() {
		return elManager;
	}

	public void setElManager(User elManager) {
		this.elManager = elManager;
	}

	public String getAppraisalCycle() {
		return appraisalCycle;
	}

	public void setAppraisalCycle(String appraisalCycle) {
		this.appraisalCycle = appraisalCycle;
	}

	public String getFeedbackResolverTeam() {
		return feedbackResolverTeam;
	}

	public void setFeedbackResolverTeam(String feedbackResolverTeam) {
		this.feedbackResolverTeam = feedbackResolverTeam;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getPassword() {
		return password;
	}

	public void setPassword(String password) {
		this.password = password;
	}

	public Boolean isUserStatus() {
		return userStatus;
	}

	public void setUserStatus(Boolean userStatus) {
		this.userStatus = userStatus;
	}

	public Boolean isUserArchived() {
		return isUserArchived;
	}

	public void setUserArchived(Boolean isUserArchived) {
		this.isUserArchived = isUserArchived;
	}

	public Date getUserCreateTime() {
		return userCreateTime;
	}

	public void setUserPasswordExpiryDate(Date userPasswordExpiryDate) {
		this.userPasswordExpiryDate = userPasswordExpiryDate;
	}

	public Date getUserPasswordExpiryDate() {
		return userPasswordExpiryDate;
	}

	public void setUserCreateTime(Date userCreateTime) {
		this.userCreateTime = userCreateTime;
	}

	public Date getUserModifyTime() {
		return userModifyTime;
	}

	public void setUserModifyTime(Date userModifyTime) {
		this.userModifyTime = userModifyTime;
	}

	public String getUserEmail() {
		return userEmail;
	}

	public void setUserEmail(String userEmail) {
		this.userEmail = userEmail;
	}

	public String getUsername() {
		return username;
	}

	public void setUsername(String username) {
		this.username = username;
	}

	public String getToken() {
		return token;
	}

	public void setToken(String token) {
		this.token = token;
	}

}