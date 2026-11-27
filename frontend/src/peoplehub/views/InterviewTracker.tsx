import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { CalendarDays, Clock, Users, Ticket, FileText, ExternalLink, Mail, Phone, Briefcase, MapPin, Link2, Download, X, Activity, CalendarCheck, Upload, Loader2, UserPlus } from "lucide-react";
import { toast, cn, NativeSelect } from "@/peoplehub/ui";
import { PageHeader, StatGrid } from "@/peoplehub/blocks/page";
import { DataTable } from "@/peoplehub/blocks/data-table";
import type { Column, Row } from "@/peoplehub/modules/types";

type LogEntry = { id: number; action: string; details: string | null; actor: string; createdAt: string };
type AllLogEntry = { id: number; entityType: string; entityId: number; action: string; details: string | null; actor: string; createdAt: string };

function ActivityLog({ entityId, refreshKey }: { entityId: number; refreshKey: number }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  useEffect(() => {
    axios.get(`/t2.0/authentificationUtilization/applications/${entityId}/logs`)
      .then(r => setLogs((r.data as { data: LogEntry[] }).data ?? []))
      .catch(() => {});
  }, [entityId, refreshKey]);

  if (!logs.length) return (
    <div className="flex items-center gap-2 py-3 text-xs text-ink-400">
      <Activity className="size-3.5" /> No activity yet
    </div>
  );

  return (
    <div className="space-y-0">
      {logs.map((l, i) => (
        <div key={l.id} className="flex gap-3 py-3 border-b border-ink-100 dark:border-white/[0.06] last:border-0">
          <div className="flex flex-col items-center pt-1">
            <span className="size-2 rounded-full bg-brand-500 shrink-0" />
            {i < logs.length - 1 && <span className="w-px flex-1 mt-1 bg-ink-200 dark:bg-white/[0.08]" />}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-xs font-semibold text-ink-900 dark:text-white">{l.action}</p>
            {l.details && <p className="text-xs text-ink-500 mt-0.5">{l.details}</p>}
            <p className="text-[10px] text-ink-400 mt-1">{l.actor} · {new Date(l.createdAt).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const BASE = "/t2.0/authentificationUtilization/applications";
const FILES_BASE = "http://localhost:8080";

const STAGES = [
  { value: "NEW",         label: "New",         dot: "#38bdf8", ring: "ring-sky-400",     pill: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300" },
  { value: "SCREENING",   label: "Screening",   dot: "#fb923c", ring: "ring-orange-400",  pill: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" },
  { value: "SHORTLISTED", label: "Shortlisted", dot: "#34d399", ring: "ring-emerald-400", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  { value: "REJECTED",    label: "Rejected",    dot: "#f87171", ring: "ring-rose-400",    pill: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" },
  { value: "HIRED",       label: "Hired",       dot: "#a78bfa", ring: "ring-violet-400",  pill: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" },
];

function stageFor(value: string) {
  return STAGES.find(s => s.value === value) ?? STAGES[0];
}

const COLUMNS: Column[] = [
  { key: "candidate", label: "Candidate" },
  { key: "role", label: "Role" },
  { key: "company", label: "Current Company", minor: true },
  { key: "experience", label: "Experience", minor: true },
  { key: "noticePeriod", label: "Notice Period", minor: true },
  { key: "appliedAt", label: "Applied", type: "date", minor: true },
  { key: "status", label: "Status", type: "status" },
];

type App = Record<string, unknown>;

function toRow(a: App): Row {
  return {
    id: String(a.id),
    candidate: a.fullName,
    role: a.roleTitle,
    experience: a.totalExperience ?? "—",
    noticePeriod: a.noticePeriod ?? "—",
    company: a.currentCompany ?? "—",
    appliedAt: a.appliedAt,
    status: stageFor(String(a.status ?? "NEW")).label,
    internalNotes: a.internalNotes ?? "",
    // extra export-only columns (CDN URLs)
    resumeUrl: a.resumePath ?? "",
    jdUrl: a.jdUrl ?? "",
  };
}

/* ── Small helpers ─────────────────────────────────────────────────────────── */

function Avatar({ name }: { name: string }) {
  const [a, b] = String(name).trim().split(" ");
  return (
    <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-ink-800 ring-4 ring-white/10 text-2xl font-black text-white select-none">
      {(a?.[0] ?? "").toUpperCase()}{(b?.[0] ?? "").toUpperCase()}
    </div>
  );
}

function Field({ icon: Icon, label, value, link }: { icon: React.ElementType; label: string; value?: string | null; link?: string }) {
  if (!value || value === "—" || value === "null" || value === "undefined" || !value.trim()) return null;
  return (
    <div className="flex gap-3 py-3 border-b border-ink-100 dark:border-white/[0.06] last:border-0">
      <Icon className="size-4 mt-0.5 shrink-0 text-ink-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-0.5">{label}</p>
        {link ? (
          <a href={link} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline break-all">
            {value}<ExternalLink className="size-3 shrink-0" />
          </a>
        ) : (
          <p className="text-sm font-semibold text-ink-900 dark:text-white">{value}</p>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-2 px-4">{title}</p>
      <div className="bg-white dark:bg-ink-800 border border-ink-200 dark:border-white/[0.08] px-4">
        {children}
      </div>
    </div>
  );
}

function ResumeViewer({ path }: { path?: string | null }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const fileUrl = path ? (path.startsWith("http") ? path : `${FILES_BASE}${path}`) : null;
  const isPdf = path ? path.toLowerCase().endsWith(".pdf") : false;

  useEffect(() => {
    if (!fileUrl || !isPdf) return;
    setBlobUrl(null); setFailed(false); setHidden(false);
    setLoading(true);
    fetch(fileUrl)
      .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
      .then(b => setBlobUrl(URL.createObjectURL(b)))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [fileUrl]);

  if (!fileUrl) return (
    <div className="flex items-center gap-2 text-sm text-ink-400 py-1">
      <FileText className="size-4" /> No resume uploaded
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <a href={fileUrl} download
          className="inline-flex items-center gap-1.5 bg-ink-900 dark:bg-white text-white dark:text-ink-900 px-3 py-1.5 text-xs font-bold hover:opacity-80 transition-opacity">
          <Download className="size-3.5" /> Download
        </a>
        <a href={fileUrl} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 border border-ink-200 dark:border-white/15 px-3 py-1.5 text-xs font-bold text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
          <ExternalLink className="size-3.5" /> Open
        </a>
        {blobUrl && (
          <button onClick={() => setHidden(h => !h)}
            className="inline-flex items-center gap-1.5 border border-ink-200 dark:border-white/15 px-3 py-1.5 text-xs font-bold text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
            {hidden ? "Show preview" : "Hide preview"}
          </button>
        )}
      </div>
      {loading && <p className="text-xs text-ink-400 py-1">Loading preview…</p>}
      {!loading && failed && <p className="text-xs text-ink-400 py-1">Preview unavailable — use Download or Open.</p>}
      {!loading && !failed && !isPdf && (
        <p className="text-xs text-ink-400 py-1">Preview not available for this file type. <a href={fileUrl} target="_blank" rel="noreferrer" className="underline text-brand-600">Open file</a></p>
      )}
      {blobUrl && !hidden && (
        <object data={blobUrl} type="application/pdf" className="w-full border border-ink-200 dark:border-white/10 rounded" style={{ height: 500 }}>
          <p className="p-4 text-sm text-ink-500">Your browser cannot preview PDFs. <a href={blobUrl} target="_blank" rel="noreferrer" className="underline text-brand-600">Open file</a></p>
        </object>
      )}
    </div>
  );
}

/* ── Tabs ──────────────────────────────────────────────────────────────────── */

function TabBar({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex shrink-0 border-b border-ink-200 dark:border-white/[0.08] bg-white dark:bg-ink-800">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={cn(
            "px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors",
            active === t.key
              ? "border-b-2 border-brand-500 text-ink-900 dark:text-white"
              : "text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
          )}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ── Drawer ────────────────────────────────────────────────────────────────── */

const DRAWER_TABS = [
  { key: "details", label: "Details" },
  { key: "edit", label: "Edit" },
  { key: "rounds", label: "Interview Rounds" },
  { key: "activity", label: "Activity" },
];

const INTERVIEW_TYPES = ["Video Call", "Phone Call", "In-Person"];

function TimePicker12h({ onChange }: { value: string; onChange: (v: string) => void }) {
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");

  function emit(h: string, m: string, ap: "AM" | "PM") {
    onChange(`${h}:${m} ${ap}`);
  }

  return (
    <div className="flex items-center gap-1 w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 px-3 py-2 text-sm rounded focus-within:ring-2 focus-within:ring-brand-500">
      <select value={hour} onChange={e => { setHour(e.target.value); emit(e.target.value, minute, ampm); }}
        className="bg-transparent text-ink-900 dark:text-white focus:outline-none cursor-pointer">
        {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-ink-400 font-bold">:</span>
      <select value={minute} onChange={e => { setMinute(e.target.value); emit(hour, e.target.value, ampm); }}
        className="bg-transparent text-ink-900 dark:text-white focus:outline-none cursor-pointer">
        {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")).map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <div className="flex gap-0.5 ml-auto">
        {(["AM", "PM"] as const).map(ap => (
          <button key={ap} type="button" onClick={() => { setAmpm(ap); emit(hour, minute, ap); }}
            className={cn("px-2 py-0.5 text-xs font-bold rounded transition-colors",
              ampm === ap ? "bg-brand-600 text-white" : "text-ink-400 hover:text-ink-900 dark:hover:text-white")}>
            {ap}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScheduleForm({ app, onDone }: { app: App; onDone: (updatedStatus: string) => void }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00 AM");
  const [type, setType] = useState("Video Call");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setBusy(true);
    try {
      await axios.post(`${BASE}/${app.id}/schedule-interview`, {
        interviewDate: new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),
        interviewTime: time,
        interviewType: type,
        meetingLink: link || undefined,
        notes: notes || undefined,
      });
      toast.success("Interview scheduled — candidate notified by email");
      onDone("SCREENING");
    } catch {
      toast.error("Failed to schedule interview");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 px-6 py-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Date *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required
            className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Time *</label>
          <TimePicker12h value={time} onChange={setTime} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Interview Type *</label>
        <div className="flex gap-2">
          {INTERVIEW_TYPES.map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={cn("px-3 py-1.5 text-xs font-bold rounded border transition-all",
                type === t
                  ? "bg-brand-600 text-white border-brand-600"
                  : "border-ink-200 dark:border-white/10 text-ink-500 dark:text-ink-400 hover:border-ink-400")}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {type !== "Phone Call" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">
            {type === "Video Call" ? "Meeting Link" : "Location / Address"}
          </label>
          <input type="text" value={link} onChange={e => setLink(e.target.value)}
            placeholder={type === "Video Call" ? "https://meet.google.com/..." : "Office address or room"}
            className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Notes for Candidate</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Any preparation tips or instructions…"
          className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={busy || !date || !time}
          className="inline-flex items-center gap-2 bg-brand-600 text-white text-xs font-bold px-4 py-2 rounded hover:bg-brand-700 transition-colors disabled:opacity-50">
          <CalendarCheck className="size-3.5" />
          {busy ? "Scheduling…" : "Confirm & Send Email"}
        </button>
        <p className="text-xs text-ink-400">An invite email will be sent to the candidate</p>
      </div>
    </form>
  );
}

/* ── Interview Rounds ──────────────────────────────────────────────────────── */

type Round = {
  id?: number;
  roundNumber: number;
  interviewDate: string;
  interviewerName: string;
  interviewLink: string;
  status: string;
  feedback: string;
};

const ROUND_STATUSES = ["Pending", "Cleared", "Rejected", "On Hold"];

function RoundStatusPill({ status }: { status: string }) {
  const cls =
    status === "Cleared"  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" :
    status === "Rejected" ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" :
    status === "On Hold"  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" :
                            "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300";
  return <span className={cn("px-2.5 py-0.5 text-xs font-bold rounded-full", cls)}>{status}</span>;
}

function RoundCard({ appId, round, onSaved }: { appId: number; round: Round; onSaved: (rounds: Round[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(round.interviewDate ?? "");
  const [interviewer, setInterviewer] = useState(round.interviewerName ?? "");
  const [link, setLink] = useState(round.interviewLink ?? "");
  const [status, setStatus] = useState(round.status ?? "Pending");
  const [feedback, setFeedback] = useState(round.feedback ?? "");
  const [saving, setSaving] = useState(false);
  const isEmpty = !round.interviewDate && !round.interviewerName && !round.feedback;

  async function save() {
    setSaving(true);
    try {
      const res = await axios.put(`${BASE}/${appId}/rounds/${round.roundNumber}`, {
        interviewDate: date, interviewerName: interviewer,
        interviewLink: link, status, feedback,
      });
      onSaved((res.data as { data: Round[] }).data);
      setEditing(false);
      toast.success(`Round ${round.roundNumber} saved.`);
    } catch { toast.error("Failed to save round."); }
    finally { setSaving(false); }
  }

  return (
    <div className="border border-ink-200 dark:border-white/[0.08] bg-white dark:bg-ink-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 dark:border-white/[0.06] bg-ink-50 dark:bg-ink-900/50">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-500">Round {round.roundNumber}</span>
        <div className="flex items-center gap-2">
          <RoundStatusPill status={status} />
          <button onClick={() => setEditing(e => !e)}
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline">
            {editing ? "Cancel" : (isEmpty ? "+ Add" : "Edit")}
          </button>
        </div>
      </div>

      {!editing ? (
        <div className="px-4 py-3 space-y-2">
          {isEmpty ? (
            <p className="text-xs text-ink-400 italic">No details yet — click Add to fill in.</p>
          ) : (
            <>
              {round.interviewDate && (
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="size-3.5 text-ink-400 shrink-0" />
                  <span className="text-ink-700 dark:text-ink-200">{round.interviewDate}</span>
                </div>
              )}
              {round.interviewerName && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="size-3.5 text-ink-400 shrink-0" />
                  <span className="text-ink-700 dark:text-ink-200">{round.interviewerName}</span>
                </div>
              )}
              {round.interviewLink && (
                <div className="flex items-center gap-2 text-sm">
                  <Link2 className="size-3.5 text-ink-400 shrink-0" />
                  <a href={round.interviewLink} target="_blank" rel="noreferrer"
                    className="text-brand-600 dark:text-brand-400 hover:underline truncate">{round.interviewLink}</a>
                </div>
              )}
              {round.feedback && (
                <div className="pt-1 border-t border-ink-100 dark:border-white/[0.06] mt-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1">Feedback</p>
                  <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed whitespace-pre-wrap">{round.feedback}</p>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-2 py-1.5 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Status</label>
              <NativeSelect value={status} onChange={e => setStatus(e.target.value)} aria-label="Round status">
                {ROUND_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Interviewer</label>
            <input value={interviewer} onChange={e => setInterviewer(e.target.value)}
              className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-2 py-1.5 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Meeting Link / Location</label>
            <input value={link} onChange={e => setLink(e.target.value)}
              className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-2 py-1.5 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Feedback / Notes</label>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
              className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-2 py-1.5 text-sm rounded resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-xs font-bold px-4 py-2 rounded hover:bg-brand-700 transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {saving ? "Saving…" : "Save Round"}
          </button>
        </div>
      )}
    </div>
  );
}

function InterviewRoundsTab({ appId }: { appId: number }) {
  const [rounds, setRounds] = useState<Round[]>([]);

  useEffect(() => {
    axios.get(`${BASE}/${appId}/rounds`)
      .then(r => setRounds((r.data as { data: Round[] }).data ?? []))
      .catch(() => {});
  }, [appId]);

  const filled: Round[] = [1, 2, 3].map(n => {
    const existing = rounds.find(r => r.roundNumber === n);
    return existing ?? { roundNumber: n, interviewDate: "", interviewerName: "", interviewLink: "", status: "Pending", feedback: "" };
  });

  return (
    <div className="px-6 py-5 space-y-4">
      {filled.map(r => (
        <RoundCard key={r.roundNumber} appId={appId} round={r} onSaved={setRounds} />
      ))}
    </div>
  );
}

const SOURCE_OPTIONS_TRACKER = ["Job Portal", "LinkedIn", "Referral", "Database", "Walk-in candidate", "Campus"];

function AppDrawer({ app, onClose, onMove, onScheduled, onUpdated }: { app: App | null; onClose: () => void; onMove: (id: number, s: string, note?: string) => Promise<void>; onScheduled?: (id: number) => void; onUpdated?: (updated: App) => void }) {
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("NEW");
  const [tab, setTab] = useState("details");
  const [logRefresh, setLogRefresh] = useState(0);
  const [scheduling, setScheduling] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [moveNote, setMoveNote] = useState("");
  // edit form
  const [ef, setEf] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (app) {
      setStatus(String(app.status ?? "NEW"));
      setTab("details");
      setLogRefresh(k => k + 1);
      setScheduling(false);
      setMoveTarget(null);
      setMoveNote("");
      setEf({
        fullName: String(app.fullName ?? ""),
        roleTitle: String(app.roleTitle ?? ""),
        email: String(app.email ?? ""),
        phone: String(app.phone ?? ""),
        currentCompany: String(app.currentCompany ?? ""),
        currentDesignation: String(app.currentDesignation ?? ""),
        totalExperience: String(app.totalExperience ?? ""),
        relevantExperience: String(app.relevantExperience ?? ""),
        currentCtc: String(app.currentCtc ?? ""),
        expectedCtc: String(app.expectedCtc ?? ""),
        noticePeriod: String(app.noticePeriod ?? ""),
        currentLocation: String(app.currentLocation ?? ""),
        linkedinUrl: String(app.linkedinUrl ?? ""),
        source: String(app.source ?? ""),
        sourcedBy: String(app.sourcedBy ?? ""),
        internalNotes: String(app.internalNotes ?? ""),
      });
    }
  }, [app]);

  async function saveEdit() {
    if (!app) return;
    setSavingEdit(true);
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(ef)) { if (v !== undefined) payload[k] = v; }
      const res = await axios.patch(`${BASE}/${app.id}`, payload);
      const updated = (res.data as { data: App }).data;
      onUpdated?.(updated);
      toast.success("Applicant updated.");
      setTab("details");
    } catch {
      toast.error("Failed to save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  function editField(name: string, value: string) {
    setEf(prev => ({ ...prev, [name]: value }));
  }

  async function move(s: string) {
    if (!app || busy) return;
    setMoveTarget(s);
    setMoveNote("");
  }

  async function confirmMove() {
    if (!app || !moveTarget) return;
    setBusy(moveTarget);
    await onMove(Number(app.id), moveTarget, moveNote.trim() || undefined);
    setStatus(moveTarget);
    setLogRefresh(k => k + 1);
    setMoveTarget(null);
    setMoveNote("");
    setBusy("");
  }

  const stage = stageFor(status);

  if (!app) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-ink-50 dark:bg-ink-900 shadow-2xl overflow-hidden">

        {/* ── TOP HEADER ── */}
        <div className="shrink-0 bg-ink-900 dark:bg-ink-950 px-6 pt-6 pb-5">
          <div className="flex items-start justify-between mb-5">
            <Avatar name={String(app.fullName ?? "")} />
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors mt-1">
              <X className="size-5" />
            </button>
          </div>
          <h2 className="text-2xl font-black text-white leading-tight">{String(app.fullName ?? "")}</h2>
          <p className="text-sm text-white/50 mt-1 mb-4">{String(app.roleTitle ?? "")}</p>
          <div className="flex items-center gap-3">
            <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full", stage.pill)}>
              <span className="size-1.5 rounded-full" style={{ background: stage.dot }} />
              {stage.label}
            </span>
            <button
              onClick={() => setScheduling(s => !s)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border transition-all",
                scheduling
                  ? "bg-brand-600 border-brand-600 text-white"
                  : "border-white/20 text-white/70 hover:border-white/50 hover:text-white"
              )}>
              <CalendarCheck className="size-3" />
              Schedule Interview
            </button>
          </div>
        </div>

        {/* ── SCHEDULE FORM (collapsible but stays mounted to preserve entered values) ── */}
        <div className={cn("shrink-0 bg-ink-50 dark:bg-ink-800 border-b border-ink-200 dark:border-white/[0.08]", !scheduling && "hidden")}>
          <div className="px-6 pt-4 pb-1 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">Schedule Interview</p>
            <p className="text-[10px] text-ink-400">Status will move to Screening</p>
          </div>
          <ScheduleForm
            app={app}
            onDone={(newStatus) => {
              setStatus(newStatus);
              setScheduling(false);
              setLogRefresh(k => k + 1);
              onScheduled?.(Number(app.id));
            }}
          />
        </div>

        {/* ── STAGE MOVER ── */}
        <div className="shrink-0 bg-white dark:bg-ink-800 border-b border-ink-200 dark:border-white/[0.08] px-6 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-2">Move to stage</p>
          <div className="flex flex-wrap gap-2">
            {STAGES.map(s => (
              <button key={s.value} onClick={() => move(s.value)}
                disabled={s.value === status || !!busy}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-full border transition-all",
                  s.value === status
                    ? cn(s.pill, "opacity-100 ring-2", s.ring)
                    : "border-ink-200 dark:border-white/10 text-ink-500 hover:border-ink-400 dark:hover:border-white/30 disabled:opacity-40"
                )}>
                {busy === s.value ? "…" : s.label}
              </button>
            ))}
          </div>
          {/* Note prompt when a move is selected */}
          {moveTarget && (
            <div className="mt-3 space-y-2 border-t border-ink-100 dark:border-white/[0.06] pt-3">
              <p className="text-[10px] text-ink-500">
                Moving to <strong className="text-ink-900 dark:text-white">{stageFor(moveTarget).label}</strong> — add a note (optional)
              </p>
              <textarea
                value={moveNote}
                onChange={e => setMoveNote(e.target.value)}
                rows={2}
                autoFocus
                placeholder="e.g. Good communication, cleared technical round…"
                className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-xs rounded resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex gap-2">
                <button onClick={confirmMove} disabled={!!busy}
                  className="px-4 py-1.5 text-xs font-bold bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50 transition-colors">
                  {busy ? "Moving…" : "Confirm"}
                </button>
                <button onClick={() => { setMoveTarget(null); setMoveNote(""); }}
                  className="px-4 py-1.5 text-xs font-bold border border-ink-200 dark:border-white/10 text-ink-600 dark:text-ink-300 rounded hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── TABS ── */}
        <TabBar tabs={DRAWER_TABS} active={tab} onChange={setTab} />

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto">

          {tab === "details" && (
            <div className="space-y-5 px-6 py-5">
              <Section title="Contact">
                <Field icon={Mail} label="Email" value={String(app.email ?? "")} link={`mailto:${app.email}`} />
                <Field icon={Phone} label="Phone" value={String(app.phone ?? "")} />
                <Field icon={MapPin} label="Location" value={String(app.currentLocation ?? "")} />
              </Section>

              <Section title="Professional">
                <Field icon={Briefcase} label="Current Company" value={String(app.currentCompany ?? "")} />
                <Field icon={Briefcase} label="Designation" value={String(app.currentDesignation ?? "")} />
                <Field icon={Clock} label="Experience" value={String(app.totalExperience ?? "")} />
                <Field icon={CalendarDays} label="Notice Period" value={String(app.noticePeriod ?? "")} />
                <Field icon={Ticket} label="Current CTC" value={String(app.currentCtc ?? "")} />
                <Field icon={Ticket} label="Expected CTC" value={String(app.expectedCtc ?? "")} />
              </Section>

              {!!(app.linkedinUrl || app.portfolioUrl) && (
                <Section title="Links">
                  <Field icon={Link2} label="LinkedIn" value={String(app.linkedinUrl ?? "")} link={String(app.linkedinUrl ?? "")} />
                  <Field icon={Link2} label="Portfolio / GitHub" value={String(app.portfolioUrl ?? "")} link={String(app.portfolioUrl ?? "")} />
                </Section>
              )}

              {!!(app.coverNote && String(app.coverNote).trim()) && (
                <Section title="Cover Note">
                  <p className="py-3 text-sm leading-relaxed text-ink-700 dark:text-ink-300">
                    {String(app.coverNote)}
                  </p>
                </Section>
              )}

              {(!!(app.source) || !!(app.internalNotes && String(app.internalNotes).trim())) && (
                <Section title="ATS Info">
                  <Field icon={Briefcase} label="Source" value={String(app.source ?? "")} />
                  {!!(app.internalNotes && String(app.internalNotes).trim()) && (
                    <div className="flex gap-3 py-3 border-b border-ink-100 dark:border-white/[0.06] last:border-0">
                      <FileText className="size-4 mt-0.5 shrink-0 text-ink-400" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-0.5">Internal Notes</p>
                        <p className="text-sm text-ink-700 dark:text-ink-300 leading-relaxed whitespace-pre-wrap">{String(app.internalNotes)}</p>
                      </div>
                    </div>
                  )}
                </Section>
              )}

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-2 px-4">Resume</p>
                <div className="bg-white dark:bg-ink-800 border border-ink-200 dark:border-white/[0.08] px-4 py-4">
                  <ResumeViewer path={app.resumePath ? String(app.resumePath) : null} />
                </div>
              </div>
            </div>
          )}

          {tab === "edit" && (
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {([
                  ["fullName", "Full Name *", "text"],
                  ["roleTitle", "Role Title *", "text"],
                  ["email", "Email", "email"],
                  ["phone", "Phone", "text"],
                  ["currentCompany", "Current Company", "text"],
                  ["currentDesignation", "Current Designation", "text"],
                  ["totalExperience", "Total Experience", "text"],
                  ["relevantExperience", "Relevant Experience", "text"],
                  ["currentCtc", "Current CTC", "text"],
                  ["expectedCtc", "Expected CTC", "text"],
                  ["noticePeriod", "Notice Period", "text"],
                  ["currentLocation", "Location", "text"],
                  ["linkedinUrl", "LinkedIn URL", "text"],
                  ["sourcedBy", "Sourced & Screened By", "text"],
                ] as const).map(([name, label, type]) => (
                  <div key={name} className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">{label}</label>
                    <input type={type} value={ef[name] ?? ""} onChange={e => editField(name, e.target.value)}
                      className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                ))}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Source</label>
                  <select value={ef.source ?? ""} onChange={e => editField("source", e.target.value)}
                    className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="">—</option>
                    {SOURCE_OPTIONS_TRACKER.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Internal Notes</label>
                <textarea value={ef.internalNotes ?? ""} onChange={e => editField("internalNotes", e.target.value)} rows={3}
                  className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={saveEdit} disabled={savingEdit || !ef.fullName || !ef.roleTitle}
                  className="inline-flex items-center gap-2 bg-brand-600 text-white text-sm font-bold px-5 py-2 rounded hover:bg-brand-700 disabled:opacity-50 transition-colors">
                  {savingEdit ? <Loader2 className="size-4 animate-spin" /> : null}
                  {savingEdit ? "Saving…" : "Save Changes"}
                </button>
                <button onClick={() => setTab("details")}
                  className="text-sm font-semibold text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {tab === "rounds" && (
            <InterviewRoundsTab appId={Number(app.id)} />
          )}

          {tab === "activity" && (
            <div className="px-6 py-5">
              <ActivityLog entityId={Number(app.id)} refreshKey={logRefresh} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

const EXP_OPTIONS = [
  { label: "Any experience", value: "" },
  { label: "0 – 1 year", value: "0-1" },
  { label: "1 – 3 years", value: "1-3" },
  { label: "3 – 5 years", value: "3-5" },
  { label: "5 – 8 years", value: "5-8" },
  { label: "8+ years", value: "8+" },
];

const NOTICE_OPTIONS = [
  { label: "Any notice period", value: "" },
  { label: "Immediate", value: "immediate" },
  { label: "≤ 15 days", value: "15" },
  { label: "≤ 30 days", value: "30" },
  { label: "≤ 60 days", value: "60" },
  { label: "90+ days", value: "90+" },
];

function matchExp(raw: unknown, filter: string): boolean {
  if (!filter) return true;
  const s = String(raw ?? "").toLowerCase().replace(/[^0-9]/g, " ").trim();
  const n = parseInt(s);
  if (isNaN(n)) return false;
  if (filter === "0-1") return n < 1;
  if (filter === "1-3") return n >= 1 && n < 3;
  if (filter === "3-5") return n >= 3 && n < 5;
  if (filter === "5-8") return n >= 5 && n < 8;
  if (filter === "8+") return n >= 8;
  return true;
}

function matchNotice(raw: unknown, filter: string): boolean {
  if (!filter) return true;
  const s = String(raw ?? "").toLowerCase();
  if (filter === "immediate") return s.includes("immediate") || s.includes("0");
  const n = parseInt(s);
  if (isNaN(n)) return false;
  if (filter === "15") return n <= 15;
  if (filter === "30") return n <= 30;
  if (filter === "60") return n <= 60;
  if (filter === "90+") return n >= 90;
  return true;
}

function PageActivityLog({ entityType }: { entityType: string }) {
  const [logs, setLogs] = useState<AllLogEntry[]>([]);
  useEffect(() => {
    axios.get("/t2.0/authentificationUtilization/talent-logs")
      .then(r => {
        const all = (r.data as { data: AllLogEntry[] }).data ?? [];
        setLogs(all.filter(l => l.entityType === entityType));
      })
      .catch(() => {});
  }, [entityType]);

  if (!logs.length) return (
    <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10 px-6 py-10 flex items-center gap-2 text-sm text-ink-400">
      <Activity className="size-4" /> No activity recorded yet.
    </div>
  );

  return (
    <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10">
      {logs.map((l, i) => (
        <div key={l.id} className="flex gap-4 px-6 py-4 border-b border-ink-100 dark:border-white/[0.06] last:border-0">
          <div className="flex flex-col items-center pt-1.5 shrink-0">
            <span className="size-2 rounded-full bg-brand-500" />
            {i < logs.length - 1 && <span className="w-px flex-1 mt-1 bg-ink-200 dark:bg-white/[0.08]" />}
          </div>
          <div className="min-w-0 pb-2 flex-1">
            <p className="text-sm font-semibold text-ink-900 dark:text-white">{l.action}</p>
            {l.details && <p className="text-xs text-ink-500 mt-0.5">{l.details}</p>}
            <p className="text-xs text-ink-400 mt-1">{l.actor} · {new Date(l.createdAt).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PageTabBar({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex border-b border-ink-200 dark:border-white/[0.08]">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={cn(
            "px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors",
            active === t.key
              ? "border-b-2 border-brand-500 text-ink-900 dark:text-white"
              : "text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
          )}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

const SOURCE_OPTIONS = [
  { label: "All sources", value: "" },
  { label: "Job Portal", value: "Job Portal" },
  { label: "LinkedIn", value: "LinkedIn" },
  { label: "Referral", value: "Referral" },
  { label: "Database", value: "Database" },
  { label: "Walk-in candidate", value: "Walk-in candidate" },
  { label: "Campus", value: "Campus" },
];

const ADD_SOURCE_OPTIONS = ["Job Portal", "LinkedIn", "Referral", "Database", "Walk-in candidate", "Campus"];

type OpenRole = { id: number; title: string; department: string };

function FormInput({ label, value, onChange, placeholder, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  );
}

function AddApplicantPanel({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [step, setStep] = useState<"upload" | "form">("upload");
  const [dragging, setDragging] = useState(false);

  const [openRoles, setOpenRoles] = useState<OpenRole[]>([]);
  const [openRoleId, setOpenRoleId] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [totalExperience, setTotalExperience] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentDesignation, setCurrentDesignation] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [currentCtc, setCurrentCtc] = useState("");
  const [expectedCtc, setExpectedCtc] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [source, setSource] = useState("Database");
  const [internalNotes, setInternalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get("/t2.0/authentificationUtilization/open-roles")
      .then(r => setOpenRoles((r.data as { data: OpenRole[] }).data ?? []))
      .catch(() => {});
  }, []);

  async function handleFile(f: File) {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files supported for auto-parsing.");
      setStep("form");
      setFile(f);
      return;
    }
    setFile(f);
    setParsing(true);
    setStep("form");
    try {
      const fd = new FormData();
      fd.append("resume", f);
      const res = await axios.post(`${BASE}/parse-resume`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      const payload = res.data as {
        success: boolean; parseWarning?: string;
        data: {
          fullName: string; email: string; phone: string; totalExperience: string;
          linkedinUrl: string; currentLocation: string; currentCompany: string;
          currentDesignation: string; currentCtc: string; expectedCtc: string; noticePeriod: string;
        }
      };
      const d = payload.data;
      if (d.fullName) setFullName(d.fullName);
      if (d.email) setEmail(d.email);
      if (d.phone) setPhone(d.phone);
      if (d.totalExperience) setTotalExperience(d.totalExperience);
      if (d.currentLocation) setCurrentLocation(d.currentLocation);
      if (d.linkedinUrl) setLinkedinUrl(d.linkedinUrl);
      if (d.currentCompany) setCurrentCompany(d.currentCompany);
      if (d.currentDesignation) setCurrentDesignation(d.currentDesignation);
      if (d.currentCtc) setCurrentCtc(d.currentCtc);
      if (d.expectedCtc) setExpectedCtc(d.expectedCtc);
      if (d.noticePeriod) setNoticePeriod(d.noticePeriod);

      const filled = [d.fullName, d.email, d.phone, d.totalExperience].filter(Boolean).length;
      if (payload.parseWarning || filled === 0) {
        toast(payload.parseWarning ?? "Could not auto-parse — fill in the fields manually.");
      } else {
        toast.success("Resume parsed — review and fill in any missing fields.");
      }
    } catch {
      toast("Could not auto-parse — fill in the fields manually.");
    } finally {
      setParsing(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !email) { toast.error("Full name and email are required."); return; }
    const title = openRoles.find(r => String(r.id) === openRoleId)?.title ?? roleTitle;
    if (!title) { toast.error("Please select or enter a role."); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (file) fd.append("resume", file);
      fd.append("fullName", fullName);
      fd.append("email", email);
      fd.append("phone", phone);
      fd.append("totalExperience", totalExperience);
      fd.append("currentCompany", currentCompany);
      fd.append("currentDesignation", currentDesignation);
      fd.append("noticePeriod", noticePeriod);
      fd.append("currentCtc", currentCtc);
      fd.append("expectedCtc", expectedCtc);
      fd.append("currentLocation", currentLocation);
      fd.append("linkedinUrl", linkedinUrl);
      fd.append("source", source);
      fd.append("internalNotes", internalNotes);
      fd.append("roleTitle", title);
      if (openRoleId) fd.append("openRoleId", openRoleId);
      await axios.post(`${BASE}/upload-applicant`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${fullName} added to ATS.`);
      onAdded();
      onClose();
    } catch {
      toast.error("Failed to add applicant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-xl flex-col bg-ink-50 dark:bg-ink-900 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="shrink-0 bg-ink-900 dark:bg-ink-950 px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-400 mb-1">Talent Acquisition</p>
            <h2 className="text-xl font-black text-white">Add Applicant</h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === "upload" && (
            <div className="p-6 space-y-4">
              <p className="text-sm text-ink-500 dark:text-ink-400">Upload a resume PDF to auto-fill the form, or skip to fill manually.</p>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-lg cursor-pointer transition-all px-8 py-12 flex flex-col items-center gap-4 select-none",
                  dragging
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-ink-200 dark:border-white/15 hover:border-ink-400 dark:hover:border-white/30 bg-white dark:bg-ink-800"
                )}>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <div className="size-12 rounded-full bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center">
                  <Upload className="size-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-ink-900 dark:text-white">Drop resume here</p>
                  <p className="text-xs text-ink-400 mt-0.5">PDF preferred for auto-parsing · up to 5 MB</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex-1 h-px bg-ink-200 dark:bg-white/10" />
                <span className="text-xs text-ink-400">or</span>
                <span className="flex-1 h-px bg-ink-200 dark:bg-white/10" />
              </div>
              <button onClick={() => setStep("form")}
                className="w-full py-2.5 text-sm font-bold border border-ink-200 dark:border-white/15 text-ink-700 dark:text-ink-200 rounded hover:bg-ink-100 dark:hover:bg-white/5 transition-colors">
                Fill form manually
              </button>
            </div>
          )}

          {step === "form" && (
            <form onSubmit={submit} id="add-applicant-form" className="p-6 space-y-6">
              {/* File indicator */}
              {file && (
                <div className="flex items-center gap-3 bg-white dark:bg-ink-800 border border-ink-200 dark:border-white/10 px-4 py-3 rounded-lg">
                  <FileText className="size-4 text-rose-500 shrink-0" />
                  <p className="text-sm font-medium text-ink-700 dark:text-ink-200 flex-1 truncate">{file.name}</p>
                  {parsing
                    ? <Loader2 className="size-4 text-brand-500 animate-spin shrink-0" />
                    : <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">✓ Parsed</span>}
                </div>
              )}

              {/* Role */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-ink-400 border-b border-ink-100 dark:border-white/[0.06] pb-2">Role</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Open Role</label>
                    <NativeSelect value={openRoleId} onChange={e => {
                      setOpenRoleId(e.target.value);
                      const r = openRoles.find(o => String(o.id) === e.target.value);
                      if (r) setRoleTitle(r.title);
                    }} aria-label="Open Role">
                      <option value="">— select —</option>
                      {openRoles.map(r => <option key={r.id} value={String(r.id)}>{r.title}</option>)}
                    </NativeSelect>
                  </div>
                  <FormInput label="Role Title *" value={roleTitle} onChange={setRoleTitle} required={!openRoleId} />
                </div>
              </div>

              {/* Candidate */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-ink-400 border-b border-ink-100 dark:border-white/[0.06] pb-2">Candidate</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormInput label="Full Name" value={fullName} onChange={setFullName} required />
                  <FormInput label="Email" value={email} onChange={setEmail} type="email" required />
                  <FormInput label="Phone" value={phone} onChange={setPhone} />
                  <FormInput label="Location" value={currentLocation} onChange={setCurrentLocation} />
                  <FormInput label="Current Company" value={currentCompany} onChange={setCurrentCompany} />
                  <FormInput label="Designation" value={currentDesignation} onChange={setCurrentDesignation} />
                  <FormInput label="Total Experience" value={totalExperience} onChange={setTotalExperience} />
                  <FormInput label="Notice Period" value={noticePeriod} onChange={setNoticePeriod} />
                  <FormInput label="Current CTC" value={currentCtc} onChange={setCurrentCtc} />
                  <FormInput label="Expected CTC" value={expectedCtc} onChange={setExpectedCtc} />
                </div>
                <FormInput label="LinkedIn URL" value={linkedinUrl} onChange={setLinkedinUrl} />
              </div>

              {/* ATS */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-ink-400 border-b border-ink-100 dark:border-white/[0.06] pb-2">ATS Info</p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Source</label>
                  <NativeSelect value={source} onChange={e => setSource(e.target.value)} aria-label="Source">
                    {ADD_SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Internal Notes</label>
                  <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={3}
                    placeholder="Referred by Priya, strong fintech background…"
                    className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-3 py-2 text-sm rounded resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {step === "form" && (
          <div className="shrink-0 border-t border-ink-200 dark:border-white/[0.08] bg-white dark:bg-ink-800 px-6 py-4 flex items-center gap-3">
            <button type="submit" form="add-applicant-form" disabled={submitting || parsing}
              className="inline-flex items-center gap-2 bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded hover:bg-brand-700 transition-colors disabled:opacity-50">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              {submitting ? "Adding…" : "Add to ATS"}
            </button>
            <button type="button" onClick={() => setStep("upload")}
              className="text-sm font-semibold text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors">
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function InterviewTracker() {
  const [apps, setApps] = useState<App[]>([]);
  const [selected, setSelected] = useState<App | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterExp, setFilterExp] = useState("");
  const [filterNotice, setFilterNotice] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [pageView, setPageView] = useState("applications");
  const [addingApplicant, setAddingApplicant] = useState(false);

  async function load() {
    try {
      const res = await axios.get(BASE);
      setApps((res.data as { data: App[] }).data ?? []);
    } catch { toast.error("Could not load applications."); }
  }

  useEffect(() => { load(); }, []);

  async function handleMove(id: number, status: string) {
    try {
      await axios.patch(`${BASE}/${id}/status`, { status });
      toast.success(`Moved to ${stageFor(status).label}`);
      setApps(prev => prev.map(a => Number(a.id) === id ? { ...a, status } : a));
      setSelected(prev => prev && Number(prev.id) === id ? { ...prev, status } : prev);
    } catch { toast.error("Failed to update status."); }
  }

  const roles = useMemo(() => {
    const seen = new Set<string>();
    apps.forEach(a => { const r = String(a.roleTitle ?? ""); if (r) seen.add(r); });
    return [...seen].sort();
  }, [apps]);

  const filtered = useMemo(() => apps.filter(a => {
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterRole && a.roleTitle !== filterRole) return false;
    if (!matchExp(a.totalExperience, filterExp)) return false;
    if (!matchNotice(a.noticePeriod, filterNotice)) return false;
    if (filterSource && a.source !== filterSource) return false;
    return true;
  }), [apps, filterStatus, filterRole, filterExp, filterNotice, filterSource]);

  const rows = useMemo(() => filtered.map(toRow), [filtered]);

  const hasFilter = filterStatus || filterExp || filterNotice || filterRole || filterSource;

  function resetFilters() {
    setFilterStatus(""); setFilterExp(""); setFilterNotice(""); setFilterRole(""); setFilterSource("");
  }

  async function handleImport(parsed: Record<string, string>[]) {
    const statusMap: Record<string, string> = {
      new: "NEW", screening: "SCREENING", shortlisted: "SHORTLISTED",
      rejected: "REJECTED", hired: "HIRED",
    };
    function resolveStatus(raw: string): string {
      const key = raw.trim().toLowerCase().replace(/\s+/g, "");
      return statusMap[key] ?? raw.trim().toUpperCase();
    }
    function rowId(r: Record<string, string>) {
      return (r["ID"] ?? r["id"] ?? r["Id"] ?? "").trim();
    }

    // CSV label → { appKey (matches toRow output), patchKey (backend field name) }
    const COL_MAP: { csv: string; appKey: keyof App; patchKey: string }[] = [
      { csv: "Candidate",      appKey: "fullName",          patchKey: "fullName" },
      { csv: "Role",           appKey: "roleTitle",         patchKey: "roleTitle" },
      { csv: "Current Company",appKey: "currentCompany",    patchKey: "currentCompany" },
      { csv: "Experience",     appKey: "totalExperience",   patchKey: "totalExperience" },
      { csv: "Notice Period",  appKey: "noticePeriod",      patchKey: "noticePeriod" },
    ];

    const updates: { id: string; patch: Record<string, string>; appChanges: Record<string, string> }[] = [];

    for (const r of parsed) {
      const id = rowId(r);
      if (!id) continue;
      const app = apps.find(a => String(a.id) === id);
      if (!app) continue;

      const patch: Record<string, string> = {};
      const appChanges: Record<string, string> = {};

      // Check each editable column for changes
      for (const { csv, appKey, patchKey } of COL_MAP) {
        const csvVal = (r[csv] ?? "").trim();
        const appVal = String(app[appKey] ?? "—").replace(/^—$/, "");
        if (csvVal && csvVal !== appVal) {
          patch[patchKey] = csvVal;
          appChanges[appKey as string] = csvVal;
        }
      }

      // Status — special case: needs label→value mapping
      const rawStatus = (r["Status"] ?? "").trim();
      if (rawStatus) {
        const mapped = resolveStatus(rawStatus);
        if (mapped !== String(app.status)) {
          patch["status"] = mapped;
          appChanges["status"] = mapped;
        }
      }

      if (Object.keys(patch).length) updates.push({ id, patch, appChanges });
    }

    if (!updates.length) { toast("No changes detected in the imported CSV."); return; }

    for (const { id, patch } of updates) {
      await axios.patch(`${BASE}/${id}`, patch);
    }

    setApps(prev => prev.map(a => {
      const u = updates.find(x => x.id === String(a.id));
      if (!u) return a;
      return { ...a, ...u.appChanges };
    }));

    toast.success(`${updates.length} applicant${updates.length !== 1 ? "s" : ""} updated.`);
  }

  const stats = [
    { label: "Total Applications", value: String(apps.length), icon: Users },
    { label: "New", value: String(apps.filter(a => a.status === "NEW").length), icon: CalendarDays },
    { label: "Shortlisted", value: String(apps.filter(a => a.status === "SHORTLISTED").length), icon: Clock },
    { label: "Hired", value: String(apps.filter(a => a.status === "HIRED").length), icon: Ticket },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Talent Acquisition"
          title="Applicants"
          description="All candidate applications from the careers page. Click any row to review."
        />
        <button
          onClick={() => setAddingApplicant(true)}
          className="shrink-0 inline-flex items-center gap-2 bg-brand-600 text-white text-sm font-bold px-4 py-2.5 rounded hover:bg-brand-700 transition-colors mt-1">
          <UserPlus className="size-4" />
          Add Applicant
        </button>
      </div>
      <StatGrid stats={stats} />

      {/* ── Page-level tabs ── */}
      <PageTabBar
        tabs={[{ key: "applications", label: "Applications" }, { key: "activity", label: "Activity Log" }]}
        active={pageView}
        onChange={v => { setPageView(v); setSelected(null); }}
      />

      {/* ── Applications view ── */}
      {pageView === "applications" && (
        <>
          {/* Filters card */}
          <div className="border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-ink-500 dark:text-ink-400">Filters</span>
              {hasFilter && (
                <button onClick={resetFilters}
                  className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400 hover:opacity-80 transition-opacity">
                  Reset
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Status</label>
                <NativeSelect value={filterStatus} onChange={e => setFilterStatus(e.target.value)} aria-label="Status">
                  <option value="">All statuses</option>
                  {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Role</label>
                <NativeSelect value={filterRole} onChange={e => setFilterRole(e.target.value)} aria-label="Role">
                  <option value="">All roles</option>
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Experience</label>
                <NativeSelect value={filterExp} onChange={e => setFilterExp(e.target.value)} aria-label="Experience">
                  {EXP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Notice Period</label>
                <NativeSelect value={filterNotice} onChange={e => setFilterNotice(e.target.value)} aria-label="Notice Period">
                  {NOTICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Source</label>
                <NativeSelect value={filterSource} onChange={e => setFilterSource(e.target.value)} aria-label="Source">
                  {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </NativeSelect>
              </div>
            </div>
            {hasFilter && (
              <p className="mt-3 text-xs text-ink-400 tabular-nums">{filtered.length} of {apps.length} candidates</p>
            )}
          </div>

          <DataTable
            title="Applications"
            columns={COLUMNS}
            rows={rows}
            tabsOn="status"
            onRowClick={r => setSelected(apps.find(a => String(a.id) === String(r.id)) ?? null)}
            exportExtras={[
              { key: "id", label: "ID" },
              { key: "resumeUrl", label: "Resume URL" },
              { key: "jdUrl", label: "JD URL" },
            ]}
            onImport={handleImport}
            searchExtras={["internalNotes"]}
          />
          <AppDrawer
            app={selected}
            onClose={() => setSelected(null)}
            onMove={handleMove}
            onScheduled={(id) => {
              setApps(prev => prev.map(a => Number(a.id) === id ? { ...a, status: "SCREENING" } : a));
              setSelected(prev => prev && Number(prev.id) === id ? { ...prev, status: "SCREENING" } : prev);
            }}
            onUpdated={(updated) => {
              setApps(prev => prev.map(a => Number(a.id) === Number(updated.id) ? updated : a));
              setSelected(updated);
            }}
          />
        </>
      )}

      {/* ── Activity Log view ── */}
      {pageView === "activity" && (
        <PageActivityLog entityType="APPLICATION" />
      )}

      {addingApplicant && (
        <AddApplicantPanel
          onClose={() => setAddingApplicant(false)}
          onAdded={() => { load(); setAddingApplicant(false); }}
        />
      )}
    </div>
  );
}
