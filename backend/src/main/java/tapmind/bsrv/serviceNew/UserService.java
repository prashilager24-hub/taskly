// package tapmind.bsrv.serviceNew;

// import java.util.List;
// import java.util.stream.Collectors;
// import lombok.RequiredArgsConstructor;
// import org.springframework.stereotype.Service;
// import org.springframework.transaction.annotation.Transactional;
// import tapmind.bsrv.dto.UserResponse;
// import tapmind.bsrv.exception.ResourceNotFoundException;
// import tapmind.bsrv.model.User;
// import tapmind.bsrv.repository.UserRepository;

// /**
//  * Read-only service over the existing Users table.
//  * Taskly does NOT create, update, or delete users — that is owned by the
//  * existing user-management module.  This service only looks them up.
//  */
// @Service
// @RequiredArgsConstructor
// public class UserService {

//     private final UserRepository userRepository;

//     // ── List all active, non-archived users (developer switcher) ─────────
//     @Transactional(readOnly = true)
//     public List<UserResponse> findAllActive() {
//         return userRepository
//                 .findByUserStatusTrueAndIsUserArchivedFalseOrderByNameAsc()
//                 .stream()
//                 .map(this::toResponse)
//                 .collect(Collectors.toList());
//     }

//     // ── Get one user by ID ────────────────────────────────────────────────
//     @Transactional(readOnly = true)
//     public UserResponse findById(Integer userId) {
//         return toResponse(getOrThrow(userId));
//     }

//     // ── Internal: fetch entity or throw 404 ──────────────────────────────
//     public User getOrThrow(Integer userId) {
//         return userRepository.findByUserStatusTrueAndIsUserArchivedFalseAndUserID(userId)
//                 .orElseThrow(() -> new ResourceNotFoundException(
//                         "Active user not found with id: " + userId));
//     }

//     // ── Mapping ───────────────────────────────────────────────────────────
//     public UserResponse toResponse(User u) {
//         return UserResponse.builder()
//                 .userId(u.getUserID())
//                 .name(u.getName())
//                 .userEmail(u.getUserEmail())
//                 .userStatus(true)
//                 .build();
//     }
// }


package tapmind.bsrv.serviceNew;

import java.util.List;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tapmind.bsrv.dto.UserResponse;
import tapmind.bsrv.exception.ResourceNotFoundException;
import tapmind.bsrv.model.User;
import tapmind.bsrv.repository.UserRepository;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    // ================= LIST ALL ACTIVE USERS =================

    @Transactional(readOnly = true)
    public List<UserResponse> findAllActive() {
        return userRepository
                .findAllActiveUsersWithManagers() // ✅ fetch managers also
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ================= GET USER BY ID =================

    @Transactional(readOnly = true)
    public UserResponse findById(Integer userId) {

        User user = userRepository
                .findAllActiveUsersWithManagers() // ✅ ensures managers are fetched
                .stream()
                .filter(u -> u.getUserID().equals(userId))
                .findFirst()
                .orElseThrow(() ->
                        new ResourceNotFoundException("Active user not found with id: " + userId)
                );

        return toResponse(user);
    }

    // ================= INTERNAL FETCH =================

    public User getOrThrow(Integer userId) {
        return userRepository
                .findByUserStatusTrueAndIsUserArchivedFalseAndUserID(userId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Active user not found with id: " + userId)
                );
    }

    // ================= ENTITY → DTO MAPPING =================

    public UserResponse toResponse(User u) {

        return UserResponse.builder()
                .userId(u.getUserID())
                .name(u.getName())
                .userEmail(u.getUserEmail())
                .userStatus(true)

                // ===== NEW FIELDS =====
                .employeeID(u.getEmployeeID())
                .appraisalCycle(u.getAppraisalCycle())
                .feedbackresolverteam(u.getFeedbackResolverTeam())

                .reportingManagerId(
                        u.getReportingManager() != null
                                ? u.getReportingManager().getUserID()
                                : null
                )
                .reportingManagerName(
                        u.getReportingManager() != null
                                ? u.getReportingManager().getName()
                                : null
                )

                .elManagerId(
                        u.getElManager() != null
                                ? u.getElManager().getUserID()
                                : null
                )
                .elManagerName(
                        u.getElManager() != null
                                ? u.getElManager().getName()
                                : null
                )

                .build();
    }
}