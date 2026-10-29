import type { ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "@heroui/theme";

import { Chip, Input } from "@/components/ui";
import type { CycleInfo, Level, Money, Status } from "./api";
import { STATUS_COLOR, STATUS_LABEL, addDaysIso, day, inr, parseAmount, showAmount, splitPreview, VARIABLE_PCT } from "./format";

export const StatusChip = ({ status }: { status: Status }) => (
    <Chip size="sm" variant="flat" color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Chip>
);

/** Where the cycle is: five steps on one row, the current one marked, finished ones ticked */
export function Stepper({ cycle }: { cycle: CycleInfo }) {
    const at: Record<Status, number> = { EMPLOYEE_OPEN: 0, ASSESSOR_OPEN: 1, FINANCE_REVIEW: 2, OFFERED: 3, ACCEPTED: 5, POSTPONED: 4 };
    const now = at[cycle.status];
    const steps = [
        { title: "Employee window", sub: `${day(cycle.start)} → ${day(cycle.employeeWindowEnd)}` },
        { title: "Assessor window", sub: `${day(addDaysIso(cycle.start, 15))} → ${day(cycle.assessorWindowEnd)}` },
        { title: "Final approval", sub: cycle.level === "HEAD_EL" ? "By Finance" : "By the EL" },
        { title: "Offer", sub: "Sent to the employee" },
        { title: "Decision", sub: cycle.status === "POSTPONED" ? `Postponed to ${day(cycle.postponedUntil)}` : cycle.status === "ACCEPTED" ? "Accepted" : "Accept or reject" },
    ];
    return (
        <ol className="grid grid-cols-1 border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s, i) => {
                const done = i < now;
                const current = i === now;
                return (
                    <li key={s.title} aria-current={current ? "step" : undefined}
                        className={cn("flex items-start gap-3 px-4 py-3.5", i > 0 && "border-t border-ink-200 dark:border-white/10 sm:border-t-0 lg:border-l", current && "bg-brand-50 dark:bg-brand-600/10")}>
                        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold",
                            done ? "bg-emerald-600 text-white" : current ? "bg-brand-600 text-white" : "border border-ink-300 text-ink-500 dark:border-white/20")}>
                            {done ? <Check size={13} /> : i + 1}
                        </span>
                        <div className="min-w-0">
                            <p className={cn("text-[13px] font-semibold", current ? "text-brand-700 dark:text-brand-400" : "text-ink-900 dark:text-white")}>{s.title}</p>
                            <p className="truncate text-xs text-ink-500 dark:text-ink-400">{s.sub}</p>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

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
        <div className="flex flex-col gap-1.5">
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
            <p className="min-h-5 text-xs text-ink-500 dark:text-ink-400" aria-live="polite">
                {s ? <>{inr(s.annual)} → <b className="font-semibold text-ink-800 dark:text-ink-100">{inr(s.fixed)}</b> fixed + <b className="font-semibold text-ink-800 dark:text-ink-100">{inr(s.variable)}</b> variable <span className="text-ink-400">({VARIABLE_PCT[level]}%)</span></> : hint ?? "Annual amount"}
            </p>
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

export const ANSWER_QUESTIONS: [string, string][] = [
    ["goalsAchieved", "What goals and targets did you achieve?"],
    ["goalsNotAchievedWhy", "Why were some goals or targets not achieved?"],
    ["howRatingAchieved", "How did you achieve this rating?"],
    ["difficultiesAndWhy", "What difficulties did you face, and why?"],
    ["howUpdatingGoalsTargets", "How do you update your goals and targets?"],
    ["whoApprovesGoalsTargets", "Who approves your goals and targets?"],
    ["whyDeserveSalary", "Why do you think you deserve this salary?"],
    ["whyExpectThisSalary", "Why do you expect this much salary?"],
    ["biggestMilestone", "Biggest milestone"],
    ["biggestAchievement", "Biggest achievement"],
];
