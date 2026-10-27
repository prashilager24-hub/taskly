package tapmind.bsrv.controller;

import java.util.Map;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import tapmind.bsrv.dto.QuarterlyReviewRequestDTO;
import tapmind.bsrv.model.QuarterlyReview;
import tapmind.bsrv.serviceNew.QuarterlyReviewService;

@RestController
@RequestMapping("/t2.0/authentificationUtilization/quarterly-review")
@RequiredArgsConstructor
public class QuarterlyReviewController {

        private final QuarterlyReviewService quarterlyReviewService;

        @PostMapping("/create")
        public ResponseEntity<?> createQuarterlyReview(
                        @RequestBody QuarterlyReviewRequestDTO request) {

                QuarterlyReview review = quarterlyReviewService
                                .createReview(request);

                return ResponseEntity.ok(
                                Map.of(
                                                "success", true,
                                                "message",
                                                "Quarterly review saved successfully",
                                                "id", review.getId()));
        }

        @GetMapping("/all")
        public ResponseEntity<?> getAllReviews() {

                return ResponseEntity.ok(
                                quarterlyReviewService
                                                .getAllReviews());
        }

        @GetMapping("/employee/{empId}")
        public ResponseEntity<?> getEmployeeReviews(

                        @PathVariable Integer empId,

                        @RequestParam(required = false) String quarter,

                        @RequestParam(required = false) String year) {

                return ResponseEntity.ok(
                                quarterlyReviewService
                                                .getReviewsByEmployee(
                                                                empId,
                                                                quarter,
                                                                year));
        }

        @PutMapping("/update/{id}")
        public ResponseEntity<?> updateQuarterlyReview(
                        @PathVariable Integer id,
                        @RequestBody QuarterlyReviewRequestDTO request) {

                QuarterlyReview review = quarterlyReviewService
                                .updateReview(id, request);

                return ResponseEntity.ok(
                                Map.of(
                                                "success", true,
                                                "message",
                                                "Quarterly review updated successfully",
                                                "id", review.getId()));
        }

}