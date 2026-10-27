
package tapmind.bsrv.serviceNew;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.json.JSONObject;
import tapmind.bsrv.dto.jwt.JwtRequest;
import tapmind.bsrv.dto.jwt.JwtResponse;
import tapmind.bsrv.auth.JwtTokenUtil;
import tapmind.bsrv.auth.UserAuthDetails;
import tapmind.bsrv.repository.AMRoleRepository;
import tapmind.bsrv.model.User;
import tapmind.bsrv.model.AMRole;
import org.json.JSONArray;
import org.joda.time.DateTime;
import org.joda.time.DateTimeZone;
import java.time.LocalDate;
import tapmind.bsrv.dto.jwt.UserSwitchRequestDTO;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import jakarta.servlet.http.HttpServletRequest;
import java.text.*;
import java.time.LocalDateTime;

import tapmind.bsrv.dto.*;
import org.joda.time.format.DateTimeFormatter;

import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.criteria.Predicate;
import tapmind.bsrv.service.*;
import lombok.extern.slf4j.Slf4j;
import tapmind.bsrv.dto.jwt.UserSwitchRequestDTO;
import org.springframework.web.client.RestTemplate;
import tapmind.bsrv.repository.UserRepository;
import tapmind.bsrv.repository.DepartmentUserRepository;
import tapmind.bsrv.repository.DepartmentRepository;
import tapmind.bsrv.repository.ForgotPasswordRepository;

import tapmind.bsrv.model.ForgotPassword;

import tapmind.bsrv.dto.UserResponseDTO;
import tapmind.bsrv.dto.UserStatusUpdateDTO;
import tapmind.bsrv.dto.UserListResponseDTO;
import tapmind.bsrv.dto.UserReadDTO;
import jakarta.persistence.criteria.JoinType;

import java.util.*;
import java.util.stream.Collectors;
import tapmind.bsrv.model.Department;
import tapmind.bsrv.model.DepartmentUser;
import org.joda.time.format.DateTimeFormat;
import jakarta.persistence.criteria.Join;

@Service
@Slf4j
public class JwtUserService implements UserDetailsService {

    @Lazy
    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private Service_Default serviceDefault;

    // @Autowired
    // private Cache cache;

    @Lazy
    @Autowired
    private AuthenticationManager authenticationManager;

    @Lazy
    @Autowired
    private JwtTokenUtil jwtTokenUtil;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentUserRepository departmentUserRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private ForgotPasswordRepository forgotPasswordRepository;

    private final RestTemplate restTemplate = new RestTemplate();

    @Lazy
    @Autowired
    private JwtUserService userDetailsService;

    @Autowired
    private AMRoleRepository amRoleRepository;

    @Autowired
    private OnboardingService onboardingService;

    // @Autowired
    // private AsyncCacheUpdateService cacheUpdateService;

    public String findExpireDate(String email) {
        String date = null;
        Optional<User> userOptional = userRepository.findByUserEmail(email);
        if (userOptional.isPresent()) {
            User user = userOptional.get();
            java.util.Date expiryDate = user.getUserPasswordExpiryDate();
            if (expiryDate != null) {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
                date = sdf.format(expiryDate);
            }
            log.info("UserPasswordExpiryDate for " + email + " is " + date);
        } else {
            log.warn("User not found with email: " + email);
        }
        return date;
    }

    @Transactional
    public JSONObject authenticationLog(String date, String name, JwtRequest authenticationRequest) throws Exception {

        JSONObject response = new JSONObject();
        DateTimeZone zone = DateTimeZone.forID("America/New_York");
        DateTimeFormatter fmt = DateTimeFormat.forPattern("yyyy-MM-dd HH:mm:ss").withZone(zone);

        try {
            DateTime dbTime = fmt.parseDateTime(date);
            DateTime now = DateTime.now(zone);

            if (dbTime.isBefore(now)) {
                response.put("passwordExpired", true);

                Optional<User> userOpt = userRepository.findByUserEmail(name);
                if (userOpt.isPresent()) {
                    User user = userOpt.get();
                    deletePassword(name);

                    String start = now.toString("yyyy-MM-dd HH:mm:ss");
                    String end = now.plusMinutes(30).toString("yyyy-MM-dd HH:mm:ss");

                    String link = sendPasswordResetLink(
                            name, start, end, user.getUserID(), user.getUsername(), "login");

                    response.put("link", link);
                }

                response.put("statusCode", 401);
                response.put("status", false);
                return response;
            }

            authenticate(authenticationRequest.getUsername(), authenticationRequest.getPassword());

            UserDetails userDetails = loadUserByUsername(authenticationRequest.getUsername());
            User user = userRepository.findByUserEmail(authenticationRequest.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            String token = jwtTokenUtil.generateToken(userDetails);

            response.put("username", user.getUserEmail());
            response.put("name", user.getName());
            response.put("token", token);
            response.put("userID", user.getUserID());
            response.put("userRole", user.getRole().getRoleID());
            response.put("secondaryRoleID",
                    user.getSecondaryRoleID() != null ? user.getSecondaryRoleID() : JSONObject.NULL);
            response.put(
                    "reportingManagerID",
                    user.getReportingManager() != null
                            ? user.getReportingManager().getUserID()
                            : null);

            response.put(
                    "elManagerID",
                    user.getElManager() != null
                            ? user.getElManager().getUserID()
                            : null);
            response.put(
                    "feedbackresolverteam",
                    user.getFeedbackResolverTeam() != null
                            ? user.getFeedbackResolverTeam()
                            : JSONObject.NULL);
            response.put("isHeExecutiveLeader", false);
            response.put("isHeFunctionalLeader", false);

            int roleId = user.getRole().getRoleID();

            if (roleId == 3) { // Executive Leader
                JSONArray departments = new JSONArray();
                for (Object[] row : departmentRepository
                        .findDepartmentsWhereUserIsExecutiveLeader(user.getUserID())) {

                    JSONObject d = new JSONObject();
                    d.put("departmentID", row[0]);
                    d.put("departmentName", row[1]);
                    d.put("executiveLeaderID", row[2]);
                    d.put("functionalLeaderID", row[3]);
                    departments.put(d);
                }
                response.put("departments", departments);
                response.put("isHeExecutiveLeader", true);

            } else if (roleId == 4) {

                JSONArray departments = new JSONArray();
                Set<Integer> addedDepartmentIds = new HashSet<>();

                // Departments where user is Functional Leader
                for (Object[] row : departmentRepository.findDepartmentsWhereUserIsFunctinalLeader(user.getUserID())) {

                    Integer deptId = (Integer) row[0];

                    JSONObject d = new JSONObject();
                    d.put("departmentID", deptId);
                    d.put("departmentName", row[1]);
                    d.put("executiveLeaderID", row[2]);
                    d.put("functionalLeaderID", row[3]);

                    departments.put(d);
                    addedDepartmentIds.add(deptId);
                }

                List<Object[]> deptInfo = departmentUserRepository.findDepartmentDetailsByUserId(user.getUserID());

                for (Object[] dept : deptInfo) {

                    Integer deptId = (Integer) dept[0];

                    if (!addedDepartmentIds.contains(deptId)) {

                        JSONObject d = new JSONObject();
                        d.put("departmentID", deptId);
                        d.put("departmentName", dept[1]);
                        d.put("executiveLeaderID", JSONObject.NULL);
                        d.put("functionalLeaderID", JSONObject.NULL);

                        departments.put(d);
                        addedDepartmentIds.add(deptId);
                    }
                }

                response.put("departments", departments);
                response.put("isHeFunctionalLeader", true);
            } else { // Normal user
                List<Object[]> deptInfo = departmentUserRepository.findDepartmentDetailsByUserId(user.getUserID());

                if (!deptInfo.isEmpty()) {
                    Object[] dept = deptInfo.get(0);
                    response.put("departmentID", dept[0]);
                    response.put("departmentName", dept[1]);
                }
            }

            response.put("status", true);
            response.put("statusCode", 200);
            return response;

        } catch (BadCredentialsException e) {
            response.put("authorization", "Wrong Password");
        } catch (UsernameNotFoundException e) {
            response.put("authorization", "Wrong Email");
        } catch (Exception e) {
            response.put("authorization", "Wrong Credentials");
        }

        response.put("status", false);
        response.put("statusCode", 401);
        return response;
    }

    private void authenticate(String username, String password) throws Exception {
        try {
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));
        } catch (DisabledException e) {
            e.printStackTrace();
            throw new Exception("USER_DISABLED", e);
        } catch (BadCredentialsException e) {
            e.printStackTrace();
            throw new Exception("INVALID_CREDENTIALS", e);
        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Authentication failed", e);
        }
    }

    public void deletePassword(String email) {
        String randomUUID = UUID.randomUUID().toString();
        int rowsUpdated = userRepository.updatePasswordByEmail(randomUUID, email);
        if (rowsUpdated > 0) {
            log.info("Password reset successfully for: " + email);
        } else {
            log.warn("No user found with email: " + email);
        }
    }

    public String sendPasswordResetLink(String email, String startTime, String endTime, int userID, String UserName,
            String action) throws Exception {
        String uuid = UUID.randomUUID().toString();
        String createPasswordUrl = "http://taskly.tapmind.io/passwordHandler?token=" + uuid + "&type=create";
        JSONArray to = new JSONArray();
        JSONArray cc = new JSONArray();
        to.put(email);
        StringBuffer body = new StringBuffer();
        body.append("<p>Dear " + UserName + " </p>");
        if (action.equals("setPasswordLink")) {
            body.append("<p >Welcome to Tapmind tasklyTool.</p>");
            body.append("<p> Your account is almost complete; to set a password, please click the link <a href="
                    + createPasswordUrl + " target='_blank' style='width:60%;  color:blue;'>Click here</a></p> ");
        } else {
            body.append(
                    "<p> Your password for Tapmind is expired; to set a password, please click the link <a href="
                            + createPasswordUrl
                            + " target='_blank' style='width:60%;  color:blue;'>Click here</a></p> ");
        }
        body.append("<p> This password reset link is only valid for the next 30 minutes.</p>");
        String subject = "Set Password ";
        Mailer MAILER = new Mailer();
        MAILER.send(to, cc, subject, body.toString());
        this.insertForgotPassword(email, startTime, endTime, uuid, userID);
        return createPasswordUrl;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsernameAndStatusTrue(username);
        System.out.println(user);
        if (user == null) {
            throw new UsernameNotFoundException("User not found with username: " + username);
        }
        return new UserAuthDetails(user);
    }

    public String usernameExists(String email) {
        if (userRepository.existsByUserEmail(email)) {
            return email;
        }
        return "";
    }

    public void insertForgotPassword(String email, String startTime, String endTime, String uuid, int userID) {
        forgotPasswordRepository.insertForgotPassword(uuid, userID, startTime, endTime, true);
    }

    @Transactional
    public UserResponseDTO createUser(UserCreateDTO requestDTO) {
        UserResponseDTO response = new UserResponseDTO();
        boolean flag = false;

        try {
            // Check if email already exists
            if (userRepository.findByUserEmail(requestDTO.getUserEmail()).isPresent()) {
                response.setStatus(false);
                response.setStatusCode(409);
                response.setTimestamp(LocalDateTime.now());
                response.setMessage("Email already exists");
                return response;
            }

            // Check if username already exists
            if (userRepository.findByName(requestDTO.getUserName()).isPresent()) {
                response.setStatus(false);
                response.setStatusCode(409);
                response.setTimestamp(LocalDateTime.now());
                response.setMessage("Username already exists");
                return response;
            }

            // Fetch the next available ID

            // Create new User
            User newUser = new User();
            newUser.setName(requestDTO.getUserName());
            newUser.setUserEmail(requestDTO.getUserEmail());
            newUser.setEmployeeID(requestDTO.getEmployeeID());
            // Reporting Manager
            if (requestDTO.getReportingManagerId() != null) {
                Optional<User> rmOpt = userRepository.findById(requestDTO.getReportingManagerId());
                if (rmOpt.isPresent()) {
                    newUser.setReportingManager(rmOpt.get());
                } else {
                    throw new RuntimeException("Invalid Reporting Manager ID");
                }
            }

            // EL Manager
            if (requestDTO.getElManagerId() != null) {
                Optional<User> elOpt = userRepository.findById(requestDTO.getElManagerId());
                if (elOpt.isPresent()) {
                    newUser.setElManager(elOpt.get());
                } else {
                    throw new RuntimeException("Invalid EL Manager ID");
                }
            }
            newUser.setAppraisalCycle(requestDTO.getAppraisalCycle());
            newUser.setFeedbackResolverTeam(requestDTO.getFeedbackresolverteam());

            newUser.setUserCreateTime(new Date());
            newUser.setUserModifyTime(new Date());

            newUser.setUserCreateTime(new Date());
            newUser.setUserModifyTime(new Date());

            // Handle password
            // if (!requestDTO.getGeneratePasswordEmail()) {
            String encodedPassword = passwordEncoder.encode(requestDTO.getPassword());
            newUser.setPassword(encodedPassword);

            String expiredTimeString = DateTime.now().withZone(DateTimeZone.forID("America/New_York")).plusDays(366)
                    .toString("yyyy-MM-dd HH:mm:ss");
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
            Date expiredTime = sdf.parse(expiredTimeString);
            newUser.setUserPasswordExpiryDate(expiredTime);
            // }

            // Handle Role assignment
            if (requestDTO.getRoleID() != null && requestDTO.getRoleID() > 0) {
                Optional<AMRole> roleOpt = amRoleRepository.findById(requestDTO.getRoleID());
                if (roleOpt.isPresent()) {
                    newUser.setRole(roleOpt.get());
                    newUser.setSecondaryRoleID(requestDTO.getSecondaryRoleID());
                } else {
                    response.setStatus(false);
                    response.setStatusCode(404);
                    response.setTimestamp(LocalDateTime.now());
                    response.setMessage("Invalid Role ID: " + requestDTO.getRoleID());
                    return response;
                }
            } else {
                response.setStatus(false);
                response.setStatusCode(400);
                response.setTimestamp(LocalDateTime.now());
                response.setMessage("Role ID is required");
                return response;
            }

            // Save user to the repository
            userRepository.save(newUser);
            if (requestDTO.getDepartmentID() != 0) {

                Department department = new Department();
                department.setDepartmentID(requestDTO.getDepartmentID()); // assuming you already have the ID

                DepartmentUser departmentUser = new DepartmentUser();
                departmentUser.setUser(newUser); // from your user creation logic
                departmentUser.setDepartment(department); // link to the department

                departmentUserRepository.save(departmentUser);

            }

            // Auto-trigger the onboarding survey for the newly created user
            try {
                String dueDate = java.time.LocalDate.now()
                        .plusDays(30)
                        .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd"));

                Map<String, String> deptOverrides = null;
                if (requestDTO.getDepartmentID() != 0) {
                    String deptName = departmentRepository.findDepartmentNameByID(requestDTO.getDepartmentID());
                    if (deptName != null) {
                        deptOverrides = Map.of(newUser.getName(), deptName);
                    }
                }

                onboardingService.sendSurvey(OnboardingSendRequest.builder()
                        .recipients(java.util.List.of(newUser.getName()))
                        .dueDate(dueDate)
                        .notifyList("hr@tapmind.com")
                        .departmentOverrides(deptOverrides)
                        .build());
            } catch (Exception e) {
                log.warn("Failed to auto-trigger onboarding survey for user {}: {}",
                        newUser.getUserID(), e.getMessage());
            }

            if (requestDTO.getRoleID() == 3) {
                userRepository.updateExecutiveLeader(requestDTO.getDepartmentID(), requestDTO.getUserID());
            }

            /*
             * if (requestDTO.getGeneratePasswordEmail()) {
             * String startTime =
             * DateTime.now().withZone(DateTimeZone.forID("America/New_York"))
             * .toString("yyyy-MM-dd HH:mm:ss");
             * String endTime =
             * DateTime.now().withZone(DateTimeZone.forID("America/New_York")).plusMinutes(
             * 30)
             * .toString("yyyy-MM-dd HH:mm:ss");
             * String link = sendPasswordResetLink(requestDTO.getUserEmail(), startTime,
             * endTime, nextId,
             * requestDTO.getUserName(), "setPasswordLink");
             * response.setLink(link);
             * }
             */
            response.setResponse(new HashMap<>());
            response.setStatus(true);
            response.setMessage("User created successfully");
            response.setStatusCode(200);
            response.setTimestamp(LocalDateTime.now());

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage(e.getMessage());
            response.setTimestamp(LocalDateTime.now());
        }
        return response;
    }

    @Transactional
    public UserResponseDTO updateUser(UserCreateDTO requestDTO) {
        UserResponseDTO response = new UserResponseDTO();
        try {
            // Check if user exists
            Integer userId = requestDTO.getUserID();
            Optional<User> existingUserOpt = userRepository.findById(userId);
            if (existingUserOpt.isEmpty()) {
                response.setStatus(false);
                response.setStatusCode(404);
                response.setMessage("User not found");
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            // Check email uniqueness (exclude current user)
            Optional<User> emailUser = userRepository.findByUserEmail(requestDTO.getUserEmail());
            if (emailUser.isPresent() && !emailUser.get().getUserID().equals(userId)) {
                response.setStatus(false);
                response.setStatusCode(409);
                response.setMessage("Email already exists");
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            // Check username uniqueness (exclude current user)
            Optional<User> nameUser = userRepository.findByName(requestDTO.getUserName());
            if (nameUser.isPresent() && !nameUser.get().getUserID().equals(userId)) {
                response.setStatus(false);
                response.setStatusCode(409);
                response.setMessage("Username already exists");
                response.setTimestamp(LocalDateTime.now());
                return response;
            }

            User user = existingUserOpt.get();
            user.setName(requestDTO.getUserName());
            user.setUserEmail(requestDTO.getUserEmail());
            user.setUserModifyTime(new Date());
            // Employee ID
            user.setEmployeeID(requestDTO.getEmployeeID());

            // Appraisal Cycle
            user.setAppraisalCycle(requestDTO.getAppraisalCycle());

            // Feedback Resolver Team
            user.setFeedbackResolverTeam(requestDTO.getFeedbackresolverteam());

            // Reporting Manager
            if (requestDTO.getReportingManagerId() != null) {
                Optional<User> rmOpt = userRepository.findById(requestDTO.getReportingManagerId());
                if (rmOpt.isPresent()) {
                    user.setReportingManager(rmOpt.get());
                } else {
                    throw new RuntimeException("Invalid Reporting Manager ID");
                }
            } else {
                user.setReportingManager(null); // optional (if you want to clear)
            }

            // EL Manager
            if (requestDTO.getElManagerId() != null) {
                Optional<User> elOpt = userRepository.findById(requestDTO.getElManagerId());
                if (elOpt.isPresent()) {
                    user.setElManager(elOpt.get());
                } else {
                    throw new RuntimeException("Invalid EL Manager ID");
                }
            } else {
                user.setElManager(null); // optional
            }
            if (requestDTO.getPassword() != null
                    && !requestDTO.getPassword().isEmpty()) {
                String encodedPassword = passwordEncoder.encode(requestDTO.getPassword());
                user.setPassword(encodedPassword);

                String expiredTimeString = DateTime.now()
                        .withZone(DateTimeZone.forID("America/New_York"))
                        .plusDays(366)
                        .toString("yyyy-MM-dd HH:mm:ss");

                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
                Date expiredTime = sdf.parse(expiredTimeString);
                user.setUserPasswordExpiryDate(expiredTime);
            }
            // Update role if roleID provided
            if (requestDTO.getRoleID() != null && requestDTO.getRoleID() > 0) {
                Optional<AMRole> roleOpt = amRoleRepository.findById(requestDTO.getRoleID());

                if (roleOpt.isPresent()) {
                    user.setRole(roleOpt.get());
                    user.setSecondaryRoleID(requestDTO.getSecondaryRoleID());
                } else {
                    response.setStatus(false);
                    response.setStatusCode(404);
                    response.setMessage("Invalid Role ID: " + requestDTO.getRoleID());
                    response.setTimestamp(LocalDateTime.now());
                    return response;
                }
            } else {
                response.setStatus(false);
                response.setStatusCode(400);
                response.setMessage("Role ID is required");
                response.setTimestamp(LocalDateTime.now());
                return response;
            }
            userRepository.save(user);
            // if(requestDTO.getDepartmentID()!=0 && requestDTO.getRoleID()!=3 &&
            // requestDTO.getRoleID()!=4){
            // departmentUserRepository.deleteByUserId(userId);

            // Department department = new Department();
            // department.setDepartmentID(requestDTO.getDepartmentID());
            // DepartmentUser departmentUser = new DepartmentUser();
            // departmentUser.setUser(user); // Existing user entity
            // departmentUser.setDepartment(department); // Link department
            // departmentUserRepository.save(departmentUser);
            // }
            Integer deptId = requestDTO.getDepartmentID();

            // ✅ REMOVE department
            if (deptId == null || deptId == 0) {
                departmentUserRepository.deleteByUserId(userId);
            }

            // ✅ ASSIGN department
            else {
                departmentUserRepository.deleteByUserId(userId);

                Department department = new Department();
                department.setDepartmentID(deptId);

                DepartmentUser departmentUser = new DepartmentUser();
                departmentUser.setUser(user);
                departmentUser.setDepartment(department);

                departmentUserRepository.save(departmentUser);
            }
            if (requestDTO.getRoleID() == 3) {
                userRepository.updateExecutiveLeader(requestDTO.getDepartmentID(), requestDTO.getUserID());
            }
            if (requestDTO.getRoleID() == 4) {
                userRepository.updateExecutiveLeader(requestDTO.getDepartmentID(), requestDTO.getUserID());
            }

            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("User updated successfully");
            response.setTimestamp(LocalDateTime.now());
            response.setResponse(new HashMap<>());

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("An error occurred: " + e.getMessage());
            response.setTimestamp(LocalDateTime.now());
        }

        return response;
    }

    @Transactional(readOnly = true)
    public UserListResponseDTO getUsers(UserReadDTO userReadDTO, int pageNumber, int pageSize, String sortBy) {

        String filter = userReadDTO.getFilter();
        String searchText = userReadDTO.getSearchText();
        Integer departmentId = userReadDTO.getDepartmentID();
        Integer roleID = userReadDTO.getRoleID();
        boolean fetchOnlyIDAndName = pageSize == 0 && pageNumber == 0;

        // ------------------------------------------------------------------------
        // BUILD JPA SPECIFICATION
        // ------------------------------------------------------------------------
        Specification<User> spec = (root, query, cb) -> {

            // List<Predicate> predicates = new ArrayList<>();
            // predicates.add(cb.isTrue(root.get("userStatus")));
            // predicates.add(cb.isFalse(root.get("isUserArchived")));
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isTrue(root.get("userStatus")));

            if (filter == null || filter.isBlank()) {
                // no additional status filter
            } else {
                switch (filter) {
                    case "Archived":
                        predicates.add(cb.isTrue(root.get("isUserArchived")));
                        break;

                    case "NonArchived":
                    case "Active":
                        predicates.add(cb.isFalse(root.get("isUserArchived")));
                        break;
                }
            }
            // Join User → DepartmentUser → Department
            Join<User, DepartmentUser> deptUserJoin = root.join("departmentUsers", JoinType.LEFT);
            Join<DepartmentUser, Department> departmentJoin = deptUserJoin.join("department", JoinType.LEFT);

            // Role Filter
            if (roleID != null && roleID != 0) {
                Join<User, AMRole> roleJoin = root.join("role", JoinType.LEFT);
                predicates.add(cb.equal(roleJoin.get("roleID"), roleID));
            }

            // Department Filter
            if (departmentId != null && departmentId != 0) {
                predicates.add(cb.equal(departmentJoin.get("departmentID"), departmentId));
            }

            // Status Filter
            if (filter != null) {
                switch (filter) {
                    case "Active":
                        predicates.add(cb.isTrue(root.get("userStatus")));
                        break;

                    case "Inactive":
                        predicates.add(cb.and(
                                cb.isFalse(root.get("userStatus")),
                                cb.isFalse(root.get("isUserArchived"))));
                        break;

                    case "Archived":
                        predicates.add(cb.isTrue(root.get("isUserArchived")));
                        break;

                    case "NonArchived":
                        predicates.add(cb.isFalse(root.get("isUserArchived")));
                        break;
                }
            }

            // Search
            if (searchText != null && !searchText.isEmpty()) {
                Predicate nameLike = cb.like(root.get("name"), "%" + searchText + "%");
                Predicate emailLike = cb.like(root.get("username"), "%" + searchText + "%");
                predicates.add(cb.or(nameLike, emailLike));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        // ------------------------------------------------------------------------
        // PAGINATION & SORT
        // ------------------------------------------------------------------------
        String sortingField = (sortBy != null && sortBy.equals("userModifyTime"))
                ? "userModifyTime"
                : "userID";

        Sort sort = Sort.by(Sort.Direction.DESC, sortingField);

        Pageable pageable = fetchOnlyIDAndName
                ? Pageable.unpaged()
                : PageRequest.of(pageNumber - 1, pageSize, sort);

        Page<User> page = userRepository.findAll(spec, pageable);

        // ------------------------------------------------------------------------
        // MAP ENTITIES → DTO
        // ------------------------------------------------------------------------
        List<UserDTO> userDtos = page.getContent().stream().map(user -> {

            UserDTO dto = new UserDTO();

            dto.setUserID(user.getUserID());
            dto.setUserName(user.getName());
            dto.setUserEmail(user.getUserEmail());
            dto.setUserPasswordExpiryDate(
                    user.getUserPasswordExpiryDate() != null
                            ? user.getUserPasswordExpiryDate().toString()
                            : null);
            // Employee ID
            dto.setEmployeeID(user.getEmployeeID());

            // Appraisal Cycle
            dto.setAppraisalCycle(user.getAppraisalCycle());

            // Feedback Resolver Team
            dto.setFeedbackresolverteam(user.getFeedbackResolverTeam());

            // Reporting Manager
            if (user.getReportingManager() != null) {
                dto.setReportingManagerId(user.getReportingManager().getUserID());
                dto.setReportingManagerName(user.getReportingManager().getName());
            }

            // EL Manager
            if (user.getElManager() != null) {
                dto.setElManagerId(user.getElManager().getUserID());
                dto.setElManagerName(user.getElManager().getName());
            }
            dto.setUserStatus(user.isUserStatus());
            dto.setIsUserArchived(user.isUserArchived());
            dto.setUserCreateTime(user.getUserCreateTime().toString());
            dto.setUserModifyTime(user.getUserModifyTime().toString());

            // Role info
            int roleId = user.getRole() != null ? user.getRole().getRoleID() : 0;
            dto.setRoleID(roleId);
            dto.setRoleName(user.getRole() != null ? user.getRole().getRoleName() : null);
            dto.setSecondaryRoleID(user.getSecondaryRoleID());
            // --------------------------------------------------------------------
            // NORMAL USER (role != 3)
            // --------------------------------------------------------------------
            if (roleId != 3) {
                if (user.getDepartmentUsers() != null && !user.getDepartmentUsers().isEmpty()) {
                    DepartmentUser du = user.getDepartmentUsers().iterator().next();
                    if (du.getDepartment() != null
                            && !du.getDepartment().isDepartmentArchived()
                            && du.getDepartment().isDepartmentStatus()) {
                        dto.setDepartmentID(du.getDepartment().getDepartmentID());
                        dto.setDepartmentName(du.getDepartment().getDepartmentName());
                    }
                }
            }

            // --------------------------------------------------------------------
            // EXECUTIVE LEADER (role == 3)
            // Fetch all departments where user is Executive Leader
            // --------------------------------------------------------------------
            else {
                List<Object[]> elDepts = departmentRepository
                        .findDepartmentsWhereUserIsExecutiveLeader(user.getUserID());

                List<DepartmentDTO> deptList = new ArrayList<>();

                for (Object[] row : elDepts) {
                    deptList.add(new DepartmentDTO(
                            (Integer) row[0], // departmentID
                            (String) row[1], // departmentName
                            (Integer) row[2], // executiveLeaderID
                            (Integer) row[3] // functionalLeaderID
                    ));
                }

                dto.setDepartments(deptList);
            }

            // --------------------------------------------------------------------
            // STATUS DERIVATION
            // --------------------------------------------------------------------
            if (!user.isUserArchived() && user.isUserStatus()) {
                dto.setNewStatus("Active");
            } else if (user.isUserArchived()) {
                dto.setNewStatus("Archived");
            } else {
                dto.setNewStatus("Inactive");
            }

            return dto;

        }).collect(Collectors.toList());

        // ------------------------------------------------------------------------
        // PREPARE RESPONSE WRAPPER
        // ------------------------------------------------------------------------
        UserListResponseDTO responseDTO = new UserListResponseDTO();
        UserListResponseDTO.ResponseData responseData = new UserListResponseDTO.ResponseData();

        responseData.setCurrentPage(pageNumber);
        responseData.setPageSize(pageSize);
        responseData.setUsers(userDtos);
        responseData.setTotalRecords(page.getTotalElements());
        responseData.setTotalPages(page.getTotalPages());

        responseDTO.setResponse(responseData);
        responseDTO.setSuccess(true);
        responseDTO.setMessage("Listed successfully");
        responseDTO.setStatusCode(200);

        return responseDTO;
    }

    public UserResponseDTO updateUserStatus(UserStatusUpdateDTO dto) {
        UserResponseDTO response = new UserResponseDTO();
        try {
            Date modifyTime = new Date();
            int updatedCount = userRepository.updateUserStatusByIds(dto.isUserStatus(), modifyTime,
                    dto.getUserIdList());
            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("Status updated for " + updatedCount + " users");
            response.setTimestamp(LocalDateTime.now());

        } catch (Exception e) {
            e.printStackTrace();
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error: " + e.getMessage());
            response.setTimestamp(LocalDateTime.now());
        }

        return response;
    }

    @Transactional
    public UserResponseDTO archiveUsers(ArchiveUserRequestDTO requestDTO) {
        UserResponseDTO response = new UserResponseDTO();
        try {
            Date modifyTime = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss")
                    .parse(DateTime.now().withZone(DateTimeZone.forID("America/New_York"))
                            .toString("yyyy-MM-dd HH:mm:ss"));

            // Global DB update
            int updatedGlobal = userRepository.archiveUsers(requestDTO.getUserIdList(), modifyTime);

            response.setStatus(true);
            response.setStatusCode(200);
            response.setMessage("Users archived successfully in both databases");
            response.setTimestamp(LocalDateTime.now());
            response.setResponse(new HashMap<>());

        } catch (Exception ex) {
            response.setStatus(false);
            response.setStatusCode(500);
            response.setMessage("Error: " + ex.getMessage());
            response.setTimestamp(LocalDateTime.now());
        }
        return response;
    }

    public JSONObject handleForgotPassword(String emailJson) {
        JSONObject response = new JSONObject();
        response.put("isRegisteredEmail", false);

        try {
            JSONObject input = new JSONObject(emailJson);
            String email = input.getString("email");

            boolean exists = userRepository.existsByUserEmail(email);
            response.put("isRegisteredEmail", exists);

            if (exists) {
                String startTime = DateTime.now()
                        .withZone(DateTimeZone.forID("America/New_York"))
                        .toString("yyyy-MM-dd HH:mm:ss");

                String endTime = DateTime.now()
                        .withZone(DateTimeZone.forID("America/New_York"))
                        .plusMinutes(30)
                        .toString("yyyy-MM-dd HH:mm:ss");

                String resetPasswordUrl = this.sendMailFP(email, startTime, endTime);
                response.put("resetPasswordUrl", "please check your email to reset password");
            }
        } catch (Exception e) {
            e.printStackTrace();
            response.put("error", "Failed to process forgot password request.");
        }

        return response;
    }

    public String sendMailFP(String email, String startTime, String endTime) throws Exception {
        JSONObject token = new JSONObject();
        token.put("user", email);
        token.put("start_time", startTime);
        token.put("end_time", endTime);

        String uuid = UUID.randomUUID().toString();
        String resetPasswordUrl = "http://taskly.tapmind.io/passwordHandler?token=" + uuid + "&type=reset";

        JSONArray to = new JSONArray();
        JSONArray cc = new JSONArray();
        to.put(email);

        StringBuilder body = new StringBuilder();
        body.append("<p>Hello,</p>");
        body.append("<p>A new password change request was made for your Tapmind tasky tool account linked to ")
                .append("<a style='color:black; font-size:13px;'>").append(email).append("</a>. ")
                .append("Your account has not yet been altered.</p>")
                .append("<p>To reset your password, click the link below:</p>")
                .append("<p><a href='").append(resetPasswordUrl)
                .append("' style='color:#1a73e8; text-decoration:none;'>Reset Password</a></p>")
                .append("<p>If you didn’t request this, please ignore this email. ")
                .append("This link is valid for 30 minutes.</p>");

        new Mailer().send(to, cc, "Reset Password", body.toString());

        Optional<User> userOpt = userRepository.findByUserEmail(email);
        if (userOpt.isPresent()) {
            insertForgotPassword(email, startTime, endTime, uuid, userOpt.get().getUserID());
        }

        return resetPasswordUrl;
    }

    public void insertForgotPassword(String email, String startTime, String endTime, String uuid, Integer userId) {
        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

            Date start = sdf.parse(startTime);
            Date end = sdf.parse(endTime);

            ForgotPassword forgotPassword = new ForgotPassword();
            forgotPassword.setUuid(uuid);
            forgotPassword.setUserId(userId);
            forgotPassword.setStartTime(start);
            forgotPassword.setEndTime(end);
            forgotPassword.setStatus(true);

            forgotPasswordRepository.save(forgotPassword);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public JSONObject resetPassword(String data) {
        JSONObject json = new JSONObject();
        json.put("isURLActive", false); // Default state

        try {
            JSONObject jsonInput = new JSONObject(data);
            String token = jsonInput.optString("token");
            String newPassword = jsonInput.optString("password");

            if (token.isEmpty() || newPassword.isEmpty()) {
                json.put("message", "Invalid token or password.");
                return json;
            }

            Optional<ForgotPassword> forgotPasswordOpt = forgotPasswordRepository.findByUuidAndStatusTrue(token);

            if (forgotPasswordOpt.isPresent()) {
                ForgotPassword forgotPassword = forgotPasswordOpt.get();
                json.put("isURLActive", true);

                int userId = forgotPassword.getUserId();

                // Hashing password (optional but recommended)
                String hashedPassword = hashPassword(newPassword);

                // Update password
                int rows = resetPassword(userId, hashedPassword);
                json.put("isPasswordRest", rows > 0);

                // Invalidate token
                forgotPassword.setStatus(false);
                forgotPasswordRepository.save(forgotPassword);
            }

        } catch (Exception e) {
            json.put("message", "Error processing reset password request: " + e.getMessage());
        }

        return json;
    }

    public int resetPassword(int userId, String newPassword) {
        Optional<User> userOpt = userRepository.findById(userId);
        DateTimeZone zone = DateTimeZone.forID("America/New_York");
        DateTime dateTime = DateTime.now().withZone(zone).plusYears(2);
        Date expiredTime = dateTime.toDate();

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setPassword(newPassword);
            user.setUserModifyTime(new Date());
            user.setUserPasswordExpiryDate(expiredTime);
            userRepository.save(user);
            return 1;
        }
        return 0;
    }

    private String hashPassword(String password) {
        return passwordEncoder.encode(password);
    }

    public void sendMail() {
        Mailer MAILER = new Mailer();
        try {
            String[] emails = {

                    "amlan.das@tapmind.com",
                    "rohan.m@tapmind.com",
                    "ankit.kumar@tapmind.com",
                    "rajasekhar.c@tapmind.com",
                    "brijesh.hn@tapmind.com",
                    "imran.adeeb@tapmind.com",
                    "samsunnahar.khan@tapmind.com",
                    "archana.v@tapmind.com",
                    "girish.c@tapmind.com",
                    "abhinav.katoch@tapmind.com",
                    "venkatesh.b@tapmind.com",
                    "clinton.c@tapmind.com",
                    "najma.a@tapmind.com",
                    "sunaina.k@tapmind.com",
                    "neelam.tripathi@tapmind.com",
                    "fakkiresh.bh@tapmind.com",
                    "vivekreddy.t@tapmind.com",
                    "sindooja.mk@tapmind.com",
                    "manojkumar.p@tapmind.com",
                    "vasantha.kumar@tapmind.com",
                    "nithin.d@tapmind.com",
                    "jervin.k@tapmind.com",
                    "vishnu.s@tapmind.com",
                    "saiviswanth.p@tapmind.com",
                    "gautam.raj@tapmind.com",
                    "ananthakrishna.cn@tapmind.com",
                    "prabhat.dwari@tapmind.com",
                    "neha.sinha@tapmind.com",
                    "soupayan.dash@tapmind.com",
                    "sandhya.v@tapmind.com",
                    "prajaktha.p@tapmind.com",
                    "anusha.p@tapmind.com",
                    "gowrinandana.r@tapmind.com",
                    "jyoti.gupta@tapmind.com",
                    "varnika.k@tapmind.com",
                    "madhusudan.thakur@tapmind.com",
                    "samuel.js@tapmind.com",
                    "siva.marri@tapmind.com",
                    "kavya.kn@tapmind.com",
                    "jyotishman.roymedhi@tapmind.com",
                    "rajeshwari.p@tapmind.com",
                    "sharon.j@tapmind.com",
                    "ravindra.reddy@tapmind.com",
                    "dilip.mahato@tapmind.com",
                    "vikash.kumar@tapmind.com",
                    "lenvisha.r@tapmind.com",
                    "kadirappa.madigubba@tapmind.com",
                    "surya.manickavel@tapmind.com",
                    "nirmal.kumar@tapmind.com",
                    "prashanta.ilager@tapmind.com",
                    "sruthika.gs@tapmind.com",
                    "vasu.madhavarapu@tapmind.com",
                    "siddaramaiah.bm@tapmind.com",
                    "vasu.madhavarapu@tapmind.com",
                    "rozer.raphael@tapmind.com",
                    "shiva.santhosh@tapmind.com",
                    "dipika.kabra@tapmind.com",
                    "chandan.tilaganji@tapmind.com",
                    "mithilesh.jha@tapmind.com",
                    "athira.cs@tapmind.com",
                    "raja.chakraborty@tapmind.com",
                    "prerna.s@tapmind.com",
                    "john.britto@tapmind.com"
            };

            JSONArray cc = new JSONArray(); // empty CC
            JSONArray jsonArray = new JSONArray(emails);
            String subject = "Ticketing Tool Access Domain Change Announcement";

            StringBuilder body = new StringBuilder();

            body.append("<p>Hi Team,</p>");
            body.append("<p>This is to inform you that the access URL for our ticketing tool has been updated.</p>");
            body.append("<p>Effective from MONDAY, please use the new domain to log and manage all tickets.</p>");

            body.append("<p><strong>Old Domain:</strong> ");
            body.append("<a href=\"https://sdesk.bidsxchange.com\" target=\"_blank\">sdesk.bidsxchange.com</a></p>");

            body.append("<p><strong>New Domain:</strong> ");
            body.append("<a href=\"https://tdesk.tapmind.io\" target=\"_blank\">tdesk.tapmind.io</a></p>");

            body.append("<p>Kindly update your bookmarks and begin using the new link for all future access. ");
            body.append(
                    "The tool and your existing tickets remain unchanged — only the access domain has been updated.</p>");

            body.append("<p>If you face any issues while accessing the new domain, please reach out to us.</p>");
            body.append("<p>Thank you for your cooperation.</p>");
            body.append("<p>TapMind.</p>");

            MAILER.send(jsonArray, cc, subject, body.toString());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public List<MissingWorkDataUserDTO> getUsersWhoDidNotFillData(LocalDate startDate, LocalDate endDate) {

        List<Object[]> rows = userRepository.findUsersWhoDidNotFillWorkDataExcludeDept22And24(startDate, endDate);

        List<MissingWorkDataUserDTO> result = new ArrayList<>();

        for (Object[] row : rows) {
            result.add(new MissingWorkDataUserDTO(
                    (Integer) row[0],
                    (String) row[1],
                    (String) row[2]));
        }

        return result;
    }
    // public List<MissingWorkDataUserDTO> getUsersWhoDidNotFillData(LocalDate
    // startDate, LocalDate endDate) {
    // return repository.findMissingUsers(startDate.toDate(), endDate.toDate());
    // }

    @Transactional
    public JSONObject switchUser(
            UserSwitchRequestDTO request,
            HttpServletRequest httpRequest) throws Exception {

        JSONObject response = new JSONObject();

        try {

            String authHeader = httpRequest.getHeader("Authorization");

            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                response.put("status", false);
                response.put("statusCode", 401);
                response.put("message", "Missing Authorization Header");
                return response;
            }

            String token = authHeader.substring(7);

            String currentUserEmail = jwtTokenUtil.getUsernameFromToken(token);

            User admin = userRepository.findByUserEmail(currentUserEmail)
                    .orElse(null);

            if (admin == null) {
                response.put("status", false);
                response.put("statusCode", 401);
                response.put("message", "Unauthorized");
                return response;
            }

            // Allow only Root/Admin
            // Integer roleId = admin.getRole().getRoleID();
            // Integer userId = admin.getUserID();
            // log.info("User ID={}, Role ID={}, Email={}", userId, roleId,
            // currentUserEmail);
            // if (userId != 144 || roleId != 1) {
            // response.put("status", false);
            // response.put("statusCode", 403);
            // response.put("message", "Access Denied");
            // return response;
            // }

            User targetUser = userRepository.findById(request.getUserID())
                    .orElse(null);

            if (targetUser == null) {
                response.put("status", false);
                response.put("statusCode", 404);
                response.put("message", "User Not Found");
                return response;
            }

            UserDetails userDetails = new UserAuthDetails(targetUser);

            String newToken = jwtTokenUtil.generateToken(userDetails);

            response.put("username", targetUser.getUserEmail());
            response.put("name", targetUser.getName());
            response.put("token", newToken);
            response.put("userID", targetUser.getUserID());
            response.put("userRole", targetUser.getRole().getRoleID());

            response.put(
                    "secondaryRoleID",
                    targetUser.getSecondaryRoleID() != null
                            ? targetUser.getSecondaryRoleID()
                            : JSONObject.NULL);

            response.put(
                    "reportingManagerID",
                    targetUser.getReportingManager() != null
                            ? targetUser.getReportingManager().getUserID()
                            : JSONObject.NULL);

            response.put(
                    "elManagerID",
                    targetUser.getElManager() != null
                            ? targetUser.getElManager().getUserID()
                            : JSONObject.NULL);

            response.put("isHeExecutiveLeader", false);
            response.put("isHeFunctionalLeader", false);

            Integer targetRoleId = targetUser.getRole().getRoleID();

            if (targetRoleId == 3) {

                JSONArray departments = new JSONArray();

                for (Object[] row : departmentRepository
                        .findDepartmentsWhereUserIsExecutiveLeader(targetUser.getUserID())) {

                    JSONObject d = new JSONObject();
                    d.put("departmentID", row[0]);
                    d.put("departmentName", row[1]);
                    d.put("executiveLeaderID", row[2]);
                    d.put("functionalLeaderID", row[3]);
                    departments.put(d);
                }

                response.put("departments", departments);
                response.put("isHeExecutiveLeader", true);

            } else if (targetRoleId == 4) {

                JSONArray departments = new JSONArray();
                Set<Integer> addedDepartmentIds = new HashSet<>();

                for (Object[] row : departmentRepository
                        .findDepartmentsWhereUserIsFunctinalLeader(targetUser.getUserID())) {

                    Integer deptId = (Integer) row[0];

                    JSONObject d = new JSONObject();
                    d.put("departmentID", deptId);
                    d.put("departmentName", row[1]);
                    d.put("executiveLeaderID", row[2]);
                    d.put("functionalLeaderID", row[3]);

                    departments.put(d);
                    addedDepartmentIds.add(deptId);
                }

                List<Object[]> deptInfo = departmentUserRepository.findDepartmentDetailsByUserId(
                        targetUser.getUserID());

                for (Object[] dept : deptInfo) {

                    Integer deptId = (Integer) dept[0];

                    if (!addedDepartmentIds.contains(deptId)) {

                        JSONObject d = new JSONObject();
                        d.put("departmentID", dept[0]);
                        d.put("departmentName", dept[1]);

                        departments.put(d);
                        addedDepartmentIds.add(deptId);
                    }
                }

                response.put("departments", departments);
                response.put("isHeFunctionalLeader", true);

            } else {

                List<Object[]> deptInfo = departmentUserRepository.findDepartmentDetailsByUserId(
                        targetUser.getUserID());

                if (!deptInfo.isEmpty()) {

                    Object[] dept = deptInfo.get(0);

                    response.put("departmentID", dept[0]);
                    response.put("departmentName", dept[1]);
                }
            }

            response.put("status", true);
            response.put("statusCode", 200);
            response.put("message", "User switched successfully");

        } catch (Exception e) {

            e.printStackTrace();

            response.put("status", false);
            response.put("statusCode", 500);
            response.put("message", e.getMessage());
        }

        return response;
    }
}
