import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, CornerUpLeft, Gauge, Layers, Send, Sparkles, Wallet, XCircle } from "lucide-react";
import {
  addToast, Button, Card, Checkbox, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Spinner, Tab, Tabs, Textarea,
} from "@/components/ui";
import { hasModuleAccess } from "@/lib/permissions";

/**
 * People Hub → Variable Pay (server: /variable-pay, see variablePay.service.ts).
 * Every employee (ELs too) sees their PMS final score per period and what the policy pays for it. If eligible they
 * appeal; the appeal goes straight to the Finance Head (no manager approves). Managers see their team's status only.
 * The Finance Head sees every employee in the Variable Pay Overview: appealed vs paid, by year or quarter.
 */
const BASE = "/t2.0/authentificationUtilization/variable-pay";

type Status = "WITH_REVIEWER" | "WITH_FINANCE" | "APPROVED" | "PAID" | "RETURNED";
interface Review { step: string; action: string; amount: number | null; comment: string; at: string; by: { userId: number; name: string } | null }
interface Req {
  id: number; userId: number; name: string; department: string; periodKey: string; periodLabel: string; start: string; end: string; cycle: string;
  goalPct: number | null; targetPct: number | null; goalWeight: number; score: number | null; slabPct: number;
  targetAmount: number; computedAmount: number; proposedAmount: number; finalAmount: number | null;
  note: string; status: Status; submittedAt: string; paidOn: string | null; history: Review[];
}
interface Quote { goalPct: number | null; targetPct: number | null; goalWeight: number; score: number | null; goalEntries: number; targetEntries: number; slabPct: number; targetAmount: number | null; computedAmount: number | null }
interface Elig { eligible: boolean; reasons: string[]; minScore: number; gap: number | null }
interface Slab { from: number; to: number | null; payout: number | null; cap?: number }
interface Period { key: string; label: string; start: string; end: string; cycle: string }

const data = <T,>(r: { data?: any }): T => r.data?.response ?? r.data?.data ?? r.data;
const errText = (e: any, f: string) => e?.response?.data?.message ?? f;
const inr = (v: number | null | undefined) => (v == null ? "—" : `₹${Math.round(v).toLocaleString("en-IN")}`);
const pct = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(2)}%`);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (d: string | null) => (d ? `${d.slice(8, 10)} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : "—");
const when = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
const slabText = (s: Slab) => `${s.from}% – ${s.to == null ? "above" : `${s.to}%`}`;

const STATUS: Record<Status | "NOT_APPEALED", { label: string; color: "default" | "primary" | "success" | "warning" | "danger" }> = {
  NOT_APPEALED: { label: "Not appealed", color: "default" },
  WITH_REVIEWER: { label: "With Finance Head", color: "primary" },
  WITH_FINANCE: { label: "With Finance Head", color: "primary" },
  APPROVED: { label: "Approved", color: "success" },
  PAID: { label: "Paid", color: "success" },
  RETURNED: { label: "Sent back", color: "danger" },
};
const StatusChip = ({ s }: { s: Status | "NOT_APPEALED" }) => <Chip size="sm" variant="flat" color={STATUS[s].color}>{STATUS[s].label}</Chip>;

/** A word of encouragement for someone who is not eligible this time (picked by the period, so it stays the same on reload) */
const QUOTES = [
  "Success is the sum of small efforts, repeated day in and day out. — Robert Collier",
  "The secret of getting ahead is getting started. — Mark Twain",
  "It always seems impossible until it's done. — Nelson Mandela",
  "Don't watch the clock; do what it does. Keep going. — Sam Levenson",
  "Quality is not an act, it is a habit. — Aristotle",
  "Your next cycle is a fresh page. Set one clear goal each week and log it.",
  "Small wins every day add up to a big score at the end of the quarter.",
];
const quoteFor = (key: string) => QUOTES[[...key].reduce((a, c) => a + c.charCodeAt(0), 0) % QUOTES.length]!;

function Header({ title, sub, children }: { title: string; sub: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="eyebrow">Variable Pay</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-500">{sub}</p>
      </div>
      {children}
    </div>
  );
}
function Stat({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: typeof Wallet }) {
  return (
    <Card className="flex flex-row items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        <p className="mt-1.5 truncate text-2xl font-extrabold tabular-nums leading-none text-ink-900 dark:text-white">{value}</p>
        {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      </div>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><Icon size={17} /></span>
    </Card>
  );
}

/** Appealed → Finance Head → Approved → Paid */
function Stepper({ r, approver }: { r?: Req; approver: string }) {
  const steps = ["Appealed", approver, "Approved", "Paid"];
  const at = !r ? 0 : r.status === "PAID" ? 4 : r.status === "APPROVED" ? 3 : r.status === "RETURNED" ? 0 : 1;
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
      {steps.map((s, i) => {
        const done = i < at, now = i === at && r && r.status !== "RETURNED" && r.status !== "PAID";
        return (
          <Fragment key={s}>
            {i > 0 && <span className="text-ink-300">→</span>}
            <li className={`flex items-center gap-1 px-2 py-1 ${done ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : now ? "bg-brand-50 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-300" : "bg-ink-100 text-ink-500 dark:bg-white/5"}`}>
              {done && <Check size={11} />}{s}
            </li>
          </Fragment>
        );
      })}
      {r?.status === "RETURNED" && <li className="ml-1 bg-rose-50 px-2 py-1 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">Sent back</li>}
    </ol>
  );
}

/** How the payout is worked out: goal % and target % → PMS final score → slab → amount */
function Working({ q }: { q: { goalPct: number | null; targetPct: number | null; goalWeight: number; score: number | null; slabPct: number; targetAmount: number | null; computedAmount: number | null } }) {
  const both = q.goalPct != null && q.targetPct != null;
  const rows: [string, string, string][] = [
    ["Goal %", pct(q.goalPct), both ? `weight ${q.goalWeight}%` : "each goal counts the same"],
    ["Target %", pct(q.targetPct), both ? `weight ${100 - q.goalWeight}%` : "each target counts the same"],
    ["PMS final score", pct(q.score), both && q.score != null ? `Goal^${(q.goalWeight / 100).toFixed(2)} × Target^${(1 - q.goalWeight / 100).toFixed(2)}` : q.goalPct == null && q.targetPct == null ? "no goal or target entries" : "needs both goal and target figures"],
    ["Policy payout", `${q.slabPct}%`, "slab from Policy & Slabs"],
    ["Target variable", inr(q.targetAmount), "100% payout for this period"],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {rows.map(([k, v, h]) => (
        <div key={k} className="border border-ink-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-ink-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{k}</p>
          <p className="text-base font-extrabold tabular-nums text-ink-900 dark:text-white">{v}</p>
          <p className="text-[11px] text-ink-500">{h}</p>
        </div>
      ))}
      <div className="border border-brand-300 bg-brand-50 px-3 py-2 dark:border-brand-500/40 dark:bg-brand-500/10">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Variable pay</p>
        <p className="text-base font-extrabold tabular-nums text-ink-900 dark:text-white">{inr(q.computedAmount)}</p>
        <p className="text-[11px] text-ink-500">{q.targetAmount != null ? `${inr(q.targetAmount)} × ${q.slabPct}%` : "not set up"}</p>
      </div>
    </div>
  );
}

function History({ r }: { r: Req }) {
  const [open, setOpen] = useState(false);
  const label: Record<string, string> = { SENT: "appealed", RESENT: "appealed again", APPROVED: "approved", RETURNED: "sent back", PAID: "marked paid" };
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 focus-ring">
        {open ? "Hide history" : `History (${r.history.length})`}<ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ol className="mt-2 space-y-1.5 border-l border-ink-200 pl-3 text-xs dark:border-white/10">
          {r.history.map((h, i) => (
            <li key={i}>
              <span className="font-semibold text-ink-900 dark:text-white">{h.by?.name ?? "—"}</span> {label[h.action] ?? h.action.toLowerCase()}
              {h.amount != null && <> · <b className="tabular-nums">{inr(h.amount)}</b></>} <span className="text-ink-400">· {when(h.at)}</span>
              {h.comment && <p className="text-ink-600 dark:text-ink-300">“{h.comment}”</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function useLoad<T>(url: string, params?: Record<string, unknown>) {
  const [d, setD] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const key = JSON.stringify(params ?? {});
  const load = useCallback(() => {
    setLoading(true);
    axios.get(url, { params }).then((r) => { setD(data<T>(r)); setError(""); }).catch((e) => setError(errText(e, "Could not load. Please refresh."))).finally(() => setLoading(false));
  }, [url, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { d, loading, error, load };
}

/** Not eligible: the reasons, how far off they were, and some encouragement */
function NotEligible({ el, periodKey }: { el: Elig; periodKey: string }) {
  return (
    <div className="flex flex-col gap-3 border-l-[3px] border-l-rose-500 bg-rose-50/60 p-4 dark:bg-rose-900/15">
      <p className="flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-300"><XCircle size={16} /> Not eligible for variable pay this period</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700 dark:text-ink-200">{el.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      {el.gap != null && <p className="text-sm text-ink-700 dark:text-ink-200">You were <b>{el.gap.toFixed(2)} points</b> short of the {el.minScore}% needed. Keep your goal and target entries up to date every week to close the gap.</p>}
      <p className="flex items-start gap-2 border-t border-rose-200 pt-3 text-sm italic text-ink-700 dark:border-rose-500/20 dark:text-ink-200"><Sparkles size={15} className="mt-0.5 shrink-0 text-brand-600" />{quoteFor(periodKey)}</p>
    </div>
  );
}

// ═══ My Variable Pay ═════════════════════════════════════════════════════════════════════════════
interface Mine {
  person: { cycle: string; cycleLabel: string; cycleSet: boolean; level: string; levelPct: number; annual: number | null; source: "OVERRIDE" | "CTC" | null; department: string };
  approver: { userId: number; name: string }; slabs: Slab[];
  current: Period & { quote: Quote; eligibility: Elig };
  periods: (Period & { state: "OPEN" | "SENT"; request: Req | null; quote: Quote | null; eligibility: Elig | null })[];
  requests: Req[];
}
export function MyVariablePay() {
  const { d, loading, error, load } = useLoad<Mine>(`${BASE}/me`);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const send = (key: string) => {
    setSending(key);
    axios.post(`${BASE}/me/send`, { periodKey: key, note: notes[key] || null })
      .then(() => { addToast({ title: "Appeal sent", description: `It is with ${d?.approver.name ?? "the Finance Head"} now.`, color: "success" }); load(); })
      .catch((e) => addToast({ title: "Could not send", description: errText(e, "Please try again."), color: "danger" }))
      .finally(() => setSending(null));
  };
  const paidYtd = (d?.requests ?? []).filter((r) => r.status === "PAID" && r.paidOn?.startsWith(String(new Date().getFullYear()))).reduce((a, r) => a + (r.finalAmount ?? 0), 0);
  const levelName: Record<string, string> = { ASSOCIATE: "Associate", MANAGER: "Manager", HEAD_EL: "Head / EL" };
  const approver = d ? `Finance Head · ${d.approver.name}` : "Finance Head";

  return (
    <section className="flex flex-col gap-5">
      <Header title="My Variable Pay" sub="Your variable pay comes from your PMS final score for each period of your cycle and the Variable Pay policy. When a period ends and you are eligible, appeal for it; your appeal goes straight to the Finance Head." />
      {loading && !d && <Spinner />}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Your cycle" value={d.person.cycleLabel} hint={d.person.cycleSet ? d.person.department : "not set by HR yet: half-yearly is used"} icon={Layers} />
            <Stat label="Annual target variable" value={inr(d.person.annual)} hint={d.person.source === "OVERRIDE" ? "set by HR" : d.person.source === "CTC" ? `${d.person.levelPct}% of CTC (${levelName[d.person.level] ?? d.person.level})` : "not set up"} icon={Wallet} />
            <Stat label={`So far in ${d.current.label.split(" (")[0]}`} value={pct(d.current.quote.score)} hint={d.current.eligibility.eligible ? `on track for ${inr(d.current.quote.computedAmount)} (${d.current.quote.slabPct}%)` : `needs ${d.current.eligibility.minScore}% to qualify`} icon={Gauge} />
            <Stat label="Paid this year" value={inr(paidYtd)} icon={CheckCircle2} />
          </div>

          {d.periods.map((p) => {
            const r = p.request;
            const open = !r || r.status === "RETURNED";
            return (
              <Card key={p.key} className="p-5">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">{p.label}</h2>
                  {r ? <StatusChip s={r.status} /> : p.eligibility?.eligible ? <Chip size="sm" variant="flat" color="success">Eligible</Chip> : <Chip size="sm" variant="flat" color="danger">Not eligible</Chip>}
                  {r && <span className="ml-auto text-xs text-ink-500">Appealed {when(r.submittedAt)}</span>}
                </div>
                {!open ? (
                  <div className="flex flex-col gap-3">
                    <Working q={r!} />
                    <Stepper r={r!} approver={approver} />
                    {r!.finalAmount != null && <p className="text-sm">Approved: <b className="text-emerald-700 dark:text-emerald-300">{inr(r!.finalAmount)}</b>{r!.finalAmount !== r!.computedAmount ? ` (worked out ${inr(r!.computedAmount)})` : ""}{r!.paidOn ? ` · paid on ${day(r!.paidOn)}` : ""}</p>}
                    <History r={r!} />
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {r?.status === "RETURNED" && (
                      <div className="border-l-[3px] border-l-rose-500 bg-rose-50 px-3 py-2 text-sm dark:bg-rose-900/20">
                        Sent back: “{[...r.history].reverse().find((h) => h.action === "RETURNED")?.comment}”. Check your entries and appeal again; the score is worked out afresh.
                      </div>
                    )}
                    {p.quote && <Working q={p.quote} />}
                    {p.quote && <p className="text-xs text-ink-500">From {p.quote.goalEntries} goal and {p.quote.targetEntries} target entries between {day(p.start)} and {day(p.end)}. Missing something? Add it in PMS → Target & Goals first.</p>}
                    {p.eligibility && !p.eligibility.eligible ? <NotEligible el={p.eligibility} periodKey={p.key} /> : (
                      <>
                        <Textarea label="Note for the Finance Head (optional)" size="sm" minRows={2} value={notes[p.key] ?? ""} onValueChange={(v) => setNotes((n) => ({ ...n, [p.key]: v }))} />
                        <div className="flex flex-wrap items-center gap-3">
                          <Button color="primary" startContent={<Send size={14} />} isLoading={sending === p.key} onPress={() => send(p.key)}>{r ? "Appeal again" : `Appeal for ${inr(p.quote?.computedAmount)}`}</Button>
                          <Stepper approver={approver} />
                        </div>
                      </>
                    )}
                    {r && <History r={r} />}
                  </div>
                )}
              </Card>
            );
          })}

          {d.requests.filter((r) => !d.periods.some((p) => p.key === r.periodKey)).length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Earlier periods</h2>
              <RequestTable rows={d.requests.filter((r) => !d.periods.some((p) => p.key === r.periodKey))} hideName />
            </Card>
          )}
        </>
      )}
    </section>
  );
}

function RequestTable({ rows, hideName }: { rows: Req[]; hideName?: boolean }) {
  return (
    <div className="overflow-x-auto border border-ink-200 dark:border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-ink-50 dark:bg-ink-800"><tr className="text-left">
          {[...(hideName ? [] : ["Employee"]), "Period", "PMS score", "Payout %", "Appealed", "Approved", "Status", "Paid on"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-ink-100 align-top dark:border-white/5">
              {!hideName && <td className="px-3 py-2"><b>{r.name}</b><p className="text-xs text-ink-500">{r.department}</p></td>}
              <td className="whitespace-nowrap px-3 py-2">{r.periodLabel}<div className="mt-1"><History r={r} /></div></td>
              <td className="px-3 py-2 tabular-nums">{pct(r.score)}</td>
              <td className="px-3 py-2 tabular-nums">{r.slabPct}%</td>
              <td className="px-3 py-2 tabular-nums">{inr(r.computedAmount)}</td>
              <td className="px-3 py-2 font-semibold tabular-nums">{inr(r.finalAmount)}</td>
              <td className="px-3 py-2"><StatusChip s={r.status} /></td>
              <td className="whitespace-nowrap px-3 py-2">{day(r.paidOn)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-ink-400">Nothing here.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ═══ Team Variable Pay (managers: status only) ═══════════════════════════════════════════════════
interface TeamRow { userId: number; name: string; department: string; cycleLabel: string; setUp: boolean; lastPeriod: string; lastStatus: Status | "NOT_APPEALED"; appealed: number; paid: number; lastScore: number | null; lastAmount: number | null }
export function TeamVariablePay() {
  const { d, loading, error } = useLoad<{ people: TeamRow[]; requests: Req[] }>(`${BASE}/team`);
  const [tab, setTab] = useState("people");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const people = (d?.people ?? []).filter((p) => (!q || `${p.name} ${p.department}`.toLowerCase().includes(q.toLowerCase())) && (status === "all" || p.lastStatus === status));
  const reqs = (d?.requests ?? []).filter((r) => !q || `${r.name} ${r.department}`.toLowerCase().includes(q.toLowerCase()));
  const count = (s: string) => (d?.people ?? []).filter((p) => p.lastStatus === s).length;
  return (
    <section className="flex flex-col gap-5">
      <Header title="Team Variable Pay" sub="Where your team's variable pay stands. Appeals go straight to the Finance Head; you see the status only." />
      {loading && !d && <Spinner />}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {d && !d.people.length && <Card className="p-10 text-center text-sm text-ink-500">Nobody is below you in the Hierarchy (Access Management → Hierarchy), so there is no team variable pay to show.</Card>}
      {d && d.people.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Team members" value={String(d.people.length)} hint={`${d.people.filter((p) => !p.setUp).length} not set up`} icon={Layers} />
            <Stat label="Appealed (last period)" value={String(d.people.length - count("NOT_APPEALED"))} hint={`${count("NOT_APPEALED")} not appealed`} icon={Send} />
            <Stat label="Approved / paid (last period)" value={String(count("APPROVED") + count("PAID"))} icon={CheckCircle2} />
            <Stat label="Paid to the team" value={inr(d.people.reduce((a, p) => a + p.paid, 0))} hint="all periods" icon={Wallet} />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Tabs aria-label="Show" selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
              <Tab key="people" title={`Team (${d.people.length})`} />
              <Tab key="history" title={`All appeals (${d.requests.length})`} />
            </Tabs>
            <Input aria-label="Search" placeholder="Search name or department" size="sm" className="w-64" value={q} onValueChange={setQ} isClearable onClear={() => setQ("")} />
            {tab === "people" && (
              <Select aria-label="Status" size="sm" className="w-52" selectedKeys={new Set([status])} disallowEmptySelection onSelectionChange={(k) => setStatus(String(Array.from(k)[0]))}>
                {[<SelectItem key="all">Every status</SelectItem>, ...(["NOT_APPEALED", "WITH_FINANCE", "APPROVED", "PAID", "RETURNED"] as const).map((s) => <SelectItem key={s}>{STATUS[s].label}</SelectItem>)]}
              </Select>
            )}
          </div>
          {tab === "people" ? (
            <div className="overflow-x-auto border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 dark:bg-ink-800"><tr className="text-left">{["Employee", "Cycle", "Last finished period", "PMS score", "Amount", "Status", "Appealed (all)", "Paid (all)"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5">{h}</th>)}</tr></thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.userId} className="border-t border-ink-100 dark:border-white/5">
                      <td className="px-3 py-2"><b>{p.name}</b><p className="text-xs text-ink-500">{p.department}</p></td>
                      <td className="px-3 py-2">{p.cycleLabel}{!p.setUp && <p className="text-[11px] text-amber-600">not set up</p>}</td>
                      <td className="whitespace-nowrap px-3 py-2">{p.lastPeriod}</td>
                      <td className="px-3 py-2 tabular-nums">{pct(p.lastScore)}</td>
                      <td className="px-3 py-2 tabular-nums">{inr(p.lastAmount)}</td>
                      <td className="px-3 py-2"><StatusChip s={p.lastStatus} /></td>
                      <td className="px-3 py-2 tabular-nums">{inr(p.appealed)}</td>
                      <td className="px-3 py-2 font-semibold tabular-nums">{inr(p.paid)}</td>
                    </tr>
                  ))}
                  {!people.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-ink-400">No one matches.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : <RequestTable rows={reqs} />}
        </>
      )}
    </section>
  );
}

// ═══ Variable Pay Overview (Finance Head / Admin) ════════════════════════════════════════════════
interface Bucket { period: string; requests: number; appealed: number; approved: number; paid: number; pending: number }
interface Everyone {
  userId: number; name: string; department: string; cycleLabel: string; setUp: boolean; lastPeriod: string; lastStatus: Status | "NOT_APPEALED";
  score: number | null; goalPct: number | null; targetPct: number | null; slabPct: number; targetAmount: number | null; expected: number | null; eligible: boolean; reasons: string[];
}
export function FinanceVariablePay() {
  const thisYear = new Date().getFullYear();
  const [years, setYears] = useState<Set<string>>(new Set([String(thisYear)]));
  const [quarters, setQuarters] = useState<Set<string>>(new Set(["1", "2", "3", "4"]));
  const [groupBy, setGroupBy] = useState<"quarter" | "year">("quarter");
  const [dept, setDept] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [tab, setTab] = useState("appeals");
  const params = { years: [...years].join(","), quarters: quarters.size === 4 ? "" : [...quarters].join(","), groupBy };
  const { d, loading, error, load } = useLoad<{ years: number[]; buckets: Bucket[]; requests: Req[]; everyone: Everyone[] }>(`${BASE}/finance`, params);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [amount, setAmount] = useState<Record<number, string>>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState<Req | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [paidOn, setPaidOn] = useState(todayIso());
  useEffect(() => setPicked(new Set()), [params.years, params.quarters]);
  const [tabChosen, setTabChosen] = useState(false);
  useEffect(() => { if (d && !tabChosen) setTab(d.requests.length ? "appeals" : "everyone"); }, [d, tabChosen]);
  const [eligF, setEligF] = useState("all");

  const depts = useMemo(() => [...new Set([...(d?.requests ?? []).map((r) => r.department), ...(d?.everyone ?? []).map((p) => p.department)])].sort(), [d]);
  const rows = (d?.requests ?? []).filter((r) => (dept === "all" || r.department === dept) && (statusF === "all" || r.status === statusF || (statusF === "WITH_FINANCE" && r.status === "WITH_REVIEWER")));
  const everyone = (d?.everyone ?? []).filter((p) => dept === "all" || p.department === dept);
  const byDept = useMemo(() => { const m = new Map<string, Req[]>(); for (const r of rows) m.set(r.department, [...(m.get(r.department) ?? []), r]); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])); }, [rows]);
  const sum = (xs: Req[], f: (r: Req) => number | null) => xs.reduce((a, r) => a + (f(r) ?? 0), 0);
  const waiting = rows.filter((r) => r.status === "WITH_FINANCE" || r.status === "WITH_REVIEWER");
  const approvedOrPaid = rows.filter((r) => r.status === "APPROVED" || r.status === "PAID");
  const paid = rows.filter((r) => r.status === "PAID");
  const pickedRows = rows.filter((r) => picked.has(r.id));
  const pickedWaiting = pickedRows.filter((r) => r.status === "WITH_FINANCE"), pickedApproved = pickedRows.filter((r) => r.status === "APPROVED");
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const valueOf = (r: Req) => (amount[r.id] === undefined || amount[r.id] === "" ? r.proposedAmount : Number(amount[r.id]));
  const bucketLabel = (k: string) => (k.includes("-Q") ? `Q${k.slice(6)} ${k.slice(0, 4)}` : k);

  const approve = () => {
    if (pickedWaiting.some((r) => valueOf(r) !== r.proposedAmount) && !comment.trim()) { addToast({ title: "Add a reason", description: "Some amounts were changed: give a reason.", color: "warning" }); return; }
    setBusy(true);
    axios.post(`${BASE}/finance/approve`, { items: pickedWaiting.map((r) => ({ id: r.id, amount: valueOf(r) })), comment: comment.trim() || null })
      .then((x) => { addToast({ title: `Approved ${data<{ approved: number }>(x).approved}`, color: "success" }); setPicked(new Set()); setComment(""); load(); })
      .catch((e) => addToast({ title: "Could not approve", description: errText(e, "Please try again."), color: "danger" })).finally(() => setBusy(false));
  };
  const markPaid = () => {
    setBusy(true);
    axios.post(`${BASE}/finance/paid`, { ids: pickedApproved.map((r) => r.id), paidOn })
      .then((x) => { addToast({ title: `Marked ${data<{ paid: number }>(x).paid} paid`, color: "success" }); setPicked(new Set()); load(); })
      .catch((e) => addToast({ title: "Could not mark paid", description: errText(e, "Please try again."), color: "danger" })).finally(() => setBusy(false));
  };
  const sendBack = () => {
    if (!returning || !returnNote.trim()) return;
    setBusy(true);
    axios.post(`${BASE}/finance/${returning.id}/return`, { comment: returnNote.trim() })
      .then(() => { addToast({ title: "Sent back", description: returning.name, color: "success" }); setReturning(null); setReturnNote(""); load(); })
      .catch((e) => addToast({ title: "Could not send back", description: errText(e, "Please try again."), color: "danger" })).finally(() => setBusy(false));
  };
  const multi = (label: string, all: string[], value: Set<string>, set: (v: Set<string>) => void, name: (k: string) => string) => (
    <Select label={label} size="sm" selectionMode="multiple" disallowEmptySelection selectedKeys={value}
      renderValue={() => (value.size === all.length ? `All ${label.toLowerCase()}` : [...value].sort().map(name).join(", "))}
      onSelectionChange={(k) => set(new Set(Array.from(k as Set<string>).map(String)))}>
      {all.map((k) => <SelectItem key={k}>{name(k)}</SelectItem>)}
    </Select>
  );

  return (
    <section className="flex flex-col gap-5">
      <Header title="Variable Pay Overview" sub="Every employee's variable pay: appealed, approved and paid, by year or quarter. Approve appeals (changing an amount needs a reason), send one back to the employee, and mark them paid." />
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {multi("Years", (d?.years ?? [thisYear]).map(String), years, setYears, (k) => k)}
        {multi("Quarters", ["1", "2", "3", "4"], quarters, setQuarters, (k) => `Q${k}`)}
        <Select label="View by" size="sm" selectedKeys={new Set([groupBy])} disallowEmptySelection onSelectionChange={(k) => setGroupBy(String(Array.from(k)[0]) as "quarter" | "year")}>
          <SelectItem key="quarter">Quarter</SelectItem><SelectItem key="year">Year</SelectItem>
        </Select>
        <Select label="Department" size="sm" selectedKeys={new Set([dept])} disallowEmptySelection onSelectionChange={(k) => setDept(String(Array.from(k)[0]))}>
          {[<SelectItem key="all">All departments</SelectItem>, ...depts.map((x) => <SelectItem key={x}>{x}</SelectItem>)]}
        </Select>
        <Select label="Status" size="sm" selectedKeys={new Set([statusF])} disallowEmptySelection onSelectionChange={(k) => setStatusF(String(Array.from(k)[0]))}>
          {[<SelectItem key="all">Every status</SelectItem>, ...(["WITH_FINANCE", "APPROVED", "PAID", "RETURNED"] as const).map((s) => <SelectItem key={s}>{s === "WITH_FINANCE" ? "Waiting for approval" : STATUS[s].label}</SelectItem>)]}
        </Select>
        </div>
        <p className="mt-3 flex items-center gap-2 text-[11px] text-ink-500">{loading && <Spinner size="sm" />}An appeal counts in the quarter and year its period ends in (a half year ending in September counts in Q3). Years, quarters and status apply to appeals; All employees shows each person's last finished period.</p>
      </Card>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Appealed" value={inr(sum(rows, (r) => r.computedAmount))} hint={`${rows.length} appeals`} icon={Send} />
            <Stat label="Waiting for approval" value={inr(sum(waiting, (r) => r.proposedAmount))} hint={`${waiting.length} appeals`} icon={Layers} />
            <Stat label="Approved" value={inr(sum(approvedOrPaid, (r) => r.finalAmount))} hint={`${approvedOrPaid.length} appeals`} icon={CheckCircle2} />
            <Stat label="Paid" value={inr(sum(paid, (r) => r.finalAmount))} hint={`${paid.length} appeals`} icon={Wallet} />
          </div>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">By {groupBy}</h2>
            <div className="overflow-x-auto border border-ink-200 dark:border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 dark:bg-ink-800"><tr className="text-left">{["Period", "Appeals", "Waiting", "Appealed", "Approved", "Paid", "Paid of appealed"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5">{h}</th>)}</tr></thead>
                <tbody>
                  {d.buckets.map((b) => (
                    <tr key={b.period} className="border-t border-ink-100 dark:border-white/5">
                      <td className="px-3 py-2 font-semibold">{bucketLabel(b.period)}</td>
                      <td className="px-3 py-2 tabular-nums">{b.requests}</td>
                      <td className="px-3 py-2 tabular-nums">{b.pending}</td>
                      <td className="px-3 py-2 tabular-nums">{inr(b.appealed)}</td>
                      <td className="px-3 py-2 tabular-nums">{inr(b.approved)}</td>
                      <td className="px-3 py-2 font-semibold tabular-nums">{inr(b.paid)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2"><div className="h-1.5 w-28 overflow-hidden bg-ink-100 dark:bg-white/10"><div className="h-full bg-brand-600" style={{ width: `${b.appealed ? Math.min(100, (b.paid / b.appealed) * 100) : 0}%` }} /></div><span className="text-xs tabular-nums text-ink-500">{b.appealed ? `${Math.round((b.paid / b.appealed) * 100)}%` : "—"}</span></div>
                      </td>
                    </tr>
                  ))}
                  {!d.buckets.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-ink-400">No appeals for these years and quarters.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          {/* last finished period for everyone, appealed or not */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="Calculated payout (all eligible)" value={inr(everyone.filter((p) => p.eligible).reduce((a, p) => a + (p.expected ?? 0), 0))} hint={`${everyone.filter((p) => p.eligible).length} eligible employees, before any appeal`} icon={CheckCircle2} />
            <Stat label="Eligible, not appealed yet" value={inr(everyone.filter((p) => p.eligible && p.lastStatus === "NOT_APPEALED").reduce((a, p) => a + (p.expected ?? 0), 0))} hint={`${everyone.filter((p) => p.eligible && p.lastStatus === "NOT_APPEALED").length} employees still to appeal`} icon={Send} />
            <Stat label="Not eligible" value={String(everyone.filter((p) => !p.eligible && p.setUp).length)} hint="score below the minimum or no entries" icon={XCircle} />
            <Stat label="Not set up" value={String(everyone.filter((p) => !p.setUp).length)} hint="no CTC: HR adds it" icon={AlertTriangle} />
          </div>

          <Tabs aria-label="Show" selectedKey={tab} onSelectionChange={(k) => { setTab(String(k)); setTabChosen(true); }}>
            <Tab key="appeals" title={`Appeals (${rows.length})`} />
            <Tab key="everyone" title={`All employees (${everyone.length})`} />
          </Tabs>

          {tab === "appeals" && (
            <>
              {picked.size > 0 && (
                <Card className="flex flex-row flex-wrap items-end gap-3 border-l-[3px] border-l-brand-600 p-4">
                  <span className="text-sm"><b>{picked.size}</b> selected</span>
                  {pickedWaiting.length > 0 && (
                    <>
                      <Input label="Reason (if you changed an amount)" size="sm" className="min-w-64 flex-1" value={comment} onValueChange={setComment} />
                      <Button color="primary" startContent={<Check size={14} />} isLoading={busy} onPress={approve}>Approve {pickedWaiting.length} · {inr(sum(pickedWaiting, valueOf))}</Button>
                    </>
                  )}
                  {pickedApproved.length > 0 && (
                    <>
                      <Input type="date" label="Paid on" size="sm" className="w-44" value={paidOn} onValueChange={setPaidOn} />
                      <Button variant="bordered" startContent={<Wallet size={14} />} isLoading={busy} onPress={markPaid}>Mark {pickedApproved.length} paid</Button>
                    </>
                  )}
                  <button type="button" className="text-xs font-semibold text-brand-600 hover:underline" onClick={() => setPicked(new Set())}>Clear</button>
                </Card>
              )}
              {byDept.map(([dname, list]) => {
                const selectable = list.filter((r) => r.status === "WITH_FINANCE" || r.status === "APPROVED");
                const all = selectable.length > 0 && selectable.every((r) => picked.has(r.id));
                return (
                  <Card key={dname} className="p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">{dname}</h2>
                      <span className="text-xs text-ink-500">{list.length} appeals · appealed {inr(sum(list, (r) => r.computedAmount))} · paid {inr(sum(list.filter((r) => r.status === "PAID"), (r) => r.finalAmount))}</span>
                      {selectable.length > 0 && <button type="button" className="ml-auto text-xs font-semibold text-brand-600 hover:underline" onClick={() => setPicked((s) => { const n = new Set(s); for (const r of selectable) { if (all) n.delete(r.id); else n.add(r.id); } return n; })}>{all ? "Unselect department" : "Select department"}</button>}
                    </div>
                    <div className="overflow-x-auto border border-ink-200 dark:border-white/10">
                      <table className="w-full text-sm">
                        <thead className="bg-ink-50 dark:bg-ink-800"><tr className="text-left">
                          {["", "Employee", "Period", "PMS score", "Payout %", "Target", "Appealed", "Approved", "Status", ""].map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2.5">{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {list.map((r) => (
                            <tr key={r.id} className="border-t border-ink-100 align-top dark:border-white/5">
                              <td className="px-3 py-2"><Checkbox size="sm" aria-label={`Select ${r.name}`} isSelected={picked.has(r.id)} isDisabled={r.status !== "WITH_FINANCE" && r.status !== "APPROVED"} onValueChange={() => toggle(r.id)} /></td>
                              <td className="px-3 py-2"><b>{r.name}</b>{r.note && <p className="max-w-[260px] text-xs text-ink-500">“{r.note}”</p>}<div className="mt-1"><History r={r} /></div></td>
                              <td className="whitespace-nowrap px-3 py-2">{r.periodLabel}</td>
                              <td className="px-3 py-2 tabular-nums">{pct(r.score)}</td>
                              <td className="px-3 py-2 tabular-nums">{r.slabPct}%</td>
                              <td className="px-3 py-2 tabular-nums">{inr(r.targetAmount)}</td>
                              <td className="px-3 py-2 tabular-nums">{inr(r.computedAmount)}</td>
                              <td className="px-3 py-2">
                                {r.status === "WITH_FINANCE"
                                  ? <input type="number" min={0} aria-label={`Amount for ${r.name}`} className="h-8 w-28 border border-ink-200 bg-white px-2 text-right text-sm font-semibold tabular-nums focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-ink-900" value={amount[r.id] ?? String(r.proposedAmount)} onChange={(e) => setAmount((a) => ({ ...a, [r.id]: e.target.value }))} />
                                  : <span className="font-semibold tabular-nums">{inr(r.finalAmount)}</span>}
                              </td>
                              <td className="px-3 py-2"><StatusChip s={r.status} />{r.paidOn && <p className="mt-1 text-xs text-ink-500">paid {day(r.paidOn)}</p>}</td>
                              <td className="px-3 py-2">{r.status === "WITH_FINANCE" && <Button size="sm" variant="light" startContent={<CornerUpLeft size={13} />} onPress={() => { setReturning(r); setReturnNote(""); }}>Send back</Button>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })}
              {!byDept.length && <Card className="p-10 text-center text-sm text-ink-500">No appeals match these filters yet. {everyone.some((p) => p.eligible && p.lastStatus === "NOT_APPEALED") ? `${everyone.filter((p) => p.eligible && p.lastStatus === "NOT_APPEALED").length} employees are eligible for their last period and have not appealed: see All employees.` : ""}</Card>}
            </>
          )}

          {tab === "everyone" && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Select aria-label="Eligibility" size="sm" className="w-60" selectedKeys={new Set([eligF])} disallowEmptySelection onSelectionChange={(k) => setEligF(String(Array.from(k)[0]))}>
                  <SelectItem key="all">Everyone</SelectItem><SelectItem key="eligible">Eligible</SelectItem><SelectItem key="waiting">Eligible, not appealed</SelectItem><SelectItem key="not">Not eligible</SelectItem><SelectItem key="setup">Not set up</SelectItem>
                </Select>
                <span className="text-xs text-ink-500">Each person's last finished period of their cycle, worked out now from their PMS entries.</span>
              </div>
              <div className="overflow-x-auto border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 dark:bg-ink-800"><tr className="text-left">{["Employee", "Cycle · last period", "Goal %", "Target %", "PMS score", "Payout %", "Target", "Expected", "Eligible", "Status", "Appealed", "Paid"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5">{h}</th>)}</tr></thead>
                  <tbody>
                    {everyone.filter((p) => eligF === "all" || (eligF === "eligible" && p.eligible) || (eligF === "waiting" && p.eligible && p.lastStatus === "NOT_APPEALED") || (eligF === "not" && !p.eligible && p.setUp) || (eligF === "setup" && !p.setUp)).map((p) => {
                      const mine = (d.requests ?? []).filter((r) => r.userId === p.userId);
                      return (
                        <tr key={p.userId} className="border-t border-ink-100 align-top dark:border-white/5">
                          <td className="px-3 py-2"><b>{p.name}</b><p className="text-xs text-ink-500">{p.department}</p></td>
                          <td className="whitespace-nowrap px-3 py-2">{p.cycleLabel}<p className="text-xs text-ink-500">{p.lastPeriod}</p></td>
                          <td className="px-3 py-2 tabular-nums">{pct(p.goalPct)}</td>
                          <td className="px-3 py-2 tabular-nums">{pct(p.targetPct)}</td>
                          <td className="px-3 py-2 font-semibold tabular-nums">{pct(p.score)}</td>
                          <td className="px-3 py-2 tabular-nums">{p.slabPct}%</td>
                          <td className="px-3 py-2 tabular-nums">{inr(p.targetAmount)}</td>
                          <td className="px-3 py-2 font-semibold tabular-nums">{inr(p.expected)}</td>
                          <td className="px-3 py-2">{p.eligible ? <Chip size="sm" variant="flat" color="success">Eligible</Chip> : <span title={p.reasons.join(" ")}><Chip size="sm" variant="flat" color={p.setUp ? "danger" : "warning"}>{p.setUp ? "Not eligible" : "Not set up"}</Chip><p className="mt-1 max-w-[220px] text-[11px] text-ink-500">{p.reasons[p.setUp ? 0 : 0]}</p></span>}</td>
                          <td className="px-3 py-2"><StatusChip s={p.lastStatus} /></td>
                          <td className="px-3 py-2 tabular-nums">{inr(mine.reduce((a, r) => a + r.computedAmount, 0))}</td>
                          <td className="px-3 py-2 font-semibold tabular-nums">{inr(mine.filter((r) => r.status === "PAID").reduce((a, r) => a + (r.finalAmount ?? 0), 0))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-[11px] text-ink-500">Appealed / paid totals are for the years and quarters chosen above.</p>
              </div>
            </>
          )}
        </>
      )}
      <Modal isOpen={!!returning} onOpenChange={(o) => { if (!o) setReturning(null); }}>
        <ModalContent>
          <ModalHeader>Send back {returning?.name}'s appeal</ModalHeader>
          <ModalBody>
            <p className="text-sm text-ink-500">It goes back to {returning?.name}, who can check their entries and appeal again.</p>
            <Textarea label="Why" size="sm" minRows={3} value={returnNote} onValueChange={setReturnNote} autoFocus />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setReturning(null)}>Cancel</Button>
            <Button color="primary" isDisabled={!returnNote.trim()} isLoading={busy} onPress={sendBack}>Send back</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </section>
  );
}

// ═══ Policy & Slabs ══════════════════════════════════════════════════════════════════════════════
export function VariablePayPolicy() {
  const { d, loading, error, load } = useLoad<{ slabs: Slab[]; levels: Record<string, number> }>(`${BASE}/policy`);
  const canEdit = hasModuleAccess("hub_variable_pay_policy", "update");
  const [draft, setDraft] = useState<Slab[] | null>(null);
  const [busy, setBusy] = useState(false);
  const list = draft ?? d?.slabs ?? [];
  const set = (i: number, k: keyof Slab, v: string) => setDraft(list.map((s, j) => (j === i ? { ...s, [k]: v === "" ? null : Number(v) } : s)));
  const save = () => {
    setBusy(true);
    axios.put(`${BASE}/policy`, { slabs: list })
      .then(() => { addToast({ title: "Slabs saved", description: "They apply to requests sent from now on.", color: "success" }); setDraft(null); load(); })
      .catch((e) => addToast({ title: "Could not save", description: errText(e, "Please check the slabs."), color: "danger" })).finally(() => setBusy(false));
  };
  const cell = "h-8 w-24 border border-ink-200 bg-white px-2 text-right text-sm tabular-nums focus:border-brand-500 focus:outline-none disabled:bg-transparent disabled:border-transparent dark:border-white/10 dark:bg-ink-900";
  return (
    <section className="flex flex-col gap-5">
      <Header title="Policy & Slabs" sub="How variable pay is worked out for each period of a person's cycle." />
      <Card className="p-5 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
        <ol className="list-decimal space-y-1 pl-5">
          <li><b>Target variable</b> = annual CTC × the level's variable % ({d ? Object.entries(d.levels).map(([k, v]) => `${({ ASSOCIATE: "Associate", MANAGER: "Manager", HEAD_EL: "Head / EL" } as Record<string, string>)[k] ?? k} ${v}%`).join(", ") : "…"}), shared over the year by the person's cycle (quarterly ÷ 4, half-yearly ÷ 2, annual ÷ 1). HR can set a different annual amount per person in Eligibility.</li>
          <li><b>PMS score</b> for the period is the PMS Dashboard's PMS Score: Goal %<sup>w</sup> × Target %<sup>1−w</sup>, with w = 70% when Goal is ahead of Target, otherwise 50%, plus any ±5% shift the person's manager set for the year. Goal % and Target % average each goal / target first, so every metric counts the same; each side counts as at least 5% and at most 150%.</li>
          <li><b>Payout %</b> from the slab the score falls in (below), × the target variable = the amount the request starts with.</li>
          <li><b>Eligible</b> when set up, with PMS entries in the period and a score in a paying slab. Eligible employees appeal; the appeal goes straight to the <b>Finance Head</b>, who approves it (any change to the amount needs a reason) and marks it paid. Managers see their team's status only.</li>
        </ol>
      </Card>
      {loading && !d && <Spinner />}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Payout slabs</h2>
          {canEdit && <span className="text-xs text-ink-500">Edit the numbers and save. Leave "Payout" empty to pay at the score (up to the cap).</span>}
        </div>
        <table className="w-full max-w-3xl text-sm">
          <thead className="bg-ink-50 dark:bg-ink-800"><tr className="text-left">{["Score from (%)", "Score below (%)", "Payout (%)", "Cap (%)", "Means"].map((h) => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr></thead>
          <tbody>
            {list.map((s, i) => (
              <tr key={i} className="border-t border-ink-100 dark:border-white/5">
                <td className="px-3 py-2"><input type="number" className={cell} disabled={!canEdit} value={s.from} onChange={(e) => set(i, "from", e.target.value)} /></td>
                <td className="px-3 py-2"><input type="number" className={cell} disabled={!canEdit} value={s.to ?? ""} placeholder="no end" onChange={(e) => set(i, "to", e.target.value)} /></td>
                <td className="px-3 py-2"><input type="number" className={cell} disabled={!canEdit} value={s.payout ?? ""} placeholder="at score" onChange={(e) => set(i, "payout", e.target.value)} /></td>
                <td className="px-3 py-2">{s.payout == null ? <input type="number" className={cell} disabled={!canEdit} value={s.cap ?? 120} onChange={(e) => set(i, "cap", e.target.value)} /> : <span className="text-ink-400">—</span>}</td>
                <td className="px-3 py-2 text-ink-600 dark:text-ink-300">{slabText(s)} → {s.payout == null ? `paid at the score, up to ${s.cap ?? 120}%` : `${s.payout}% of the target variable`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {canEdit && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="bordered" onPress={() => setDraft([...list.slice(0, -1), { ...list[list.length - 1]!, to: (list[list.length - 1]!.from + 10) }, { from: list[list.length - 1]!.from + 10, to: null, payout: null, cap: 120 }])}>Add slab</Button>
            {list.length > 1 && <Button size="sm" variant="light" onPress={() => setDraft([...list.slice(0, -2), { ...list[list.length - 2]!, to: null, ...(list[list.length - 1]!.payout == null ? { payout: null, cap: list[list.length - 1]!.cap } : {}) }])}>Remove last</Button>}
            {draft && <Button size="sm" variant="light" onPress={() => setDraft(null)}>Undo changes</Button>}
            <Button size="sm" color="primary" isDisabled={!draft} isLoading={busy} onPress={save}>Save slabs</Button>
          </div>
        )}
      </Card>
    </section>
  );
}

// ═══ Eligibility (HR) ════════════════════════════════════════════════════════════════════════════
interface Elig { userId: number; name: string; department: string; cycle: string; cycleSet: boolean; cycleLabel: string; level: string; levelPct: number; ctc: number | null; override: number | null; annual: number | null; source: "OVERRIDE" | "CTC" | null; perPeriod: number | null }
export function VariablePayEligibility() {
  const { d, loading, error, load } = useLoad<Elig[]>(`${BASE}/eligibility`);
  const canEdit = hasModuleAccess("hub_variable_pay_eligibility", "update");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState("all");
  const [edit, setEdit] = useState<Record<number, { override?: string; cycle?: string }>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const rows = (d ?? []).filter((p) => (!q || `${p.name} ${p.department}`.toLowerCase().includes(q.toLowerCase())) && (only === "all" || (only === "missing" ? p.annual == null : p.source === "OVERRIDE")));
  const save = (p: Elig) => {
    const e = edit[p.userId] ?? {};
    const body: Record<string, unknown> = {};
    if (e.override !== undefined) body.annualVariable = e.override === "" ? null : Number(e.override);
    if (e.cycle !== undefined) body.cycle = e.cycle;
    setBusy(p.userId);
    axios.put(`${BASE}/eligibility/${p.userId}`, body)
      .then(() => { addToast({ title: "Saved", description: p.name, color: "success" }); setEdit((x) => { const n = { ...x }; delete n[p.userId]; return n; }); load(); })
      .catch((err) => addToast({ title: "Could not save", description: errText(err, "Please try again."), color: "danger" })).finally(() => setBusy(null));
  };
  const levelName: Record<string, string> = { ASSOCIATE: "Associate", MANAGER: "Manager", HEAD_EL: "Head / EL" };
  return (
    <section className="flex flex-col gap-5">
      <Header title="Eligibility" sub="Each person's variable pay cycle and target variable. It comes from their CTC and level (Appraisal Setup); set an annual amount here to use a different one." />
      {loading && !d && <Spinner />}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Stat label="People" value={String(d.length)} icon={Layers} />
            <Stat label="Set up" value={String(d.filter((p) => p.annual != null).length)} hint="have a target variable" icon={CheckCircle2} />
            <Stat label="Not set up" value={String(d.filter((p) => p.annual == null).length)} hint="no CTC or amount: cannot send" icon={AlertTriangle} />
            <Stat label="Annual variable" value={inr(d.reduce((a, p) => a + (p.annual ?? 0), 0))} icon={Wallet} />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Input aria-label="Search" placeholder="Search name or department" size="sm" className="w-72" value={q} onValueChange={setQ} isClearable onClear={() => setQ("")} />
            <Select aria-label="Show" size="sm" className="w-56" selectedKeys={new Set([only])} disallowEmptySelection onSelectionChange={(k) => setOnly(String(Array.from(k)[0]))}>
              <SelectItem key="all">Everyone</SelectItem><SelectItem key="missing">Not set up</SelectItem><SelectItem key="override">Amount set by HR</SelectItem>
            </Select>
          </div>
          <div className="overflow-x-auto border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-800"><tr className="text-left">{["Person", "Level", "Annual CTC", "Cycle", "Annual variable", "Per period", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((p) => {
                  const e = edit[p.userId] ?? {};
                  const dirty = e.override !== undefined || e.cycle !== undefined;
                  return (
                    <tr key={p.userId} className="border-t border-ink-100 align-middle dark:border-white/5">
                      <td className="px-3 py-2"><b>{p.name}</b><p className="text-xs text-ink-500">{p.department}</p></td>
                      <td className="whitespace-nowrap px-3 py-2">{levelName[p.level] ?? p.level} <span className="text-xs text-ink-500">({p.levelPct}%)</span></td>
                      <td className="px-3 py-2 tabular-nums">{inr(p.ctc)}</td>
                      <td className="px-3 py-2">
                        {canEdit ? (
                          <select aria-label={`Cycle for ${p.name}`} className="h-8 border border-ink-200 bg-white px-2 text-sm dark:border-white/10 dark:bg-ink-900" value={e.cycle ?? (p.cycleSet ? p.cycle : "")} onChange={(ev) => setEdit((x) => ({ ...x, [p.userId]: { ...e, cycle: ev.target.value } }))}>
                            {!p.cycleSet && <option value="">Not set (half-yearly)</option>}
                            <option value="QUARTERLY">Quarterly</option><option value="HALF_YEARLY">Half-yearly</option><option value="ANNUAL">Annual</option>
                          </select>
                        ) : <span>{p.cycleLabel}{!p.cycleSet && <span className="text-xs text-ink-500"> (not set)</span>}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {canEdit ? (
                          <input type="number" min={0} aria-label={`Annual variable for ${p.name}`} placeholder={p.ctc ? `${inr(Math.round((p.ctc * p.levelPct) / 100))} from CTC` : "not set"}
                            className="h-8 w-40 border border-ink-200 bg-white px-2 text-right text-sm tabular-nums focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-ink-900"
                            value={e.override ?? (p.override != null ? String(p.override) : "")} onChange={(ev) => setEdit((x) => ({ ...x, [p.userId]: { ...e, override: ev.target.value } }))} />
                        ) : <span className="tabular-nums">{inr(p.annual)}</span>}
                        <p className="mt-0.5 text-[11px] text-ink-500">{p.source === "OVERRIDE" ? "set by HR (empty = use CTC)" : p.source === "CTC" ? "from CTC × level %" : "no CTC: add it in Appraisal Setup"}</p>
                      </td>
                      <td className="px-3 py-2 font-semibold tabular-nums">{inr(p.perPeriod)}</td>
                      <td className="px-3 py-2">{canEdit && dirty && <Button size="sm" color="primary" isLoading={busy === p.userId} onPress={() => save(p)}>Save</Button>}</td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={7} className="px-3 py-10 text-center text-ink-400">No one matches.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
