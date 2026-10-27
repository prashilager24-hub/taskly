package tapmind.bsrv.serviceNew;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.dto.GoalRequest;
import tapmind.bsrv.dto.GoalResponse;
import tapmind.bsrv.exception.ResourceNotFoundException;
import tapmind.bsrv.model.Goal;
import tapmind.bsrv.model.SprintEntry;
import tapmind.bsrv.repository.GoalRepository;

@Slf4j
@Service
@RequiredArgsConstructor
public class GoalService {

    private final GoalRepository goalRepository;
    private final SprintEntryService sprintEntryService;
    private final ScoreCalculationService scoreCalc;

    // ── Add goal ──────────────────────────────────────────────────────────
    @Transactional
    public GoalResponse addGoal(Long sprintId, GoalRequest req) {
        SprintEntry entry = sprintEntryService.getOrThrow(sprintId);

        long nextOrder = goalRepository.countBySprintEntryId(sprintId);
        Goal goal = Goal.builder()
                .sprintEntry(entry)
                .goalName(req.getGoalName().trim())
                .targetPct(req.getTargetPct() != null ? req.getTargetPct() : 100)
                .achievedPct(req.getAchievedPct() != null ? req.getAchievedPct() : 0)
                .sortOrder(req.getSortOrder() != null ? req.getSortOrder() : (int) nextOrder)
                .build();

        Goal saved = goalRepository.save(goal);
        // reload to get DB-computed is_achieved
        Goal reloaded = goalRepository.findById(saved.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Goal", saved.getId()));
        log.info("Goal added: id={} sprintId={}", reloaded.getId(), sprintId);
        return toResponse(reloaded);
    }

    // ── Update goal ───────────────────────────────────────────────────────
    @Transactional
    public GoalResponse updateGoal(Long sprintId, Long goalId, GoalRequest req) {
        Goal goal = goalRepository.findByIdAndSprintEntryId(goalId, sprintId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Goal id=" + goalId + " not found in sprint id=" + sprintId));

        goal.setGoalName(req.getGoalName().trim());
        goal.setTargetPct(req.getTargetPct() != null ? req.getTargetPct() : 100);
        goal.setAchievedPct(req.getAchievedPct() != null ? req.getAchievedPct() : 0);
        if (req.getSortOrder() != null) goal.setSortOrder(req.getSortOrder());

        goalRepository.save(goal);
        Goal reloaded = goalRepository.findById(goal.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Goal", goal.getId()));
        log.info("Goal updated: id={}", goalId);
        return toResponse(reloaded);
    }

    // ── Delete goal ───────────────────────────────────────────────────────
    @Transactional
    public void deleteGoal(Long sprintId, Long goalId) {
        if (!goalRepository.existsByIdAndSprintEntryId(goalId, sprintId)) {
            throw new ResourceNotFoundException(
                    "Goal id=" + goalId + " not found in sprint id=" + sprintId);
        }
        goalRepository.deleteById(goalId);
        log.info("Goal deleted: id={}", goalId);
    }

    // ── List all goals for a sprint ───────────────────────────────────────
    @Transactional(readOnly = true)
    public List<GoalResponse> findBySprintId(Long sprintId) {
        sprintEntryService.getOrThrow(sprintId);
        return goalRepository.findBySprintEntryIdOrderBySortOrderAsc(sprintId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ── Mapping ───────────────────────────────────────────────────────────
    public GoalResponse toResponse(Goal g) {
        BigDecimal progress = scoreCalc.goalProgress(g.getAchievedPct(), g.getTargetPct());
        return GoalResponse.builder()
                .id(g.getId())
                .goalName(g.getGoalName())
                .targetPct(g.getTargetPct())
                .achievedPct(g.getAchievedPct())
                .isAchieved(g.getIsAchieved())
                .progressPct(progress)
                .sortOrder(g.getSortOrder())
                .build();
    }
}
