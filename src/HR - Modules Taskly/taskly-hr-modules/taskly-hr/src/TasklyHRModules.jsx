import { useState, useEffect, useCallback } from "react";
import { Mail, X, Users } from "lucide-react";
import { Button, Card, CardBody, Chip, Tabs, Tab } from "@heroui/react";

import OnboardingEmployee from "./modules/onboarding/OnboardingEmployee";
import OnboardingHR from "./modules/onboarding/OnboardingHR";
import OnboardingAdmin from "./modules/onboarding/OnboardingAdmin";

import QueryEmployee from "./modules/query/QueryEmployee";
import QueryResolver from "./modules/query/QueryResolver";
import QueryAdmin from "./modules/query/QueryAdmin";

import EngagementEmployee from "./modules/engagement/EngagementEmployee";
import EngagementHR from "./modules/engagement/EngagementHR";
import EngagementAdmin from "./modules/engagement/EngagementAdmin";

import * as api from "./lib/api";
import { avg, one } from "./lib/metrics";
import { subscribeToPush, unsubscribeFromPush, isSubscribed } from "../../../../lib/pushClient";

const NOTIFY_LIST = "hr@tapmind.com; admin@tapmind.com";

export default function TasklyHRModules() {
  const [mod, setMod] = useState("m1");
  const [role, setRole] = useState(null);

  const [surveys, setSurveys] = useState([]);
  const [queries, setQueries] = useState([]);
  const [queryAdmin, setQueryAdmin] = useState(null);
  const [engagement, setEngagement] = useState([]);

  const [currentUser, setCurrentUser] = useState({ name: "", dept: "" });
  const [authUser, setAuthUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pushActive, setPushActive] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
    try {
      const key = "hrModuleNotifications";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      const item = {
        id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        message: msg,
        time: new Date().toISOString(),
        read: false,
      };
      localStorage.setItem(key, JSON.stringify([item, ...prev].slice(0, 50)));
    } catch { /* ignore */ }
  };

  /* ── Real push (PWA service worker + Web Push) ─────────── */
  const checkPushStatus = useCallback(() => {
    isSubscribed().then(setPushActive).catch(() => setPushActive(false));
  }, []);

  useEffect(() => {
    checkPushStatus();
  }, [checkPushStatus]);

  /* ── Current user from localStorage (same pattern as rest of Taskly) ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("authUserLD");
      if (raw) {
        const u = JSON.parse(raw);
        setCurrentUser({ name: u.userName || u.name || "", dept: u.departmentName || u.dept || "" });
        setAuthUser(u);
      }
    } catch { /* ignore */ }
  }, []);

  /* ── Fetch data when module or role changes ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (mod === "m1") {
        if (role === "employee") {
          setSurveys(await api.fetchMyOnboardingSurveys());
        } else if (role === "hr") {
          setSurveys(await api.fetchOnboardingSurveys());
        }
        // admin view uses same surveys endpoint
        if (role === "admin") {
          setSurveys(await api.fetchOnboardingSurveys());
        }
      }
      if (mod === "m2") {
        if (role === "employee") {
          setQueries(await api.fetchMyQueries());
        } else if (role === "hr") {
          setQueries(await api.fetchQueryQueue("HR"));
        }
        if (role === "admin") {
          try {
            setQueryAdmin(await api.fetchQueryAdmin());
          } catch {
            const [hr, ln] = await Promise.all([api.fetchQueryQueue("HR"), api.fetchQueryQueue("L&D")]);
            setQueries([...hr, ...ln]);
          }
        }
      }
      if (mod === "m3") {
        if (role === "employee") {
          setEngagement(await api.fetchOpenEngagementSurveys());
        } else if (role === "hr") {
          setEngagement(await api.fetchEngagementSurveys());
        }
      }
    } catch (err) {
      notify("Failed to load data. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mod, role]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Module 1: Onboarding callbacks ── */
  const submitSurvey = async (id, answers, feedback) => {
    try {
      const res = await api.submitOnboardingSurvey(id, answers, feedback);
      setSurveys((p) => p.map((s) => (s.id === id ? { ...s, status: "submitted", answers, feedback } : s)));
      notify(`Survey submitted (${one(avg(answers))}/10). Email sent to ${NOTIFY_LIST}.`);
    } catch (err) {
      notify("Failed to submit survey. Please try again.");
      console.error(err);
    }
  };

  const sendSurvey = async (joinerName, due) => {
    try {
      const res = await api.sendOnboardingSurvey([joinerName], due, NOTIFY_LIST);
      notify(`Survey sent to ${joinerName}. Reminder scheduled if not submitted by ${due}.`);
      fetchData();
    } catch (err) {
      notify("Failed to send survey. Please try again.");
      console.error(err);
    }
  };

  /* ── Module 2: Query callbacks ── */
  const raiseQuery = async ({ team, category, subject, desc, priority }) => {
    try {
      const res = await api.raiseQuery(team, category, subject, desc, priority);
      setQueries((p) => [
        { ...res, employee: currentUser.name, dept: currentUser.dept, raisedOn: res.raisedOn || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), thread: res.thread || [] },
        ...p,
      ]);
      notify(`${res.id} raised and routed to the ${team} team.`);
    } catch (err) {
      notify("Failed to raise query. Please try again.");
      console.error(err);
    }
  };

  const replyQuery = async (id, text) => {
    try {
      const res = await api.replyQuery(id, text);
      setQueries((p) => p.map((q) => (q.id === id ? { ...q, status: res.status ?? q.status, thread: res.thread ?? q.thread ?? [] } : q)));
      notify("Reply sent. Employee notified.");
    } catch (err) {
      notify("Failed to send reply. Please try again.");
      console.error(err);
    }
  };

  const resolveQuery = async (id) => {
    try {
      const res = await api.resolveQuery(id);
      setQueries((p) => p.map((q) => (q.id === id ? { ...q, status: res.status } : q)));
      notify("Marked resolved. Support survey sent to employee.");
    } catch (err) {
      notify("Failed to resolve query. Please try again.");
      console.error(err);
    }
  };

  const rateQuery = async (id, ratings, comment) => {
    try {
      const res = await api.rateQuery(id, ratings, comment);
      setQueries((p) => p.map((q) => (q.id === id ? { ...q, status: "closed", ratings, ratingComment: comment } : q)));
      const a = avg(ratings);
      notify(`Support survey submitted (${one(a)}/10). ${a < 6 ? "Flagged to Admin for review." : "Query closed."}`);
    } catch (err) {
      notify("Failed to submit rating. Please try again.");
      console.error(err);
    }
  };

  const reopenQuery = async (id, reason = "") => {
    try {
      const res = await api.reopenQuery(id, reason);
      setQueries((p) => p.map((q) => (q.id === id ? { ...q, ...res, status: "open" } : q)));
      notify("Query reopened. It will appear in the resolver queue.");
    } catch (err) {
      notify("Failed to reopen query.");
      console.error(err);
    }
  };

  /* ── Module 3: Engagement callbacks ── */
  const submitEngagement = async (id, months, rest, feedback, anonymous) => {
    try {
      await api.submitEngagementSurvey(id, months, rest, feedback, anonymous);
      setEngagement((p) => p.map((s) => (
        s.id === id ? { ...s, responses: [...(s.responses || []), { by: currentUser.name, anonymous, months, rest, feedback }] } : s
      )));
      notify(`Engagement survey submitted (${one(avg([...months, ...rest]))}/10).`);
    } catch (err) {
      notify("Failed to submit survey. Please try again.");
      console.error(err);
    }
  };

  const rolloutEngagement = async ({ quarter, months, closes, recipients = [] }) => {
    try {
      const res = await api.rolloutEngagement(quarter, months, closes, NOTIFY_LIST, recipients);
      setEngagement((p) => [{ ...res, responses: [] }, ...p]);
      notify(`"${quarter}" rolled out to ${recipients.length || "all"} employee(s).`);
    } catch (err) {
      notify("Failed to roll out survey. Please try again.");
      console.error(err);
    }
  };

  /* ── UI config ── */
  const modules = [
    { id: "m1", num: "01", label: "Onboarding Experience" },
    { id: "m2", num: "02", label: "Query & HR Support" },
    { id: "m3", num: "03", label: "Employee Engagement" },
  ];

  const allRoles = [
    { id: "employee", label: "Employee", hint: `Signed in as ${currentUser.name} · ${currentUser.dept}` },
    { id: "hr", label: "HR / L&D", hint: "Rollout, resolver queue and scores" },
    { id: "admin", label: "Admin", hint: "Read-only oversight and org-wide metrics" },
  ];

  const isAdmin = authUser?.userRole === 1;
  const feedbackResolverTeam = authUser?.feedbackresolverteam;
  const isHrUser = feedbackResolverTeam === "HR" || feedbackResolverTeam === "L_D";

  const roles = allRoles.filter((r) => {
    if (r.id === "employee") return !isAdmin && !isHrUser;
    if (r.id === "admin") return isAdmin;
    if (r.id === "hr") return isHrUser;
    return false;
  });

  /* ── Set default role based on user permissions ── */
  useEffect(() => {
    if (authUser && roles.length > 0) {
      setRole((prev) => {
        if (prev && roles.some((r) => r.id === prev)) return prev;
        return roles[0].id;
      });
    }
  }, [authUser]);

  const body = () => {
    if (loading || !role) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-gray-400">Loading…</div>
        </div>
      );
    }

    if (mod === "m1") {
      if (role === "employee") return <OnboardingEmployee surveys={surveys} currentUser={currentUser} onSubmit={submitSurvey} />;
      if (role === "hr") return <OnboardingHR surveys={surveys} notifyList={NOTIFY_LIST} onSend={sendSurvey} />;
      return <OnboardingAdmin surveys={surveys} />;
    }
    if (mod === "m2") {
      if (role === "employee") return <QueryEmployee queries={queries} currentUser={currentUser} onRaise={raiseQuery} onRate={rateQuery} onReopen={reopenQuery} onReply={replyQuery} />;
      if (role === "hr") return <QueryResolver queries={queries} defaultTeam={feedbackResolverTeam === "L_D" ? "L&D" : feedbackResolverTeam} onReply={replyQuery} onResolve={resolveQuery} />;
      if (role === "admin") return <QueryAdmin queries={queries} admin={queryAdmin} />;
    }
    if (role === "employee") return <EngagementEmployee surveys={engagement} currentUser={currentUser} onSubmit={submitEngagement} />;
    if (role === "hr") return <EngagementHR surveys={engagement} headcount={142} notifyList={NOTIFY_LIST} onRollout={rolloutEngagement} />;
    return <EngagementAdmin surveys={engagement} />;
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">

      <div className="bg-white px-5 overflow-x-auto">
        <Tabs
          selectedKey={mod}
          onSelectionChange={(k) => setMod(String(k))}
          variant="light"
          aria-label="HR Modules"
        >
          {modules.map((m) => (
            <Tab key={m.id} title={<span className=" mr-1">{m.label}</span>} />
          ))}
        </Tabs>
      </div>

      <div className="bg-white px-5 py-2.5 flex items-center gap-3 flex-wrap">
        {/* <span className=" text-[10px] uppercase tracking-widest text-primary">Viewing as</span> */}
        {roles.length > 1 && (
          <Tabs
            selectedKey={role}
            onSelectionChange={(k) => setRole(String(k))}
            variant="light"
            aria-label="Role selector"
            size="sm"
          >
            {roles.map((r) => (
              <Tab key={r.id} title={r.label} />
            ))}
          </Tabs>
        )}
        {/* {role && <span className=" text-[10px] text-primary">{roles.find((r) => r.id === role)?.hint}</span>} */}
        {/* <span className="ml-auto">
          <Button
            size="sm"
            variant="bordered"
            isDisabled={pushBusy}
            onPress={async () => {
              setPushBusy(true);
              try {
                if (pushActive) {
                  await unsubscribeFromPush();
                  setPushActive(false);
                  notify("Push notifications turned off.");
                } else {
                  await subscribeToPush();
                  setPushActive(true);
                  notify("Push notifications enabled.");
                }
              } catch (err) {
                console.error(err);
                notify("Could not enable notifications: " + (err?.message || "unsupported browser"));
              } finally {
                setPushBusy(false);
              }
            }}
          >
            {pushBusy ? "…" : (pushActive ? "Notifications on" : "Enable notifications")}
          </Button>
        </span> */}
      </div>

      <div className="max-w-5xl mx-auto px-5 py-6 pb-24">{body()}</div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-30 w-11/12 max-w-md" style={{ transform: "translateX(-50%)" }}>
          <Card shadow="lg" className="bg-gray-900">
            <CardBody className="p-3 flex items-start gap-2.5">
              <Mail size={15} className="text-primary-400 mt-0.5 shrink-0" />
              <div className=" text-white flex-1">{toast}</div>
              <button onClick={() => setToast(null)} className="text-gray-500 hover:text-white"><X size={14} /></button>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
