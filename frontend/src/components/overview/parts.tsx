import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { cn } from "@heroui/theme";

// Shared building blocks for the Taskly overview dashboards: numbers that count up, a two-ring gauge,
// KPI tiles and a staggered reveal. Everything plays once when data arrives and respects "reduce motion".

export const num = (v: unknown, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

/** Efficiency level of a team or person by target achieved: High at 100%+, At Par at 80%+, else Low */
export type Level = "High" | "At Par" | "Low";
export const levelOf = (target: number): Level => (target >= 100 ? "High" : target >= 80 ? "At Par" : "Low");
export const LEVEL_STYLE: Record<Level, { bar: string; text: string; soft: string; hex: string }> = {
    High: { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", soft: "bg-emerald-50 dark:bg-emerald-500/10", hex: "#10b981" },
    "At Par": { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", soft: "bg-amber-50 dark:bg-amber-500/10", hex: "#f59e0b" },
    Low: { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", soft: "bg-rose-50 dark:bg-rose-500/10", hex: "#f43f5e" },
};

/** A number that counts up from its previous value to `value` */
export function CountUp({ value, decimals = 0, suffix = "", className }: { value: number; decimals?: number; suffix?: string; className?: string }) {
    const reduce = useReducedMotion();
    const [shown, setShown] = useState(reduce ? value : 0);
    const from = useRef(0);
    useEffect(() => {
        if (reduce) { setShown(value); return; }
        const controls = animate(from.current, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(v) });
        from.current = value;
        return () => controls.stop();
    }, [value, reduce]);
    return <span className={className}>{shown.toFixed(decimals)}{suffix}</span>;
}

/** Fades and lifts its children in, one after another when `index` increases */
export function Reveal({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
    const reduce = useReducedMotion();
    return (
        <motion.div
            className={className}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
        >
            {children}
        </motion.div>
    );
}

/** A thin progress bar that grows to its value */
export function Meter({ value, max = 100, className, barClassName, delay = 0 }: { value: number; max?: number; className?: string; barClassName?: string; delay?: number }) {
    const reduce = useReducedMotion();
    const pct = Math.max(0, Math.min(100, (value / max) * 100));
    return (
        <div className={cn("h-1.5 w-full overflow-hidden bg-ink-100 dark:bg-white/10", className)} role="presentation">
            <motion.div
                className={cn("h-full bg-brand-600", barClassName)}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
            />
        </div>
    );
}

const R_OUT = 94, R_IN = 74;
const C_OUT = 2 * Math.PI * R_OUT, C_IN = 2 * Math.PI * R_IN;

/** Two concentric rings: the outer one is the main value (target achieved), the inner one a second value (utilization) */
export function DualGauge({ outer, inner, outerLabel, innerLabel, caption }: { outer: number; inner: number; outerLabel: string; innerLabel: string; caption?: ReactNode }) {
    const reduce = useReducedMotion();
    const o = Math.max(0, Math.min(100, outer)), i = Math.max(0, Math.min(100, inner));
    return (
        <div className="flex flex-col items-center">
            <div className="relative h-[230px] w-[230px]">
                <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90" role="img" aria-label={`${outerLabel} ${outer}%, ${innerLabel} ${inner}%`}>
                    <circle cx="110" cy="110" r={R_OUT} fill="none" strokeWidth="12" className="stroke-ink-100 dark:stroke-white/10" />
                    <circle cx="110" cy="110" r={R_IN} fill="none" strokeWidth="6" className="stroke-ink-100 dark:stroke-white/10" />
                    <motion.circle cx="110" cy="110" r={R_OUT} fill="none" strokeWidth="12" strokeLinecap="butt" className="stroke-brand-600"
                        strokeDasharray={C_OUT}
                        initial={reduce ? false : { strokeDashoffset: C_OUT }} animate={{ strokeDashoffset: C_OUT * (1 - o / 100) }}
                        transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }} />
                    <motion.circle cx="110" cy="110" r={R_IN} fill="none" strokeWidth="6" strokeLinecap="butt" className="stroke-ink-900 dark:stroke-white"
                        strokeDasharray={C_IN}
                        initial={reduce ? false : { strokeDashoffset: C_IN }} animate={{ strokeDashoffset: C_IN * (1 - i / 100) }}
                        transition={{ duration: 1.3, delay: 0.15, ease: [0.16, 1, 0.3, 1] }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <CountUp value={outer} decimals={1} suffix="%" className="text-[30px] font-bold leading-none tracking-tight text-ink-900 dark:text-white" />
                    <span className="mt-2 max-w-[100px] text-[9px] font-semibold uppercase leading-tight tracking-[0.14em] text-ink-500 dark:text-ink-400">{outerLabel}</span>
                </div>
            </div>
            <dl className="mt-4 grid w-full grid-cols-2 gap-px border border-ink-200 bg-ink-200 dark:border-white/10 dark:bg-white/10">
                <div className="bg-white px-3 py-2.5 dark:bg-ink-900">
                    <dt className="flex items-center gap-2 text-[11px] text-ink-500 dark:text-ink-400"><span className="h-2 w-2 bg-brand-600" aria-hidden />{outerLabel}</dt>
                    <dd className="mt-0.5 text-sm font-bold text-ink-900 dark:text-white"><CountUp value={outer} decimals={1} suffix="%" /></dd>
                </div>
                <div className="bg-white px-3 py-2.5 dark:bg-ink-900">
                    <dt className="flex items-center gap-2 text-[11px] text-ink-500 dark:text-ink-400"><span className="h-2 w-2 bg-ink-900 dark:bg-white" aria-hidden />{innerLabel}</dt>
                    <dd className="mt-0.5 text-sm font-bold text-ink-900 dark:text-white"><CountUp value={inner} decimals={1} suffix="%" /></dd>
                </div>
            </dl>
            {caption && <div className="mt-3 w-full">{caption}</div>}
        </div>
    );
}

/** One headline number with a label, a hint and an optional meter */
export function Kpi({ label, value, decimals = 0, suffix = "", hint, meter, index = 0, icon }: { label: string; value: number | null; decimals?: number; suffix?: string; hint?: ReactNode; meter?: { value: number; max?: number }; index?: number; icon?: ReactNode }) {
    return (
        <Reveal index={index} className="group flex min-h-[132px] flex-col justify-between border border-ink-200 bg-white p-4 transition-colors hover:border-brand-500 dark:border-white/10 dark:bg-ink-900 dark:hover:border-brand-500/60">
            <div className="flex items-start justify-between gap-2">
                <span className="eyebrow leading-snug">{label}</span>
                {icon && <span className="text-ink-400 transition-colors group-hover:text-brand-600">{icon}</span>}
            </div>
            <div>
                <p className="text-[30px] font-bold leading-none tracking-tight text-ink-900 dark:text-white">
                    {value === null ? "—" : <CountUp value={value} decimals={decimals} suffix={suffix} />}
                </p>
                {hint && <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
            </div>
            {meter && <Meter value={meter.value} max={meter.max} delay={0.2 + index * 0.07} className="mt-3" />}
        </Reveal>
    );
}

/** Donut of how many items fall in each level; segments grow in and act as filters */
export function LevelDonut({ counts, active, onPick }: { counts: Record<Level, number>; active: Level | "All"; onPick: (l: Level | "All") => void }) {
    const reduce = useReducedMotion();
    const total = counts.High + counts["At Par"] + counts.Low;
    const R = 62, C = 2 * Math.PI * R;
    const order: Level[] = ["High", "At Par", "Low"];
    let acc = 0;
    return (
        <div className="flex flex-col items-center gap-5">
            <div className="relative h-[170px] w-[170px]">
                <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label={`High ${counts.High}, At Par ${counts["At Par"]}, Low ${counts.Low}`}>
                    <circle cx="80" cy="80" r={R} fill="none" strokeWidth="18" className="stroke-ink-100 dark:stroke-white/10" />
                    {total > 0 && order.map((l, idx) => {
                        const len = (counts[l] / total) * C;
                        const seg = (
                            <motion.circle key={l} cx="80" cy="80" r={R} fill="none" strokeWidth={active === l ? 22 : 18} stroke={LEVEL_STYLE[l].hex}
                                opacity={active === "All" || active === l ? 1 : 0.25}
                                strokeDashoffset={-acc}
                                initial={reduce ? false : { strokeDasharray: `0 ${C}` }} animate={{ strokeDasharray: `${Math.max(len - 2, 0)} ${C}` }}
                                transition={{ duration: 0.9, delay: 0.2 + idx * 0.15, ease: "easeOut" }} />
                        );
                        acc += len;
                        return seg;
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <CountUp value={total} className="text-3xl font-bold text-ink-900 dark:text-white" />
                    <span className="eyebrow mt-1">departments</span>
                </div>
            </div>
            <ul className="w-full divide-y divide-ink-100 dark:divide-white/5">
                {order.map((l) => (
                    <li key={l}>
                        <button type="button" aria-pressed={active === l} onClick={() => onPick(active === l ? "All" : l)}
                            className={cn("flex w-full items-center gap-3 px-2 py-2.5 text-left text-sm transition-colors focus-ring", active === l ? "bg-ink-50 dark:bg-white/5" : "hover:bg-ink-50 dark:hover:bg-white/[0.03]")}>
                            <span className={cn("h-2.5 w-2.5", LEVEL_STYLE[l].bar)} aria-hidden />
                            <span className="flex-1 font-medium text-ink-900 dark:text-white">{l}</span>
                            <span className="font-bold text-ink-900 dark:text-white">{counts[l]}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
