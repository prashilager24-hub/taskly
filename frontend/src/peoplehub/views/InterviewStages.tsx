import { useEffect, useMemo, useState, useCallback } from "react"
import axios from "axios"
import { CalendarDays, X, Activity, Mail, Phone, MapPin, Briefcase, Clock, Link2, FileText, Loader2, Users, ExternalLink, MessageSquare, AlertCircle } from "lucide-react"
import { NativeSelect, PageHeader, StatGrid } from "@/peoplehub/blocks/page"
import { PersonAvatar } from "@/peoplehub/blocks/person-cell"
import { cn, toast } from "@/peoplehub/ui"
const BASE = "/t2.0/authentificationUtilization/applications"

function useCurrentUserName(): string {
  try {
    const raw = localStorage.getItem("authUserLD")
    if (!raw) return ""
    const { token } = JSON.parse(raw)
    if (!token) return ""
    const payload = JSON.parse(atob(token.split(".")[1]!))
    return payload.username ?? payload.name ?? ""
  } catch {
    return ""
  }
}

type UserOption = { id: number; name: string }
let _usersCache: UserOption[] | null = null

function useUsers(): UserOption[] {
  const [users, setUsers] = useState<UserOption[]>(_usersCache ?? [])
  useEffect(() => {
    if (_usersCache) return
    axios.get("/api/users").then(r => {
      const raw = (r.data as any)?.response ?? (r.data as any)?.data ?? r.data ?? []
      const list: UserOption[] = (Array.isArray(raw) ? raw : []).map((u: any) => ({ id: u.UserID ?? u.id, name: u.Name ?? u.name }))
      _usersCache = list
      setUsers(list)
    }).catch(() => {})
  }, [])
  return users
}

type LogEntry = { id: number; entityType: string; entityId: number; action: string; details: string | null; actor: string; createdAt: string }

type App = {
  id: number; fullName: string; roleTitle: string;
  totalExperience: string | null; relevantExperience: string | null;
  currentCompany: string | null; currentDesignation: string | null;
  email: string; phone: string; currentLocation: string | null;
  linkedinUrl: string | null; resumePath: string | null;
  currentCtc: string | null; expectedCtc: string | null; noticePeriod: string | null;
  source: string | null; internalNotes: string | null;
  sourcedBy: string | null; screenedBy: string | null; screeningNotes: string | null;
  rejectionReason: string | null; rejectedAtStage: string | null;
  finalStatus: string | null; offeredCtc: string | null; expectedDoj: string | null;
  currentRoundDate: string | null; currentRoundInterviewer: string | null; currentRoundStatus: string | null;
  interviewStage: StageKey; status: string;
}

type Round = {
  id?: number; roundNumber: number; interviewDate: string;
  interviewerName: string; interviewLink: string; mode?: string; venue?: string;
  status: string; feedback: string; managerFeedback?: string;
}

const STAGES = [
  { key: "applied",  label: "Applied",      hint: "Incoming",          color: "bg-sky-500" },
  { key: "screened", label: "Screened",     hint: "Sourced & Screened", color: "bg-teal-500" },
  { key: "l1",       label: "Interview 1",  hint: "1st Interview",     color: "bg-amber-500" },
  { key: "l2",       label: "Interview 2",  hint: "2nd Interview",     color: "bg-violet-500" },
  { key: "l3",       label: "Interview 3",  hint: "3rd Interview",     color: "bg-emerald-500" },
  { key: "offer",    label: "Offer",        hint: "Final / Offer",     color: "bg-brand-500" },
] as const
type StageKey = (typeof STAGES)[number]["key"] | "rejected"

const ROUND_STATUSES = ["Scheduled", "Selected", "Rejected", "On Hold", "No-Show", "Rescheduled"]
const EXP_OPTIONS = [
  { label: "Any experience", value: "" },
  { label: "0–2 yrs", value: "0-2" },
  { label: "3–5 yrs", value: "3-5" },
  { label: "6–8 yrs", value: "6-8" },
  { label: "9+ yrs", value: "9+" },
]

function matchExp(raw: string | null, f: string) {
  if (!f || !raw) return true
  const n = parseInt(raw); if (isNaN(n)) return false
  if (f === "0-2") return n <= 2; if (f === "3-5") return n >= 3 && n <= 5
  if (f === "6-8") return n >= 6 && n <= 8; if (f === "9+") return n >= 9
  return true
}

function TabBar({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex border-b border-ink-200 dark:border-white/[0.08]">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} className={cn(
          "px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors",
          active === t.key ? "border-b-2 border-brand-500 text-ink-900 dark:text-white" : "text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
        )}>{t.label}</button>
      ))}
    </div>
  )
}

function RoundStatusPill({ status }: { status: string }) {
  const cls =
    status === "Selected"    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" :
    status === "Rejected"    ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300" :
    status === "On Hold"     ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" :
    status === "No-Show"     ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" :
    status === "Rescheduled" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" :
                               "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
  return <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded-full", cls)}>{status}</span>
}

function RoundCard({ appId, round, onSaved }: { appId: number; round: Round; onSaved: (r: Round[]) => void }) {
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState(round.interviewDate ?? "")
  const [interviewer, setInterviewer] = useState(round.interviewerName ?? "")
  const [link, setLink] = useState(round.interviewLink ?? "")
  const [status, setStatus] = useState(round.status ?? "Pending")
  const [feedback, setFeedback] = useState(round.feedback ?? "")
  const [saving, setSaving] = useState(false)
  const isEmpty = !round.interviewDate && !round.interviewerName && !round.feedback

  async function save() {
    setSaving(true)
    try {
      const res = await axios.put(`${BASE}/${appId}/rounds/${round.roundNumber}`, { interviewDate: date, interviewerName: interviewer, interviewLink: link, status, feedback })
      onSaved((res.data as { data: Round[] }).data)
      setEditing(false)
      toast.success(`Round ${round.roundNumber} saved.`)
    } catch { toast.error("Failed to save round.") }
    finally { setSaving(false) }
  }

  return (
    <div className="border border-ink-200 dark:border-white/[0.08] bg-white dark:bg-ink-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-ink-50 dark:bg-ink-900/60 border-b border-ink-100 dark:border-white/[0.06]">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-500">Round {round.roundNumber}</span>
        <div className="flex items-center gap-2">
          <RoundStatusPill status={status} />
          <button onClick={() => setEditing(e => !e)} className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline">
            {editing ? "Cancel" : (isEmpty ? "+ Add" : "Edit")}
          </button>
        </div>
      </div>
      {!editing ? (
        <div className="px-4 py-3 space-y-1.5">
          {isEmpty ? <p className="text-xs text-ink-400 italic">No details yet.</p> : (
            <>
              {round.interviewDate && <div className="flex items-center gap-2 text-xs text-ink-600 dark:text-ink-300"><CalendarDays className="size-3 text-ink-400" />{round.interviewDate}</div>}
              {round.interviewerName && <div className="flex items-center gap-2 text-xs text-ink-600 dark:text-ink-300"><Users className="size-3 text-ink-400" />{round.interviewerName}</div>}
              {round.interviewLink && <div className="flex items-center gap-2 text-xs"><Link2 className="size-3 text-ink-400" /><a href={round.interviewLink} target="_blank" rel="noreferrer" className="text-brand-600 dark:text-brand-400 hover:underline truncate">{round.interviewLink}</a></div>}
              {round.feedback && <p className="text-xs text-ink-500 dark:text-ink-400 border-t border-ink-100 dark:border-white/[0.06] mt-2 pt-2 leading-relaxed whitespace-pre-wrap">{round.feedback}</p>}
            </>
          )}
        </div>
      ) : (
        <div className="px-4 py-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-2 py-1.5 text-xs rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-2 py-1.5 text-xs rounded focus:outline-none focus:ring-2 focus:ring-brand-500">
                {ROUND_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Interviewer</label>
            <input value={interviewer} onChange={e => setInterviewer(e.target.value)}
              className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-2 py-1.5 text-xs rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Meeting Link / Location</label>
            <input value={link} onChange={e => setLink(e.target.value)}
              className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-2 py-1.5 text-xs rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Feedback</label>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
              className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-2 py-1.5 text-xs rounded resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {saving && <Loader2 className="size-3 animate-spin" />}{saving ? "Saving…" : "Save Round"}
          </button>
        </div>
      )}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, link }: { icon: React.ElementType; label: string; value?: string | null; link?: string }) {
  if (!value?.trim()) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-ink-100 dark:border-white/[0.06] last:border-0">
      <Icon className="size-3.5 shrink-0 text-ink-400 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">{label}</p>
        {link
          ? <a href={link} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline break-all">{value}</a>
          : <p className="text-xs font-semibold text-ink-900 dark:text-white">{value}</p>
        }
      </div>
    </div>
  )
}

/* ── Stage-aware transition form ─────────────────────────────────────────────
   Shows relevant capture fields when moving to a specific stage.
   Each stage knows what data to collect and what APIs to call.           ── */

type TransitionData = {
  note?: string
  // screened
  sourcedBy?: string; screenedBy?: string; screeningNotes?: string
  expectedCtc?: string; noticePeriod?: string
  // rejection
  rejectionReason?: string
  // offer
  offeredCtc?: string; expectedDoj?: string
  // schedule (date, interviewer, link, mode, venue)
  r1Date?: string; r1Interviewer?: string; r1Link?: string; r1Mode?: string; r1Venue?: string
  r2Date?: string; r2Interviewer?: string; r2Link?: string; r2Mode?: string; r2Venue?: string
  r3Date?: string; r3Interviewer?: string; r3Link?: string; r3Mode?: string; r3Venue?: string
}

const ROUND_STATUSES_OPTS = ["Scheduled", "Selected", "Rejected", "On Hold", "No-Show", "Rescheduled"]
const OFFER_STATUSES = ["Offer Pending", "Offer Released", "Offer Accepted", "Offer Declined", "Joined", "Dropped"]

function TF({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-2.5 py-1.5 text-xs rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  )
}
function TA({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} placeholder={placeholder}
        className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-2.5 py-1.5 text-xs rounded resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  )
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-2.5 py-1.5 text-xs rounded focus:outline-none focus:ring-2 focus:ring-brand-500">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function ModeField({ mode, venue, onMode, onVenue }: { mode: string; venue: string; onMode: (v: string) => void; onVenue: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {["online", "in_person"].map(m => (
          <label key={m} className="flex items-center gap-1.5 text-xs font-semibold text-ink-600 dark:text-ink-300 cursor-pointer">
            <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => onMode(m)} className="accent-brand-600" />
            {m === "online" ? "Online" : "In Person"}
          </label>
        ))}
      </div>
      {mode === "online"
        ? <TF label="Meeting Link" value={venue} onChange={onVenue} placeholder="https://meet.google.com/…" />
        : <TF label="Venue / Location" value={venue} onChange={onVenue} placeholder="e.g. Office, Room 2A" />
      }
    </div>
  )
}

function StageTransitionForm({ target, data, onChange, currentUser }: {
  target: StageKey; data: TransitionData; onChange: (d: TransitionData) => void; currentUser?: string
}) {
  const set = useCallback((patch: Partial<TransitionData>) => onChange({ ...data, ...patch }), [data, onChange])
  const users = useUsers()

  if (target === "screened") return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">Screening Info</p>
      <div className="grid grid-cols-2 gap-2">
        <TF label="Sourced By" value={data.sourcedBy ?? ""} onChange={v => set({ sourcedBy: v })} placeholder="e.g. LinkedIn / Referral" />
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-ink-500 dark:text-ink-400">Screened By</label>
          <select
            value={data.screenedBy || currentUser || ""}
            onChange={e => set({ screenedBy: e.target.value })}
            className="h-9 w-full rounded border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 px-2.5 text-sm text-ink-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">— select —</option>
            {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TF label="Expected CTC (edit if changed)" value={data.expectedCtc ?? ""} onChange={v => set({ expectedCtc: v })} placeholder="e.g. 18 LPA" />
        <TF label="Notice Period (edit if changed)" value={data.noticePeriod ?? ""} onChange={v => set({ noticePeriod: v })} placeholder="e.g. 30 days" />
      </div>
      <TA label="Screening Notes" value={data.screeningNotes ?? ""} onChange={v => set({ screeningNotes: v })} placeholder="Observations, candidate summary…" />
      <TA label="Additional Note (optional)" value={data.note ?? ""} onChange={v => set({ note: v })} placeholder="Any other notes…" />
    </div>
  )

  if (target === "l1") return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Schedule Interview 1</p>
      <div className="grid grid-cols-2 gap-2">
        <TF label="Date & Time" value={data.r1Date ?? ""} onChange={v => set({ r1Date: v })} type="datetime-local" />
        <TF label="Interviewer (EL)" value={data.r1Interviewer ?? ""} onChange={v => set({ r1Interviewer: v })} placeholder="Interviewer name" />
      </div>
      <ModeField mode={data.r1Mode ?? "online"} venue={data.r1Link ?? ""} onMode={v => set({ r1Mode: v })} onVenue={v => set({ r1Link: v })} />
      <TA label="Note (optional)" value={data.note ?? ""} onChange={v => set({ note: v })} placeholder="Any notes…" />
    </div>
  )

  if (target === "l2") return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">Schedule Interview 2</p>
      <div className="grid grid-cols-2 gap-2">
        <TF label="Date & Time" value={data.r2Date ?? ""} onChange={v => set({ r2Date: v })} type="datetime-local" />
        <TF label="Interviewer 2" value={data.r2Interviewer ?? "Naveen"} onChange={v => set({ r2Interviewer: v })} placeholder="Naveen" />
      </div>
      <ModeField mode={data.r2Mode ?? "online"} venue={data.r2Link ?? ""} onMode={v => set({ r2Mode: v })} onVenue={v => set({ r2Link: v })} />
      <TA label="Note (optional)" value={data.note ?? ""} onChange={v => set({ note: v })} placeholder="Any notes…" />
    </div>
  )

  if (target === "l3") return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Schedule Interview 3</p>
      <div className="grid grid-cols-2 gap-2">
        <TF label="Date & Time" value={data.r3Date ?? ""} onChange={v => set({ r3Date: v })} type="datetime-local" />
        <TF label="Interviewer 3" value={data.r3Interviewer ?? "Raja"} onChange={v => set({ r3Interviewer: v })} placeholder="Raja" />
      </div>
      <ModeField mode={data.r3Mode ?? "online"} venue={data.r3Link ?? ""} onMode={v => set({ r3Mode: v })} onVenue={v => set({ r3Link: v })} />
      <TA label="Note (optional)" value={data.note ?? ""} onChange={v => set({ note: v })} placeholder="Any notes…" />
    </div>
  )

  if (target === "offer") return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">Move to Offer</p>
      <p className="text-xs text-ink-500 dark:text-ink-400">Interview 3 must be marked "Selected" to proceed. Optionally add offer details below.</p>
      <div className="grid grid-cols-2 gap-2">
        <TF label="Offered CTC (optional)" value={data.offeredCtc ?? ""} onChange={v => set({ offeredCtc: v })} placeholder="e.g. 24 LPA" />
        <TF label="Expected DOJ (optional)" value={data.expectedDoj ?? ""} onChange={v => set({ expectedDoj: v })} type="date" />
      </div>
      <TA label="Note (optional)" value={data.note ?? ""} onChange={v => set({ note: v })} placeholder="Offer details, joining instructions…" />
    </div>
  )

  if (target === "rejected") return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400">Reject Candidate</p>
      <TA label="Reason for rejection *" value={data.rejectionReason ?? ""} onChange={v => set({ rejectionReason: v })} placeholder="e.g. Compensation mismatch, skill gap, no-show…" />
      <TA label="Additional notes (optional)" value={data.note ?? ""} onChange={v => set({ note: v })} placeholder="Any other context…" />
    </div>
  )

  // default (applied or fallback)
  return (
    <TA label="Note (optional)" value={data.note ?? ""} onChange={v => set({ note: v })} placeholder="Any notes…" />
  )
}

/* ── Feedback Modal ─────────────────────────────────────────────────────────── */

const ROUND_INTERVIEWER_LABEL: Record<number, string> = { 1: "Interviewer 1 (EL) Feedback", 2: "Naveen's Feedback", 3: "Raja's Feedback (Final)" }
const ROUND_MANAGER_LABEL: Record<number, string> = { 1: "Raja's Review (after Round 1)" }

function FeedbackModal({ app, roundNo, onClose, onSaved }: {
  app: App; roundNo: number; onClose: () => void
  onSaved: (rounds: Round[], updatedApp?: App) => void
}) {
  const currentUser = useCurrentUserName()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("Scheduled")
  const [feedback, setFeedback] = useState("")
  const [managerFeedback, setManagerFeedback] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    axios.get(`${BASE}/${app.id}/rounds`).then(r => {
      const rounds = (r.data as { data: Round[] }).data ?? []
      const existing = rounds.find(r => r.roundNumber === roundNo)
      if (existing) { setStatus(existing.status || "Scheduled"); setFeedback(existing.feedback || ""); setManagerFeedback(existing.managerFeedback || "") }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [app.id, roundNo])

  async function save() {
    setSaving(true)
    try {
      const res = await axios.put(`${BASE}/${app.id}/rounds/${roundNo}`, {
        status, feedback: feedback || undefined, managerFeedback: managerFeedback || undefined,
        submittedBy: currentUser,
      })
      const rounds = (res.data as { data: Round[]; app?: App }).data ?? []
      const updatedApp = (res.data as any).app
      onSaved(rounds, updatedApp)
      toast.success(status === "Rejected" ? `${app.fullName} rejected after Round ${roundNo}` : `Round ${roundNo} feedback saved — status: ${status}`)
      onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to save feedback.")
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white dark:bg-ink-800 rounded-xl shadow-2xl w-full max-w-md border border-ink-200 dark:border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-200 dark:border-white/10 bg-ink-50 dark:bg-ink-900/60">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-400">Submit Feedback</p>
            <h3 className="text-sm font-black text-ink-900 dark:text-white mt-0.5">Round {roundNo} · {app.fullName}</h3>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 dark:hover:text-white p-1"><X className="size-4" /></button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="size-5 animate-spin text-ink-400" /></div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <Select label="Interview Status *" value={status} onChange={setStatus} options={ROUND_STATUSES_OPTS} />
            {status === "Rescheduled" && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 rounded">
                Save this, then use the drawer to reschedule the round date.
              </p>
            )}
            {status === "Rejected" && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 rounded flex items-center gap-2">
                <AlertCircle className="size-3.5 shrink-0" /> This will auto-reject the candidate.
              </p>
            )}
            <TA label={ROUND_INTERVIEWER_LABEL[roundNo] ?? "Interviewer Feedback"} value={feedback} onChange={setFeedback} placeholder="Interviewer's assessment of this round…" />
            {ROUND_MANAGER_LABEL[roundNo] && (
              <TA label={ROUND_MANAGER_LABEL[roundNo]} value={managerFeedback} onChange={setManagerFeedback} placeholder="Manager's overall assessment after round 1…" />
            )}
          </div>
        )}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-ink-200 dark:border-white/10 bg-ink-50 dark:bg-ink-900/40">
          <button onClick={save} disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : "Save Feedback"}
          </button>
          <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function CandidateDrawer({ app, onClose, onMoved, onAppUpdated, initialMoveTarget }: {
  app: App | null; onClose: () => void
  onMoved: (id: number, stage: StageKey) => void
  onAppUpdated: (updated: App) => void
  initialMoveTarget?: StageKey
}) {
  const currentUser = useCurrentUserName()
  const [tab, setTab] = useState("info")
  const [rounds, setRounds] = useState<Round[]>([])
  const [moveTarget, setMoveTarget] = useState<StageKey | null>(initialMoveTarget ?? null)
  const [transData, setTransData] = useState<TransitionData>({})
  const [moving, setMoving] = useState(false)
  const [offerStatus, setOfferStatus] = useState("")
  const [savingOffer, setSavingOffer] = useState(false)

  useEffect(() => {
    if (!app) return
    setTab("info"); setMoveTarget(initialMoveTarget ?? null)
    // Pre-populate form with existing candidate data
    setTransData({
      sourcedBy: app.sourcedBy ?? "",
      screenedBy: app.screenedBy ?? "",
      screeningNotes: app.screeningNotes ?? "",
      expectedCtc: app.expectedCtc ?? "",
      noticePeriod: app.noticePeriod ?? "",
      offeredCtc: app.offeredCtc ?? "",
      expectedDoj: app.expectedDoj ?? "",
    })
    setOfferStatus(app.finalStatus ?? "")
    axios.get(`${BASE}/${app.id}/rounds`)
      .then(r => setRounds((r.data as { data: Round[] }).data ?? []))
      .catch(() => {})
  }, [app?.id, initialMoveTarget])

  if (!app) return null

  const stageIdx = STAGES.findIndex(s => s.key === app.interviewStage)
  const nextStage = STAGES[stageIdx + 1]
  const prevStage = stageIdx > 0 ? STAGES[stageIdx - 1] : null

  // Determine which round number the current stage maps to for gating
  const currentRoundNo: Record<string, number> = { l1: 1, l2: 2, l3: 3 }
  const roundForStage = currentRoundNo[app.interviewStage]
  const currentRound = roundForStage ? rounds.find(r => r.roundNumber === roundForStage) : undefined
  const roundSelected = currentRound?.status === "Selected"

  const filledRounds: Round[] = [1, 2, 3].map(n => {
    const e = rounds.find(r => r.roundNumber === n)
    return e ?? { roundNumber: n, interviewDate: "", interviewerName: "", interviewLink: "", status: "Scheduled", feedback: "" }
  })

  async function saveOfferStatus() {
    if (!offerStatus) return
    setSavingOffer(true)
    try {
      const res = await axios.patch(`${BASE}/${app!.id}/final-status`, { finalStatus: offerStatus })
      onAppUpdated((res.data as { data: App }).data)
      toast.success(`Final status → ${offerStatus}`)
    } catch { toast.error("Failed to update offer status.") }
    finally { setSavingOffer(false) }
  }

  async function confirmMove() {
    if (!moveTarget || !app) return

    // Validate rejection reason
    if (moveTarget === "rejected" && !transData.rejectionReason?.trim()) {
      toast.error("Please enter a reason for rejection.")
      return
    }

    setMoving(true)
    try {
      const d = transData
      // Save schedule data as round record when moving into an interview stage
      if (moveTarget === "l1" && (d.r1Date || d.r1Interviewer || d.r1Link)) {
        await axios.put(`${BASE}/${app.id}/rounds/1`, {
          interviewDate: d.r1Date, interviewerName: d.r1Interviewer,
          interviewLink: d.r1Link, mode: d.r1Mode || "online", status: "Scheduled",
        })
      }
      if (moveTarget === "l2" && (d.r2Date || d.r2Interviewer || d.r2Link)) {
        await axios.put(`${BASE}/${app.id}/rounds/2`, {
          interviewDate: d.r2Date, interviewerName: d.r2Interviewer || "Naveen",
          interviewLink: d.r2Link, mode: d.r2Mode || "online", status: "Scheduled",
        })
      }
      if (moveTarget === "l3" && (d.r3Date || d.r3Interviewer || d.r3Link)) {
        await axios.put(`${BASE}/${app.id}/rounds/3`, {
          interviewDate: d.r3Date, interviewerName: d.r3Interviewer || "Raja",
          interviewLink: d.r3Link, mode: d.r3Mode || "online", status: "Scheduled",
        })
      }
      // Change stage — backend handles gating, rejection fields, offer fields
      await axios.patch(`${BASE}/${app.id}/interview-stage`, {
        stage: moveTarget,
        note: d.note?.trim() || undefined,
        sourcedBy: d.sourcedBy?.trim() || undefined,
        screenedBy: d.screenedBy?.trim() || (moveTarget === "screened" ? currentUser : undefined),
        screeningNotes: d.screeningNotes?.trim() || undefined,
        expectedCtc: d.expectedCtc?.trim() || undefined,
        noticePeriod: d.noticePeriod?.trim() || undefined,
        rejectionReason: d.rejectionReason?.trim() || undefined,
        offeredCtc: d.offeredCtc?.trim() || undefined,
        expectedDoj: d.expectedDoj?.trim() || undefined,
      })
      onMoved(app.id, moveTarget)
      toast.success(`${app.fullName} → ${moveTarget === "rejected" ? "Rejected" : STAGES.find(s => s.key === moveTarget)?.label}`)
      onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to move stage.")
    } finally { setMoving(false) }
  }

  const F_BASE = "http://localhost:8080"
  const fileUrl = app.resumePath ? (app.resumePath.startsWith("http") ? app.resumePath : `${F_BASE}${app.resumePath}`) : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col bg-ink-50 dark:bg-ink-900 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className={cn("shrink-0 px-5 pt-5 pb-4", "bg-ink-900 dark:bg-ink-950")}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink-700 ring-2 ring-white/10 font-black text-white text-base">
                {app.fullName.trim().split(" ").slice(0, 2).map(w => w[0]?.toUpperCase()).join("")}
              </div>
              <div>
                <h2 className="text-base font-black text-white leading-tight">{app.fullName}</h2>
                <p className="text-xs text-white/50 mt-0.5">{app.roleTitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X className="size-5" /></button>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {STAGES.map(s => (
              <span key={s.key} className={cn(
                "px-2.5 py-0.5 text-[10px] font-bold rounded-full border transition-all",
                app.interviewStage === s.key ? `${s.color} border-transparent text-white` : "border-white/15 text-white/35"
              )}>{s.label}</span>
            ))}
          </div>
        </div>

        {/* Stage mover — compact button strip; forward gated for interview stages */}
        <div className="shrink-0 bg-white dark:bg-ink-800 border-b border-ink-200 dark:border-white/[0.08] px-5 py-3 flex flex-wrap gap-2 items-center">
          {prevStage && (
            <button onClick={() => { setMoveTarget(prevStage.key as StageKey); setTransData({}) }}
              className="px-3 py-1 text-xs font-bold border border-ink-200 dark:border-white/10 text-ink-500 rounded-full hover:border-ink-400 transition-colors">
              ← {prevStage.label}
            </button>
          )}
          {nextStage && (() => {
            const needsGate = ["l1", "l2", "l3"].includes(app.interviewStage)
            const disabled = needsGate && !roundSelected
            return (
              <button onClick={() => { if (!disabled) { setMoveTarget(nextStage.key as StageKey); setTransData({}) } }}
                title={disabled ? `Mark Round ${roundForStage} as "Selected" first` : undefined}
                className={cn("px-3 py-1 text-xs font-bold rounded-full transition-colors",
                  disabled ? "bg-brand-200 dark:bg-brand-900/30 text-white/60 cursor-not-allowed" : "bg-brand-600 text-white hover:bg-brand-700")}>
                {nextStage.label} →
              </button>
            )
          })()}
          <button onClick={() => { setMoveTarget("rejected" as StageKey); setTransData({}) }}
            className="px-3 py-1 text-xs font-bold border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-full hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
            Reject
          </button>
          {roundForStage && !roundSelected && currentRound && (
            <span className="ml-auto text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertCircle className="size-3" /> Submit feedback first
            </span>
          )}
        </div>

        {/* Jira-style transition modal */}
        {moveTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && (setMoveTarget(null), setTransData({}))}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setMoveTarget(null); setTransData({}) }} />
            <div className="relative z-10 bg-white dark:bg-ink-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-ink-200 dark:border-white/10">
              <div className="flex items-center justify-between px-6 py-4 border-b border-ink-200 dark:border-white/10 bg-ink-50 dark:bg-ink-900/60">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-ink-400">Move to stage</p>
                  <h3 className="text-sm font-black text-ink-900 dark:text-white mt-0.5">
                    {moveTarget === "rejected" ? "Reject Candidate" : `→ ${STAGES.find(s => s.key === moveTarget)?.label}`}
                  </h3>
                  <p className="text-[10px] text-ink-400 mt-0.5">{app.fullName} · {app.roleTitle}</p>
                </div>
                <button onClick={() => { setMoveTarget(null); setTransData({}) }} className="text-ink-400 hover:text-ink-700 dark:hover:text-white transition-colors p-1">
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <StageTransitionForm target={moveTarget} data={transData} onChange={setTransData} currentUser={currentUser} />
              </div>
              <div className="flex items-center gap-3 px-6 py-4 border-t border-ink-200 dark:border-white/10 bg-ink-50 dark:bg-ink-900/40">
                <button onClick={confirmMove} disabled={moving}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50 transition-colors">
                  {moving && <Loader2 className="size-4 animate-spin" />}
                  {moving ? "Moving…" : moveTarget === "rejected" ? "Confirm Rejection" : "Confirm & Move"}
                </button>
                <button onClick={() => { setMoveTarget(null); setTransData({}) }}
                  className="px-5 py-2 text-sm font-semibold text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <TabBar tabs={[{ key: "info", label: "Info" }, { key: "rounds", label: "Interview Rounds" }]} active={tab} onChange={setTab} />

        <div className="flex-1 overflow-y-auto">
          {tab === "info" && (
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Contact</p>
                <div className="bg-white dark:bg-ink-800 border border-ink-200 dark:border-white/[0.08] px-4">
                  <InfoRow icon={Mail} label="Email" value={app.email} link={`mailto:${app.email}`} />
                  <InfoRow icon={Phone} label="Phone" value={app.phone} />
                  <InfoRow icon={MapPin} label="Location" value={app.currentLocation} />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Professional</p>
                <div className="bg-white dark:bg-ink-800 border border-ink-200 dark:border-white/[0.08] px-4">
                  <InfoRow icon={Briefcase} label="Current Company" value={app.currentCompany} />
                  <InfoRow icon={Briefcase} label="Designation" value={app.currentDesignation} />
                  <InfoRow icon={Clock} label="Total Experience" value={app.totalExperience} />
                  <InfoRow icon={Clock} label="Relevant Experience" value={app.relevantExperience} />
                  <InfoRow icon={Clock} label="Notice Period" value={app.noticePeriod} />
                  <InfoRow icon={FileText} label="Current CTC" value={app.currentCtc} />
                  <InfoRow icon={FileText} label="Expected CTC" value={app.expectedCtc} />
                  <InfoRow icon={Link2} label="LinkedIn" value={app.linkedinUrl} link={app.linkedinUrl ?? undefined} />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">ATS Info</p>
                <div className="bg-white dark:bg-ink-800 border border-ink-200 dark:border-white/[0.08] px-4">
                  <InfoRow icon={Users} label="Source" value={app.source} />
                  <InfoRow icon={Users} label="Sourced By" value={app.sourcedBy} />
                  <InfoRow icon={Users} label="Screened By" value={app.screenedBy} />
                  <InfoRow icon={FileText} label="Screening Notes" value={app.screeningNotes} />
                  {app.rejectionReason && (
                    <div className="py-2.5 border-b border-ink-100 dark:border-white/[0.06] last:border-0">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-500 mb-1">Rejection Reason</p>
                      <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{app.rejectionReason}</p>
                    </div>
                  )}
                  {app.internalNotes && (
                    <div className="py-2.5 border-b border-ink-100 dark:border-white/[0.06] last:border-0">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-1">Internal Notes</p>
                      <p className="text-xs text-ink-700 dark:text-ink-300 leading-relaxed">{app.internalNotes}</p>
                    </div>
                  )}
                </div>
              </div>
              {/* Offer stage: final status panel */}
              {app.interviewStage === "offer" && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Offer Status</p>
                  <div className="bg-white dark:bg-ink-800 border border-ink-200 dark:border-white/[0.08] p-4 space-y-3">
                    <InfoRow icon={FileText} label="Current Final Status" value={app.finalStatus} />
                    {app.offeredCtc && <InfoRow icon={FileText} label="Offered CTC" value={app.offeredCtc} />}
                    {app.expectedDoj && <InfoRow icon={CalendarDays} label="Expected DOJ" value={app.expectedDoj} />}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Update Status</label>
                        <select value={offerStatus} onChange={e => setOfferStatus(e.target.value)}
                          className="w-full border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-700 text-ink-900 dark:text-white px-2.5 py-1.5 text-xs rounded focus:outline-none focus:ring-2 focus:ring-brand-500">
                          <option value="">— select —</option>
                          {OFFER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <button onClick={saveOfferStatus} disabled={savingOffer || !offerStatus || offerStatus === app.finalStatus}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-40 transition-colors">
                        {savingOffer && <Loader2 className="size-3 animate-spin" />} Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {fileUrl && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1.5">Resume</p>
                  <div className="flex gap-2">
                    <a href={fileUrl} download className="inline-flex items-center gap-1.5 bg-ink-900 dark:bg-white text-white dark:text-ink-900 px-3 py-1.5 text-xs font-bold hover:opacity-80 transition-opacity">Download</a>
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-ink-200 dark:border-white/15 px-3 py-1.5 text-xs font-bold text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
                      <ExternalLink className="size-3" /> Open
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "rounds" && (
            <div className="px-5 py-4 space-y-3">
              {filledRounds.map(r => <RoundCard key={r.roundNumber} appId={app.id} round={r} onSaved={setRounds} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Kanban card ─────────────────────────────────────────────────────────────── */

function KanbanCard({ app, stageIdx, onSelect, onOpenWithMove, onFeedback }: {
  app: App; stageIdx: number
  onSelect: () => void
  onOpenWithMove: (stage: StageKey) => void
  onFeedback: () => void
}) {
  const nextStage = STAGES[stageIdx + 1]
  const isInterviewStage = ["l1", "l2", "l3"].includes(app.interviewStage)
  const roundSelected = app.currentRoundStatus === "Selected"
  const feedbackPending = isInterviewStage && app.currentRoundDate && app.currentRoundStatus === "Scheduled"
    && new Date(app.currentRoundDate) < new Date()

  return (
    <article
      className="rounded-lg border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 transition-shadow hover:shadow-md"
    >
      {/* Top strip — click to open drawer */}
      <div className="p-3.5 pb-2" onClick={onSelect}>
        <div className="flex items-start gap-2.5">
          <PersonAvatar name={app.fullName} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{app.fullName}</p>
            <p className="text-xs text-ink-500 dark:text-ink-400 truncate">{app.roleTitle}</p>
          </div>
        </div>

        {/* Key fields */}
        <div className="mt-2.5 ml-7 space-y-1">
          {(app.totalExperience || app.relevantExperience) && (
            <div className="flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
              <Clock className="size-3 shrink-0" />
              <span>{[app.totalExperience, app.relevantExperience && `Rel: ${app.relevantExperience}`].filter(Boolean).join(" · ")}</span>
            </div>
          )}
          {app.currentCompany && (
            <div className="flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
              <Briefcase className="size-3 shrink-0" />
              <span className="truncate">{app.currentCompany}{app.currentDesignation ? ` · ${app.currentDesignation}` : ""}</span>
            </div>
          )}
          {app.currentLocation && (
            <div className="flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
              <MapPin className="size-3 shrink-0" /><span>{app.currentLocation}</span>
            </div>
          )}
          {(app.currentCtc || app.expectedCtc) && (
            <div className="flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
              <FileText className="size-3 shrink-0" />
              <span>{[app.currentCtc && `CTC: ${app.currentCtc}`, app.expectedCtc && `Exp: ${app.expectedCtc}`].filter(Boolean).join(" | ")}</span>
            </div>
          )}
          {app.noticePeriod && (
            <div className="flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
              <CalendarDays className="size-3 shrink-0" /><span>NP: {app.noticePeriod}</span>
            </div>
          )}
          {(app.sourcedBy || app.screenedBy) && (
            <div className="flex items-center gap-1 text-xs text-ink-400 dark:text-ink-500">
              <Users className="size-3 shrink-0" />
              <span>{[app.sourcedBy && `Src: ${app.sourcedBy}`, app.screenedBy && `Scr: ${app.screenedBy}`].filter(Boolean).join(" · ")}</span>
            </div>
          )}
          {/* Current round info for interview stages */}
          {isInterviewStage && app.currentRoundDate && (
            <div className={cn("flex items-center gap-1 text-xs mt-0.5", feedbackPending ? "text-amber-600 dark:text-amber-400" : "text-ink-500 dark:text-ink-400")}>
              <CalendarDays className="size-3 shrink-0" />
              <span className="truncate">{new Date(app.currentRoundDate).toLocaleDateString()}{app.currentRoundInterviewer ? ` · ${app.currentRoundInterviewer}` : ""}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {app.source && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-ink-100 dark:bg-white/[0.08] text-ink-500 dark:text-ink-400">{app.source}</span>}
            {feedbackPending && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">Feedback Pending</span>}
            {isInterviewStage && app.currentRoundStatus && <RoundStatusPill status={app.currentRoundStatus} />}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 border-t border-ink-200 dark:border-white/10 px-3.5 py-2.5" onClick={e => e.stopPropagation()}>
        <button onClick={() => onOpenWithMove("rejected" as StageKey)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-400 hover:text-rose-600 transition-colors">
          <X className="size-3" /> Reject
        </button>
        {isInterviewStage ? (
          <>
            <button onClick={onFeedback}
              className="ml-auto inline-flex items-center gap-1 text-xs font-bold bg-brand-600 text-white px-2.5 py-1 rounded hover:bg-brand-700 transition-colors">
              <MessageSquare className="size-3" /> Feedback
            </button>
            {nextStage && roundSelected && (
              <button onClick={() => onOpenWithMove(nextStage.key as StageKey)}
                className="inline-flex items-center gap-1 text-xs font-bold border border-brand-600 text-brand-600 dark:text-brand-400 px-2.5 py-1 rounded hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors">
                {nextStage.label} →
              </button>
            )}
          </>
        ) : nextStage ? (
          <button onClick={() => onOpenWithMove(nextStage.key as StageKey)}
            className="ml-auto inline-flex items-center gap-1 text-xs font-bold bg-brand-600 text-white px-2.5 py-1 rounded hover:bg-brand-700 transition-colors">
            {nextStage.label} →
          </button>
        ) : null}
      </div>
    </article>
  )
}

/* ── Main page ───────────────────────────────────────────────────────────────── */

export function InterviewStages() {
  const [apps, setApps] = useState<App[]>([])
  const [selected, setSelected] = useState<App | null>(null)
  const [drawerMoveTarget, setDrawerMoveTarget] = useState<StageKey | undefined>(undefined)
  const [feedbackTarget, setFeedbackTarget] = useState<{ app: App; roundNo: number } | null>(null)
  const [filterRole, setFilterRole] = useState("")
  const [filterStage, setFilterStage] = useState("")
  const [filterExp, setFilterExp] = useState("")
  const [view, setView] = useState("pipeline")
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await axios.get(BASE)
      setApps((res.data as { data: App[] }).data ?? [])
    } catch { toast.error("Could not load candidates.") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (view !== "activity") return
    axios.get("/t2.0/authentificationUtilization/talent-logs")
      .then(r => setLogs((r.data as { data: LogEntry[] }).data ?? [])).catch(() => {})
  }, [view])

  const roles = useMemo(() => {
    const seen = new Set<string>(); apps.forEach(a => { if (a.roleTitle) seen.add(a.roleTitle) }); return [...seen].sort()
  }, [apps])

  const pipelineApps = useMemo(() => apps.filter(a => a.interviewStage !== "rejected"), [apps])

  const visible = useMemo(() => pipelineApps.filter(a => {
    if (filterRole && a.roleTitle !== filterRole) return false
    if (filterStage && a.interviewStage !== filterStage) return false
    if (!matchExp(a.totalExperience, filterExp)) return false
    return true
  }), [pipelineApps, filterRole, filterStage, filterExp])

  const hasFilter = !!(filterRole || filterStage || filterExp)

  function handleMoved(id: number, stage: StageKey) {
    setApps(prev => prev.map(a => a.id === id ? { ...a, interviewStage: stage, currentRoundStatus: null, currentRoundDate: null, currentRoundInterviewer: null } : a))
    setSelected(prev => prev?.id === id ? { ...prev, interviewStage: stage } : prev)
  }

  function handleAppUpdated(updated: App) {
    setApps(prev => prev.map(a => a.id === updated.id ? updated : a))
    setSelected(prev => prev?.id === updated.id ? updated : prev)
  }

  function handleFeedbackSaved(_rounds: Round[], updatedApp?: App) {
    if (updatedApp) {
      handleAppUpdated(updatedApp)
      // If candidate was auto-rejected, close drawer
      if (updatedApp.interviewStage === "rejected") setSelected(null)
    } else {
      // Reload apps to pick up new currentRoundStatus from the JOIN
      load()
    }
  }

  async function quickMove(app: App, stage: StageKey) {
    // Optimistic update — move card immediately, revert on failure
    const prevStage = app.interviewStage
    handleMoved(app.id, stage)
    try {
      await axios.patch(`${BASE}/${app.id}/interview-stage`, { stage })
      toast.success(`${app.fullName} → ${stage === "rejected" ? "Rejected" : STAGES.find(s => s.key === stage)?.label}`)
    } catch {
      handleMoved(app.id, prevStage)
      toast.error("Failed to move — reverted.")
    }
  }


  const stats = [
    { label: "Active candidates", value: String(pipelineApps.length) },
    { label: "Screened", value: String(pipelineApps.filter(a => a.interviewStage === "screened").length) },
    { label: "In Interviews", value: String(pipelineApps.filter(a => ["l1","l2","l3"].includes(a.interviewStage)).length) },
    { label: "At Offer", value: String(pipelineApps.filter(a => a.interviewStage === "offer").length) },
  ]

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Talent Acquisition" title="Interview Tracker"
        description="Drag candidates between stages or use the quick-move buttons. Click a card for full details & interview rounds." />
      <StatGrid stats={stats} />

      <TabBar tabs={[{ key: "pipeline", label: "Pipeline" }, { key: "activity", label: "Activity Log" }]} active={view} onChange={setView} />

      {view === "pipeline" && (
        <>
          <div className="border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-ink-500 dark:text-ink-400">Filters</span>
              {hasFilter && <button onClick={() => { setFilterRole(""); setFilterStage(""); setFilterExp("") }}
                className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400 hover:opacity-80">Reset</button>}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Role</label>
                <NativeSelect value={filterRole} onChange={e => setFilterRole(e.target.value)} aria-label="Role">
                  <option value="">All roles</option>
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Stage</label>
                <NativeSelect value={filterStage} onChange={e => setFilterStage(e.target.value)} aria-label="Stage">
                  <option value="">All stages</option>
                  {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Experience</label>
                <NativeSelect value={filterExp} onChange={e => setFilterExp(e.target.value)} aria-label="Experience">
                  {EXP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </NativeSelect>
              </div>
            </div>
            {hasFilter && <p className="mt-3 text-xs text-ink-400 tabular-nums">{visible.length} of {pipelineApps.length} candidates</p>}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-ink-400 gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading candidates…
            </div>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              <div className="grid min-w-[1300px] grid-cols-6 gap-4">
                {STAGES.map((s, si) => {
                  const list = visible.filter(a => a.interviewStage === s.key)
                  return (
                    <section key={s.key}
                      className="flex flex-col rounded-xl border border-ink-200 dark:border-white/10 bg-ink-50 dark:bg-white/[0.03]">
                      <header className="flex items-center justify-between border-b border-ink-200 dark:border-white/10 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", s.color)} />
                          <div>
                            <h2 className="text-sm font-semibold">{s.label}</h2>
                            <p className="text-xs text-ink-500 dark:text-ink-400">{s.hint}</p>
                          </div>
                        </div>
                        <span className="tabular-nums rounded-full bg-white dark:bg-ink-900 px-2 py-0.5 text-xs font-semibold">{list.length}</span>
                      </header>
                      <div className="flex flex-1 flex-col gap-3 p-3 min-h-[200px]">
                        {list.length === 0 && (
                          <p className="py-8 text-center text-xs text-ink-500 dark:text-ink-400">No candidates</p>
                        )}
                        {list.map(a => (
                          <KanbanCard key={a.id} app={a} stageIdx={si}
                            onSelect={() => { setDrawerMoveTarget(undefined); setSelected(a) }}
                            onOpenWithMove={(stage) => { setDrawerMoveTarget(stage); setSelected(a) }}
                            onFeedback={() => {
                              const roundNo = { l1: 1, l2: 2, l3: 3 }[a.interviewStage as string] ?? 1
                              setFeedbackTarget({ app: a, roundNo })
                            }}
                          />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {view === "activity" && (
        <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10">
          {logs.length === 0 ? (
            <div className="flex items-center gap-2 px-6 py-10 text-sm text-ink-400">
              <Activity className="size-4" /> No activity recorded yet.
            </div>
          ) : logs.map((l, i) => (
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
      )}

      {selected && (
        <CandidateDrawer
          app={selected}
          initialMoveTarget={drawerMoveTarget}
          onClose={() => { setSelected(null); setDrawerMoveTarget(undefined) }}
          onMoved={(id, stage) => { handleMoved(id, stage); setSelected(null); setDrawerMoveTarget(undefined) }}
          onAppUpdated={handleAppUpdated}
        />
      )}

      {feedbackTarget && (
        <FeedbackModal
          app={feedbackTarget.app}
          roundNo={feedbackTarget.roundNo}
          onClose={() => setFeedbackTarget(null)}
          onSaved={(rounds, updatedApp) => { handleFeedbackSaved(rounds, updatedApp); setFeedbackTarget(null) }}
        />
      )}
    </div>
  )
}
