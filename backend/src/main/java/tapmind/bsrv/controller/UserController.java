package tapmind.bsrv.controller;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.ApiResponse;
import tapmind.bsrv.dto.UserResponse;
import tapmind.bsrv.serviceNew.UserService;

/**
 * User (read-only) APIs for Taskly
 *
 * <p>GET /api/users – list all active users (developer switcher dropdown) GET /api/users/{id} – get
 * one user by ID
 *
 * <p>NOTE: User creation / update / delete is owned by the existing user-management module — NOT
 * exposed here.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

  private final UserService userService;

  // ── GET /api/users ────────────────────────────────────────────────────
  @GetMapping
  public ResponseEntity<ApiResponse<List<UserResponse>>> findAllActive() {
    return ResponseEntity.ok(ApiResponse.ok(userService.findAllActive()));
  }

  // ── GET /api/users/{id} ───────────────────────────────────────────────
  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<UserResponse>> findById(@PathVariable Integer id) {
    return ResponseEntity.ok(ApiResponse.ok(userService.findById(id)));
  }
}
