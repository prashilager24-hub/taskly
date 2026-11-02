import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@heroui/theme";

import { Checkbox, Chip, Input } from "@/components/ui";
import type { BudgetAction, BudgetLogEntry, Level, Money, Round, RoundPerson, RoundStatus, Stage, Status, VariableOverride } from "./api";
import { ROUND_COLOR, ROUND_LABEL, STAGE_COLOR, STAGE_LABEL, STATUS_COLOR, STATUS_LABEL, ctcRise, inr, parseAmount, pctOf, showAmount, splitPreview, VARIABLE_PCT } from "./format";

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
/** A saved override back into a form, and a form's override ready to send (null while incomplete) */
export const ownFrom = (v: VariableOverride | null | undefined): OwnVariable => (v ? { mode: v.mode, value: v.value } : null);
export const ownToSend = (o: OwnVariable): VariableOverride | null => (o && o.value != null ? { mode: o.mode, value: o.value } : null);
/** An override ticked but with no % / ₹ typed yet, or more variable pay than the hike */
export const ownInvalid = (o: OwnVariable, amount: number | null) => !!o && (o.value == null || (amount != null && (o.mode === "PCT" ? o.value > 100 : o.value > amount)));

/** "Variable pay override": a tick, then Custom % or Custom ₹ and the value */
function OverrideControl({ level, value, own, onOwn, disabled, tooMuch, compact }: { level: Level; value: number | null; own: OwnVariable; onOwn: (v: OwnVariable) => void; disabled?: boolean; tooMuch?: boolean; compact?: boolean }) {
    const s = value != null ? splitPreview(value, level, own) : null;
    return (
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
                                {m === "PCT" ? (compact ? "%" : "Custom %") : (compact ? "₹" : "Custom ₹")}
                            </button>
                        ))}
                    </div>
                    <input aria-label={own.mode === "PCT" ? "Variable pay percentage" : "Variable pay amount"} inputMode="numeric" disabled={disabled}
                        placeholder={own.mode === "PCT" ? "%" : "₹ per year"}
                        value={own.mode === "PCT" ? (own.value ?? "") : showAmount(own.value)}
                        onChange={(e) => onOwn({ mode: own.mode, value: own.mode === "PCT" ? (e.target.value.replace(/[^\d]/g, "") === "" ? null : Math.min(100, Number(e.target.value.replace(/[^\d]/g, "")))) : parseAmount(e.target.value) })}
                        className={cn(boxCls, own.mode === "PCT" ? "w-16" : "w-28", tooMuch && "border-rose-500")} />
                </div>
            )}
        </div>
    );
}

/**
 * A hike in a table row: the amount, its fixed / variable split under it (with the CTC increase when the CTC is known),
 * and the variable pay override.
 */
export function HikeCell({ label, value, onChange, level, own, onOwn, disabled, ctc }: { label: string; value: number | null; onChange: (v: number | null) => void; level: Level; own: OwnVariable; onOwn: (v: OwnVariable) => void; disabled?: boolean; ctc?: number | null }) {
    const s = value != null ? splitPreview(value, level, own) : null;
    const rise = ctcRise(ctc, value);
    const tooMuch = own?.value != null && value != null && (own.mode === "PCT" ? own.value > 100 : own.value > value);
    return (
        <div className="flex flex-col gap-1.5">
            <AmountBox label={label} value={value} onChange={onChange} disabled={disabled} />
            <p className="text-[11px] tabular-nums text-ink-500">{s ? <>Fixed {inr(s.fixed)} · Variable {inr(s.variable)} <span className={own ? "font-semibold text-amber-700 dark:text-amber-400" : ""}>({s.pct}%{own ? " own" : ""})</span></> : `Variable ${VARIABLE_PCT[level]}% for the level`}</p>
            {rise && <p className="text-[11px] tabular-nums text-ink-500">CTC {inr(ctc)} → <b className="text-ink-800 dark:text-ink-100">{inr(rise.now)}</b> (+{rise.pct}%)</p>}
            {!disabled && <OverrideControl compact level={level} value={value} own={own} onOwn={onOwn} tooMuch={tooMuch} />}
            {tooMuch && <p className="text-[11px] font-semibold text-rose-600">More variable pay than the hike.</p>}
        </div>
    );
}

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
            {onOwn && <OverrideControl level={level} value={value} own={own ?? null} onOwn={onOwn} disabled={disabled} tooMuch={tooMuch} />}
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

const LOG_TEXT: Record<BudgetAction, string> = { PROPOSED: "proposed the budget", REVISED: "revised the budget", NEGOTIATE: "asked to negotiate", ACCEPTED: "accepted the budget", RESET: "reset the budget split" };
const LOG_DOT: Record<BudgetAction, string> = { PROPOSED: "bg-brand-600", REVISED: "bg-brand-600", NEGOTIATE: "bg-rose-500", ACCEPTED: "bg-emerald-500", RESET: "bg-amber-500" };

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
                            {l.action === "RESET" ? <>Split cleared; the <b>{inr(l.amount)}</b> budget is back with the EL to accept</> : l.action === "NEGOTIATE" ? <>Asked for <b className="text-rose-600">{inr(l.amount)}</b>{offered[i] != null ? <span className="text-ink-500"> (offered {inr(offered[i])})</span> : null}</> : <b>{inr(l.amount)}</b>}
                        </p>
                    )}
                    {l.comment && <p className="max-w-[70ch] whitespace-pre-wrap border-l-2 border-ink-200 pl-3 text-sm text-ink-700 dark:border-white/10 dark:text-ink-200">{l.comment}</p>}
                </li>
            ))}
        </ol>
    );
}
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const FROM_FINANCE: BudgetAction[] = ["PROPOSED", "REVISED"];
const THREAD_LABEL: Record<BudgetAction, string> = { PROPOSED: "Proposed the budget", REVISED: "Revised the budget", NEGOTIATE: "Asked to negotiate", ACCEPTED: "Accepted the budget", RESET: "Reset the budget split" };
const THREAD_TONE: Record<BudgetAction, string> = {
    PROPOSED: "border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900",
    REVISED: "border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900",
    NEGOTIATE: "border-rose-400/60 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10",
    ACCEPTED: "border-emerald-500/60 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10",
    RESET: "border-amber-500/60 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10",
};
const THREAD_TEXT: Record<BudgetAction, string> = {
    PROPOSED: "text-brand-700 dark:text-brand-300", REVISED: "text-brand-700 dark:text-brand-300", NEGOTIATE: "text-rose-700 dark:text-rose-300",
    ACCEPTED: "text-emerald-700 dark:text-emerald-300", RESET: "text-amber-800 dark:text-amber-300",
};
const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

/**
 * The budget discussion between the Finance Head and the EL as a conversation, oldest first: the viewer's own messages on
 * the right, the other side's on the left, each with what was done, the amount and the comment.
 */
export function BudgetThread({ log, viewer }: { log: BudgetLogEntry[]; viewer: "FINANCE" | "EL" }) {
    if (!log.length) return (
        <div className="flex flex-col items-center gap-2 border border-dashed border-ink-300 px-6 py-12 text-center dark:border-white/20">
            <p className="text-base font-bold text-ink-900 dark:text-white">No budget yet</p>
            <p className="max-w-[56ch] text-sm text-ink-500">The discussion starts when the Finance Head proposes the department's budget.</p>
        </div>
    );
    let offer: number | null = null;
    const offered = log.map((l) => { const before = offer; if (l.action === "PROPOSED" || l.action === "REVISED") offer = l.amount; return before; });
    return (
        <ol className="flex flex-col gap-2.5" aria-label="Budget discussion">
            {log.map((l, i) => {
                const finance = FROM_FINANCE.includes(l.action);
                const mine = finance === (viewer === "FINANCE");
                const name = l.by?.name ?? (finance ? "Finance Head" : "EL");
                return (
                    <li key={i} className={cn("flex items-start gap-2", mine && "flex-row-reverse")}>
                        <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-[10px] font-bold text-white", finance ? "bg-brand-600" : "bg-ink-800 dark:bg-ink-600")} aria-hidden>{initials(name)}</span>
                        <div className={cn("flex max-w-[520px] flex-col gap-1 border px-3 py-2", THREAD_TONE[l.action], mine && "items-end text-right")}>
                            <p className={cn("flex flex-wrap items-baseline gap-x-2 text-xs", mine && "flex-row-reverse")}>
                                <b className="text-ink-900 dark:text-white">{name}</b>
                                <span className={cn("font-semibold", THREAD_TEXT[l.action])}>{THREAD_LABEL[l.action].toLowerCase()}</span>
                                <span className="text-ink-500">{when(l.at)}</span>
                            </p>
                            {l.amount != null && (l.action === "NEGOTIATE"
                                ? <p className="text-sm text-ink-700 dark:text-ink-200">Asks <b className="text-base tabular-nums text-rose-700 dark:text-rose-300">{inr(l.amount)}</b>{offered[i] != null && <span className="text-xs text-ink-500"> instead of {inr(offered[i])}</span>}</p>
                                : <p className="text-base font-bold tabular-nums text-ink-900 dark:text-white">{inr(l.amount)}{l.action === "REVISED" && offered[i] != null && <span className="ml-1.5 text-xs font-normal text-ink-500">was {inr(offered[i])}</span>}</p>)}
                            {l.action === "RESET" && <p className="text-xs text-ink-600 dark:text-ink-300">Split cleared; the budget came back to the EL to accept again.</p>}
                            {l.comment && <p className="whitespace-pre-wrap text-sm text-ink-800 dark:text-ink-100">{l.comment}</p>}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

/** The department's budget at a glance, above the discussion: where it stands and how it compares with the appeals */
export function BudgetStrip({ r }: { r: Round }) {
    const agreed = !!r.elAcceptedAt;
    const state = r.budget == null ? "Not proposed yet" : agreed ? `Agreed · accepted by ${r.el?.name ?? "the EL"} ${dayShort(r.elAcceptedAt)}` : r.status === "BUDGET_NEGOTIATION" ? `${r.el?.name ?? "The EL"} is negotiating` : `Waiting for ${r.el?.name ?? "the EL"} to accept`;
    const cells = [
        { label: "Department budget", value: r.budget == null ? "—" : inr(r.budget), hint: state, strong: true },
        { label: "Department Total Expected", value: inr(r.totals.expected), hint: r.budget != null ? `Budget is ${pctOf(r.budget, r.totals.expected)} of it` : `${r.totals.submitted} of ${r.totals.people} appeals in` },
        { label: "Department Total Targeted", value: inr(r.totals.target), hint: r.budget != null ? `Budget is ${pctOf(r.budget, r.totals.target)} of it` : undefined },
        { label: "Decided so far", value: r.elSentAt ? inr(r.totals.allocated) : "—", hint: r.elSentAt ? `Split sent ${dayShort(r.elSentAt)}` : "Not split yet" },
    ];
    return (
        <div className="grid grid-cols-1 border border-ink-200 sm:grid-cols-2 xl:grid-cols-4 dark:border-white/10">
            {cells.map((c, i) => (
                <div key={c.label} className={cn("flex flex-col gap-0.5 border-ink-200 px-4 py-3 dark:border-white/10", i > 0 && "border-t sm:border-t-0 sm:border-l", c.strong && (agreed ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-brand-50 dark:bg-brand-600/10"))}>
                    <p className="eyebrow">{c.label}</p>
                    <p className="text-xl font-bold tabular-nums text-ink-900 dark:text-white">{c.value}</p>
                    {c.hint && <p className={cn("text-xs", c.strong && agreed ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-ink-500")}>{c.hint}</p>}
                </div>
            ))}
        </div>
    );
}
const dayShort = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "");

/**
 * The split, one row per person: what they expected and targeted, the hike (fixed and variable under it), and how it
 * compares with what they expected and targeted. With `budget`, its share of that budget; with `ctc`, the old CTC, the new
 * one and the increase. The EL and the Finance Head see the department's; an FL their team and their own; a person their own.
 */
/** Who the person is in the round: EL or FL by their place in it, otherwise Intern by role, else their level */
export const whoIs = (p: RoundPerson) => p.source === "EL_OWN" ? "EL" : p.source === "FL_OWN" ? "FL" : /intern/i.test(p.roleName ?? "") ? "Intern" : p.level === "HEAD_EL" ? "Head" : p.level === "MANAGER" ? "Manager" : "Associate";

export function SplitTable({ people, budget, budgetLabel = "% of total budget", ctc }: { people: RoundPerson[]; budget?: number | null; budgetLabel?: string; ctc?: boolean }) {
    const rows = people.map((p) => {
        const hike = p.approved ?? p.allocation;
        const split = p.approvedFixed != null ? { fixed: p.approvedFixed, variable: p.approvedVariable ?? 0 } : hike != null ? splitPreview(hike, p.level, p.variable) : null;
        return { p, hike, split, rise: ctcRise(p.currentAnnualCtc, hike) };
    });
    const sum = (f: (x: (typeof rows)[number]) => number | null | undefined) => rows.reduce((t, x) => t + (f(x) ?? 0), 0);
    const total = sum((x) => x.hike);
    const expected = sum((x) => x.p.expected);
    const target = sum((x) => x.p.target);
    const withCtc = rows.filter((x) => x.p.currentAnnualCtc != null);
    const oldCtc = withCtc.reduce((t, x) => t + x.p.currentAnnualCtc!, 0);
    const ctcHike = withCtc.reduce((t, x) => t + (x.hike ?? 0), 0);
    const showBudget = budget !== undefined;
    const heads = ["Name", "Expected hike", "Targeted hike", "Accepted hike", ...(ctc ? ["Current CTC → New CTC", "CTC increase"] : []), ...(showBudget ? [budgetLabel] : []), "% of expected", "% of targeted", "Status"];
    const th = "px-4 py-2.5 text-left";
    const num = "px-4 py-3 text-right tabular-nums";
    return (
        <div className="overflow-x-auto">
            <table className={cn("w-full text-sm", ctc ? "min-w-[1120px]" : "min-w-[820px]")}>
                <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">
                    {heads.map((h, i) => <th key={h} className={cn(th, i > 0 && i < heads.length - 1 && "text-right")}>{h}</th>)}
                </tr></thead>
                <tbody>
                    {rows.map(({ p, hike, split, rise }) => (
                        <tr key={p.cycleId} className="border-b border-ink-100 align-top last:border-0 dark:border-white/5">
                            <td className="px-4 py-3"><p className="font-semibold text-ink-900 dark:text-white">{p.name}</p><p className="text-xs text-ink-500">{whoIs(p)}</p></td>
                            <td className={num}>{inr(p.expected)}</td>
                            <td className={num}>{inr(p.target)}</td>
                            <td className={num}>
                                <p className="font-bold text-ink-900 dark:text-white">{inr(hike)}</p>
                                {split && <p className="mt-0.5 whitespace-nowrap text-xs text-ink-500">Fixed {inr(split.fixed)} · Variable {inr(split.variable)}</p>}
                            </td>
                            {ctc && <td className={num}>{p.currentAnnualCtc != null ? <><span className="text-ink-500">{inr(p.currentAnnualCtc)}</span> → <b className="text-ink-900 dark:text-white">{rise ? inr(rise.now) : "—"}</b></> : <span className="text-xs text-ink-400">No CTC on record</span>}</td>}
                            {ctc && <td className={cn(num, "font-semibold text-emerald-700 dark:text-emerald-400")}>{rise ? `+${rise.pct}%` : "—"}</td>}
                            {showBudget && <td className={num}>{pctOf(hike, budget)}</td>}
                            <td className={num}>{pctOf(hike, p.expected)}</td>
                            <td className={num}>{pctOf(hike, p.target)}</td>
                            <td className="px-4 py-3"><StatusChip status={p.status} /></td>
                        </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={heads.length} className="px-4 py-8 text-center text-sm text-ink-500">Nobody here has an appraisal yet.</td></tr>}
                </tbody>
                {rows.length > 1 && <tfoot><tr className="border-t border-ink-200 bg-ink-50 font-semibold dark:border-white/10 dark:bg-ink-800">
                    <td className="px-4 py-3 text-ink-900 dark:text-white">Total</td>
                    <td className={num}>{inr(expected)}</td>
                    <td className={num}>{inr(target)}</td>
                    <td className={num}>{inr(total)}{showBudget && <p className="text-xs font-normal text-ink-500">of {inr(budget)} budget</p>}</td>
                    {ctc && <td className={num}>{withCtc.length ? <>{inr(oldCtc)} → {inr(oldCtc + ctcHike)}</> : "—"}</td>}
                    {ctc && <td className={cn(num, "text-emerald-700 dark:text-emerald-400")}>{oldCtc ? `+${Math.round((ctcHike / oldCtc) * 1000) / 10}%` : "—"}</td>}
                    {showBudget && <td className={num}>{pctOf(total, budget)}</td>}
                    <td className={num}>{pctOf(total, expected)}</td>
                    <td className={num}>{pctOf(total, target)}</td>
                    <td />
                </tr></tfoot>}
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
