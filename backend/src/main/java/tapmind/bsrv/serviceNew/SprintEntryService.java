package tapmind.bsrv.serviceNew;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.exception.ResourceNotFoundException;
import tapmind.bsrv.model.*;
import tapmind.bsrv.repository.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SprintEntryService {

  private static final String JIRA_BASE = "https://tapminds.atlassian.net/browse/";
  private final SprintEntryRepository sprintEntryRepository;
  private final TaskRepository taskRepository;
  private final GoalRepository goalRepository;
  private final UserService userService;
  private final ScoreCalculationService scoreCalc;
  private final UserWorkDataRepository userWorkDataRepository;
  private final UserGoalDataRepository repository;

  // ═══════════════════════════════════════════════════════════════════════
  // Submit (create or full-replace for same user + sprint label)
  // ═══════════════════════════════════════════════════════════════════════
  @Transactional
  public SprintEntryResponse submit(SprintSubmitRequest req) {
    User user = userService.getOrThrow(req.getUserId());

    // upsert: same user + sprint label → overwrite existing entry
    Optional<SprintEntry> existing = sprintEntryRepository.findByUserUserIDAndSprintLabel(req.getUserId(),
        req.getSprintLabel());
    SprintEntry entry = existing.orElseGet(SprintEntry::new);
    mapRequestToEntry(req, user, entry);
    entry.replaceTasks(buildTasks(req.getTasks()));
    entry.replaceGoals(buildGoals(req.getGoals()));

    SprintEntry saved = sprintEntryRepository.save(entry);

    // reload to pick up DB generated column values
    SprintEntry reloaded = sprintEntryRepository
        .findById(saved.getId())
        .orElseThrow(() -> new ResourceNotFoundException("SprintEntry", saved.getId()));
    makeEntryInWorkData(req);
    makeEntryInGoalData(req);

    log.info(
        "Sprint entry submitted: id={} user={} sprint={}",
        reloaded.getId(),
        user.getName(),
        req.getSprintLabel());
    return toResponse(reloaded);
  }

  public void makeEntryInWorkData(SprintSubmitRequest request) {
    UserWorkData userWorkData = userWorkDataRepository
        .findByWorkDateAndUserID(request.getWeekEnd(), request.getUserId())
        .orElse(new UserWorkData());
    userWorkData.setAllocatedTime(0.0);
    userWorkData.setTimeTakenToWork(0.0);
    userWorkData.setAchivedUnits(request.getSpCompleted() != null ? request.getSpCompleted() : 0);
    userWorkData.setUnits(request.getSpCommitted() != null
        ? request.getSpCommitted().doubleValue()
        : 0.0);
    userWorkData.setIsForTarget(false);
    userWorkData.setUserID(request.getUserId());
    userWorkData.setWorkDate(request.getWeekEnd());
    userWorkData.setDepartmentID(24);
    userWorkData.setRemarks(request.getChallenges());

    Timestamp now = Timestamp.valueOf(LocalDateTime.now());
    userWorkData.setCreatedAt(now);
    userWorkData.setUpdatedAt(now);
    userWorkDataRepository.save(userWorkData);
  }

  public void makeEntryInGoalData(SprintSubmitRequest dto) {
    UserGoalData data = repository
        .findByWorkDateAndUserIDAndGoalIDAndGoalType(
            dto.getWeekEnd(), dto.getUserId(), 51, null)
        .orElse(new UserGoalData());

    data.setWorkDate(dto.getWeekEnd());
    data.setUserID(dto.getUserId());
    data.setDepartmentID(24);
    data.setGoalID(51);
    data.setFixedGoal(BigDecimal.valueOf(dto.getSpCommitted()));
    data.setAchievedGoal(BigDecimal.valueOf(dto.getSpCompleted()));
    repository.save(data);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Full update (only for an existing entry by id)
  // ═══════════════════════════════════════════════════════════════════════
  @Transactional
  public SprintEntryResponse update(Long id, SprintSubmitRequest req) {
    SprintEntry entry = getOrThrow(id);
    User user = userService.getOrThrow(req.getUserId());

    mapRequestToEntry(req, user, entry);
    entry.replaceTasks(buildTasks(req.getTasks()));
    entry.replaceGoals(buildGoals(req.getGoals()));

    SprintEntry saved = sprintEntryRepository.save(entry);
    SprintEntry reloaded = sprintEntryRepository
        .findById(saved.getId())
        .orElseThrow(() -> new ResourceNotFoundException("SprintEntry", saved.getId()));
    makeEntryInGoalData(req);
    makeEntryInWorkData(req);
    log.info("Sprint entry updated: id={}", id);
    return toResponse(reloaded);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Get one (with full tasks + goals)
  // ═══════════════════════════════════════════════════════════════════════
  @Transactional(readOnly = true)
  public SprintEntryResponse findById(Long id) {
    return toResponse(getOrThrow(id));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // History list (paginated, optional filters)
  // ═══════════════════════════════════════════════════════════════════════
  @Transactional(readOnly = true)
  public PagedResponse<SprintEntryResponse> findHistory(
      Integer userId, String sprint, LocalDate from, LocalDate to, int page, int size) {
    if (userId != null && userId != 1) {
      userService.getOrThrow(userId);
      Pageable pageable = PageRequest.of(page, size);
      Page<SprintEntry> pageResult = sprintEntryRepository.findHistory(userId, sprint, from, to, pageable);
      return PagedResponse.of(pageResult.map(this::toResponse));
    } else {
      Pageable pageable = PageRequest.of(page, size);
      Page<SprintEntry> pageResult = sprintEntryRepository.findHistoryForAdmin(sprint, from, to, pageable);
      return PagedResponse.of(pageResult.map(this::toResponse));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Delete
  // ═══════════════════════════════════════════════════════════════════════
  @Transactional
  public void delete(Long id) {
    SprintEntry entry = getOrThrow(id);
    sprintEntryRepository.delete(entry);
    log.info("Sprint entry deleted: id={}", id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Patch manager note only
  // ═══════════════════════════════════════════════════════════════════════
  @Transactional
  public SprintEntryResponse patchManagerNote(Long id, String note) {
    SprintEntry entry = getOrThrow(id);
    entry.setManagerNote(note);
    sprintEntryRepository.save(entry);
    log.info("Manager note saved for sprint id={}", id);
    return toResponse(entry);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // All distinct sprint labels (for filter dropdowns)
  // ═══════════════════════════════════════════════════════════════════════
  @Transactional(readOnly = true)
  public List<String> findAllSprintLabels() {
    return sprintEntryRepository.findAllSprintLabels();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Internal helpers
  // ═══════════════════════════════════════════════════════════════════════
  public SprintEntry getOrThrow(Long id) {
    return sprintEntryRepository
        .findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("SprintEntry", id));
  }

  private void mapRequestToEntry(SprintSubmitRequest req, User user, SprintEntry entry) {
    entry.setUser(user);
    entry.setSprintLabel(req.getSprintLabel());
    entry.setWeekStart(req.getWeekStart());
    entry.setWeekEnd(req.getWeekEnd());
    entry.setDaysPresent(req.getDaysPresent());
    entry.setSpCommitted(req.getSpCommitted());
    entry.setSpCompleted(req.getSpCompleted());
    entry.setBugsIntroduced(req.getBugsIntroduced());
    entry.setPrReviews(req.getPrReviews());
    entry.setSpCarryover(req.getSpCarryover());
    entry.setBlockers(req.getBlockers());
    entry.setSelfRating(req.getSelfRating());
    entry.setAchievements(req.getAchievements());
    entry.setChallenges(req.getChallenges());
    entry.setNextFocus(req.getNextFocus());
  }

  private List<Task> buildTasks(List<TaskRequest> taskRequests) {
    if (taskRequests == null)
      return List.of();
    int[] idx = { 0 };
    return taskRequests.stream()
        .filter(t -> t.getTaskName() != null && !t.getTaskName().isBlank())
        .map(
            t -> Task.builder()
                .jiraId(t.getJiraId() != null ? t.getJiraId().toUpperCase().trim() : null)
                .taskName(t.getTaskName().trim())
                .storyPoints(t.getStoryPoints() != null ? t.getStoryPoints() : 0)
                .product(t.getProduct())
                .module(t.getModule())
                .taskType(t.getTaskType())
                .status(t.getStatus())
                .sortOrder(t.getSortOrder() != null ? t.getSortOrder() : idx[0])
                .build())
        .peek(t -> idx[0]++)
        .collect(Collectors.toList());
  }

  private List<Goal> buildGoals(List<GoalRequest> goalRequests) {
    if (goalRequests == null)
      return List.of();
    int[] idx = { 0 };
    return goalRequests.stream()
        .filter(g -> g.getGoalName() != null && !g.getGoalName().isBlank())
        .map(
            g -> Goal.builder()
                .goalName(g.getGoalName().trim())
                .targetPct(g.getTargetPct() != null ? g.getTargetPct() : 100)
                .achievedPct(g.getAchievedPct() != null ? g.getAchievedPct() : 0)
                .sortOrder(g.getSortOrder() != null ? g.getSortOrder() : idx[0])
                .build())
        .peek(g -> idx[0]++)
        .collect(Collectors.toList());
  }

  public SprintEntryResponse toResponse(SprintEntry e) {
    long totalGoals = e.getGoals().size();
    long metGoals = e.getGoals().stream().filter(g -> Boolean.TRUE.equals(g.getIsAchieved())).count();

    BigDecimal cr = coalesce(
        e.getScoreCompletion(),
        scoreCalc.completionRate(e.getSpCompleted(), e.getSpCommitted()));
    BigDecimal ut = coalesce(e.getScoreUtilisation(), scoreCalc.utilisation(e.getDaysPresent()));
    BigDecimal qs = coalesce(e.getScoreQuality(), scoreCalc.qualityScore(e.getBugsIntroduced()));
    BigDecimal eff = coalesce(e.getScoreEfficiency(), scoreCalc.efficiencyScore(cr, ut, qs));
    BigDecimal ov = coalesce(e.getScoreOverall(), scoreCalc.overallScore(eff, e.getSelfRating()));

    return SprintEntryResponse.builder()
        .id(e.getId())
        .userId(e.getUser().getUserID())
        .userName(e.getUser().getName())
        .userEmail(e.getUser().getUserEmail())
        .sprintLabel(e.getSprintLabel())
        .weekStart(e.getWeekStart())
        .weekEnd(e.getWeekEnd())
        .daysPresent(e.getDaysPresent())
        .spCommitted(e.getSpCommitted())
        .spCompleted(e.getSpCompleted())
        .bugsIntroduced(e.getBugsIntroduced())
        .prReviews(e.getPrReviews())
        .spCarryover(e.getSpCarryover())
        .blockers(e.getBlockers())
        .selfRating(e.getSelfRating())
        .scoreCompletion(cr)
        .scoreUtilisation(ut)
        .scoreQuality(qs)
        .scoreEfficiency(eff)
        .scoreOverall(ov)
        .completionBand(scoreCalc.band(cr))
        .utilisationBand(scoreCalc.band(ut))
        .qualityBand(scoreCalc.band(qs))
        .efficiencyBand(scoreCalc.band(eff))
        .overallRating(scoreCalc.overallRating(ov))
        .radar(scoreCalc.radar(e, (int) metGoals, (int) totalGoals))
        .achievements(e.getAchievements())
        .challenges(e.getChallenges())
        .nextFocus(e.getNextFocus())
        .managerNote(e.getManagerNote())
        .entryTimestamp(e.getEntryTimestamp())
        .updatedAt(e.getUpdatedAt())
        .tasks(e.getTasks().stream().map(this::toTaskResponse).collect(Collectors.toList()))
        .goals(e.getGoals().stream().map(this::toGoalResponse).collect(Collectors.toList()))
        .totalGoals((int) totalGoals)
        .metGoals((int) metGoals)
        .build();
  }

  public TaskResponse toTaskResponse(Task t) {
    String jiraUrl = (t.getJiraId() != null && !t.getJiraId().isBlank()) ? JIRA_BASE + t.getJiraId() : null;
    return TaskResponse.builder()
        .id(t.getId())
        .jiraId(t.getJiraId())
        .jiraUrl(jiraUrl)
        .taskName(t.getTaskName())
        .storyPoints(t.getStoryPoints())
        .product(t.getProduct().name())
        .module(t.getModule().name())
        .taskType(t.getTaskType().name())
        .status(t.getStatus().name())
        .sortOrder(t.getSortOrder())
        .build();
  }

  public GoalResponse toGoalResponse(Goal g) {
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

  private BigDecimal coalesce(BigDecimal dbValue, BigDecimal computed) {
    return dbValue != null ? dbValue : computed;
  }
}
