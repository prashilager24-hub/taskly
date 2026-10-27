package tapmind.bsrv.serviceNew;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.enums.EngagementStatus;
import tapmind.bsrv.exception.ResourceNotFoundException;
import tapmind.bsrv.model.EngagementResponse;
import tapmind.bsrv.model.EngagementSurvey;
import tapmind.bsrv.model.User;
import tapmind.bsrv.repository.EngagementResponseRepository;
import tapmind.bsrv.repository.EngagementSurveyRepository;
import tapmind.bsrv.repository.UserRepository;

@Slf4j
@Service
@RequiredArgsConstructor
public class EngagementService {

    private final EngagementSurveyRepository surveyRepo;
    private final EngagementResponseRepository responseRepo;
    private final UserRepository userRepo;
    private final ObjectMapper objectMapper;
    private final PushService pushService;

    private static final DateTimeFormatter DF = DateTimeFormatter.ofPattern("d MMM yyyy");
    private static final List<DateTimeFormatter> DATE_PARSERS = List.of(
            DateTimeFormatter.ofPattern("d MMM yyyy"),
            DateTimeFormatter.ofPattern("dd MMM yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy")
    );

    @Transactional(readOnly = true)
    public EngagementEmployeeResponse getOpenSurveys(Integer employeeId) {
        List<EngagementSurvey> open = surveyRepo.findOpenSurveys();
        List<EngagementEmployeeResponse.EngagementSurveyItem> items = open.stream()
                .map(s -> {
                    boolean submitted = responseRepo.existsBySurveyIdAndRespondentId(s.getId(), employeeId);
                    List<String> months = parseMonths(s.getMonths());
                    return EngagementEmployeeResponse.EngagementSurveyItem.builder()
                            .id(s.getId())
                            .quarter(s.getQuarter())
                            .months(months)
                            .closes(s.getCloses().format(DF))
                            .status(s.getStatus().name().toLowerCase())
                            .submitted(submitted)
                            .build();
                })
                .collect(Collectors.toList());
        return EngagementEmployeeResponse.builder().surveys(items).build();
    }

    @Transactional
    public EngagementSubmitResponse submitResponse(Integer employeeId, String employeeName, EngagementSubmitRequest req) {
        EngagementSurvey survey = surveyRepo.findById(req.getSurveyId())
                .orElseThrow(() -> new ResourceNotFoundException("Engagement survey not found: " + req.getSurveyId()));

        if (responseRepo.existsBySurveyIdAndRespondentId(req.getSurveyId(), employeeId)) {
            throw new IllegalArgumentException("You have already responded to this survey");
        }

        String monthsJson;
        String restJson;
        try {
            monthsJson = objectMapper.writeValueAsString(req.getMonths());
            restJson = objectMapper.writeValueAsString(req.getRest());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid ratings format");
        }

        EngagementResponse response = EngagementResponse.builder()
                .survey(survey)
                .respondentId(employeeId)
                .respondentName(employeeName)
                .anonymous(req.getAnonymous() != null && req.getAnonymous())
                .months(monthsJson)
                .rest(restJson)
                .feedback(req.getFeedback())
                .build();
        responseRepo.save(response);

        double overallScore = req.getMonths().stream().mapToInt(Integer::intValue).average().orElse(0);
        double restAvg = req.getRest().stream().mapToInt(Integer::intValue).average().orElse(0);
        double combined = (overallScore + restAvg) / 2;

        log.info("Engagement response submitted: surveyId={} employeeId={} score={}", req.getSurveyId(), employeeId, combined);

        // Push notification to HR team
        try {
            pushService.sendToTeam("HR", "Engagement survey submitted",
                    employeeName + " submitted engagement survey (" + (Math.round(combined * 10.0) / 10.0) + "/10)");
        } catch (Exception e) {
            log.warn("Failed to send push for engagement submit: {}", e.getMessage());
        }

        return EngagementSubmitResponse.builder()
                .recorded(true)
                .overallScore(Math.round(combined * 10.0) / 10.0)
                .build();
    }

    @Transactional(readOnly = true)
    public EngagementHRResponse getSurveysHR(String fy) {
        List<EngagementSurvey> surveys = surveyRepo.findAllByOrderByOpensDesc();

        List<EngagementHRResponse.EngagementHRSurveyItem> items = surveys.stream()
                .map(s -> {
                    List<EngagementResponse> responses = responseRepo.findBySurveyIdOrderByCreatedAtAsc(s.getId());
                    List<String> months = parseMonths(s.getMonths());
                    double responseRate = s.getSentTo() > 0
                            ? Math.round((responses.size() * 100.0) / s.getSentTo() * 10.0) / 10.0
                            : 0;

                    List<EngagementHRResponse.ResponseItem> responseItems = responses.stream()
                            .map(r -> EngagementHRResponse.ResponseItem.builder()
                                    .by(r.getAnonymous() ? "Anonymous" : r.getRespondentName())
                                    .anonymous(r.getAnonymous())
                                    .months(parseIntList(r.getMonths()))
                                    .rest(parseIntList(r.getRest()))
                                    .feedback(r.getFeedback())
                                    .build())
                            .collect(Collectors.toList());

                    return EngagementHRResponse.EngagementHRSurveyItem.builder()
                            .id(s.getId())
                            .quarter(s.getQuarter())
                            .months(months)
                            .sentTo(s.getSentTo())
                            .opens(s.getOpens().format(DF))
                            .closes(s.getCloses().format(DF))
                            .status(s.getStatus().name().toLowerCase())
                            .responseCount((long) responses.size())
                            .responseRate(responseRate)
                            .responses(responseItems)
                            .build();
                })
                .collect(Collectors.toList());

        return EngagementHRResponse.builder().surveys(items).build();
    }

    @Transactional(readOnly = true)
    public EngagementScoresResponse getScores(String surveyId) {
        EngagementSurvey survey = surveyRepo.findById(surveyId)
                .orElseThrow(() -> new ResourceNotFoundException("Engagement survey not found: " + surveyId));

        List<EngagementResponse> responses = responseRepo.findBySurveyIdOrderByCreatedAtAsc(surveyId);
        long responseCount = responses.size();
        double responseRate = survey.getSentTo() > 0
                ? Math.round((responseCount * 100.0) / survey.getSentTo() * 10.0) / 10.0
                : 0;

        List<String> monthLabels = parseMonths(survey.getMonths());
        List<Double> monthAvgs = new ArrayList<>();
        List<Double> restAvgs = new ArrayList<>();

        if (!responses.isEmpty()) {
            for (int m = 0; m < monthLabels.size(); m++) {
                int idx = m;
                double avg = responses.stream()
                        .mapToDouble(r -> {
                            List<Integer> months = parseIntList(r.getMonths());
                            return idx < months.size() ? months.get(idx) : 0;
                        })
                        .average().orElse(0);
                monthAvgs.add(Math.round(avg * 10.0) / 10.0);
            }

            for (int r = 0; r < 2; r++) {
                int idx = r;
                double avg = responses.stream()
                        .mapToDouble(resp -> {
                            List<Integer> rest = parseIntList(resp.getRest());
                            return idx < rest.size() ? rest.get(idx) : 0;
                        })
                        .average().orElse(0);
                restAvgs.add(Math.round(avg * 10.0) / 10.0);
            }
        }

        List<Integer> distribution = new ArrayList<>(Collections.nCopies(10, 0));
        for (EngagementResponse resp : responses) {
            List<Integer> all = new ArrayList<>(parseIntList(resp.getMonths()));
            all.addAll(parseIntList(resp.getRest()));
            double avg = all.stream().mapToInt(Integer::intValue).average().orElse(0);
            int bucket = Math.min(9, Math.max(0, (int) avg - 1));
            distribution.set(bucket, distribution.get(bucket) + 1);
        }

        double quarterAvg = responses.stream()
                .mapToDouble(r -> {
                    List<Integer> all = new ArrayList<>(parseIntList(r.getMonths()));
                    all.addAll(parseIntList(r.getRest()));
                    return all.stream().mapToInt(Integer::intValue).average().orElse(0);
                })
                .average().orElse(0);

        List<EngagementScoresResponse.CommentItem> comments = responses.stream()
                .filter(r -> r.getFeedback() != null && !r.getFeedback().isEmpty())
                .map(r -> {
                    List<Integer> all = new ArrayList<>(parseIntList(r.getMonths()));
                    all.addAll(parseIntList(r.getRest()));
                    double score = all.stream().mapToInt(Integer::intValue).average().orElse(0);
                    return EngagementScoresResponse.CommentItem.builder()
                            .score(Math.round(score * 10.0) / 10.0)
                            .feedback(r.getFeedback())
                            .by(r.getAnonymous() ? "Anonymous" : r.getRespondentName())
                            .build();
                })
                .collect(Collectors.toList());

        return EngagementScoresResponse.builder()
                .surveyId(surveyId)
                .quarter(survey.getQuarter())
                .quarterAvg(Math.round(quarterAvg * 10.0) / 10.0)
                .responseCount(responseCount)
                .sentTo(survey.getSentTo())
                .responseRate(responseRate)
                .monthLabels(monthLabels)
                .monthAvgs(monthAvgs)
                .restAvgs(restAvgs)
                .restLabels(List.of("Planning & execution", "HR approachability"))
                .commentCount((long) comments.size())
                .distribution(distribution)
                .comments(comments)
                .build();
    }

    @Transactional
    public EngagementRolloutResponse rollout(EngagementRolloutRequest req) {
        String nextId = generateNextId();
        long totalUsers = userRepo.count();

        EngagementSurvey survey = EngagementSurvey.builder()
                .id(nextId)
                .quarter(req.getQuarter())
                .months(objectMapper.valueToTree(req.getMonths()).toString())
                .sentTo((int) totalUsers)
                .opens(LocalDate.now())
                .closes(parseDate(req.getCloses()))
                .status(EngagementStatus.COLLECTING)
                .build();
        surveyRepo.save(survey);

        log.info("Engagement survey rolled out: id={} quarter={} sentTo={}", nextId, req.getQuarter(), totalUsers);

        // Push notification to all users
        try {
            pushService.sendToAll("Engagement survey", "New engagement survey for " + req.getQuarter() + " is now open");
        } catch (Exception e) {
            log.warn("Failed to send push for engagement rollout: {}", e.getMessage());
        }

        return EngagementRolloutResponse.builder()
                .id(nextId)
                .quarter(req.getQuarter())
                .sentTo((int) totalUsers)
                .status(EngagementStatus.COLLECTING.name().toLowerCase())
                .build();
    }

    @Transactional(readOnly = true)
    public EngagementAdminResponse getAdmin() {
        List<EngagementSurvey> all = surveyRepo.findAllByOrderByOpensDesc();

        List<EngagementAdminResponse.QuarterOnQuarterItem> qoq = new ArrayList<>();
        double totalAvg = 0;
        double totalResponseRate = 0;

        for (EngagementSurvey s : all) {
            List<EngagementResponse> responses = responseRepo.findBySurveyIdOrderByCreatedAtAsc(s.getId());
            double responseRate = s.getSentTo() > 0
                    ? Math.round((responses.size() * 100.0) / s.getSentTo() * 10.0) / 10.0
                    : 0;

            List<Double> monthAvgs = new ArrayList<>();
            List<String> months = parseMonths(s.getMonths());
            for (int m = 0; m < months.size(); m++) {
                int idx = m;
                double avg = responses.stream()
                        .mapToDouble(r -> {
                            List<Integer> mths = parseIntList(r.getMonths());
                            return idx < mths.size() ? mths.get(idx) : 0;
                        })
                        .average().orElse(0);
                monthAvgs.add(Math.round(avg * 10.0) / 10.0);
            }

            double activities = monthAvgs.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            double planning = responses.stream()
                    .mapToDouble(r -> {
                        List<Integer> rest = parseIntList(r.getRest());
                        return rest.isEmpty() ? 0 : rest.get(0);
                    }).average().orElse(0);
            double approachability = responses.stream()
                    .mapToDouble(r -> {
                        List<Integer> rest = parseIntList(r.getRest());
                        return rest.size() > 1 ? rest.get(1) : 0;
                    }).average().orElse(0);

            qoq.add(EngagementAdminResponse.QuarterOnQuarterItem.builder()
                    .quarter(s.getQuarter())
                    .responseCount((long) responses.size())
                    .sentTo(s.getSentTo())
                    .responseRate(responseRate)
                    .activities(Math.round(activities * 10.0) / 10.0)
                    .planning(Math.round(planning * 10.0) / 10.0)
                    .approachability(Math.round(approachability * 10.0) / 10.0)
                    .build());

            totalAvg += activities;
            totalResponseRate += responseRate;
        }

        String latestQuarter = all.isEmpty() ? "" : all.get(0).getQuarter();
        double latestAvg = qoq.isEmpty() ? 0 : qoq.get(0).getActivities();
        double avgAcross = !qoq.isEmpty() ? totalAvg / qoq.size() : 0;
        double avgRespRate = !qoq.isEmpty() ? totalResponseRate / qoq.size() : 0;

        long detractorPct = 0;
        if (!all.isEmpty()) {
            List<EngagementResponse> allResponses = responseRepo.findBySurveyIdOrderByCreatedAtAsc(all.get(0).getId());
            long total = allResponses.size();
            long detractors = allResponses.stream().filter(r -> {
                List<Integer> all2 = new ArrayList<>(parseIntList(r.getMonths()));
                all2.addAll(parseIntList(r.getRest()));
                return all2.stream().mapToInt(Integer::intValue).average().orElse(10) <= 5;
            }).count();
            detractorPct = total > 0 ? Math.round((detractors * 100.0) / total) : 0;
        }

        return EngagementAdminResponse.builder()
                .latestQuarter(latestQuarter)
                .latestQuarterAvg(latestAvg)
                .avgAcrossQuarters(Math.round(avgAcross * 10.0) / 10.0)
                .avgResponseRate(Math.round(avgRespRate * 10.0) / 10.0)
                .detractorPct(detractorPct)
                .quarterOnQuarter(qoq)
                .build();
    }

    private List<String> parseMonths(String json) {
        if (json == null) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private List<Integer> parseIntList(String json) {
        if (json == null) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<Integer>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String generateNextId() {
        Optional<EngagementSurvey> last = surveyRepo.findTopByOrderByIdDesc();
        int next = 1;
        if (last.isPresent()) {
            String lastId = last.get().getId();
            next = Integer.parseInt(lastId.replace("E-", "")) + 1;
        }
        return String.format("E-%03d", next);
    }

    private LocalDate parseDate(String dateStr) {
        for (DateTimeFormatter fmt : DATE_PARSERS) {
            try {
                return LocalDate.parse(dateStr, fmt);
            } catch (DateTimeParseException ignored) {}
        }
        throw new IllegalArgumentException("Invalid date format: " + dateStr + ". Expected format: dd MMM yyyy (e.g. 15 Jan 2027)");
    }
}
