import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "@heroui/theme";

import { Chip, Input } from "@/components/ui";
import type { Level, Money, RoundStatus, Stage, Status } from "./api";
import { ROUND_COLOR, ROUND_LABEL, STAGE_COLOR, STAGE_LABEL, STATUS_COLOR, STATUS_LABEL, inr, parseAmount, showAmount, splitPreview, VARIABLE_PCT } from "./format";

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

/** An annual amount typed with Indian grouping; the split is worked out under the box so nobody types it */
export function HikeField({ label, value, onChange, level, disabled, hint }: { label: string; value: number | null; onChange: (v: number | null) => void; level: Level; disabled?: boolean; hint?: string }) {
    const s = value != null ? splitPreview(value, level) : null;
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
            {/* the split is always on screen, so the layout does not jump while typing */}
            <div className="grid grid-cols-2 gap-2" aria-live="polite">
                <div className="flex items-center justify-between gap-2 border-l-2 border-brand-500 bg-brand-50 px-3 py-2 dark:bg-brand-600/10">
                    <span className="eyebrow">Fixed</span>
                    <span className="text-sm font-bold tabular-nums text-ink-900 dark:text-white">{s ? inr(s.fixed) : "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2 border-l-2 border-emerald-500 bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10">
                    <span className="eyebrow flex items-center gap-1.5">Variable<span className="bg-emerald-600 px-1 text-[10px] font-semibold tracking-normal text-white">{VARIABLE_PCT[level]}%</span></span>
                    <span className="text-sm font-bold tabular-nums text-ink-900 dark:text-white">{s ? inr(s.variable) : "—"}</span>
                </div>
            </div>
            {hint && <p className="-mt-0.5 text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
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
