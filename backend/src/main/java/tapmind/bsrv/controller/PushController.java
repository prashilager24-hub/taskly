package tapmind.bsrv.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.auth.UserAuthDetails;
import tapmind.bsrv.dto.ApiResponse;
import tapmind.bsrv.dto.PushSubscriptionRequest;
import tapmind.bsrv.serviceNew.PushService;

import java.util.Map;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/hrFeedback/push")
@RequiredArgsConstructor
public class PushController {

    private final PushService pushService;

    private UserAuthDetails currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserAuthDetails) {
            return (UserAuthDetails) auth.getPrincipal();
        }
        return null;
    }

    @PostMapping("/subscribe")
    public ResponseEntity<ApiResponse<?>> subscribe(@RequestBody PushSubscriptionRequest req) {
        UserAuthDetails user = currentUser();
        Integer userId = user != null ? user.getUser().getUserID() : null;
        if (userId == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Unauthorized"));
        }
        pushService.saveSubscription(userId, req.getEndpoint(), req.getP256dh(), req.getAuth(), req.getTeam());
        return ResponseEntity.ok(ApiResponse.ok("Subscribed to push notifications"));
    }

    @DeleteMapping("/unsubscribe")
    public ResponseEntity<ApiResponse<?>> unsubscribe(@RequestBody Map<String, String> body) {
        UserAuthDetails user = currentUser();
        Integer userId = user != null ? user.getUser().getUserID() : null;
        if (userId == null) {
            return ResponseEntity.status(401).body(ApiResponse.error("Unauthorized"));
        }
        pushService.removeSubscription(userId, body.get("endpoint"));
        return ResponseEntity.ok(ApiResponse.ok("Unsubscribed from push notifications"));
    }

    @GetMapping("/vapid-public-key")
    public ResponseEntity<ApiResponse<String>> vapidPublicKey() {
        return ResponseEntity.ok(ApiResponse.ok(pushService.getVapidPublicKey()));
    }
}
