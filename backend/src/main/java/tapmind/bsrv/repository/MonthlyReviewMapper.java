package tapmind.bsrv.mapper;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.stereotype.Component;

import tapmind.bsrv.dto.MonthlyReviewRequestDTO;
import tapmind.bsrv.dto.MonthlyReviewResponseDTO;
import tapmind.bsrv.entity.MonthlyReview;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class MonthlyReviewMapper {

        private final ObjectMapper objectMapper = new ObjectMapper();

        public MonthlyReview toEntity(
                        MonthlyReviewRequestDTO dto) {

                try {

                        return MonthlyReview.builder()

                                        .empId(dto.getEmpId())

                                        .month(dto.getMonth())

                                        .year(dto.getYear())

                                        .startDate(dto.getStartDate())

                                        .endDate(dto.getEndDate())

                                        .target(dto.getTarget())

                                        .goal(dto.getGoal())

                                        .utilization(dto.getUtilization())

                                        .efficiency(dto.getEfficiency())

                                        .efficiencyLabel(
                                                        dto.getEfficiencyLabel())

                                        .status(dto.getStatus())

                                        .feedback(
                                                        objectMapper.writeValueAsString(
                                                                        dto.getFeedback()))

                                        .accessor(
                                                        objectMapper.writeValueAsString(
                                                                        dto.getAccessor()))

                                        .timestamp(dto.getTimestamp())

                                        .build();

                } catch (Exception e) {

                        throw new RuntimeException(
                                        "Error converting dto to entity",
                                        e);
                }
        }

        public MonthlyReviewResponseDTO toResponseDTO(
                        MonthlyReview entity) {

                try {

                        List<Map<String, Object>> feedbacks = entity.getFeedback() != null
                                        ? objectMapper.readValue(
                                                        entity.getFeedback(),
                                                        new TypeReference<List<Map<String, Object>>>() {
                                                        })
                                        : new ArrayList<>();

                        List<Map<String, Object>> accessors = entity.getAccessor() != null
                                        ? objectMapper.readValue(
                                                        entity.getAccessor(),
                                                        new TypeReference<List<Map<String, Object>>>() {
                                                        })
                                        : new ArrayList<>();

                        return MonthlyReviewResponseDTO.builder()

                                        .id(entity.getId())

                                        .empId(entity.getEmpId())

                                        .month(entity.getMonth())

                                        .year(entity.getYear())

                                        .startDate(entity.getStartDate())

                                        .endDate(entity.getEndDate())

                                        .target(entity.getTarget())

                                        .goal(entity.getGoal())

                                        .utilization(entity.getUtilization())

                                        .efficiency(entity.getEfficiency())

                                        .efficiencyLabel(
                                                        entity.getEfficiencyLabel())

                                        .status(entity.getStatus())

                                        .feedback(feedbacks)

                                        .accessor(accessors)

                                        .timestamp(entity.getTimestamp())

                                        .createdAt(entity.getCreatedAt())

                                        .updatedAt(entity.getUpdatedAt())

                                        .build();

                } catch (Exception e) {

                        throw new RuntimeException(
                                        "Error converting entity to response",
                                        e);
                }
        }
}