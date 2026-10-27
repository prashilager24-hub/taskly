import axios from "axios";

const BASE = "/t2.0/authentificationUtilization/hrFeedback";

const getToken = () => {
  const raw = localStorage.getItem("authUserLD");
  return raw ? JSON.parse(raw).token : "";
};

const auth = () => ({ headers: { Authorization: `Bearer ${getToken()}` } });

const POST = (url, data) => axios.post(url, data, auth());
const GET = (url) => axios.get(url, auth());

const payload = (r) => r.data?.data ?? {};

const normalizeQuery = (q = {}, defaultTeam) => ({
  id: q.id ?? "",
  employee: q.employee ?? "",
  dept: q.dept ?? "",
  team: q.team ?? defaultTeam ?? "HR",
  category: q.category ?? "",
  subject: q.subject ?? "",
  priority: q.priority ?? "Normal",
  raisedOn: q.raisedOn ?? "",
  ageHrs: q.ageHrs ?? 0,
  status: q.status ?? "open",
  overdue: q.overdue ?? false,
  supportScore: q.supportScore ?? null,
  ratings: q.ratings ?? [],
  ratingComment: q.ratingComment ?? "",
  thread: q.thread ?? [],
  ...q,
});

/* ── Module 1: Onboarding ─────────────────────────────── */

export const fetchMyOnboardingSurveys = () =>
  GET(`${BASE}/onboarding/surveys/mine`).then((r) => payload(r).surveys ?? []);

export const submitOnboardingSurvey = (surveyId, answers, feedback) =>
  POST(`${BASE}/onboarding/submit`, { surveyId, answers, feedback }).then((r) => payload(r));

export const fetchOnboardingSurveys = (status = "all", dateRange = "90") =>
  GET(`${BASE}/onboarding/surveys/list?status=${status}&dateRange=${dateRange}`).then((r) => payload(r).surveys ?? []);

export const fetchOnboardingScores = () =>
  GET(`${BASE}/onboarding/scores`).then((r) => payload(r));

export const sendOnboardingSurvey = (recipients, dueDate, notifyList) =>
  POST(`${BASE}/onboarding/send`, { recipients, dueDate, notifyList }).then((r) => payload(r));

export const fetchOnboardingAdmin = () =>
  GET(`${BASE}/onboarding/admin`).then((r) => payload(r));

/* ── Module 2: Query ──────────────────────────────────── */

export const fetchMyQueries = () =>
  GET(`${BASE}/query/mine`).then((r) => (payload(r).queries ?? []).map((q) => normalizeQuery(q)));

export const raiseQuery = (team, category, subject, description, priority) =>
  POST(`${BASE}/query/raise`, { team, category, subject, description, priority }).then((r) => normalizeQuery(payload(r), team));

export const rateQuery = (queryId, ratings, comment) =>
  POST(`${BASE}/query/${queryId}/rate`, { ratings, comment }).then((r) => payload(r));

export const fetchQueryQueue = (team = "HR") =>
  GET(`${BASE}/query/queue?team=${team}`).then((r) => (payload(r).queries ?? []).map((q) => normalizeQuery(q, team)));

export const replyQuery = (queryId, text) =>
  POST(`${BASE}/query/${queryId}/reply`, { text }).then((r) => {
    const d = payload(r);
    return normalizeQuery({ ...d, id: d.queryId ?? queryId });
  });

export const resolveQuery = (queryId) =>
  POST(`${BASE}/query/${queryId}/resolve`).then((r) => payload(r));

export const reopenQuery = (queryId, reason = "") =>
  POST(`${BASE}/query/${queryId}/reopen`, { reason }).then((r) => normalizeQuery(payload(r)));

export const reassignQuery = (queryId, reason) =>
  POST(`${BASE}/query/${queryId}/reassign`, { reason }).then((r) => payload(r));

export const fetchQueryAdmin = () =>
  GET(`${BASE}/query/admin`).then((r) => payload(r));

/* ── Module 3: Engagement ─────────────────────────────── */

export const fetchOpenEngagementSurveys = () =>
  GET(`${BASE}/engagement/surveys/open`).then((r) => payload(r).surveys ?? []);

export const submitEngagementSurvey = (surveyId, months, rest, feedback, anonymous) =>
  POST(`${BASE}/engagement/submit`, { surveyId, months, rest, feedback, anonymous }).then((r) => payload(r));

export const fetchEngagementSurveys = (fy) =>
  GET(`${BASE}/engagement/surveys/list${fy ? `?fy=${fy}` : ""}`).then((r) => payload(r).surveys ?? []);

export const fetchEngagementScores = (surveyId) =>
  GET(`${BASE}/engagement/scores/${surveyId}`).then((r) => payload(r));

export const rolloutEngagement = (quarter, months, closes, notifyList, recipients = []) =>
  POST(`${BASE}/engagement/rollout`, { quarter, months, closes, notifyList, recipients }).then((r) => payload(r));

export const fetchEngagementAdmin = () =>
  GET(`${BASE}/engagement/admin`).then((r) => payload(r));

/* ── Users (existing Taskly endpoint) ──────────────────── */

export const fetchUsers = (searchText = "") =>
  POST("/t2.0/authentificationUtilization/users/read?page=0&size=0", {
    filter: "Active",
    searchText,
    departmentID: 0,
  }).then((r) => r.data.response?.users || []);