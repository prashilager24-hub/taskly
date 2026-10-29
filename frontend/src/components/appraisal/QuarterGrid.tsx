import { cn } from "@heroui/theme";

export interface Slot { n: number; quarter: string; year: number }
export interface QuarterNote { comments: string; biggestAchievements: string; biggestFailures: string }
export const EMPTY_NOTE: QuarterNote = { comments: "", biggestAchievements: "", biggestFailures: "" };

const COLS: [keyof QuarterNote, string][] = [["comments", "Comments"], ["biggestAchievements", "Biggest achievements"], ["biggestFailures", "Biggest failures"]];
const cell = "block w-full resize-y border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 dark:border-white/10 dark:bg-ink-900 dark:text-white";

/**
 * What the employee writes for each quarter of the year: comments, biggest achievements, biggest failures.
 * Editable for the employee while the window is open; read-only for the FL, the EL and Finance.
 */
export default function QuarterGrid({ slots, values, onChange }: { slots: Slot[]; values: Record<number, QuarterNote>; onChange?: (n: number, patch: Partial<QuarterNote>) => void }) {
    const editable = !!onChange;
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
                    {slots.map((s) => {
                        const v = values[s.n] ?? EMPTY_NOTE;
                        return (
                            <tr key={s.n} className="border-b border-ink-100 align-top last:border-0 dark:border-white/5">
                                <td className="px-4 py-3 font-semibold text-ink-900 dark:text-white">{s.quarter} {s.year}</td>
                                {COLS.map(([key, label]) => (
                                    <td key={key} className="px-2 py-2">
                                        {editable ? (
                                            <textarea aria-label={`${label}, ${s.quarter} ${s.year}`} rows={3} className={cell} value={v[key]} placeholder={label}
                                                onChange={(e) => onChange!(s.n, { [key]: e.target.value })} />
                                        ) : (
                                            <p className={cn("whitespace-pre-wrap px-2 py-1", v[key] ? "text-ink-900 dark:text-ink-100" : "text-ink-400")}>{v[key] || "Nothing written"}</p>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/** The notes the server sent, keyed by quarter number */
export const notesFrom = (quarters: { quarter: number; comments?: string; biggestAchievements?: string; biggestFailures?: string }[] | undefined): Record<number, QuarterNote> =>
    Object.fromEntries((quarters ?? []).map((q) => [q.quarter, { comments: q.comments ?? "", biggestAchievements: q.biggestAchievements ?? "", biggestFailures: q.biggestFailures ?? "" }]));
