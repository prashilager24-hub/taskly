package tapmind.bsrv.controller;


import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tapmind.bsrv.dto.ApiResponse;
import tapmind.bsrv.enums.Product;
import tapmind.bsrv.enums.TaskStatus;
import tapmind.bsrv.enums.TaskType;

/**
 * Metadata / Reference APIs
 *
 * GET /api/meta/products        – product dropdown values
 * GET /api/meta/modules         – module dropdown values
 * GET /api/meta/task-types      – task type options
 * GET /api/meta/task-statuses   – task status options with badge colours
 */
@RestController
@RequestMapping("/api/meta")
@RequiredArgsConstructor
public class MetaController {

    // ── GET /api/meta/products ────────────────────────────────────────────
    @GetMapping("/products")
    public ResponseEntity<ApiResponse<List<Map<String, String>>>> getProducts() {
        List<Map<String, String>> result = Arrays.stream(Product.values())
                .map(p -> {
                    Map<String, String> m = new LinkedHashMap<>();
                    m.put("value", p.name());
                    m.put("label", p.getLabel());
                    return m;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    // ── GET /api/meta/modules ─────────────────────────────────────────────
/*    @GetMapping("/modules")
    public ResponseEntity<ApiResponse<List<Map<String, String>>>> getModules() {
        List<Map<String, String>> result = Arrays.stream(Module.values())
                .map(m -> {
                    Map<String, String> map = new LinkedHashMap<>();
                    map.put("value", m.name());
                    map.put("label", m.getLabel());
                    return map;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(result));
    }*/

    // ── GET /api/meta/task-types ──────────────────────────────────────────
    @GetMapping("/task-types")
    public ResponseEntity<ApiResponse<List<Map<String, String>>>> getTaskTypes() {
        List<Map<String, String>> result = Arrays.stream(TaskType.values())
                .map(t -> {
                    Map<String, String> m = new LinkedHashMap<>();
                    m.put("value", t.name());
                    m.put("label", toTitleCase(t.name()));
                    return m;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    // ── GET /api/meta/task-statuses ───────────────────────────────────────
    @GetMapping("/task-statuses")
    public ResponseEntity<ApiResponse<List<Map<String, String>>>> getTaskStatuses() {
        // badge colours match the spec: Done=green, Partial=amber, Missed=red, Carry=grey
        Map<TaskStatus, String> badgeColours = Map.of(
                TaskStatus.DONE,    "green",
                TaskStatus.PARTIAL, "amber",
                TaskStatus.MISSED,  "red",
                TaskStatus.CARRY,   "grey"
        );
        Map<TaskStatus, String> labels = Map.of(
                TaskStatus.DONE,    "✓ Done",
                TaskStatus.PARTIAL, "◑ Partial",
                TaskStatus.MISSED,  "✗ Missed",
                TaskStatus.CARRY,   "→ Carry"
        );

        List<Map<String, String>> result = Arrays.stream(TaskStatus.values())
                .map(s -> {
                    Map<String, String> m = new LinkedHashMap<>();
                    m.put("value", s.name());
                    m.put("label", labels.get(s));
                    m.put("badgeColour", badgeColours.get(s));
                    return m;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    // ── Util ──────────────────────────────────────────────────────────────
    private String toTitleCase(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase();
    }
}
