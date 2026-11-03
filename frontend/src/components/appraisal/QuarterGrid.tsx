import { cn } from "@heroui/theme";

import type { PmsQuarter } from "./api";

export interface Slot { n: number; quarter: string; year: number; achievement?: string; failure?: string }

const COLS: [keyof Pick<PmsQuarter, "comments" | "achievements" | "failures">, string][] = [["comments", "Comments"], ["achievements", "Biggest achievements"], ["failures", "Biggest failures"]];

/**
 * Comments, biggest achievements and biggest failures for each quarter of the year.
 * Comments come from the PMS Quarterly Review manager feedback. Biggest achievements and failures are what the employee wrote in Quarter Highlights. Nobody types here.
 */
export default function QuarterGrid({ slots, pms }: { slots: Slot[]; pms: PmsQuarter[] }) {
    const find = (s: Slot) => pms.find((p) => p.quarter === s.quarter && p.year === s.year);
    return (
        <div className="overflow-x-auto border border-ink-200 dark:border-white/10">
            <table className="w-full min-w-[760px] table-fixed text-sm">
                <colgroup><col className="w-28" /><col /><col /><col /></colgroup>
                <thead>
                    <tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-ink-800">
                        <th className="px-4 py-2.5 text-left">Quarter</th>
                        {COLS.map(([, label]) => <th key={label} className="px-4 py-2.5 text-left">{label}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {[...slots].sort((x, y) => x.quarter.localeCompare(y.quarter)).map((s) => {
                        const p = find(s);
                        return (
                            <tr key={s.n} className="border-b border-ink-100 align-top last:border-0 dark:border-white/5">
                                <td className="px-4 py-3 font-semibold text-ink-900 dark:text-white">{s.quarter} {s.year}</td>
                                {COLS.map(([key]) => {
                                    // achievements and failures are the employee's own notes (Quarter Highlights), shown even before the PMS review is in
                                    const own = key === "achievements" ? s.achievement : key === "failures" ? s.failure : "";
                                    const text = own || p?.[key] || "";
                                    return (
                                        <td key={key} className="px-4 py-3">
                                            <p className={cn("whitespace-pre-wrap", text ? "text-ink-900 dark:text-ink-100" : "text-ink-400")}>{text || (own === "" && key !== "comments" ? "Not entered yet" : p ? "Nothing recorded" : "No PMS review for this quarter")}</p>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
