// MonthlyReviewController.java
package tapmind.bsrv.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import tapmind.bsrv.dto.MonthlyReviewRequestDTO;
import tapmind.bsrv.dto.MonthlyReviewResponseDTO;
import tapmind.bsrv.service.MonthlyReviewService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/monthly-reviews")
@RequiredArgsConstructor
public class MonthlyReviewController {

        private final MonthlyReviewService monthlyReviewService;

        @PostMapping
        public ResponseEntity<MonthlyReviewResponseDTO> create(
                        @Valid @RequestBody MonthlyReviewRequestDTO requestDTO) {

                MonthlyReviewResponseDTO response = monthlyReviewService.create(requestDTO);

                return ResponseEntity
                                .status(HttpStatus.CREATED)
                                .body(response);
        }

        @GetMapping("/{empId}/{year}")
        public ResponseEntity<List<MonthlyReviewResponseDTO>> getByEmpIdAndYear(

                        @PathVariable Integer empId,

                        @PathVariable String year) {

                return ResponseEntity.ok(
                                monthlyReviewService
                                                .getByEmpIdAndYear(
                                                                empId,
                                                                year));
        }

        @DeleteMapping("/{id}")
        public ResponseEntity<String> delete(
                        @PathVariable Integer id) {

                monthlyReviewService.delete(id);

                return ResponseEntity.ok(
                                "Monthly review deleted successfully");
        }
}