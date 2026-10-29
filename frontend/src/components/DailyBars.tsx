import { cn } from "@heroui/theme";

/**
 * One bar per day, scaled to the largest value (or `max`). Bars share the width, so any number of days fits.
 * `goal` draws a dashed line, e.g. 100 for "target achieved %" or 8 for working hours.
 */
export default function DailyBars({ labels, values, unit = "", max, goal }: { labels: string[]; values: number[]; unit?: string; max?: number; goal?: number }) {
    const top = Math.max(max ?? 0, goal ?? 0, ...values, 1);
    return (
        <div>
            <div className="relative flex h-44 items-end gap-1.5 border-b border-ink-200 dark:border-white/10">
                {goal !== undefined && (
                    <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-400 dark:border-white/30" style={{ bottom: `${(goal / top) * 100}%` }}>
                        <span className="absolute right-0 -top-4 bg-white pl-1 text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:bg-ink-900 dark:text-ink-400">Goal {goal}{unit}</span>
                    </div>
                )}
                {values.map((v, i) => {
                    const met = goal !== undefined && v >= goal;
                    return (
                        <div key={i} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${labels[i]}: ${v}${unit}`}>
                            <span className="mb-1 text-[11px] font-semibold text-ink-700 dark:text-ink-200">{v}{unit}</span>
                            <div className={cn("w-full max-w-[56px] transition-colors", met ? "bg-emerald-500 group-hover:bg-emerald-600" : "bg-brand-500 group-hover:bg-brand-600")} style={{ height: `${Math.max((v / top) * 82, v > 0 ? 3 : 0)}%` }} />
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 flex gap-1.5">
                {labels.map((l, i) => <span key={i} className="min-w-0 flex-1 truncate text-center text-[11px] text-ink-500 dark:text-ink-400">{l}</span>)}
            </div>
        </div>
    );
}
