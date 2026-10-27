package tapmind.bsrv.controller;

import lombok.RequiredArgsConstructor;
import tapmind.bsrv.dto.BulkApprovalRequestDTO;
import java.util.Map;
import tapmind.bsrv.dto.RejectEntryRequestDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tapmind.bsrv.dto.CombinedWorkFilterRequestDTO;
import tapmind.bsrv.dto.CombinedWorkResponseWrapperDTO;
import tapmind.bsrv.serviceNew.CombinedWorkDataService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/combined")
@RequiredArgsConstructor
public class CombinedWorkDataController {

        private final CombinedWorkDataService combinedWorkDataService;

        @PostMapping("/list")
        public ResponseEntity<CombinedWorkResponseWrapperDTO> list(
                        @RequestBody CombinedWorkFilterRequestDTO filter,
                        @RequestParam(defaultValue = "1") int page,
                        @RequestParam(defaultValue = "10") int size) {

                return ResponseEntity.ok(
                                combinedWorkDataService.getCombinedData(filter, page, size));
        }

        @PostMapping("/approve")
        public ResponseEntity<?> approveCombinedEntries(
                        @RequestBody BulkApprovalRequestDTO request) {

                combinedWorkDataService.approveEntries(request);

                return ResponseEntity.ok(
                                Map.of(
                                                "status", true,
                                                "message", "Entries approved successfully"));
        }

        @PostMapping("/reject")
        public ResponseEntity<?> rejectEntry(
                        @RequestBody RejectEntryRequestDTO request) {

                combinedWorkDataService.rejectEntry(request);

                return ResponseEntity.ok(
                                Map.of(
                                                "status", true,
                                                "message", "Entry rejected successfully"));
        }
}