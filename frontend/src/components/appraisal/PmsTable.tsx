import { cn } from "@heroui/theme";

import type { PmsQuarter } from "./api";

const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 10) / 10}%`);
const num = (n: number | null) => (n == null ? "—" : String(Math.round(n * 100) / 100));

/**
 * Part A: the four quarters of the year, taken from the person's PMS Quarterly Reviews. Read-only for everyone.
 * A quarter with no PMS review is said so, never left blank. The manager feedback is shown by QuarterGrid, split into comments, achievements and failures.
 */
export default function PmsTable({ quarters, className }: { quarters: PmsQuarter[]; className?: string }) {
    if (!quarters.length) {
        return <p className={cn("border border-dashed border-ink-300 px-4 py-8 text-center text-sm text-ink-500 dark:border-white/20", className)}>No PMS quarterly review was found for this year.</p>;
    }
    const avg = quarters.filter((q) => q.finalRating != null);
    const avgFinal = avg.length ? avg.reduce((t, q) => t + (q.finalRating ?? 0), 0) / avg.length : null;
    return (
        <div className={cn("flex flex-col gap-3", className)}>
            <div className="overflow-x-auto border border-ink-200 dark:border-white/10">
                <table className="w-full min-w-[760px] text-sm">
                    <thead>
                        <tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">
                            {["Quarter", "Target", "Goal", "Utilization", "Efficiency", "System grade", "Manager rating", "Final rating"].map((h, i) => <th key={h} className={cn("px-4 py-2.5", i === 0 ? "text-left" : "text-right")}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {quarters.map((q) => (
                            <tr key={`${q.quarter}${q.year}`} className="border-b border-ink-100 last:border-0 align-top dark:border-white/5">
                                <td className="px-4 py-3"><p className="font-semibold text-ink-900 dark:text-white">{q.quarter} {q.year}</p>{q.gradeLabel && <p className="text-xs text-ink-500">{q.gradeLabel}</p>}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{pct(q.targetPercent)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{pct(q.goalAchievement)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{pct(q.utilizationPercent)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{pct(q.efficiencyPercent)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{num(q.systemGrade)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{num(q.managerAvgRating)}</td>
                                <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink-900 dark:text-white">{num(q.finalRating)}</td>
                            </tr>
                        ))}
                        {avgFinal != null && (
                            <tr className="bg-ink-50 font-semibold dark:bg-ink-800"><td className="px-4 py-3" colSpan={7}>Average final rating over {avg.length} quarter{avg.length === 1 ? "" : "s"}</td><td className="px-4 py-3 text-right tabular-nums">{num(avgFinal)}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
