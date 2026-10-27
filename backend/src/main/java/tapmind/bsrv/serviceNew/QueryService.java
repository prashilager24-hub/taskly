package tapmind.bsrv.serviceNew;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tapmind.bsrv.dto.*;
import tapmind.bsrv.enums.*;
import tapmind.bsrv.exception.ResourceNotFoundException;
import tapmind.bsrv.model.HrQuery;
import tapmind.bsrv.model.QueryMessage;
import tapmind.bsrv.model.User;
import tapmind.bsrv.repository.HrQueryRepository;
import tapmind.bsrv.repository.QueryMessageRepository;
import tapmind.bsrv.repository.UserRepository;
import tapmind.bsrv.service.EmailService;

@Slf4j
@Service
@RequiredArgsConstructor
public class QueryService {

    private final HrQueryRepository queryRepo;
    private final QueryMessageRepository messageRepo;
    private final UserRepository userRepo;
    private final ObjectMapper objectMapper;
    private final EmailService emailService;
    private final PushService pushService;

    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("d MMM, HH:mm");
    private static final DateTimeFormatter D_FMT = DateTimeFormatter.ofPattern("d MMM");

    @Transactional(readOnly = true)
    public QueryEmployeeResponse getMine(Integer employeeId) {
        List<HrQuery> queries = queryRepo.findByEmployeeIdOrderByRaisedOnDesc(employeeId);
        List<QueryEmployeeResponse.QueryEmployeeItem> items = queries.stream()
                .map(this::toEmployeeItem)
                .collect(Collectors.toList());
        return QueryEmployeeResponse.builder().queries(items).build();
    }

    @Transactional
    public QueryRaiseResponse raiseQuery(Integer employeeId, String employeeName, String department, QueryRaiseRequest req) {
        String nextId = generateNextId();
        QueryTeam team = QueryTeam.fromString(req.getTeam());
        QueryCategory category = QueryCategory.fromString(req.getCategory());
        QueryPriority priority = QueryPriority.fromString(req.getPriority());

        HrQuery query = HrQuery.builder()
                .id(nextId)
                .employeeId(employeeId)
                .employeeName(employeeName)
                .department(department)
                .team(team)
                .category(category)
                .subject(req.getSubject().trim())
                .description(req.getDescription().trim())
                .priority(priority)
                .raisedOn(LocalDate.now())
                .ageHours(0)
                .status(QueryStatus.OPEN)
                .build();
        query = queryRepo.save(query);

        QueryMessage msg = QueryMessage.builder()
                .query(query)
                .author(employeeName)
                .text(req.getDescription().trim())
                .build();
        messageRepo.save(msg);

        // Send email to routed team
        try {
            String teamEmail = team == QueryTeam.HR ? "hr@tapmind.com" : "ld@tapmind.com";
            String subject = "New " + team.name().replace("_", "&") + " Query: " + req.getSubject();
            String body = String.format(
                "<h3>New Query Raised</h3>" +
                "<p><b>From:</b> %s (%s)</p>" +
                "<p><b>Category:</b> %s | <b>Priority:</b> %s</p>" +
                "<p><b>Subject:</b> %s</p>" +
                "<p><b>Description:</b> %s</p>",
                employeeName, department, category, priority, req.getSubject(), req.getDescription()
            );
            emailService.sendTaskEntryMail(List.of(teamEmail), subject, body);
        } catch (Exception e) {
            log.warn("Failed to send query notification email: {}", e.getMessage());
        }

        // Push notification to team
        try {
            pushService.sendToTeam(team.name(),
                    "New query",
                    employeeName + " raised: " + req.getSubject(),
                    "query_raised",
                    "/hr/queries/" + nextId);
        } catch (Exception e) {
            log.warn("Failed to send push notification for new query: {}", e.getMessage());
        }

        log.info("Query raised: id={} team={} category={}", nextId, team, category);

        List<QueryEmployeeResponse.ThreadMessage> thread = Collections.singletonList(
                QueryEmployeeResponse.ThreadMessage.builder()
                        .who(employeeName)
                        .at("Today")
                        .text(truncate(req.getDescription(), 100))
                        .build()
        );

        return QueryRaiseResponse.builder()
                .id(nextId)
                .team(team.name())
                .category(category.name())
                .subject(req.getSubject())
                .priority(priority.name())
                .raisedOn("Today")
                .status(QueryStatus.OPEN.name().toLowerCase())
                .thread(thread)
                .build();
    }

    @Transactional
    public QueryRateResponse rateQuery(String queryId, Integer employeeId, QueryRateRequest req) {
        HrQuery query = queryRepo.findById(queryId)
                .orElseThrow(() -> new ResourceNotFoundException("Query not found: " + queryId));

        if (!query.getEmployeeId().equals(employeeId)) {
            throw new IllegalArgumentException("Query does not belong to this employee");
        }

        String ratingsJson;
        try {
            ratingsJson = objectMapper.writeValueAsString(req.getRatings());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid ratings format");
        }

        double overallScore = req.getRatings().stream().mapToInt(Integer::intValue).average().orElse(0);

        query.setRatings(ratingsJson);
        query.setRatingComment(req.getComment());
        query.setStatus(QueryStatus.CLOSED);
        queryRepo.save(query);

        // If score < 6, notify admin
        if (overallScore < 6) {
            try {
                String subject = "Low Support Score Alert: " + query.getSubject();
                String body = String.format(
                    "<h3>Low Support Score</h3>" +
                    "<p><b>Query:</b> %s (%s)</p>" +
                    "<p><b>Team:</b> %s</p>" +
                    "<p><b>Score:</b> %.1f/10</p>" +
                    "<p><b>Comment:</b> %s</p>",
                    query.getSubject(), queryId, query.getTeam(),
                    Math.round(overallScore * 10.0) / 10.0,
                    req.getComment() != null ? req.getComment() : "None"
                );
                emailService.sendTaskEntryMail(List.of("admin@tapmind.com"), subject, body);
            } catch (Exception e) {
                log.warn("Failed to send low score alert: {}", e.getMessage());
            }
        }

        log.info("Query rated: id={} score={}", queryId, overallScore);

        // Push notification to team: survey submitted
        try {
            pushService.sendToTeam(query.getTeam().name(),
                    "Survey submitted",
                    query.getEmployeeName() + " rated " + queryId + " (" + Math.round(overallScore * 10.0) / 10.0 + "/10)",
                    "query_rated",
                    "/hr/queries/" + queryId);
        } catch (Exception e) {
            log.warn("Failed to send push notification for survey: {}", e.getMessage());
        }

        return QueryRateResponse.builder()
                .queryId(queryId)
                .status(QueryStatus.CLOSED.name().toLowerCase())
                .overallScore(Math.round(overallScore * 10.0) / 10.0)
                .build();
    }

    @Transactional(readOnly = true)
    public QueryQueueResponse getQueue(QueryTeam team) {
        List<HrQuery> allByTeam = queryRepo.findByTeamAll(team);
        long openCount = queryRepo.countOpenByTeam(team);
        long overdueCount = queryRepo.countOverdueByTeam(team);
        long resolvedCount = queryRepo.countResolvedByTeam(team);

        double avgScore = allByTeam.stream()
                .filter(q -> q.getRatings() != null)
                .mapToDouble(q -> {
                    try {
                        List<Integer> ratings = objectMapper.readValue(q.getRatings(), new TypeReference<List<Integer>>() {});
                        return ratings.stream().mapToInt(Integer::intValue).average().orElse(0);
                    } catch (Exception e) { return 0; }
                })
                .average().orElse(0);

        long surveysCompleted = allByTeam.stream()
                .filter(q -> q.getRatings() != null).count();

        List<QueryQueueResponse.QueryQueueItem> items = allByTeam.stream()
                .map(q -> {
                    List<QueryMessage> msgs = messageRepo.findByQueryIdOrderByCreatedAtAsc(q.getId());
                    List<QueryQueueResponse.Reply> replies = msgs.stream()
                            .map(m -> QueryQueueResponse.Reply.builder()
                                    .who(m.getAuthor())
                                    .at(m.getCreatedAt().format(DT_FMT))
                                    .text(m.getText())
                                    .build())
                            .collect(Collectors.toList());
                    return QueryQueueResponse.QueryQueueItem.builder()
                            .id(q.getId())
                            .employee(q.getEmployeeName())
                            .subject(q.getSubject())
                            .category(q.getCategory().name())
                            .status(q.getStatus().name().toLowerCase())
                            .ageHrs(q.getAgeHours())
                            .overdue(q.getAgeHours() > 72 && q.getStatus() != QueryStatus.RESOLVED && q.getStatus() != QueryStatus.CLOSED)
                            .raisedOn(q.getRaisedOn().format(D_FMT))
                            .supportScore(q.getRatings() != null ? Math.round(avgScore * 10.0) / 10.0 : null)
                            .replies(replies)
                            .build();
                })
                .collect(Collectors.toList());

        return QueryQueueResponse.builder()
                .team(team.name())
                .openCount(openCount)
                .overdueCount(overdueCount)
                .resolvedClosedCount(resolvedCount)
                .avgSupportScore(Math.round(avgScore * 10.0) / 10.0)
                .surveysCompleted(surveysCompleted)
                .slaHours(72)
                .queries(items)
                .build();
    }

    @Transactional
    public QueryReplyResponse replyToQuery(String queryId, String authorName, QueryReplyRequest req) {
        HrQuery query = queryRepo.findById(queryId)
                .orElseThrow(() -> new ResourceNotFoundException("Query not found: " + queryId));

        QueryMessage msg = QueryMessage.builder()
                .query(query)
                .author(authorName)
                .text(req.getText().trim())
                .build();
        messageRepo.save(msg);

        if (query.getStatus() == QueryStatus.OPEN) {
            query.setStatus(QueryStatus.IN_PROGRESS);
            queryRepo.save(query);
        }

        List<QueryEmployeeResponse.ThreadMessage> thread = getThread(queryId);

        log.info("Reply added to query: id={} by={}", queryId, authorName);

        // Push notification: if employee replied → notify team, if team replied → notify employee
        try {
            if (authorName.equalsIgnoreCase(query.getEmployeeName())) {
                // Employee replied → notify team
                pushService.sendToTeam(query.getTeam().name(),
                        "New reply",
                        authorName + " replied to " + queryId,
                        "query_replied",
                        "/hr/queries/" + queryId);
            } else {
                // Team member replied → notify employee
                pushService.sendToUser(query.getEmployeeId(),
                        "New reply",
                        authorName + " replied to " + queryId,
                        "query_replied",
                        "/hr/queries/" + queryId);
            }
        } catch (Exception e) {
            log.warn("Failed to send push notification for reply: {}", e.getMessage());
        }

        return QueryReplyResponse.builder()
                .queryId(queryId)
                .status(query.getStatus().name().toLowerCase())
                .thread(thread)
                .build();
    }

    @Transactional
    public QueryResolveResponse resolveQuery(String queryId) {
        HrQuery query = queryRepo.findById(queryId)
                .orElseThrow(() -> new ResourceNotFoundException("Query not found: " + queryId));

        query.setStatus(QueryStatus.RESOLVED);
        queryRepo.save(query);

        // Email to employee: query resolved, please rate
        try {
            User employee = userRepo.findById(query.getEmployeeId()).orElse(null);
            if (employee != null) {
                String subject = "Your query has been resolved: " + query.getSubject();
                String body = String.format(
                    "<h3>Query Resolved</h3>" +
                    "<p>Hi %s,</p>" +
                    "<p>Your query <b>%s</b> has been resolved by the %s team.</p>" +
                    "<p>Please rate the support experience in Taskly.</p>",
                    query.getEmployeeName(), query.getSubject(), query.getTeam().name().replace("_", "&")
                );
                emailService.sendTaskEntryMail(List.of(employee.getUserEmail()), subject, body);
            }
        } catch (Exception e) {
            log.warn("Failed to send resolve email: {}", e.getMessage());
        }

        // Push notification to employee
        try {
            pushService.sendToUser(query.getEmployeeId(), "Query resolved",
                    queryId + " has been resolved");
        } catch (Exception e) {
            log.warn("Failed to send push notification for resolve: {}", e.getMessage());
        }

        log.info("Query resolved: id={}", queryId);

        return QueryResolveResponse.builder()
                .queryId(queryId)
                .status(QueryStatus.RESOLVED.name().toLowerCase())
                .build();
    }

    @Transactional
    public QueryReassignResponse reassignQuery(String queryId, QueryReassignRequest req) {
        HrQuery query = queryRepo.findById(queryId)
                .orElseThrow(() -> new ResourceNotFoundException("Query not found: " + queryId));

        QueryTeam newTeam = query.getTeam() == QueryTeam.HR ? QueryTeam.L_D : QueryTeam.HR;
        query.setTeam(newTeam);
        query.setStatus(QueryStatus.OPEN);
        queryRepo.save(query);

        QueryMessage sysMsg = QueryMessage.builder()
                .query(query)
                .author("System")
                .text("Reassigned from " + (newTeam == QueryTeam.L_D ? "HR" : "L&D") + " to " + newTeam.name().replace("_", "&"))
                .build();
        messageRepo.save(sysMsg);

        log.info("Query reassigned: id={} newTeam={}", queryId, newTeam);

        return QueryReassignResponse.builder()
                .queryId(queryId)
                .team(newTeam.name().replace("_", "&"))
                .status(QueryStatus.OPEN.name().toLowerCase())
                .build();
    }

    @Transactional
    public QueryReopenResponse reopenQuery(String queryId, Integer employeeId, String reason) {
        HrQuery query = queryRepo.findById(queryId)
                .orElseThrow(() -> new ResourceNotFoundException("Query not found: " + queryId));

        if (!query.getEmployeeId().equals(employeeId)) {
            throw new IllegalArgumentException("Query does not belong to this employee");
        }

        query.setStatus(QueryStatus.OPEN);
        query.setAgeHours(0);
        query.setReopenReason(reason);
        queryRepo.save(query);

        String reopenMsg = reason != null && !reason.isEmpty()
                ? "Reopened by employee: " + reason
                : "Reopened by employee";
        QueryMessage msg = QueryMessage.builder()
                .query(query)
                .author(query.getEmployeeName())
                .text(reopenMsg)
                .build();
        messageRepo.save(msg);

        // Email to team: query reopened
        try {
            String teamEmail = query.getTeam() == QueryTeam.HR ? "hr@tapmind.com" : "ld@tapmind.com";
            String subject = "Query Reopened: " + query.getSubject();
            String body = String.format(
                "<h3>Query Reopened</h3>" +
                "<p><b>Query:</b> %s (%s)</p>" +
                "<p><b>Employee:</b> %s</p>" +
                "<p><b>Reason:</b> %s</p>",
                query.getSubject(), queryId, query.getEmployeeName(),
                reason != null && !reason.isEmpty() ? reason : "No reason provided"
            );
            emailService.sendTaskEntryMail(List.of(teamEmail), subject, body);
        } catch (Exception e) {
            log.warn("Failed to send reopen email: {}", e.getMessage());
        }

        // Push notification to team
        try {
            pushService.sendToTeam(query.getTeam().name(), "Query reopened",
                    query.getEmployeeName() + " reopened " + queryId);
        } catch (Exception e) {
            log.warn("Failed to send push notification for reopen: {}", e.getMessage());
        }

        log.info("Query reopened: id={}", queryId);

        return QueryReopenResponse.builder()
                .queryId(queryId)
                .status(QueryStatus.OPEN.name().toLowerCase())
                .reopenReason(reason)
                .build();
    }

    @Transactional(readOnly = true)
    public QueryAdminResponse getAdmin() {
        long totalRaised = queryRepo.countAll();
        long totalResolved = queryRepo.countResolved();
        long totalOpen = queryRepo.countOpen();
        long slaBreached = queryRepo.countSlaBreached();

        List<HrQuery> all = queryRepo.findAll();
        double avgScore = all.stream()
                .filter(q -> q.getRatings() != null)
                .mapToDouble(q -> {
                    try {
                        List<Integer> ratings = objectMapper.readValue(q.getRatings(), new TypeReference<List<Integer>>() {});
                        return ratings.stream().mapToInt(Integer::intValue).average().orElse(0);
                    } catch (Exception e) { return 0; }
                })
                .average().orElse(0);

        long scoresBelow6 = all.stream()
                .filter(q -> q.getRatings() != null)
                .filter(q -> {
                    try {
                        List<Integer> ratings = objectMapper.readValue(q.getRatings(), new TypeReference<List<Integer>>() {});
                        return ratings.stream().mapToInt(Integer::intValue).average().orElse(10) < 6;
                    } catch (Exception e) { return false; }
                }).count();

        List<Double> questionAvgs = computeQuestionAverages(all);
        List<Integer> distribution = computeDistribution(all);

        List<QueryAdminResponse.TeamStat> byTeam = new ArrayList<>();
        for (QueryTeam team : QueryTeam.values()) {
            List<HrQuery> teamQueries = all.stream().filter(q -> q.getTeam() == team).collect(Collectors.toList());
            long teamRaised = teamQueries.size();
            long teamResolved = teamQueries.stream()
                    .filter(q -> q.getStatus() == QueryStatus.RESOLVED || q.getStatus() == QueryStatus.CLOSED).count();
            double teamAvg = teamQueries.stream()
                    .filter(q -> q.getRatings() != null)
                    .mapToDouble(q -> {
                        try {
                            List<Integer> r = objectMapper.readValue(q.getRatings(), new TypeReference<List<Integer>>() {});
                            return r.stream().mapToInt(Integer::intValue).average().orElse(0);
                        } catch (Exception e) { return 0; }
                    }).average().orElse(0);
            long teamBelow6 = teamQueries.stream()
                    .filter(q -> q.getRatings() != null)
                    .filter(q -> {
                        try {
                            List<Integer> r = objectMapper.readValue(q.getRatings(), new TypeReference<List<Integer>>() {});
                            return r.stream().mapToInt(Integer::intValue).average().orElse(10) < 6;
                        } catch (Exception e) { return false; }
                    }).count();

            byTeam.add(QueryAdminResponse.TeamStat.builder()
                    .team(team.name().replace("_", "&"))
                    .raised(teamRaised)
                    .resolved(teamResolved)
                    .avg(Math.round(teamAvg * 10.0) / 10.0)
                    .below6(teamBelow6)
                    .build());
        }

        List<QueryAdminResponse.LowScoringItem> lowScoring = all.stream()
                .filter(q -> q.getRatings() != null)
                .filter(q -> {
                    try {
                        List<Integer> r = objectMapper.readValue(q.getRatings(), new TypeReference<List<Integer>>() {});
                        return r.stream().mapToInt(Integer::intValue).average().orElse(10) < 6;
                    } catch (Exception e) { return false; }
                })
                .map(q -> {
                    try {
                        List<Integer> r = objectMapper.readValue(q.getRatings(), new TypeReference<List<Integer>>() {});
                        double avg = r.stream().mapToInt(Integer::intValue).average().orElse(0);
                        int minIdx = 0;
                        for (int i = 1; i < r.size(); i++) {
                            if (r.get(i) < r.get(minIdx)) minIdx = i;
                        }
                        String[] labels = {"Response time", "Clarity", "Helpfulness", "Resolution quality", "Communication", "Support provided"};
                        return QueryAdminResponse.LowScoringItem.builder()
                                .id(q.getId())
                                .team(q.getTeam().name().replace("_", "&"))
                                .subject(q.getSubject())
                                .avg(Math.round(avg * 10.0) / 10.0)
                                .weakest(labels[minIdx % labels.length])
                                .comment(q.getRatingComment())
                                .build();
                    } catch (Exception e) { return null; }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        return QueryAdminResponse.builder()
                .avgSupportScore(Math.round(avgScore * 10.0) / 10.0)
                .totalRaised(totalRaised)
                .totalResolved(totalResolved)
                .totalOpen(totalOpen)
                .slaBreached(slaBreached)
                .scoresBelow6(scoresBelow6)
                .questionAverages(questionAvgs)
                .distribution(distribution)
                .byTeam(byTeam)
                .lowScoring(lowScoring)
                .build();
    }

    private List<QueryEmployeeResponse.ThreadMessage> getThread(String queryId) {
        List<QueryMessage> msgs = messageRepo.findByQueryIdOrderByCreatedAtAsc(queryId);
        return msgs.stream()
                .map(m -> QueryEmployeeResponse.ThreadMessage.builder()
                        .who(m.getAuthor())
                        .at(m.getCreatedAt().format(DT_FMT))
                        .text(m.getText())
                        .build())
                .collect(Collectors.toList());
    }

    private QueryEmployeeResponse.QueryEmployeeItem toEmployeeItem(HrQuery q) {
        List<Integer> ratings = Collections.emptyList();
        if (q.getRatings() != null) {
            try {
                ratings = objectMapper.readValue(q.getRatings(), new TypeReference<List<Integer>>() {});
            } catch (Exception ignored) {}
        }
        Double supportScore = null;
        if (!ratings.isEmpty()) {
            supportScore = Math.round(ratings.stream().mapToInt(Integer::intValue).average().orElse(0) * 10.0) / 10.0;
        }

        return QueryEmployeeResponse.QueryEmployeeItem.builder()
                .id(q.getId())
                .employee(q.getEmployeeName())
                .dept(q.getDepartment())
                .team(q.getTeam().name().replace("_", "&"))
                .category(q.getCategory().name())
                .subject(q.getSubject())
                .priority(q.getPriority().name())
                .raisedOn(q.getRaisedOn().format(D_FMT))
                .ageHrs(q.getAgeHours())
                .status(q.getStatus().name().toLowerCase())
                .ratings(ratings)
                .ratingComment(q.getRatingComment() != null ? q.getRatingComment() : "")
                .supportScore(supportScore)
                .thread(getThread(q.getId()))
                .build();
    }

    private String generateNextId() {
        Optional<HrQuery> last = queryRepo.findTopByOrderByIdDesc();
        int next = 1001;
        if (last.isPresent()) {
            String lastId = last.get().getId();
            next = Integer.parseInt(lastId.replace("Q-", "")) + 1;
        }
        return "Q-" + next;
    }

    private List<Double> computeQuestionAverages(List<HrQuery> queries) {
        List<List<Integer>> allRatings = new ArrayList<>();
        for (HrQuery q : queries) {
            if (q.getRatings() != null) {
                try {
                    allRatings.add(objectMapper.readValue(q.getRatings(), new TypeReference<List<Integer>>() {}));
                } catch (Exception ignored) {}
            }
        }
        if (allRatings.isEmpty()) return Collections.nCopies(6, 0.0);

        int size = allRatings.get(0).size();
        List<Double> avgs = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            int idx = i;
            double avg = allRatings.stream()
                    .filter(r -> r.size() > idx)
                    .mapToDouble(r -> r.get(idx))
                    .average().orElse(0);
            avgs.add(Math.round(avg * 10.0) / 10.0);
        }
        return avgs;
    }

    private List<Integer> computeDistribution(List<HrQuery> queries) {
        List<Integer> dist = new ArrayList<>(Collections.nCopies(10, 0));
        for (HrQuery q : queries) {
            if (q.getRatings() != null) {
                try {
                    List<Integer> r = objectMapper.readValue(q.getRatings(), new TypeReference<List<Integer>>() {});
                    double avg = r.stream().mapToInt(Integer::intValue).average().orElse(0);
                    int bucket = Math.min(9, Math.max(0, (int) avg - 1));
                    dist.set(bucket, dist.get(bucket) + 1);
                } catch (Exception ignored) {}
            }
        }
        return dist;
    }

    private String truncate(String s, int max) {
        return s != null && s.length() > max ? s.substring(0, max) + "..." : s;
    }
}
