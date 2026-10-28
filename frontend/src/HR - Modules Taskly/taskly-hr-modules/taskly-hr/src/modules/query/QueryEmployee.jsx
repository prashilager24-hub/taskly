import { useState } from "react";
import { Plus, Send, Star, AlertTriangle, LifeBuoy, GraduationCap, MessageSquareText } from "lucide-react";
import { Button, Input, Textarea, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "../../../../../../components/ui";
import {
  Screen, Field, BackLink, Scale, ScaleLegend, Section, Pill,
  Empty, ContextBar, Thread, OpenPoint, THead,
} from "../../components/ui";
import { QUERY_QUESTIONS } from "../../lib/questions";
import { avg, one, queryScore } from "../../lib/metrics";

const STATUS = {
  open: { label: "Open", bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  in_progress: { label: "In progress", bar: "bg-sky-500", text: "text-sky-700 dark:text-sky-400" },
  resolved: { label: "Awaiting your rating", bar: "bg-brand-600", text: "text-brand-600" },
  closed: { label: "Closed", bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
};

const CATEGORIES = {
  HR: ["Payroll", "Leave", "Policy/process", "Benefits", "Attendance", "Other"],
  "L&D": ["Training", "Certification", "Nomination", "Other"],
};

export default function QueryEmployee({ queries = [], currentUser, onRaise, onRate, onReopen, onReply }) {
  const [view, setView] = useState("list");
  const [filter, setFilter] = useState("all");
  const [team, setTeam] = useState("HR");
  const [category, setCategory] = useState("Payroll");
  const [subject, setSubject] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("Normal");

  const [rateId, setRateId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [ratings, setRatings] = useState({});
  const [comment, setComment] = useState("");
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reply, setReply] = useState("");

  const mine = queries.filter((q) => q.employee === currentUser.name);
  const target = queries.find((q) => q.id === rateId);
  const opened = queries.find((q) => q.id === openId);
  const qs = target ? QUERY_QUESTIONS(target.team) : [];
  const complete = qs.length > 0 && qs.every((_, i) => ratings[i]);
  const runningAvg = complete ? avg(qs.map((_, i) => ratings[i])) : null;

  if (target) {
    return (
      <Screen id="2.3" title={`${target.team} Query / Support Survey`} sub="Sent when the resolver marks the query resolved">
        <BackLink onClick={() => setRateId(null)} />
        <ContextBar
          title={`${target.id} · ${target.subject}`}
          meta={`Routed to ${target.team} · Raised ${target.raisedOn} · Resolved`}
        />
        <Thread messages={target.thread} />

        <ScaleLegend />
        <Section>Rate the support you received</Section>
        {qs.map((q, i) => (
          <Field key={i} label={`${i + 1}. ${q}`}>
            <Scale compact value={ratings[i]} onChange={(n) => setRatings({ ...ratings, [i]: n })} />
          </Field>
        ))}
        <Field label="Any comments on the resolution?">
          <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional…" variant="bordered" />
        </Field>

        {runningAvg !== null && runningAvg < 5 && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2.5 mb-3.5">
            <AlertTriangle size={14} /> Not satisfied? You can reopen this query instead of closing it.
          </div>
        )}

        <div className="flex gap-2.5">
          <Button
            size="sm"
            color="primary"
            className="text-white"
            isDisabled={!complete}
            startContent={<Star size={14} />}
            onPress={() => {
              onRate(target.id, qs.map((_, i) => ratings[i]), comment);
              setRateId(null); setRatings({}); setComment("");
            }}
          >
            Submit &amp; close query
          </Button>
          {onReopen && <Button size="sm" variant="flat" onPress={() => { setReopenReason("Issue still persists"); setReopenOpen(true); }}>Reopen query</Button>}
        </div>

        <OpenPoint>
          Six ratings per ticket is heavy. Q1–Q5 measure the {target.team} service in general; only Q6 is about this
          specific query. Pending decision: full set per ticket, or Q6 per ticket plus the full set quarterly.
        </OpenPoint>

        <Modal isOpen={reopenOpen} onClose={() => setReopenOpen(false)} size="sm">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">Reopen {target.id}</ModalHeader>
                <ModalBody>
                  <Input
                    label="Reason (optional)"
                    placeholder="Issue still persists"
                    value={reopenReason}
                    onValueChange={setReopenReason}
                    variant="bordered"
                  />
                </ModalBody>
                <ModalFooter>
                  <Button variant="flat" onPress={onClose}>Cancel</Button>
                  <Button
                    color="primary"
                    className="text-white"
                    onPress={() => {
                      onReopen(target.id, reopenReason.trim());
                      setReopenReason("");
                      onClose();
                    }}
                  >
                    Reopen
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </Screen>
    );
  }

  const counts = {
    all: mine.length,
    open: mine.filter((q) => q.status === "open" || q.status === "in_progress").length,
    resolved: mine.filter((q) => q.status === "resolved").length,
    closed: mine.filter((q) => q.status === "closed").length,
  };
  const shown = mine.filter((q) =>
    filter === "all" ? true
      : filter === "open" ? q.status === "open" || q.status === "in_progress"
        : q.status === filter);
  const submit = () => {
    onRaise({ team, category, subject, desc, priority });
    setSubject(""); setDesc(""); setView("list");
  };
  const startAsk = (t) => { setTeam(t); setCategory(CATEGORIES[t][0]); setOpenId(null); setView("form"); };

  return (
    <div className="flex flex-col gap-6">
      {/* Who to ask */}
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { t: "HR", title: "Ask HR", hint: "Payroll, leave, policy, benefits, attendance", Icon: LifeBuoy },
          { t: "L&D", title: "Ask Learning & Development", hint: "Training, certification, nominations, upskilling", Icon: GraduationCap },
        ].map(({ t, title, hint, Icon }) => (
          <button
            key={t}
            type="button"
            onClick={() => startAsk(t)}
            className={`group flex items-center gap-4 border p-5 text-left transition-colors focus-ring ${view === "form" && team === t ? "border-brand-600 bg-brand-50 dark:bg-brand-500/10" : "border-ink-200 bg-white hover:border-brand-500 dark:border-white/10 dark:bg-ink-900"}`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-ink-900 text-white group-hover:bg-brand-600 dark:bg-white/10"><Icon size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-ink-900 dark:text-white">{title}</span>
              <span className="block text-xs text-ink-500 dark:text-ink-400">{hint}</span>
            </span>
            <Plus size={18} className="shrink-0 text-brand-600" />
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        {/* Inbox */}
        <section className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
          <header className="border-b border-ink-200 px-4 py-3 dark:border-white/10">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">My queries</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[["all", "All"], ["open", "Open"], ["resolved", "To rate"], ["closed", "Closed"]].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide focus-ring ${filter === k ? "bg-ink-900 text-white dark:bg-white dark:text-ink-900" : "bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-white/10 dark:text-ink-300"}`}
                >
                  {label} <span className="opacity-60">{counts[k]}</span>
                </button>
              ))}
            </div>
          </header>
          <ul className="max-h-[560px] divide-y divide-ink-100 overflow-y-auto dark:divide-white/5">
            {shown.map((q) => {
              const st = STATUS[q.status] ?? STATUS.open;
              const on = openId === q.id && view === "list";
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => { setOpenId(q.id); setView("list"); }}
                    className={`relative flex w-full flex-col gap-1.5 py-3.5 pl-5 pr-4 text-left transition-colors focus-ring ${on ? "bg-ink-50 dark:bg-white/5" : "hover:bg-ink-50/70 dark:hover:bg-white/[0.03]"}`}
                  >
                    <span className={`absolute inset-y-0 left-0 w-1 ${st.bar}`} aria-hidden />
                    <span className="flex items-center justify-between gap-3 text-[11px] text-ink-500 dark:text-ink-400">
                      <span className="font-secondary">{q.id} · {q.team}</span>
                      <span>{q.raisedOn}</span>
                    </span>
                    <span className="text-[13.5px] font-semibold leading-snug text-ink-900 dark:text-white">{q.subject}</span>
                    <span className={`text-[11px] font-bold uppercase tracking-wide ${st.text}`}>
                      {st.label}{q.status === "closed" ? ` · ${one(q.supportScore ?? queryScore(q))}/10` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && (
              <li className="px-4 py-12 text-center text-sm text-ink-500 dark:text-ink-400">
                {mine.length === 0 ? "Nothing raised yet. Ask HR or L&D above." : "No queries in this view."}
              </li>
            )}
          </ul>
        </section>

        {/* Work area: new query, conversation, or a prompt */}
        <section className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
          {view === "form" ? (
            <div className="flex flex-col gap-5 p-6">
              <div>
                <span className="eyebrow">New query</span>
                <h2 className="mt-1 text-lg font-bold text-ink-900 dark:text-white">Ask the {team === "HR" ? "HR" : "Learning & Development"} team</h2>
              </div>
              <Field label="Category">
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES[team].map((c) => (
                    <button key={c} type="button" onClick={() => setCategory(c)} className={`border px-3 py-1.5 text-xs font-semibold focus-ring ${category === c ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 text-ink-700 hover:border-brand-500 dark:border-white/20 dark:text-ink-200"}`}>{c}</button>
                  ))}
                </div>
              </Field>
              <Field label="Subject">
                <Input variant="bordered" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="One line summary" />
              </Field>
              <Field label="Describe your query">
                <Textarea variant="bordered" minRows={5} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Give the team what they need to answer in one go" />
              </Field>
              <Field label="How urgent is it?">
                <div className="flex gap-1.5">
                  {["Low", "Normal", "High"].map((p) => (
                    <button key={p} type="button" onClick={() => setPriority(p)} className={`border px-4 py-1.5 text-xs font-semibold focus-ring ${priority === p ? "border-ink-900 bg-ink-900 text-white dark:border-white dark:bg-white dark:text-ink-900" : "border-ink-300 text-ink-700 hover:border-ink-500 dark:border-white/20 dark:text-ink-200"}`}>{p}</button>
                  ))}
                </div>
              </Field>
              <div className="flex gap-2.5">
                <Button color="primary" isDisabled={!subject.trim() || !desc.trim()} startContent={<Send size={14} />} onPress={submit}>Send query</Button>
                <Button variant="bordered" onPress={() => setView("list")}>Cancel</Button>
              </div>
            </div>
          ) : opened ? (
            <div className="flex flex-col">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200 p-5 dark:border-white/10">
                <div className="min-w-0">
                  <span className="eyebrow">{opened.id} · {opened.team} · {opened.category} · {opened.priority} priority</span>
                  <h2 className="mt-1 text-lg font-bold leading-snug text-ink-900 dark:text-white">{opened.subject}</h2>
                  <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Raised {opened.raisedOn}</p>
                </div>
                <span className={`shrink-0 border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${(STATUS[opened.status] ?? STATUS.open).text} border-current`}>
                  {(STATUS[opened.status] ?? STATUS.open).label}
                </span>
              </header>
              <div className="p-5"><Thread messages={opened.thread} /></div>
              <footer className="border-t border-ink-200 p-5 dark:border-white/10">
                {opened.status === "open" || opened.status === "in_progress" ? (
                  <div className="flex flex-col gap-3">
                    <Textarea variant="bordered" minRows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Add a follow-up for the team…" aria-label="Reply" />
                    <div><Button color="primary" isDisabled={!reply.trim()} startContent={<Send size={14} />} onPress={() => { if (onReply) onReply(opened.id, reply); setReply(""); }}>Send reply</Button></div>
                  </div>
                ) : opened.status === "resolved" ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ink-600 dark:text-ink-300">The team marked this resolved. Rate the support to close it.</p>
                    <Button color="primary" startContent={<Star size={14} />} onPress={() => { setRateId(opened.id); }}>Rate this resolution</Button>
                  </div>
                ) : (
                  <p className="text-sm text-ink-500 dark:text-ink-400">This query is closed.</p>
                )}
              </footer>
            </div>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <MessageSquareText size={28} className="text-ink-300 dark:text-ink-600" />
              <p className="text-sm font-semibold text-ink-900 dark:text-white">Pick a query to read the conversation</p>
              <p className="max-w-sm text-xs text-ink-500 dark:text-ink-400">Or start a new one with HR or Learning &amp; Development using the cards above.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
