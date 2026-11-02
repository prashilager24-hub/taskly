import { useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui";
import { Columns, Donut, Kpi, YearSelect } from "./pmsCharts";
import { yearRange } from "@/lib/years";
import type { Overview } from "./PmsCoverage";

// Company analytics for monthly manager feedback: efficiency labels, feedback categories, month by month
// and EL by EL. (Quarterly reviews have their own analytics.)

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LABELS: { label: string; color: string }[] = [
    { label: "High", color: "#29915f" }, { label: "At Par", color: "#efb34e" }, { label: "Low", color: "#d65353" }, { label: "Not rated", color: "#9aa3af" },
];
const GOAL = "#ff6a1f", TARGET = "#29915f", EFFICIENCY = "#3b82f6";
const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

export default function MonthlyAnalytics({ overview }: { overview: Overview }) {
    const years = useMemo(() => yearRange(), []);
    const [year, setYear] = useState<number | null>(years[years.length - 1] ?? null);
    const elOf = useMemo(() => new Map(overview.people.map((p) => [p.userID, p.elName ?? "No EL assigned"])), [overview]);
    const rows = useMemo(() => overview.monthly.filter((r) => year === null || Number(r.year) === year), [overview, year]);

    if (!overview.monthly.length) {
        return <p className="border border-dashed border-default-300 py-16 text-center text-sm text-default-500">No manager feedback has been recorded yet.</p>;
    }

    const labelCounts = LABELS.map((l) => ({ ...l, value: rows.filter((r) => (r.label || "Not rated") === l.label).length }));
    const categories = Object.entries(rows.flatMap((r) => r.categories as string[]).reduce<Record<string, number>>((m, c) => ({ ...m, [c]: (m[c] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
    const maxCat = Math.max(1, ...categories.map(([, n]) => n));

    const months = [...new Set(rows.map((r) => Number(r.month)).filter(Boolean))].sort((a, b) => a - b);
    const byMonth = months.map((m) => rows.filter((r) => Number(r.month) === m));

    const elNames = [...new Set(rows.map((r) => elOf.get(r.empId) ?? "No EL assigned"))].sort();
    const byEl = elNames.map((n) => rows.filter((r) => (elOf.get(r.empId) ?? "No EL assigned") === n));
    const scale = Math.max(100, Math.ceil(Math.max(...rows.map((r) => Math.max(r.target ?? 0, r.goal ?? 0, r.efficiency ?? 0))) / 10) * 10);

    return (
        <section className="flex flex-col gap-4">
            <div>
                <h2 className="text-base font-bold">Manager feedback analytics</h2>
                <p className="mt-0.5 text-xs text-default-500">Monthly feedback given by managers: how it was rated, what it was about, and how it moved month by month.</p>
            </div>

            {years.length > 0 && <YearSelect years={years} value={year} onChange={setYear} />}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Kpi label="Feedback entries" value={rows.length} />
                <Kpi label="People covered" value={new Set(rows.map((r) => r.empId)).size} />
                <Kpi label="Avg target" value={`${avg(rows.map((r) => r.target ?? 0)).toFixed(1)}%`} tone={TARGET} />
                <Kpi label="Avg goal" value={`${avg(rows.map((r) => r.goal ?? 0)).toFixed(1)}%`} tone={GOAL} />
                <Kpi label="Avg efficiency" value={`${avg(rows.map((r) => r.efficiency ?? 0)).toFixed(1)}%`} tone={EFFICIENCY} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="border border-default-200 shadow-sm">
                    <CardHeader className="border-b border-default-100"><h3 className="text-sm font-semibold">Efficiency level of the feedback</h3></CardHeader>
                    <CardBody className="p-4"><Donut centre={rows.length} caption="entries" segments={labelCounts} /></CardBody>
                </Card>

                <Card className="border border-default-200 shadow-sm">
                    <CardHeader className="border-b border-default-100"><h3 className="text-sm font-semibold">What the feedback says</h3></CardHeader>
                    <CardBody className="p-4">
                        {categories.length === 0 ? <p className="py-8 text-center text-xs text-default-400">No feedback categories were chosen.</p> : (
                            <ul className="space-y-2.5">
                                {categories.map(([name, n]) => (
                                    <li key={name} className="grid grid-cols-[minmax(120px,190px)_minmax(0,1fr)_auto] items-center gap-3 text-xs">
                                        <span className="truncate font-medium">{name}</span>
                                        <div className="h-2.5 bg-default-100"><div className="h-full bg-brand-600" style={{ width: `${(n / maxCat) * 100}%` }} /></div>
                                        <b>{n}</b>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
            </div>

            <Card className="border border-default-200 shadow-sm">
                <CardHeader className="border-b border-default-100"><h3 className="text-sm font-semibold">Month by month{year ? `, ${year}` : ""}</h3></CardHeader>
                <CardBody className="p-4">
                    <Columns labels={months.map((m) => MONTH_NAMES[m - 1]!)} max={scale} unit="%" height={220}
                        series={[
                            { name: "Target %", color: TARGET, values: byMonth.map((r) => avg(r.map((x) => x.target ?? 0))) },
                            { name: "Goal %", color: GOAL, values: byMonth.map((r) => avg(r.map((x) => x.goal ?? 0))) },
                            { name: "Efficiency %", color: EFFICIENCY, values: byMonth.map((r) => avg(r.map((x) => x.efficiency ?? 0))) },
                        ]} />
                </CardBody>
            </Card>

            <Card className="border border-default-200 shadow-sm">
                <CardHeader className="border-b border-default-100"><h3 className="text-sm font-semibold">EL-wise feedback</h3></CardHeader>
                <CardBody className="p-4">
                    <Columns labels={elNames} max={scale} unit="%" height={220}
                        series={[
                            { name: "Target %", color: TARGET, values: byEl.map((r) => avg(r.map((x) => x.target ?? 0))) },
                            { name: "Goal %", color: GOAL, values: byEl.map((r) => avg(r.map((x) => x.goal ?? 0))) },
                            { name: "Efficiency %", color: EFFICIENCY, values: byEl.map((r) => avg(r.map((x) => x.efficiency ?? 0))) },
                        ]} />
                    <p className="mt-3 text-[11px] text-default-400">{byEl.map((r, i) => `${elNames[i]}: ${r.length} ${r.length === 1 ? "entry" : "entries"}`).join(" · ")}</p>
                </CardBody>
            </Card>
        </section>
    );
}
