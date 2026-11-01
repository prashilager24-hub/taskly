import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@heroui/theme";

import { Checkbox, Chip, Input } from "@/components/ui";
import type { BudgetAction, BudgetLogEntry, Level, Money, Round, RoundStatus, Stage, Status } from "./api";
import { ROUND_COLOR, ROUND_LABEL, STAGE_COLOR, STAGE_LABEL, STATUS_COLOR, STATUS_LABEL, inr, parseAmount, pctOf, showAmount, splitPreview, VARIABLE_PCT } from "./format";

export const StatusChip = ({ status }: { status: Status }) => (
    <Chip size="sm" variant="flat" color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Chip>
);
export const StageChip = ({ stage }: { stage: Stage }) => (
    <Chip size="sm" variant="flat" color={STAGE_COLOR[stage]}>{STAGE_LABEL[stage]}</Chip>
);
export const RoundChip = ({ status }: { status: RoundStatus }) => (
    <Chip size="sm" variant="flat" color={ROUND_COLOR[status]}>{ROUND_LABEL[status]}</Chip>
);

export const Banner = ({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) => (
    <div role="status" className={cn("flex items-start gap-3 border-l-4 px-4 py-3 text-sm", tone === "warn" ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200" : "border-brand-600 bg-brand-50 text-ink-800 dark:bg-brand-600/10 dark:text-ink-100")}>
        <Lock size={16} className="mt-0.5 shrink-0" />
        <div>{children}</div>
    </div>
);

/** The variable pay a person sets on a hike themselves; value null while they have not typed it yet */
export type OwnVariable = { mode: "PCT" | "AMOUNT"; value: number | null } | null;

/**
 * An annual amount typed with Indian grouping; the split is worked out under the box so nobody types it. With `onOwn`,
 * a "Variable pay override" tick lets the person set the variable pay as a percentage or an amount instead of the level's.
 */
export function HikeField({ label, value, onChange, level, disabled, hint, own, onOwn }: { label: string; value: number | null; onChange: (v: number | null) => void; level: Level; disabled?: boolean; hint?: string; own?: OwnVariable; onOwn?: (v: OwnVariable) => void }) {
    const s = value != null ? splitPreview(value, level, own) : null;
    const tooMuch = own?.value != null && value != null && (own.mode === "PCT" ? own.value > 100 : own.value > value);
    return (
        <div className="flex flex-col gap-2">
            <Input
                label={label}
                inputMode="numeric"
                value={showAmount(value)}
                onValueChange={(v) => onChange(parseAmount(v))}
                startContent={<span className="text-sm text-ink-500">₹</span>}
                placeholder="0"
                isDisabled={disabled}
                labelPlacement="inside"
            />
            {onOwn && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Checkbox size="sm" isSelected={!!own} isDisabled={disabled} onValueChange={(on) => onOwn(on ? { mode: "PCT", value: VARIABLE_PCT[level] } : null)}>
                        <span className="text-xs text-ink-700 dark:text-ink-200">Variable pay override</span>
                    </Checkbox>
                    {own && (
                        <div className="flex items-center gap-2">
                            <div role="group" aria-label="Override by" className="flex border border-ink-200 dark:border-white/10">
                                {(["PCT", "AMOUNT"] as const).map((m) => (
                                    <button key={m} type="button" disabled={disabled} aria-pressed={own.mode === m}
                                        onClick={() => onOwn({ mode: m, value: m === own.mode ? own.value : m === "PCT" ? VARIABLE_PCT[level] : s ? s.variable : null })}
                                        className={cn("h-8 px-2.5 text-xs font-semibold", own.mode === m ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-white/5")}>
                                        {m === "PCT" ? "Custom %" : "Custom ₹"}
                                    </button>
                                ))}
                            </div>
                            <input aria-label={own.mode === "PCT" ? "Variable pay percentage" : "Variable pay amount"} inputMode="numeric" disabled={disabled}
                                placeholder={own.mode === "PCT" ? "%" : "₹ per year"}
                                value={own.mode === "PCT" ? (own.value ?? "") : showAmount(own.value)}
                                onChange={(e) => onOwn({ mode: own.mode, value: own.mode === "PCT" ? (e.target.value.replace(/[^\d]/g, "") === "" ? null : Math.min(100, Number(e.target.value.replace(/[^\d]/g, "")))) : parseAmount(e.target.value) })}
                                className={cn(boxCls, own.mode === "PCT" ? "w-16" : "w-32", tooMuch && "border-rose-500")} />
                        </div>
                    )}
                </div>
            )}
            {/* the split is always on screen, so the layout does not jump while typing */}
            <div className="grid grid-cols-2 gap-2" aria-live="polite">
                <div className="flex items-center justify-between gap-2 border-l-2 border-brand-500 bg-brand-50 px-3 py-2 dark:bg-brand-600/10">
                    <span className="eyebrow">Fixed</span>
                    <span className="text-sm font-bold tabular-nums text-ink-900 dark:text-white">{s ? inr(s.fixed) : "—"}</span>
                </div>
                <div className={cn("flex items-center justify-between gap-2 border-l-2 px-3 py-2", own ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10" : "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10")}>
                    <span className="eyebrow flex items-center gap-1.5">Variable<span className={cn("px-1 text-[10px] font-semibold tracking-normal text-white", own ? "bg-amber-600" : "bg-emerald-600")}>{s ? s.pct : VARIABLE_PCT[level]}%{own ? " · own" : ""}</span></span>
                    <span className="text-sm font-bold tabular-nums text-ink-900 dark:text-white">{s ? inr(s.variable) : "—"}</span>
                </div>
            </div>
            {tooMuch && <p className="-mt-0.5 text-xs font-semibold text-rose-600">Variable pay cannot be more than the hike.</p>}
            {hint && <p className="-mt-0.5 text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
        </div>
    );
}

const LOG_TEXT: Record<BudgetAction, string> = { PROPOSED: "proposed the budget", REVISED: "revised the budget", NEGOTIATE: "asked to negotiate", ACCEPTED: "accepted the budget" };
const LOG_DOT: Record<BudgetAction, string> = { PROPOSED: "bg-brand-600", REVISED: "bg-brand-600", NEGOTIATE: "bg-rose-500", ACCEPTED: "bg-emerald-500" };

/** Every budget step between the Finance Head and the EL, oldest first, each with its comment */
export function BudgetLog({ log }: { log: BudgetLogEntry[]; budget?: number | null }) {
    if (!log.length) return <p className="text-sm text-ink-500">No budget yet.</p>;
    // what the Finance Head had on offer when each step was taken
    let offer: number | null = null;
    const offered = log.map((l) => { const before = offer; if (l.action === "PROPOSED" || l.action === "REVISED") offer = l.amount; return before; });
    return (
        <ol className="flex flex-col">
            {log.map((l, i) => (
                <li key={i} className="relative flex flex-col gap-1 border-l border-ink-200 pb-4 pl-5 last:pb-0 dark:border-white/10">
                    <span className={cn("absolute -left-[5px] top-1 h-2.5 w-2.5", LOG_DOT[l.action])} />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-sm text-ink-900 dark:text-white"><b>{l.by?.name ?? "Someone"}</b> {LOG_TEXT[l.action]}</p>
                        <span className="text-xs text-ink-500">{when(l.at)}</span>
                    </div>
                    {l.amount != null && (
                        <p className="text-sm tabular-nums text-ink-700 dark:text-ink-200">
                            {l.action === "NEGOTIATE" ? <>Asked for <b className="text-rose-600">{inr(l.amount)}</b>{offered[i] != null ? <span className="text-ink-500"> (offered {inr(offered[i])})</span> : null}</> : <b>{inr(l.amount)}</b>}
                        </p>
                    )}
                    {l.comment && <p className="max-w-[70ch] whitespace-pre-wrap border-l-2 border-ink-200 pl-3 text-sm text-ink-700 dark:border-white/10 dark:text-ink-200">{l.comment}</p>}
                </li>
            ))}
        </ol>
    );
}
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * The finished split, one row per person: what they expected and targeted, the hike given (fixed and variable under it),
 * its share of the department budget, and how it compares with what they expected and targeted. Shown to the EL and the Finance Head.
 */
export function SplitTable({ r }: { r: Round }) {
    const rows = r.people.map((p) => ({ p, hike: p.approved ?? p.allocation }));
    const total = rows.reduce((t, x) => t + (x.hike ?? 0), 0);
    const th = "px-4 py-2.5 text-left";
    const num = "px-4 py-3 text-right tabular-nums";
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
                <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">
                    {["Name", "Expected hike", "Targeted hike", "Accepted hike", "% of total budget", "% of expected", "% of targeted"].map((h, i) => <th key={h} className={cn(th, i > 0 && "text-right")}>{h}</th>)}
                </tr></thead>
                <tbody>
                    {rows.map(({ p, hike }) => (
                        <tr key={p.cycleId} className="border-b border-ink-100 align-top last:border-0 dark:border-white/5">
                            <td className="px-4 py-3"><p className="font-semibold text-ink-900 dark:text-white">{p.name}</p><p className="text-xs text-ink-500">{STATUS_LABEL[p.status]}</p></td>
                            <td className={num}>{inr(p.expected)}</td>
                            <td className={num}>{inr(p.target)}</td>
                            <td className={num}>
                                <p className="font-bold text-ink-900 dark:text-white">{inr(hike)}</p>
                                {p.approvedFixed != null && <p className="mt-0.5 text-xs text-ink-500">Fixed {inr(p.approvedFixed)} · Variable {inr(p.approvedVariable)}</p>}
                            </td>
                            <td className={num}>{pctOf(hike, r.budget)}</td>
                            <td className={num}>{pctOf(hike, p.expected)}</td>
                            <td className={num}>{pctOf(hike, p.target)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot><tr className="border-t border-ink-200 bg-ink-50 font-semibold dark:border-white/10 dark:bg-ink-800">
                    <td className="px-4 py-3 text-ink-900 dark:text-white">Total</td>
                    <td className={num}>{inr(r.totals.expected)}</td>
                    <td className={num}>{inr(r.totals.target)}</td>
                    <td className={num}>{inr(total)}<p className="text-xs font-normal text-ink-500">of {inr(r.budget)} budget</p></td>
                    <td className={num}>{pctOf(total, r.budget)}</td>
                    <td className={num}>{pctOf(total, r.totals.expected)}</td>
                    <td className={num}>{pctOf(total, r.totals.target)}</td>
                </tr></tfoot>
            </table>
        </div>
    );
}

/** A finished amount: annual, fixed, variable and the half-yearly payout */
export function MoneyCard({ title, money, accent }: { title: string; money: Money | null | undefined; accent?: boolean }) {
    return (
        <div className={cn("flex flex-col gap-3 border p-4", accent ? "border-brand-600 bg-brand-50 dark:bg-brand-600/10" : "border-ink-200 dark:border-white/10")}>
            <p className="eyebrow">{title}</p>
            {money ? (
                <>
                    <p className="text-2xl font-bold leading-none text-ink-900 dark:text-white">{inr(money.annual)}<span className="ml-1.5 text-xs font-normal text-ink-500">per year</span></p>
                    <dl className="grid grid-cols-3 gap-3 text-xs">
                        <div><dt className="text-ink-500">Fixed</dt><dd className="mt-0.5 text-sm font-semibold text-ink-900 dark:text-white">{inr(money.fixed)}</dd></div>
                        <div><dt className="text-ink-500">Variable</dt><dd className="mt-0.5 text-sm font-semibold text-ink-900 dark:text-white">{inr(money.variable)}</dd></div>
                        <div><dt className="text-ink-500">Each half-year</dt><dd className="mt-0.5 text-sm font-semibold text-ink-900 dark:text-white">{inr(money.variablePerHalfYear)}</dd></div>
                    </dl>
                </>
            ) : <p className="text-sm text-ink-400">Not entered</p>}
        </div>
    );
}

/** Read-only text: label above, the answer below; an empty answer says so instead of leaving a blank box */
export const ReadText = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex flex-col gap-1">
        <p className="eyebrow">{label}</p>
        <p className={cn("whitespace-pre-wrap text-sm", value ? "text-ink-900 dark:text-ink-100" : "text-ink-400")}>{value || "Nothing written"}</p>
    </div>
);

export const SECTION = "flex flex-col gap-4";
export const COLS2 = "grid grid-cols-1 gap-4 md:grid-cols-2";
/** One quarter on one row, like the spreadsheet: goals, targets, achievements, failures */
export const COLS4 = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4";

/** The questions that go with the hike proposal. Older answers to other questions stay stored but are no longer asked or shown. */
/** The one question of the appeal (stored with the answers, key whyExpectThisSalary) */
export const WHY_KEY = "whyExpectThisSalary";
export const WHY_LABEL = "Why are you expecting this salary / hike?";

const boxCls = "h-9 w-full border border-ink-200 bg-transparent px-2.5 text-right text-[13px] tabular-nums text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 disabled:opacity-60 dark:border-white/10 dark:bg-ink-900 dark:text-white";
/** A compact rupee box for tables: Indian grouping while typing, null when empty */
export const AmountBox = ({ value, onChange, label, disabled }: { value: number | null; onChange: (v: number | null) => void; label: string; disabled?: boolean }) => (
    <input aria-label={label} inputMode="numeric" placeholder="₹ per year" className={boxCls} value={showAmount(value)} disabled={disabled} onChange={(e) => onChange(parseAmount(e.target.value))} />
);
export const TextBox = ({ value, onChange, label, placeholder, disabled }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; disabled?: boolean }) => (
    <input aria-label={label} placeholder={placeholder} className={boxCls.replace("text-right ", "text-left ").replace(" tabular-nums", "")} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
);

/** How much of a budget is given out, in coloured parts, and what is left (red when over) */
export function BudgetBar({ total, parts }: { total: number; parts: { label: string; amount: number; color: string }[] }) {
    const used = parts.reduce((t, p) => t + p.amount, 0);
    const left = total - used;
    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-ink-600 dark:text-ink-300"><b className="text-ink-900 dark:text-white">{inr(used)}</b> of {inr(total)} given out</p>
                <p className={cn("text-sm font-bold tabular-nums", left < 0 ? "text-rose-600" : "text-emerald-600")}>{left < 0 ? `${inr(-left)} over` : `${inr(left)} left`}</p>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden bg-ink-100 dark:bg-white/10" role="img" aria-label={`${inr(used)} of ${inr(total)} given out`}>
                {parts.map((p) => <span key={p.label} style={{ width: `${total ? Math.min(100, (p.amount / total) * 100) : 0}%` }} className={p.color} />)}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">{parts.map((p) => <span key={p.label} className="inline-flex items-center gap-1.5 text-xs text-ink-500"><span className={cn("h-2 w-2", p.color)} />{p.label} {inr(p.amount)}</span>)}</div>
        </div>
    );
}
