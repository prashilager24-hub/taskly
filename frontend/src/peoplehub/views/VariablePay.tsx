import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { AlertTriangle, Award, Check, CheckCircle2, ChevronDown, CornerUpLeft, FileText, Hourglass, Info, Layers, PartyPopper, Send, Wallet, XCircle } from "lucide-react";
import {
  addToast, Button, Card, Checkbox, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Spinner, Tab, Tabs, Textarea,
} from "@/components/ui";
import { hasModuleAccess } from "@/lib/permissions";
import PmsTable from "@/components/appraisal/PmsTable";
import QuarterGrid, { type Slot } from "@/components/appraisal/QuarterGrid";
import type { PmsQuarter } from "@/components/appraisal/api";

/**
 * People Hub → Variable Pay (server: /variable-pay, see variablePay.service.ts).
 * Worked out each half year. Every employee (ELs too) opens the half year like My Appraisal: its quarters from PMS, the
 * PMS score and what the policy pays for it. If eligible they appeal; the appeal goes straight to the Finance Head
 * (no manager approves). Managers see their team's status only. The policy opens as a document page (PolicyModal).
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
interface Elig { eligible: boolean; reasons: string[]; short: string; minScore: number; gap: number | null }
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

// ═══ My Variable Pay ═════════════════════════════════════════════════════════════════════════════
interface Mine {
  person: { cycle: string; cycleLabel: string; cycleSet: boolean; level: string; levelPct: number; annual: number | null; source: "OVERRIDE" | "CTC" | null; department: string };
  approver: { userId: number; name: string }; slabs: Slab[]; levels: Record<string, number>;
  current: Period & { quote: Quote; eligibility: Elig };
  periods: (Period & { state: "OPEN" | "SENT"; request: Req | null; quote: Quote | null; eligibility: Elig | null })[];
  requests: Req[];
}
interface QuarterCalc { quarter: string; year: number; start: string; end: string; goalPct: number | null; targetPct: number | null; score: number | null; goalEntries: number; targetEntries: number }
interface Detail { period: Period; quarters: QuarterCalc[]; pms: PmsQuarter[]; slots: Slot[] }
type Calc = { goalPct: number | null; targetPct: number | null; score: number | null; slabPct: number; targetAmount: number | null; computedAmount: number | null };

const shortLabel = (label: string) => label.split(" (")[0]!;
/** The slab a score falls in (same rule as the server) */
const slabOf = (score: number | null, list: Slab[]) => (score == null ? null : list.find((s) => score >= s.from && (s.to == null || score < s.to)) ?? null);
const slabPay = (s: Slab) => (s.payout == null ? `at the score, up to ${s.cap ?? 120}%` : `${s.payout}%`);

/**
 * The half year's calculation, next to the quarters: each quarter's PMS Dashboard figures, the half year's PMS score,
 * the policy slab it falls in and the amount. The appeal (or where it stands) sits at the bottom.
 */
function CalcCard({ label, quarters, calc, slabs, children }: { label: string; quarters: QuarterCalc[] | null; calc: Calc; slabs: Slab[]; children?: React.ReactNode }) {
  const hit = slabOf(calc.score, slabs);
  return (
    <div className="flex flex-col border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
      <div className="border-b border-ink-200 px-4 py-3 dark:border-white/10">
        <p className="eyebrow">Your calculation</p>
        <p className="text-sm font-bold text-ink-900 dark:text-white">{label}</p>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-ink-50 text-ink-500 dark:bg-ink-800"><tr>{["", "Goal", "Target", "PMS score"].map((h, i) => <th key={i} className={`px-3 py-2 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
        <tbody>
          {quarters == null && <tr><td colSpan={4} className="px-3 py-3 text-center"><Spinner size="sm" /></td></tr>}
          {quarters?.map((q) => (
            <tr key={`${q.quarter}${q.year}`} className="border-t border-ink-100 dark:border-white/5">
              <td className="px-3 py-2 font-semibold text-ink-700 dark:text-ink-200">{q.quarter} {q.year}</td>
              <td className="px-3 py-2 text-right tabular-nums">{pct(q.goalPct)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{pct(q.targetPct)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{pct(q.score)}</td>
            </tr>
          ))}
          <tr className="border-t border-ink-200 bg-ink-50 font-bold text-ink-900 dark:border-white/10 dark:bg-ink-800 dark:text-white">
            <td className="px-3 py-2">Half year</td>
            <td className="px-3 py-2 text-right tabular-nums">{pct(calc.goalPct)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{pct(calc.targetPct)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-brand-700 dark:text-brand-300">{pct(calc.score)}</td>
          </tr>
        </tbody>
      </table>
      <p className="px-4 pt-2 text-[11px] text-ink-500">Worked out like your PMS Dashboard. The half year uses all its entries, so it is not the average of the two quarters.</p>

      <div className="px-4 pt-4">
        <p className="eyebrow mb-1.5">Against the policy</p>
        <ul className="border border-ink-200 text-xs dark:border-white/10">
          {slabs.map((s) => {
            const on = s === hit;
            return (
              <li key={s.from} className={`flex items-center justify-between gap-2 border-t border-ink-100 px-3 py-1.5 first:border-t-0 dark:border-white/5 ${on ? "bg-brand-50 font-bold text-ink-900 ring-1 ring-inset ring-brand-400 dark:bg-brand-500/15 dark:text-white" : "text-ink-500"}`}>
                <span className="tabular-nums">{slabText(s)}</span>
                <span className="tabular-nums">{on && <Check size={12} className="mr-1 inline text-brand-600" />}{slabPay(s)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <dl className="flex flex-col gap-1.5 px-4 py-4 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-ink-500">Variable for the half year</dt><dd className="font-semibold tabular-nums">{inr(calc.targetAmount)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-ink-500">Payout</dt><dd className="font-semibold tabular-nums">× {calc.slabPct}%</dd></div>
        <div className="mt-1 flex items-end justify-between gap-3 border-t border-ink-200 pt-2.5 dark:border-white/10">
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-900 dark:text-white">Your variable pay</dt>
          <dd className="text-2xl font-extrabold tabular-nums leading-none text-brand-700 dark:text-brand-300">{inr(calc.computedAmount)}</dd>
        </div>
      </dl>
      {children && <div className="border-t border-ink-200 px-4 py-4 dark:border-white/10">{children}</div>}
    </div>
  );
}

// My Variable Pay, built like My Appraisal: one card with "Appeal for Variable Pay". It opens three tabs: Goals and
// targets by quarter (from PMS, as in the appraisal), Variable pay calculation (eligible or not; Apply for Variable Pay
// when eligible) and Appeal status.
type VpTab = "goals" | "calc" | "status";
export function MyVariablePay() {
  const { d, loading, error, load } = useLoad<Mine>(`${BASE}/me`);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<VpTab>("goals");
  const [policy, setPolicy] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const p = d?.periods[0];

  useEffect(() => {
    if (!showForm || !p || detail?.period.key === p.key) return;
    axios.get(`${BASE}/me/period/${p.key}`).then((r) => setDetail(data<Detail>(r)))
      .catch((e) => addToast({ title: "Could not load your quarters", description: errText(e, "Please try again."), color: "danger" }));
  }, [showForm, p?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (t: VpTab) => { setTab(t); setShowForm(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); };
  const send = () => {
    if (!p) return;
    setSending(true);
    axios.post(`${BASE}/me/send`, { periodKey: p.key, note: note.trim() || null })
      .then(() => { addToast({ title: "Your variable pay appeal is submitted", description: `It is with ${d?.approver.name ?? "the Finance Head"} now.`, color: "success" }); setNote(""); setTab("status"); load(); })
      .catch((e) => addToast({ title: "Could not submit", description: errText(e, "Please try again."), color: "danger" }))
      .finally(() => setSending(false));
  };

  if (loading && !d) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!d || !p) return <Card className="p-10 text-center text-sm text-ink-500">{error || "No variable pay is open for you right now."}</Card>;

  const r = p.request;
  const eligible = !!p.eligibility?.eligible;
  const calc: Calc = r && r.status !== "RETURNED" ? r : p.quote ?? { goalPct: null, targetPct: null, score: null, slabPct: 0, targetAmount: null, computedAmount: null };
  const half = shortLabel(p.label);
  const approver = `Finance Head · ${d.approver.name}`;
  const lastReturn = r?.status === "RETURNED" ? [...r.history].reverse().find((h) => h.action === "RETURNED")?.comment : null;

  // The top card: one line on where the person is, and one button (as in My Appraisal). Eligibility is shown only in the calculation.
  let icon = <Award size={26} />;
  let title = "Your variable pay is open";
  let text: React.ReactNode = `${p.label}. Look at your goals and targets for each quarter and how your variable pay is worked out.`;
  let action = <Button size="lg" color="primary" onPress={() => open("goals")}>Appeal for Variable Pay</Button>;
  if (r?.status === "RETURNED") {
    icon = <CornerUpLeft size={26} />; title = "Your appeal was sent back";
    text = <>“{lastReturn}”. Check your entries and look at your quarters again.</>;
  } else if (r?.status === "WITH_FINANCE" || r?.status === "WITH_REVIEWER") {
    icon = <Hourglass size={26} />; title = "Your appeal is submitted and in progress";
    text = `${half}: it is with the Finance Head. We will let you know soon.`;
    action = <Button size="lg" variant="bordered" onPress={() => open("status")}>View my appeal</Button>;
  } else if (r?.status === "APPROVED") {
    icon = <CheckCircle2 size={26} />; title = `Your variable pay is approved: ${inr(r.finalAmount)}`;
    text = `${half}. It will be paid with your salary.`;
    action = <Button size="lg" variant="bordered" onPress={() => open("status")}>View my appeal</Button>;
  } else if (r?.status === "PAID") {
    icon = <PartyPopper size={26} />; title = `Your variable pay is paid: ${inr(r.finalAmount)}`;
    text = `${half}. Paid on ${day(r.paidOn)}.`;
    action = <Button size="lg" variant="bordered" onPress={() => open("status")}>View my appeal</Button>;
  }
  const earlier = d.requests.filter((x) => x.periodKey !== p.key);

  return (
    <section className="flex flex-col gap-6">
      <Header title="My Variable Pay" sub="Your half-yearly variable pay: appeal for it, then see where it stands." />
      <Card className="p-0">
        <div className={showForm ? "flex flex-wrap items-center justify-between gap-4 p-5" : "flex flex-col items-center gap-5 px-4 py-12 text-center"}>
          <div className={showForm ? "flex items-center gap-4" : "flex flex-col items-center gap-5"}>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-brand-50 text-brand-600 dark:bg-brand-600/10">{icon}</span>
            <div className="flex max-w-[60ch] flex-col gap-1.5">
              <h2 className="text-xl font-bold text-ink-900 dark:text-white">{title}</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400">{text}</p>
            </div>
          </div>
          {showForm ? <Button size="lg" variant="bordered" onPress={() => setShowForm(false)}>Hide variable pay</Button> : action}
        </div>
      </Card>

      {showForm && (
        <div ref={formRef} className="scroll-mt-4">
          <Card className="p-0">
            <div className="px-5 pt-3">
              <Tabs aria-label="Variable pay sections" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as VpTab)}>
                <Tab key="goals" title="Goals and targets by quarter">
                  <div className="flex flex-col gap-6 pb-5 pt-3">
                    <p className="max-w-[72ch] text-sm text-ink-500 dark:text-ink-400">{p.label}. Everything here comes from your PMS Quarterly Reviews and your Quarter Highlights (PMS menu). There is nothing to fill in here.</p>
                    {!detail ? <Spinner /> : (
                      <>
                        <PmsTable quarters={detail.pms} />
                        <QuarterGrid slots={detail.slots} pms={detail.pms} />
                      </>
                    )}
                    <div className="flex justify-end border-t border-ink-200 pt-4 dark:border-white/10">
                      <Button color="primary" onPress={() => setTab("calc")}>Next: Variable pay calculation</Button>
                    </div>
                  </div>
                </Tab>

                <Tab key="calc" title="Variable pay calculation">
                  <div className="flex flex-col gap-5 pb-5 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="max-w-[72ch] text-sm text-ink-500 dark:text-ink-400">Worked out like your PMS Dashboard for {half}, then compared with the Variable Pay Policy.</p>
                      <Button variant="bordered" startContent={<FileText size={15} />} onPress={() => setPolicy(true)}>Variable Pay Policy</Button>
                    </div>
                    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                      <CalcCard label={half} quarters={detail?.quarters ?? null} calc={calc} slabs={d.slabs} />

                      {/* the result: eligible or not, and Apply for Variable Pay */}
                      <div className={`flex flex-col gap-4 border p-5 ${eligible || (r && r.status !== "RETURNED") ? "border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/10" : "border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800"}`}>
                        {r && r.status !== "RETURNED" ? (
                          <>
                            <Chip size="sm" variant="flat" color="success" className="self-start">Appealed</Chip>
                            <p className="text-sm text-ink-700 dark:text-ink-200">You appealed for <b>{inr(r.computedAmount)}</b> on {day(r.submittedAt.slice(0, 10))}. See the Appeal status tab.</p>
                          </>
                        ) : eligible ? (
                          <>
                            <Chip size="sm" variant="flat" color="success" className="self-start" startContent={<CheckCircle2 size={13} />}>Eligible</Chip>
                            <div>
                              <p className="eyebrow">Your variable pay for {half}</p>
                              <p className="mt-1 text-3xl font-extrabold tabular-nums leading-none text-ink-900 dark:text-white">{inr(calc.computedAmount)}</p>
                              <p className="mt-1 text-xs text-ink-500">PMS score {pct(calc.score)} → {calc.slabPct}% of {inr(calc.targetAmount)}</p>
                            </div>
                            <Textarea label="Note for the Finance Head (optional)" size="sm" minRows={2} value={note} onValueChange={setNote} />
                            <Button size="lg" color="primary" startContent={<Send size={15} />} isLoading={sending} onPress={send}>{r ? "Apply again" : "Apply for Variable Pay"}</Button>
                            <p className="text-[11px] text-ink-500">Goes straight to {approver}.</p>
                          </>
                        ) : (
                          <>
                            <Chip size="sm" variant="flat" color="default" className="self-start">Not eligible</Chip>
                            <p className="flex items-start gap-1.5 text-sm text-ink-600 dark:text-ink-300"><Info size={14} className="mt-0.5 shrink-0 text-ink-400" />{p.eligibility?.short || "Not eligible for this half year."}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Tab>

                <Tab key="status" title="Appeal status">
                  <div className="flex flex-col gap-5 pb-5 pt-3">
                    {r && r.status !== "RETURNED" ? (
                      <>
                        <Stepper r={r} approver={approver} />
                        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div><dt className="eyebrow">Appealed for</dt><dd className="mt-1 text-xl font-bold tabular-nums text-ink-900 dark:text-white">{inr(r.computedAmount)}</dd></div>
                          <div><dt className="eyebrow">Approved</dt><dd className="mt-1 text-xl font-bold tabular-nums text-ink-900 dark:text-white">{inr(r.finalAmount)}</dd></div>
                          <div><dt className="eyebrow">Paid on</dt><dd className="mt-1 text-xl font-bold text-ink-900 dark:text-white">{day(r.paidOn)}</dd></div>
                        </dl>
                        <History r={r} />
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-3 border border-dashed border-ink-300 px-6 py-10 text-center dark:border-white/20">
                        <span className="flex h-12 w-12 items-center justify-center bg-ink-100 text-ink-600 dark:bg-white/5 dark:text-ink-300"><Hourglass size={22} /></span>
                        <p className="text-base font-bold text-ink-900 dark:text-white">Nothing to show yet</p>
                        <p className="max-w-[56ch] text-sm text-ink-500">{r?.status === "RETURNED" ? "Your appeal was sent back. Apply again from the Variable pay calculation tab if you are eligible." : "Apply for variable pay from the Variable pay calculation tab. Where it stands shows here."}</p>
                      </div>
                    )}
                  </div>
                </Tab>
              </Tabs>
            </div>
          </Card>
        </div>
      )}

      {earlier.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Earlier half years</h2>
          <RequestTable rows={earlier} hideName />
        </Card>
      )}
      <PolicyModal open={policy} onClose={() => setPolicy(false)} />
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
  const [policyOpen, setPolicyOpen] = useState(false);

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
      <Header title="Variable Pay Overview" sub="Every employee's variable pay: appealed, approved and paid, by year or quarter. Approve appeals (changing an amount needs a reason), send one back to the employee, and mark them paid.">
        <Button variant="bordered" startContent={<FileText size={15} />} onPress={() => setPolicyOpen(true)}>Variable Pay Policy</Button>
      </Header>
      <PolicyModal open={policyOpen} onClose={() => setPolicyOpen(false)} />
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

// ═══ Variable Pay Policy (opens as a document page; those with update access can change the slabs) ═══
const LEVEL_NAME: Record<string, string> = { ASSOCIATE: "Associate", MANAGER: "Manager", HEAD_EL: "Head / EL" };
const payoutFor = (score: number, list: Slab[]) => { const s = slabOf(score, list); return !s ? 0 : s.payout == null ? Math.min(score, s.cap ?? 120) : s.payout; };

export function PolicyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [d, setD] = useState<{ slabs: Slab[]; levels: Record<string, number> } | null>(null);
  const [draft, setDraft] = useState<Slab[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const canEdit = hasModuleAccess("hub_variable_pay_policy", "update");
  const fetchPolicy = () => axios.get(`${BASE}/policy`).then((r) => setD(data(r))).catch((e) => addToast({ title: "Could not load the policy", description: errText(e, "Please try again."), color: "danger" }));
  useEffect(() => { if (open) { setEditing(false); setDraft(null); fetchPolicy(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = draft ?? d?.slabs ?? [];
  const set = (i: number, k: keyof Slab, v: string) => setDraft(list.map((s, j) => (j === i ? { ...s, [k]: v === "" ? null : Number(v) } : s)));
  const save = () => {
    setBusy(true);
    axios.put(`${BASE}/policy`, { slabs: list })
      .then(() => { addToast({ title: "Slabs saved", description: "They apply to appeals sent from now on.", color: "success" }); setDraft(null); setEditing(false); fetchPolicy(); })
      .catch((e) => addToast({ title: "Could not save", description: errText(e, "Please check the slabs."), color: "danger" })).finally(() => setBusy(false));
  };
  const cell = "h-7 w-20 border border-ink-300 bg-white px-2 text-right text-xs tabular-nums focus:border-brand-500 focus:outline-none";
  const minScore = list.filter((s) => s.payout == null || s.payout > 0).map((s) => s.from).sort((a, b) => a - b)[0] ?? 0;
  const assoc = d?.levels["ASSOCIATE"] ?? 10, exScore = 82, exAnnual = (600000 * assoc) / 100, exPay = payoutFor(exScore, list);
  const H = ({ n, children }: { n: number; children: React.ReactNode }) => <h3 className="mb-1.5 mt-6 text-[13px] font-bold uppercase tracking-wide text-ink-900">{n}. {children}</h3>;

  return (
    <Modal isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }} size="4xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 border-b border-ink-200 dark:border-white/10"><FileText size={17} className="text-brand-600" />Variable Pay Policy</ModalHeader>
        <ModalBody className="bg-ink-100 px-3 py-6 dark:bg-ink-950 sm:px-8">
          {!d ? <Spinner /> : (
            // a printed page: always white, whatever the theme
            <article className="mx-auto w-full max-w-[760px] border border-ink-200 bg-white px-6 py-10 text-[13px] leading-relaxed text-ink-700 shadow-[0_4px_24px_rgba(0,0,0,0.12)] sm:px-12">
              <header className="flex items-start justify-between gap-4 border-b-2 border-ink-900 pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600">People Hub · TapMind</p>
                  <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900">Variable Pay Policy</h2>
                </div>
                <dl className="text-right text-[11px] text-ink-500">
                  <div><dt className="inline">Applies to: </dt><dd className="inline font-semibold text-ink-900">every employee</dd></div>
                  <div><dt className="inline">Worked out: </dt><dd className="inline font-semibold text-ink-900">each half year</dd></div>
                </dl>
              </header>

              <H n={1}>Purpose</H>
              <p>Variable pay rewards how well you meet your goals and targets. It is worked out each half year from your PMS score and paid once the Finance Head approves it.</p>

              <H n={2}>Half years</H>
              <table className="w-full border border-ink-300 text-xs">
                <thead className="bg-ink-100 text-ink-900"><tr><th className="border border-ink-300 px-3 py-1.5 text-left">Half year</th><th className="border border-ink-300 px-3 py-1.5 text-left">Months</th><th className="border border-ink-300 px-3 py-1.5 text-left">PMS quarters</th></tr></thead>
                <tbody>
                  <tr><td className="border border-ink-300 px-3 py-1.5 font-semibold">H1</td><td className="border border-ink-300 px-3 py-1.5">April – September</td><td className="border border-ink-300 px-3 py-1.5">Q2 and Q3</td></tr>
                  <tr><td className="border border-ink-300 px-3 py-1.5 font-semibold">H2</td><td className="border border-ink-300 px-3 py-1.5">October – March</td><td className="border border-ink-300 px-3 py-1.5">Q4 and the next Q1</td></tr>
                </tbody>
              </table>

              <H n={3}>Your variable pay</H>
              <p>Your yearly variable pay is your annual CTC × the variable % for your level: {Object.entries(d.levels).map(([k, v]) => `${LEVEL_NAME[k] ?? k} ${v}%`).join(", ")}. Half of it is for each half year. HR can set a different amount for a person.</p>

              <H n={4}>Your PMS score</H>
              <p>The same score as your PMS Dashboard. Goal % and Target % average each goal and target first, so every one counts the same. The score is Goal %<sup>w</sup> × Target %<sup>1−w</sup>, where w is 70% when Goal % is ahead of Target %, otherwise 50%. Each side counts as at least 5% and at most 150%. Your manager can move the weighting by up to 5% for the year, with a reason.</p>

              <H n={5}>Payout slabs</H>
              <table className="w-full border border-ink-300 text-xs">
                <thead className="bg-ink-100 text-ink-900"><tr>{["PMS score", "Payout of your half-year variable", ...(editing ? ["From", "Below", "Payout %", "Cap %"] : [])].map((h) => <th key={h} className="border border-ink-300 px-3 py-1.5 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {list.map((s, i) => (
                    <tr key={i}>
                      <td className="border border-ink-300 px-3 py-1.5 font-semibold tabular-nums">{s.to == null ? `${s.from}% and above` : `${s.from}% to below ${s.to}%`}</td>
                      <td className="border border-ink-300 px-3 py-1.5">{s.payout == null ? `paid at the score, up to ${s.cap ?? 120}%` : s.payout === 0 ? "no variable pay" : `${s.payout}%`}</td>
                      {editing && (
                        <>
                          <td className="border border-ink-300 px-2 py-1"><input type="number" aria-label="From" className={cell} value={s.from} onChange={(e) => set(i, "from", e.target.value)} /></td>
                          <td className="border border-ink-300 px-2 py-1"><input type="number" aria-label="Below" className={cell} value={s.to ?? ""} placeholder="no end" onChange={(e) => set(i, "to", e.target.value)} /></td>
                          <td className="border border-ink-300 px-2 py-1"><input type="number" aria-label="Payout" className={cell} value={s.payout ?? ""} placeholder="at score" onChange={(e) => set(i, "payout", e.target.value)} /></td>
                          <td className="border border-ink-300 px-2 py-1">{s.payout == null ? <input type="number" aria-label="Cap" className={cell} value={s.cap ?? 120} onChange={(e) => set(i, "cap", e.target.value)} /> : "—"}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {editing && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="bordered" onPress={() => setDraft([...list.slice(0, -1), { ...list[list.length - 1]!, to: list[list.length - 1]!.from + 10 }, { from: list[list.length - 1]!.from + 10, to: null, payout: null, cap: 120 }])}>Add slab</Button>
                  {list.length > 1 && <Button size="sm" variant="light" onPress={() => setDraft([...list.slice(0, -2), { ...list[list.length - 2]!, to: null, ...(list[list.length - 1]!.payout == null ? { payout: null, cap: list[list.length - 1]!.cap } : {}) }])}>Remove last</Button>}
                  <span className="self-center text-[11px] text-ink-500">Leave Payout empty to pay at the score (up to the cap).</span>
                </div>
              )}

              <H n={6}>Who is eligible</H>
              <ul className="list-disc space-y-0.5 pl-5">
                <li>Your variable pay is set up (HR has your CTC, or an amount).</li>
                <li>You have goal and target entries in the half year, so there is a PMS score.</li>
                <li>Your PMS score is {minScore}% or more.</li>
              </ul>

              <H n={7}>Example</H>
              <p>An {LEVEL_NAME["ASSOCIATE"]} with an annual CTC of ₹6,00,000 has {inr(exAnnual)} of variable pay a year, so {inr(exAnnual / 2)} for a half year. With a PMS score of {exScore}%, the payout is {exPay}%: <b className="text-ink-900">{inr(((exAnnual / 2) * exPay) / 100)}</b>.</p>

              <H n={8}>How to claim it</H>
              <p>When a half year ends, open My Variable Pay. If you are eligible, check your quarters and the calculation, and appeal. Your appeal goes straight to the Finance Head, who approves it (any change to the amount comes with a reason) or sends it back to you, and then marks it paid. The Finance Head’s own appeal is approved by an Admin.</p>

              <footer className="mt-10 flex justify-between border-t border-ink-200 pt-3 text-[10px] uppercase tracking-wider text-ink-400">
                <span>People Hub · Variable Pay Policy</span><span>Page 1 of 1</span>
              </footer>
            </article>
          )}
        </ModalBody>
        <ModalFooter className="border-t border-ink-200 dark:border-white/10">
          {canEdit && !editing && <Button variant="light" className="mr-auto" onPress={() => setEditing(true)}>Edit slabs</Button>}
          {editing && (
            <>
              <Button variant="light" className="mr-auto" onPress={() => { setDraft(null); setEditing(false); }}>Cancel editing</Button>
              <Button color="primary" isDisabled={!draft} isLoading={busy} onPress={save}>Save slabs</Button>
            </>
          )}
          <Button variant="bordered" onPress={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
// ═══ Eligibility (HR) ════════════════════════════════════════════════════════════════════════════
interface EligRow { userId: number; name: string; department: string; cycle: string; cycleSet: boolean; cycleLabel: string; level: string; levelPct: number; ctc: number | null; override: number | null; annual: number | null; source: "OVERRIDE" | "CTC" | null; perPeriod: number | null }
export function VariablePayEligibility() {
  const { d, loading, error, load } = useLoad<EligRow[]>(`${BASE}/eligibility`);
  const canEdit = hasModuleAccess("hub_variable_pay_eligibility", "update");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState("all");
  const [edit, setEdit] = useState<Record<number, { override?: string }>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const rows = (d ?? []).filter((p) => (!q || `${p.name} ${p.department}`.toLowerCase().includes(q.toLowerCase())) && (only === "all" || (only === "missing" ? p.annual == null : p.source === "OVERRIDE")));
  const save = (p: EligRow) => {
    const e = edit[p.userId] ?? {};
    const body: Record<string, unknown> = {};
    if (e.override !== undefined) body.annualVariable = e.override === "" ? null : Number(e.override);
    setBusy(p.userId);
    axios.put(`${BASE}/eligibility/${p.userId}`, body)
      .then(() => { addToast({ title: "Saved", description: p.name, color: "success" }); setEdit((x) => { const n = { ...x }; delete n[p.userId]; return n; }); load(); })
      .catch((err) => addToast({ title: "Could not save", description: errText(err, "Please try again."), color: "danger" })).finally(() => setBusy(null));
  };
  const levelName: Record<string, string> = { ASSOCIATE: "Associate", MANAGER: "Manager", HEAD_EL: "Head / EL" };
  return (
    <section className="flex flex-col gap-5">
      <Header title="Eligibility" sub="Each person's target variable, paid in two halves a year. It comes from their CTC and level (Appraisal Setup); set an annual amount here to use a different one." />
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
              <thead className="bg-ink-50 dark:bg-ink-800"><tr className="text-left">{["Person", "Level", "Annual CTC", "Cycle", "Annual variable", "Per half year", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((p) => {
                  const e = edit[p.userId] ?? {};
                  const dirty = e.override !== undefined;
                  return (
                    <tr key={p.userId} className="border-t border-ink-100 align-middle dark:border-white/5">
                      <td className="px-3 py-2"><b>{p.name}</b><p className="text-xs text-ink-500">{p.department}</p></td>
                      <td className="whitespace-nowrap px-3 py-2">{levelName[p.level] ?? p.level} <span className="text-xs text-ink-500">({p.levelPct}%)</span></td>
                      <td className="px-3 py-2 tabular-nums">{inr(p.ctc)}</td>
                      <td className="px-3 py-2">Half-yearly</td>
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
