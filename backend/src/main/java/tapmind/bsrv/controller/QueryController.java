package tapmind.bsrv.controller;

import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.auth.UserAuthDetails;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.enums.QueryTeam;

import tapmind.bsrv.serviceNew.QueryService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/hrFeedback/query")
@RequiredArgsConstructor
public class QueryController {

    private final QueryService queryService;

    private UserAuthDetails currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserAuthDetails) {
            return (UserAuthDetails) auth.getPrincipal();
        }
        return null;
    }

    @GetMapping("/mine")
    public ResponseEntity<ApiResponse<QueryEmployeeResponse>> getMine() {
        UserAuthDetails user = currentUser();
        Integer userId = user != null ? user.getUser().getUserID() : null;
        return ResponseEntity.ok(ApiResponse.ok(queryService.getMine(userId)));
    }

    @PostMapping("/raise")
    public ResponseEntity<ApiResponse<QueryRaiseResponse>> raiseQuery(
            @Valid @RequestBody QueryRaiseRequest req) {
        UserAuthDetails user = currentUser();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Query raised successfully",
                        queryService.raiseQuery(
                                user.getUser().getUserID(),
                                user.getUser().getName(),
                                "", req)));
    }

    @PostMapping("/{id}/rate")
    public ResponseEntity<ApiResponse<QueryRateResponse>> rateQuery(
            @PathVariable String id,
            @Valid @RequestBody QueryRateRequest req) {
        UserAuthDetails user = currentUser();
        return ResponseEntity.ok(ApiResponse.ok(
                "Query rated successfully",
                queryService.rateQuery(id, user.getUser().getUserID(), req)));
    }

    @GetMapping("/queue")
    public ResponseEntity<ApiResponse<QueryQueueResponse>> getQueue(
            @RequestParam(defaultValue = "HR") String team) {
        return ResponseEntity.ok(ApiResponse.ok(queryService.getQueue(QueryTeam.fromString(team))));
    }

    @PostMapping("/{id}/reply")
    public ResponseEntity<ApiResponse<QueryReplyResponse>> reply(
            @PathVariable String id,
            @Valid @RequestBody QueryReplyRequest req) {
        UserAuthDetails user = currentUser();
        return ResponseEntity.ok(ApiResponse.ok(
                "Reply sent successfully",
                queryService.replyToQuery(id, user.getUser().getName(), req)));
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<ApiResponse<QueryResolveResponse>> resolve(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Query resolved successfully", queryService.resolveQuery(id)));
    }

    @PostMapping("/{id}/reassign")
    public ResponseEntity<ApiResponse<QueryReassignResponse>> reassign(
            @PathVariable String id,
            @RequestBody(required = false) QueryReassignRequest req) {
        if (req == null) req = new QueryReassignRequest();
        return ResponseEntity.ok(ApiResponse.ok(
                "Query reassigned successfully", queryService.reassignQuery(id, req)));
    }

    @PostMapping("/{id}/reopen")
    public ResponseEntity<ApiResponse<QueryReopenResponse>> reopen(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> body) {
        UserAuthDetails user = currentUser();
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(ApiResponse.ok(
                "Query reopened successfully",
                queryService.reopenQuery(id, user.getUser().getUserID(), reason)));
    }

    @GetMapping("/admin")
    public ResponseEntity<ApiResponse<QueryAdminResponse>> getAdmin() {
        return ResponseEntity.ok(ApiResponse.ok(queryService.getAdmin()));
    }
}
