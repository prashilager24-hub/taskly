import { Select, SelectItem } from "@/components/ui";

// Small chart pieces for the PMS company analytics (plain SVG / CSS, no chart library).

export const REVIEWED = "#29915f";
export const PENDING = "#ff6a1f";

export interface Segment { label: string; value: number; color: string }

/** Ring with a total in the middle; the legend sits beside it */
export function Donut({ segments, centre, caption }: { segments: Segment[]; centre: string | number; caption?: string }) {
    const total = segments.reduce((n, s) => n + s.value, 0);
    const R = 44, C = 2 * Math.PI * R;
    let used = 0;
    return (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
            <svg viewBox="0 0 120 120" className="h-40 w-40 shrink-0" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
                <circle cx="60" cy="60" r={R} fill="none" strokeWidth="16" className="stroke-default-100" />
                {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
                    const len = (s.value / total) * C;
                    const el = <circle key={s.label} cx="60" cy="60" r={R} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-used} transform="rotate(-90 60 60)" />;
                    used += len;
                    return el;
                })}
                <text x="60" y={caption ? 58 : 65} textAnchor="middle" className="fill-default-900 text-[24px] font-bold">{centre}</text>
                {caption && <text x="60" y="74" textAnchor="middle" className="fill-default-500 text-[8px] uppercase tracking-wider">{caption}</text>}
            </svg>
            <ul className="w-full space-y-1.5 text-xs">
                {segments.map((s) => (
                    <li key={s.label} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2"><span className="h-2.5 w-2.5" style={{ background: s.color }} aria-hidden />{s.label}</span>
                        <span className="font-semibold text-default-900">{s.value}{total > 0 && <span className="ml-1 font-normal text-default-400">({Math.round((s.value / total) * 100)}%)</span>}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** One horizontal bar split into two parts, e.g. reviewed and still waiting */
export function SplitBar({ done, rest, height = "h-3" }: { done: number; rest: number; height?: string }) {
    const total = done + rest || 1;
    return (
        <div className={`flex w-full overflow-hidden bg-default-100 ${height}`} role="img" aria-label={`${done} reviewed, ${rest} waiting`}>
            <div style={{ width: `${(done / total) * 100}%`, background: REVIEWED }} />
            <div style={{ width: `${(rest / total) * 100}%`, background: PENDING, opacity: 0.35 }} />
        </div>
    );
}

export interface Series { name: string; color: string; values: number[] }

/** Vertical grouped columns: one group per label. `max` fixes the scale */
export function Columns({ labels, series, max, height = 200, unit = "", onPick, active }: { labels: string[]; series: Series[]; max: number; height?: number; unit?: string; onPick?: (i: number) => void; active?: number | null }) {
    return (
        <div>
            <div className="flex items-end gap-3 border-b border-default-200" style={{ height }}>
                {labels.map((l, i) => (
                    <button key={l} type="button" disabled={!onPick} onClick={() => onPick?.(i)} aria-label={l}
                        className={`group flex h-full min-w-0 flex-1 items-end justify-center gap-1 pb-0 outline-none ${onPick ? "cursor-pointer" : "cursor-default"} ${active === i ? "bg-default-100" : onPick ? "hover:bg-default-50" : ""}`}>
                        {series.map((s) => {
                            const v = s.values[i] ?? 0;
                            return (
                                <div key={s.name} className="flex h-full w-full max-w-[34px] flex-col items-center justify-end" title={`${l} · ${s.name}: ${v}${unit}`}>
                                    <span className="mb-0.5 text-[10px] font-semibold text-default-700">{v > 0 ? `${Math.round(v)}${unit}` : ""}</span>
                                    <div className="w-full" style={{ height: `${Math.min(100, (v / max) * 86)}%`, background: s.color, minHeight: v > 0 ? 2 : 0 }} />
                                </div>
                            );
                        })}
                    </button>
                ))}
            </div>
            <div className="mt-1.5 flex gap-3">
                {labels.map((l) => <span key={l} className="min-w-0 flex-1 truncate text-center text-[10px] font-semibold text-default-500">{l}</span>)}
            </div>
            {series.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-default-500">
                    {series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5" style={{ background: s.color }} aria-hidden />{s.name}</span>)}
                </div>
            )}
        </div>
    );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: string }) {
    return (
        <div className="border border-default-200 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-default-500">{label}</p>
            <p className="mt-1 text-2xl font-bold leading-none" style={tone ? { color: tone } : undefined}>{value}</p>
            {hint && <p className="mt-1.5 text-[11px] text-default-400">{hint}</p>}
        </div>
    );
}

/** Year dropdown, same control as the filters above it */
export function YearSelect({ years, value, onChange }: { years: number[]; value: number | null; onChange: (y: number) => void }) {
    return (
        <Select label="Year" size="sm" className="w-36" disallowEmptySelection selectedKeys={value ? [String(value)] : []}
            onSelectionChange={(keys) => { const k = [...keys][0]; if (k) onChange(Number(k)); }}>
            {years.map((y) => <SelectItem key={String(y)}>{String(y)}</SelectItem>)}
        </Select>
    );
}
