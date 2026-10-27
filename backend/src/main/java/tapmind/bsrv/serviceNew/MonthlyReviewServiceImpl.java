package tapmind.bsrv.service.impl;

import tapmind.bsrv.dto.MonthlyReviewRequestDTO;
import tapmind.bsrv.dto.MonthlyReviewResponseDTO;
import tapmind.bsrv.entity.MonthlyReview;
import tapmind.bsrv.mapper.MonthlyReviewMapper;
import tapmind.bsrv.repository.MonthlyReviewRepository;
import tapmind.bsrv.service.MonthlyReviewService;

import lombok.RequiredArgsConstructor;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MonthlyReviewServiceImpl
                implements MonthlyReviewService {

        private final MonthlyReviewRepository monthlyReviewRepository;

        private final MonthlyReviewMapper monthlyReviewMapper;

        // =========================================
        // CREATE
        // =========================================

        @Override
        @Transactional
        public MonthlyReviewResponseDTO create(
                        MonthlyReviewRequestDTO requestDTO) {

                // =====================================
                // PREVENT DUPLICATE REVIEW
                // =====================================

                List<MonthlyReview> existingReviews = monthlyReviewRepository
                                .findByEmpIdAndMonthAndYearAndStartDateAndEndDate(
                                                requestDTO.getEmpId(),
                                                requestDTO.getMonth(),
                                                requestDTO.getYear(),
                                                requestDTO.getStartDate(),
                                                requestDTO.getEndDate());

                if (!existingReviews.isEmpty()) {

                        throw new RuntimeException(
                                        "Monthly review already exists for this date range");
                }

                MonthlyReview entity = monthlyReviewMapper.toEntity(
                                requestDTO);

                MonthlyReview saved = monthlyReviewRepository.save(
                                entity);

                return monthlyReviewMapper
                                .toResponseDTO(saved);
        }

        // =========================================
        // FETCH
        // =========================================

        @Override
        public List<MonthlyReviewResponseDTO> getByEmpIdAndYear(
                        Integer empId,
                        String year) {

                List<MonthlyReview> reviews = monthlyReviewRepository
                                .findByEmpId(empId);

                // ─────────────────────────────
                // ALL YEARS
                // ─────────────────────────────

                if ("ALL".equalsIgnoreCase(year)) {

                        return reviews.stream()
                                        .map(monthlyReviewMapper::toResponseDTO)
                                        .toList();
                }

                // ─────────────────────────────
                // FILTER YEAR
                // ─────────────────────────────

                Integer yearInt = Integer.parseInt(year);

                return reviews.stream()
                                .filter(r -> r.getYear() != null
                                                && r.getYear().equals(yearInt))
                                .map(monthlyReviewMapper::toResponseDTO)
                                .toList();
        }
        // =========================================
        // DELETE
        // =========================================

        @Override
        @Transactional
        public void delete(Integer id) {

                MonthlyReview review = monthlyReviewRepository
                                .findById(id)
                                .orElseThrow(() -> new RuntimeException(
                                                "Monthly review not found"));

                monthlyReviewRepository.delete(review);
        }
}
