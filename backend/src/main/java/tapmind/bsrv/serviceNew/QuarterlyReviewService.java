package tapmind.bsrv.serviceNew;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;

import tapmind.bsrv.dto.QuarterlyReviewRequestDTO;
import tapmind.bsrv.dto.QuarterlyReviewResponseDTO;
import tapmind.bsrv.model.QuarterlyReview;
import tapmind.bsrv.model.User;
import tapmind.bsrv.repository.DepartmentUserRepository;
import tapmind.bsrv.repository.QuarterlyReviewRepository;
import tapmind.bsrv.repository.UserRepository;

@Service
@RequiredArgsConstructor
public class QuarterlyReviewService {

        private final QuarterlyReviewRepository quarterlyReviewRepository;

        private final UserRepository userRepository;
        private final DepartmentUserRepository departmentUserRepository;

        private final ObjectMapper objectMapper;

        @Transactional
        public QuarterlyReview createReview(
                        QuarterlyReviewRequestDTO dto) {

                User employee = userRepository
                                .findById(dto.getEmpId())
                                .orElseThrow(() -> new RuntimeException(
                                                "Employee not found"));

                QuarterlyReview review = new QuarterlyReview();

                review.setEmployee(employee);

                review.setQuarter(
                                dto.getQuarter());

                review.setQuarterYear(
                                dto.getQuarterYear());

                review.setQuarterStartDate(
                                LocalDate.parse(
                                                dto.getQuarterStartDate()));

                review.setQuarterEndDate(
                                LocalDate.parse(
                                                dto.getQuarterEndDate()));

                review.setTargetPercent(
                                dto.getTargetPercent());

                review.setGoalAchievement(
                                dto.getGoalAchievement());

                review.setUtilizationPercent(
                                dto.getUtilizationPercent());

                review.setEfficiencyPercent(
                                dto.getEfficiencyPercent());

                review.setEfficiencyLabel(
                                dto.getEfficiencyLabel());

                review.setSystemGrade(
                                dto.getSystemGrade());

                review.setManagerAvgRating(
                                dto.getManagerAvgRating());

                review.setFinalRating(
                                dto.getFinalRating());

                review.setStatus(
                                dto.getStatus());

                try {

                        review.setFeedback(
                                        objectMapper.writeValueAsString(
                                                        dto.getFeedback()));
                        review.setGrade(
                                        objectMapper.writeValueAsString(
                                                        dto.getGrade()));

                        review.setManagerRatings(
                                        objectMapper.writeValueAsString(
                                                        dto.getManagerRatings()));

                } catch (Exception e) {

                        throw new RuntimeException(
                                        "JSON conversion failed");
                }

                review.setSubmittedAt(
                                dto.getSubmittedAt());

                return quarterlyReviewRepository
                                .save(review);
        }

        public List<QuarterlyReviewResponseDTO> getAllReviews() {

                List<QuarterlyReview> reviews = quarterlyReviewRepository
                                .findAllByOrderByCreatedAtDesc();

                Map<Integer, String> deptNameByUserId = buildDepartmentNameMap(reviews);

                return reviews.stream()
                                .map(r -> mapToDTO(r, deptNameByUserId))
                                .toList();
        }

        private Map<Integer, String> buildDepartmentNameMap(List<QuarterlyReview> reviews) {

                List<Integer> userIds = reviews.stream()
                                .map(r -> r.getEmployee().getUserID())
                                .distinct()
                                .toList();

                if (userIds.isEmpty()) {
                        return Map.of();
                }

                List<Object[]> rows = departmentUserRepository
                                .findDepartmentInfoByUserIds(userIds);

                Map<Integer, String> map = new HashMap<>();

                for (Object[] row : rows) {
                        Integer userId = (Integer) row[0];
                        String departmentName = (String) row[1];
                        // keep the first department found per user
                        map.putIfAbsent(userId, departmentName);
                }

                return map;
        }

        public List<QuarterlyReviewResponseDTO> getReviewsByEmployee(
                        Integer empId,
                        String quarter,
                        String year) {

                List<QuarterlyReview> reviews;

                // =========================
                // GET EMPLOYEE REVIEWS
                // =========================

                reviews = quarterlyReviewRepository
                                .findByEmployee_UserIDOrderByCreatedAtDesc(
                                                empId);

                // =========================
                // QUARTER FILTER
                // =========================

                if (quarter != null &&
                                !quarter.equalsIgnoreCase("ALL")) {

                        reviews = reviews.stream()
                                        .filter(r -> quarter.equalsIgnoreCase(
                                                        r.getQuarter()))
                                        .toList();
                }

                // =========================
                // YEAR FILTER
                // =========================

                if (year != null &&
                                !year.equalsIgnoreCase("ALL")) {

                        reviews = reviews.stream()
                                        .filter(r -> String.valueOf(
                                                        r.getQuarterYear())
                                                        .equals(year))
                                        .toList();
                }

                Map<Integer, String> deptNameByUserId = buildDepartmentNameMap(reviews);

                return reviews.stream()
                                .map(r -> mapToDTO(r, deptNameByUserId))
                                .toList();
        }

        private QuarterlyReviewResponseDTO mapToDTO(
                        QuarterlyReview review) {

                return mapToDTO(review, Map.of());
        }

        private QuarterlyReviewResponseDTO mapToDTO(
                        QuarterlyReview review,
                        Map<Integer, String> deptNameByUserId) {

                return QuarterlyReviewResponseDTO
                                .builder()

                                .id(
                                                review.getId())

                                .empId(
                                                review.getEmployee()
                                                                .getUserID())

                                .employeeName(
                                                review.getEmployee()
                                                                .getName())

                                .employeeEmail(
                                                review.getEmployee()
                                                                .getUserEmail())

                                .departmentName(
                                                deptNameByUserId.get(
                                                                review.getEmployee().getUserID()))

                                .quarter(
                                                review.getQuarter())

                                .quarterYear(
                                                review.getQuarterYear())

                                .quarterStartDate(
                                                review.getQuarterStartDate())

                                .quarterEndDate(
                                                review.getQuarterEndDate())

                                .targetPercent(
                                                review.getTargetPercent())

                                .goalAchievement(
                                                review.getGoalAchievement())

                                .utilizationPercent(
                                                review.getUtilizationPercent())

                                .efficiencyPercent(
                                                review.getEfficiencyPercent())

                                .efficiencyLabel(
                                                review.getEfficiencyLabel())

                                .systemGrade(
                                                review.getSystemGrade())

                                .managerAvgRating(
                                                review.getManagerAvgRating())

                                .finalRating(
                                                review.getFinalRating())
                                .grade(
                                                review.getGrade())

                                .managerRatings(
                                                review.getManagerRatings())

                                .feedback(
                                                review.getFeedback())

                                .status(
                                                review.getStatus())

                                .submittedAt(
                                                review.getSubmittedAt())

                                .createdAt(
                                                review.getCreatedAt())

                                .updatedAt(
                                                review.getUpdatedAt())

                                .build();
        }

        @Transactional
        public QuarterlyReview updateReview(
                        Integer id,
                        QuarterlyReviewRequestDTO dto) {

                QuarterlyReview review = quarterlyReviewRepository
                                .findById(id)
                                .orElseThrow(() -> new RuntimeException(
                                                "Quarterly review not found"));

                review.setQuarter(
                                dto.getQuarter());

                review.setQuarterYear(
                                dto.getQuarterYear());

                review.setQuarterStartDate(
                                LocalDate.parse(
                                                dto.getQuarterStartDate()));

                review.setQuarterEndDate(
                                LocalDate.parse(
                                                dto.getQuarterEndDate()));

                review.setTargetPercent(
                                dto.getTargetPercent());

                review.setGoalAchievement(
                                dto.getGoalAchievement());

                review.setUtilizationPercent(
                                dto.getUtilizationPercent());

                review.setEfficiencyPercent(
                                dto.getEfficiencyPercent());

                review.setEfficiencyLabel(
                                dto.getEfficiencyLabel());

                review.setSystemGrade(
                                dto.getSystemGrade());

                review.setManagerAvgRating(
                                dto.getManagerAvgRating());

                review.setFinalRating(
                                dto.getFinalRating());

                review.setStatus(
                                dto.getStatus());

                try {

                        review.setFeedback(
                                        objectMapper.writeValueAsString(
                                                        dto.getFeedback()));
                        review.setGrade(
                                        objectMapper.writeValueAsString(
                                                        dto.getGrade()));

                        review.setManagerRatings(
                                        objectMapper.writeValueAsString(
                                                        dto.getManagerRatings()));

                } catch (Exception e) {

                        throw new RuntimeException(
                                        "JSON conversion failed");
                }

                review.setSubmittedAt(
                                dto.getSubmittedAt());

                return quarterlyReviewRepository
                                .save(review);
        }

}