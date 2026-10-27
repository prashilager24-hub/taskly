package tapmind.bsrv.serviceNew;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.model.GoalEfficiency;
import tapmind.bsrv.model.UserGoalData;
import tapmind.bsrv.repository.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GoalEfficiencyService {

    private final UserGoalDataRepository userGoalDataRepository;
    private final SalesCallScheduleRepository salesCallScheduleRepository;
    private final GoalEfficiencyRepository goalEfficiencyRepository;

    // =====================================================
    // ================== MAIN ENTRY =======================
    // =====================================================
    @Transactional
    public GoalEfficiencyResponseWrapperDTO calculate(
            GoalEfficiencyRequestDTO req) {

        BigDecimal goalPercentage;

        switch (req.getDepartmentID()) {

            case 36 -> goalPercentage =
                    calculateDept36(req.getUserID(), req.getFromDate(), req.getToDate());

            case 13 -> goalPercentage =
                    calculateDept13(req.getUserID(), req.getFromDate(), req.getToDate());

            case 21 -> goalPercentage =
                    calculateDept21Sales(req.getUserID(), req.getFromDate(), req.getToDate());

            default -> throw new RuntimeException("Unsupported department");
        }

        // -------- OPTIONAL SAVE --------
        if (Boolean.TRUE.equals(req.getSaveResult())) {
            saveResult(req, goalPercentage);
        }

        return GoalEfficiencyResponseWrapperDTO.builder()
                .status(true)
                .statusCode(200)
                .message("Goal efficiency calculated successfully")
                .response(
                        GoalEfficiencyResponseDTO.builder()
                                .userID(req.getUserID())
                                .departmentID(req.getDepartmentID())
                                .fromDate(req.getFromDate())
                                .toDate(req.getToDate())
                                .goalPercentage(goalPercentage)
                                .build()
                )
                .build();
    }

    // =====================================================
    // ================== DEPT 36 ==========================
    // Direct: SUM(achieved) / SUM(fixed)
    // =====================================================
    private BigDecimal calculateDept36(
            Integer userID, LocalDate from, LocalDate to) {

        List<UserGoalData> list =
                userGoalDataRepository
                        .findByUserIDAndWorkDateBetween(userID, from, to);

        BigDecimal fixed = BigDecimal.ZERO;
        BigDecimal achieved = BigDecimal.ZERO;

        for (UserGoalData g : list) {
            fixed = fixed.add(g.getFixedGoal());
            achieved = achieved.add(g.getAchievedGoal());
        }

        if (fixed.compareTo(BigDecimal.ZERO) == 0)
            return BigDecimal.ZERO;

        return achieved
                .divide(fixed, 2, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
    }

    // =====================================================
    // ================== DEPT 13 ==========================
    // Multiple goals → avg of individual goal %
    // =====================================================
    private BigDecimal calculateDept13(
            Integer userID, LocalDate from, LocalDate to) {

        List<UserGoalData> list =
                userGoalDataRepository
                        .findByUserIDAndWorkDateBetween(userID, from, to);

        if (list.isEmpty()) return BigDecimal.ZERO;

        BigDecimal total = BigDecimal.ZERO;

        for (UserGoalData g : list) {
            if (g.getFixedGoal().compareTo(BigDecimal.ZERO) == 0) continue;

            BigDecimal pct =
                    g.getAchievedGoal()
                            .divide(g.getFixedGoal(), 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100));

            total = total.add(pct);
        }

        return total.divide(
                BigDecimal.valueOf(list.size()),
                2,
                RoundingMode.HALF_UP
        );
    }

    // =====================================================
    // ================== DEPT 21 (SALES) ==================
    // Based on scheduled vs completed calls
    // =====================================================
    private BigDecimal calculateDept21Sales(
            Integer userID, LocalDate from, LocalDate to) {

        int scheduled =
                salesCallScheduleRepository
                        .countScheduledCalls(userID, from, to);

        int completed =
                salesCallScheduleRepository
                        .countCompletedCalls(userID, from, to);

        if (scheduled == 0) return BigDecimal.ZERO;

        return BigDecimal.valueOf(completed)
                .divide(BigDecimal.valueOf(scheduled), 2, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
    }

    // =====================================================
    // ================== SAVE =============================
    // =====================================================
    private void saveResult(
            GoalEfficiencyRequestDTO req,
            BigDecimal percentage) {

        GoalEfficiency ge = new GoalEfficiency();
        ge.setUserID(req.getUserID());
        ge.setDepartmentID(req.getDepartmentID());
        ge.setFromDate(req.getFromDate());
        ge.setToDate(req.getToDate());
        ge.setGoalPercentage(percentage);

        goalEfficiencyRepository.save(ge);
    }
}
