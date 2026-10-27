package tapmind.bsrv.serviceNew;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.enums.OnboardingStatus;
import tapmind.bsrv.exception.ResourceNotFoundException;
import tapmind.bsrv.model.OnboardingSurvey;
import tapmind.bsrv.model.User;
import tapmind.bsrv.repository.OnboardingSurveyRepository;
import tapmind.bsrv.repository.UserRepository;
import tapmind.bsrv.service.EmailService;

@Slf4j
@Service
@RequiredArgsConstructor
public class OnboardingService {

    private final OnboardingSurveyRepository surveyRepo;
    private final UserRepository userRepo;
    private final ObjectMapper objectMapper;
    private final EmailService emailService;
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
    public OnboardingSurveyEmployeeResponse getMine(Integer employeeId) {
        List<OnboardingSurvey> surveys = surveyRepo.findByEmployeeIdOrderBySentOnDesc(employeeId);
        List<OnboardingSurveyEmployeeResponse.OnboardingSurveyItem> items = surveys.stream()
                .map(this::toEmployeeItem)
                .collect(Collectors.toList());
        return OnboardingSurveyEmployeeResponse.builder().surveys(items).build();
    }

    @Transactional
    public OnboardingSubmitResponse submitSurvey(Integer employeeId, OnboardingSubmitRequest req) {
        OnboardingSurvey survey = surveyRepo.findById(req.getSurveyId())
                .orElseThrow(() -> new ResourceNotFoundException("Onboarding survey not found: " + req.getSurveyId()));

        if (!survey.getEmployeeId().equals(employeeId)) {
            throw new IllegalArgumentException("Survey does not belong to this employee");
        }
        if (survey.getStatus() == OnboardingStatus.SUBMITTED) {
            throw new IllegalArgumentException("Survey already submitted");
        }

        String answersJson;
        try {
            answersJson = objectMapper.writeValueAsString(req.getAnswers());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid answers format");
        }

        survey.setAnswers(answersJson);
        survey.setFeedback(req.getFeedback());
        survey.setStatus(OnboardingStatus.SUBMITTED);
        surveyRepo.save(survey);

        double overallScore = req.getAnswers().stream()
                .mapToInt(Integer::intValue).average().orElse(0.0);

        // Send email notification
        try {
            List<Integer> answers = req.getAnswers();
            double processBlockAvg = answers.subList(0, 4).stream().mapToInt(Integer::intValue).average().orElse(0);
            double hrBlockAvg = answers.subList(4, 7).stream().mapToInt(Integer::intValue).average().orElse(0);
            int lowestIdx = 0;
            for (int i = 1; i < answers.size(); i++) {
                if (answers.get(i) < answers.get(lowestIdx)) lowestIdx = i;
            }
            String[] questionLabels = {"Onboarding process", "Documentation", "Training", "Buddy/mentor", "Team welcome", "HR support", "Overall experience"};
            String subject = "Onboarding Experience Survey submitted — " + survey.getEmployeeName();
            String body = String.format(
                "<h3>Onboarding Survey Submitted</h3>" +
                "<p><b>Employee:</b> %s (%s)</p>" +
                "<p><b>Overall Score:</b> %.1f/10</p>" +
                "<p><b>Process Block Avg:</b> %.1f | <b>HR Block Avg:</b> %.1f</p>" +
                "<p><b>Lowest Rated:</b> %s (%d/10)</p>" +
                "<p><b>Feedback:</b> %s</p>",
                survey.getEmployeeName(), survey.getDepartment(),
                Math.round(overallScore * 10.0) / 10.0,
                Math.round(processBlockAvg * 10.0) / 10.0,
                Math.round(hrBlockAvg * 10.0) / 10.0,
                questionLabels[lowestIdx], answers.get(lowestIdx),
                req.getFeedback() != null ? req.getFeedback() : "None"
            );
            emailService.sendTaskEntryMail(List.of("hr@tapmind.com", "admin@tapmind.com"), subject, body);
        } catch (Exception e) {
            log.warn("Failed to send onboarding survey email: {}", e.getMessage());
        }

        log.info("Onboarding survey submitted: id={} score={}", req.getSurveyId(), overallScore);

        // Push notification to HR team
        try {
            pushService.sendToTeam("HR",
                    "Onboarding survey submitted",
                    survey.getEmployeeName() + " submitted onboarding survey (" + (Math.round(overallScore * 10.0) / 10.0) + "/10)",
                    "onboarding_submitted",
                    "/hr-feedback/onboarding");
        } catch (Exception e) {
            log.warn("Failed to send push for onboarding submit: {}", e.getMessage());
        }

        return OnboardingSubmitResponse.builder()
                .surveyId(req.getSurveyId())
                .overallScore(Math.round(overallScore * 10.0) / 10.0)
                .submittedAt(LocalDateTime.now())
                .build();
    }

    @Transactional(readOnly = true)
    public OnboardingSurveyHRResponse getSurveysHR(String status, String dateRange) {
        List<OnboardingSurvey> surveys;
        if (status != null && !status.equalsIgnoreCase("all")) {
            surveys = surveyRepo.findAllFiltered(status.toUpperCase());
        } else {
            surveys = surveyRepo.findAllFiltered("ALL");
        }

        LocalDate cutoff = null;
        if (dateRange != null) {
            int days = Integer.parseInt(dateRange);
            cutoff = LocalDate.now().minusDays(days);
            LocalDate finalCutoff = cutoff;
            surveys = surveys.stream()
                    .filter(s -> s.getSentOn().isAfter(finalCutoff) || s.getSentOn().isEqual(finalCutoff))
                    .collect(Collectors.toList());
        }

        List<OnboardingSurveyHRResponse.OnboardingSurveyHRSurveyItem> items = surveys.stream()
                .map(this::toHRItem)
                .collect(Collectors.toList());
        return OnboardingSurveyHRResponse.builder().surveys(items).build();
    }

    @Transactional(readOnly = true)
    public OnboardingScoresResponse getScores() {
        long submitted = surveyRepo.countSubmitted();
        long total = surveyRepo.countAll();

        List<OnboardingSurvey> allSubmitted = surveyRepo.findByStatusOrderBySentOnDesc(OnboardingStatus.SUBMITTED);

        double overallAvg = 0;
        List<Double> questionAvgs = new ArrayList<>(Collections.nCopies(7, 0.0));
        List<Integer> distribution = new ArrayList<>(Collections.nCopies(10, 0));
        long below6 = 0;

        if (!allSubmitted.isEmpty()) {
            List<List<Integer>> allAnswers = new ArrayList<>();
            for (OnboardingSurvey s : allSubmitted) {
                try {
                    List<Integer> ans = objectMapper.readValue(s.getAnswers(), new TypeReference<List<Integer>>() {});
                    allAnswers.add(ans);
                } catch (Exception ignored) {}
            }

            if (!allAnswers.isEmpty()) {
                double totalSum = 0;
                int count = 0;
                for (List<Integer> ans : allAnswers) {
                    for (int i = 0; i < ans.size() && i < 7; i++) {
                        questionAvgs.set(i, questionAvgs.get(i) + ans.get(i));
                    }
                    totalSum += ans.stream().mapToInt(Integer::intValue).sum();
                    count += ans.size();
                }
                overallAvg = count > 0 ? Math.round((totalSum / allAnswers.size()) * 10.0) / 10.0 : 0;
                for (int i = 0; i < 7; i++) {
                    questionAvgs.set(i, Math.round((questionAvgs.get(i) / allSubmitted.size()) * 10.0) / 10.0);
                }

                for (List<Integer> ans : allAnswers) {
                    double avg = ans.stream().mapToInt(Integer::intValue).average().orElse(0);
                    int bucket = Math.min(9, Math.max(0, (int) avg - 1));
                    if (avg < 6) below6++;
                }
            }
        }

        double processBlockAvg = questionAvgs.subList(0, 4).stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double hrBlockAvg = questionAvgs.subList(4, 7).stream().mapToDouble(Double::doubleValue).average().orElse(0);
        int responseRate = total > 0 ? (int) Math.round((submitted * 100.0) / total) : 0;

        List<OnboardingScoresResponse.Q8FeedbackItem> q8Feedback = allSubmitted.stream()
                .filter(s -> s.getFeedback() != null && !s.getFeedback().isEmpty())
                .map(s -> {
                    try {
                        List<Integer> ans = objectMapper.readValue(s.getAnswers(), new TypeReference<List<Integer>>() {});
                        double score = ans.stream().mapToInt(Integer::intValue).average().orElse(0);
                        return OnboardingScoresResponse.Q8FeedbackItem.builder()
                                .score(Math.round(score * 10.0) / 10.0)
                                .employee(s.getEmployeeName())
                                .dept(s.getDepartment())
                                .feedback(s.getFeedback())
                                .build();
                    } catch (Exception e) {
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        return OnboardingScoresResponse.builder()
                .overallAvg(overallAvg)
                .processBlockAvg(Math.round(processBlockAvg * 10.0) / 10.0)
                .hrBlockAvg(Math.round(hrBlockAvg * 10.0) / 10.0)
                .responseRate(responseRate)
                .pending(total - submitted)
                .scoresBelow6(below6)
                .submittedCount(submitted)
                .distribution(distribution)
                .questionAverages(questionAvgs)
                .q8Feedback(q8Feedback)
                .build();
    }

    @Transactional
    public OnboardingSendResponse sendSurvey(OnboardingSendRequest req) {
        List<String> ids = new ArrayList<>();
        for (String name : req.getRecipients()) {
            User user = userRepo.findByName(name)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found: " + name));

        String dept = "";
        if (req.getDepartmentOverrides() != null && req.getDepartmentOverrides().containsKey(name)) {
            dept = req.getDepartmentOverrides().get(name);
        } else if (user.getDepartmentUsers() != null && !user.getDepartmentUsers().isEmpty()) {
            dept = user.getDepartmentUsers().iterator().next().getDepartment().getDepartmentName();
        }

            String nextId = generateNextId();
            OnboardingSurvey survey = OnboardingSurvey.builder()
                    .id(nextId)
                    .employeeId(user.getUserID())
                    .employeeName(user.getName())
                    .department(dept)
                    .joinedDate(LocalDate.now())
                    .sentOn(LocalDate.now())
                    .dueDate(parseDate(req.getDueDate()))
                    .status(OnboardingStatus.PENDING)
                    .build();
            surveyRepo.save(survey);
            ids.add(nextId);

            // Send push to recipient
            try {
                pushService.sendToUser(user.getUserID(),
                        "Onboarding survey",
                        "Please complete your onboarding survey by " + req.getDueDate(),
                        "onboarding_sent",
                        "/hr-feedback/onboarding");
            } catch (Exception e) {
                log.warn("Failed to send push to {}: {}", name, e.getMessage());
            }

            // Send email to recipient
            try {
                String subject = "Please complete your Onboarding Experience Survey";
                String body = String.format(
                    "<h3>Onboarding Experience Survey</h3>" +
                    "<p>Hi %s,</p>" +
                    "<p>Please complete your onboarding experience survey by <b>%s</b>.</p>" +
                    "<p>Click the link in Taskly to submit your feedback.</p>",
                    user.getName(), req.getDueDate()
                );
                emailService.sendTaskEntryMail(List.of(user.getUserEmail()), subject, body);
            } catch (Exception e) {
                log.warn("Failed to send survey email to {}: {}", name, e.getMessage());
            }
        }

        // Notify HR/Admin
        try {
            String subject = "Onboarding Experience Survey sent to " + ids.size() + " employee(s)";
            String body = String.format(
                "<h3>Onboarding Surveys Sent</h3>" +
                "<p>Surveys sent to: %s</p><p>Due date: %s</p>",
                String.join(", ", req.getRecipients()), req.getDueDate()
            );
            String notifyTo = req.getNotifyList() != null ? req.getNotifyList() : "hr@tapmind.com";
            emailService.sendTaskEntryMail(List.of(notifyTo.split(";")), subject, body);
        } catch (Exception e) {
            log.warn("Failed to send HR notification: {}", e.getMessage());
        }

        log.info("Onboarding surveys sent: count={} ids={}", ids.size(), ids);
        return OnboardingSendResponse.builder().sent(ids.size()).surveyIds(ids).build();
    }

    @Transactional(readOnly = true)
    public OnboardingAdminResponse getAdmin() {
        List<OnboardingSurvey> all = surveyRepo.findAll();
        long submitted = surveyRepo.countSubmitted();
        long total = all.size();

        Map<String, List<OnboardingSurvey>> byDept = all.stream()
                .collect(Collectors.groupingBy(OnboardingSurvey::getDepartment));

        List<OnboardingAdminResponse.DeptStat> deptStats = new ArrayList<>();
        double orgTotal = 0;
        int orgCount = 0;

        for (Map.Entry<String, List<OnboardingSurvey>> entry : byDept.entrySet()) {
            String dept = entry.getKey();
            List<OnboardingSurvey> deptSurveys = entry.getValue();
            long deptSubmitted = deptSurveys.stream()
                    .filter(s -> s.getStatus() == OnboardingStatus.SUBMITTED).count();
            double deptAvg = 0;
            long below6 = 0;
            if (deptSubmitted > 0) {
                for (OnboardingSurvey s : deptSurveys) {
                    if (s.getStatus() == OnboardingStatus.SUBMITTED && s.getAnswers() != null) {
                        try {
                            List<Integer> ans = objectMapper.readValue(s.getAnswers(), new TypeReference<List<Integer>>() {});
                            double avg = ans.stream().mapToInt(Integer::intValue).average().orElse(0);
                            deptAvg += avg;
                            if (avg < 6) below6++;
                        } catch (Exception ignored) {}
                    }
                }
                deptAvg = deptAvg / deptSubmitted;
                orgTotal += deptAvg;
                orgCount++;
            }
            deptStats.add(OnboardingAdminResponse.DeptStat.builder()
                    .dept(dept)
                    .sent(deptSurveys.size())
                    .responded((int) deptSubmitted)
                    .avg(Math.round(deptAvg * 10.0) / 10.0)
                    .below6(below6)
                    .build());
        }

        deptStats.sort(Comparator.comparingDouble(d -> d.getAvg() != null ? d.getAvg() : 0));
        OnboardingAdminResponse.DeptStat lowest = deptStats.isEmpty() ? null : deptStats.get(0);
        OnboardingAdminResponse.DeptStat highest = deptStats.isEmpty() ? null : deptStats.get(deptStats.size() - 1);

        return OnboardingAdminResponse.builder()
                .orgAvg(orgCount > 0 ? Math.round((orgTotal / orgCount) * 10.0) / 10.0 : 0.0)
                .responseRate(total > 0 ? (int) Math.round((submitted * 100.0) / total) : 0)
                .lowestDept(lowest)
                .highestDept(highest)
                .departmentBreakdown(deptStats)
                .build();
    }

    private OnboardingSurveyEmployeeResponse.OnboardingSurveyItem toEmployeeItem(OnboardingSurvey s) {
        List<Integer> answers = Collections.emptyList();
        if (s.getAnswers() != null) {
            try {
                answers = objectMapper.readValue(s.getAnswers(), new TypeReference<List<Integer>>() {});
            } catch (Exception ignored) {}
        }
        Double score = null;
        if (s.getStatus() == OnboardingStatus.SUBMITTED && !answers.isEmpty()) {
            score = Math.round(answers.stream().mapToInt(Integer::intValue).average().orElse(0) * 10.0) / 10.0;
        }
        return OnboardingSurveyEmployeeResponse.OnboardingSurveyItem.builder()
                .id(s.getId())
                .employee(s.getEmployeeName())
                .dept(s.getDepartment())
                .joined(s.getJoinedDate().format(DF))
                .sentOn(s.getSentOn().format(DF))
                .due(s.getDueDate().format(DF))
                .status(s.getStatus().name().toLowerCase())
                .answers(answers)
                .feedback(s.getFeedback() != null ? s.getFeedback() : "")
                .score(score)
                .build();
    }

    private OnboardingSurveyHRResponse.OnboardingSurveyHRSurveyItem toHRItem(OnboardingSurvey s) {
        OnboardingSurveyEmployeeResponse.OnboardingSurveyItem base = toEmployeeItem(s);
        Double hrBlockAvg = null;
        if (s.getStatus() == OnboardingStatus.SUBMITTED && s.getAnswers() != null) {
            try {
                List<Integer> ans = objectMapper.readValue(s.getAnswers(), new TypeReference<List<Integer>>() {});
                if (ans.size() >= 7) {
                    hrBlockAvg = Math.round(ans.subList(4, 7).stream().mapToInt(Integer::intValue).average().orElse(0) * 10.0) / 10.0;
                }
            } catch (Exception ignored) {}
        }
        return OnboardingSurveyHRResponse.OnboardingSurveyHRSurveyItem.builder()
                .id(base.getId())
                .employee(base.getEmployee())
                .dept(base.getDept())
                .joined(base.getJoined())
                .sentOn(base.getSentOn())
                .due(base.getDue())
                .status(base.getStatus())
                .answers(base.getAnswers())
                .feedback(base.getFeedback())
                .score(base.getScore())
                .hrBlockAvg(hrBlockAvg)
                .build();
    }

    private String generateNextId() {
        Optional<OnboardingSurvey> last = surveyRepo.findTopByOrderByIdDesc();
        int next = 1;
        if (last.isPresent()) {
            String lastId = last.get().getId();
            next = Integer.parseInt(lastId.replace("S-", "")) + 1;
        }
        return String.format("S-%03d", next);
    }

    private LocalDate parseDate(String dateStr) {
        for (DateTimeFormatter fmt : DATE_PARSERS) {
            try {
                return LocalDate.parse(dateStr, fmt);
            } catch (DateTimeParseException ignored) {}
        }
        throw new IllegalArgumentException("Invalid date format: " + dateStr + ". Expected format: dd MMM yyyy (e.g. 30 Aug 2026)");
    }
}
