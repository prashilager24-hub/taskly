import { useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui";
import { Segmented } from "@/components/page";
import { Columns, Donut, Kpi, PENDING, REVIEWED, SplitBar, YearSelect } from "./pmsCharts";
import { yearRange } from "@/lib/years";

// Who has been reviewed and who is still waiting: by year, quarter (or month) and EL team.
// This is the PMS report as an overview. Quarterly reviews and monthly manager feedback both use it.

export interface Person { userID: number; name: string; department: string; elId: number | null; elName: string | null }
export interface Overview { people: Person[]; quarterly: any[]; monthly: any[] }

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NO_EL = "No EL assigned";

export default function PmsCoverage({ type, overview }: { type: "quarterly" | "monthly"; overview: Overview }) {
    const quarterly = type === "quarterly";
    const rows = quarterly ? overview.quarterly : overview.monthly;
    const periods = quarterly ? QUARTERS : MONTH_NAMES;
    const periodKey = (i: number) => (quarterly ? QUARTERS[i]! : String(i + 1));

    const years = useMemo(() => yearRange(), []);

    const [year, setYear] = useState(years[years.length - 1]!);
    const [period, setPeriod] = useState("ALL");
    const [openEl, setOpenEl] = useState<string | null>(null);

    const people = overview.people;
    const reviewedIds = (y: number, p: string) =>
        new Set(rows.filter((r) => Number(r.year) === y && (p === "ALL" || String(quarterly ? r.quarter : r.month) === p)).map((r) => r.empId as number));

    const reviewed = useMemo(() => reviewedIds(year, period), [rows, year, period]);
    const done = people.filter((p) => reviewed.has(p.userID));
    const waiting = people.filter((p) => !reviewed.has(p.userID));
    const pct = people.length ? Math.round((done.length / people.length) * 100) : 0;

    // coverage per quarter / month of the chosen year; periods that have not happened yet are left out
    const now = new Date();
    const lastShown = year < now.getFullYear() ? periods.length : year > now.getFullYear() ? 0 : quarterly ? Math.floor(now.getMonth() / 3) + 1 : now.getMonth() + 1;
    const shown = periods.slice(0, Math.max(lastShown, 1));
    const trend = useMemo(() => shown.map((_, i) => people.filter((p) => reviewedIds(year, periodKey(i)).has(p.userID)).length), [rows, year, people, quarterly]);

    // EL teams: lowest coverage first, so the gaps show at the top
    const teams = useMemo(() => {
        const by = new Map<string, Person[]>();
        for (const p of people) by.set(p.elName ?? NO_EL, [...(by.get(p.elName ?? NO_EL) ?? []), p]);
        return [...by.entries()].map(([name, members]) => {
            const d = members.filter((m) => reviewed.has(m.userID));
            return { name, members, done: d.length, waiting: members.filter((m) => !reviewed.has(m.userID)), pct: members.length ? d.length / members.length : 0 };
        }).sort((a, b) => a.pct - b.pct || b.members.length - a.members.length);
    }, [people, reviewed]);

    const label = period === "ALL" ? `${year}${quarterly ? " (any quarter)" : " (any month)"}` : `${quarterly ? period : MONTH_NAMES[Number(period) - 1]} ${year}`;

    return (
        <section className="flex flex-col gap-4">
            <div>
                <h2 className="text-base font-bold">{quarterly ? "Quarterly review coverage" : "Manager feedback coverage"}</h2>
                <p className="mt-0.5 text-xs text-default-500">{quarterly ? "Who has a quarterly review" : "Who has manager feedback"} and who is still waiting, by period and EL team. Admin accounts are not counted.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <YearSelect years={years} value={year} onChange={setYear} />
                <Segmented size="sm" label={quarterly ? "Quarter" : "Month"} value={period} onChange={setPeriod}
                    options={[{ key: "ALL", label: "All" }, ...periods.map((p, i) => ({ key: periodKey(i), label: p }))]} />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="Should be reviewed" value={people.length} hint={label} />
                <Kpi label="Reviewed" value={done.length} tone={REVIEWED} />
                <Kpi label="Still waiting" value={waiting.length} tone={PENDING} />
                <Kpi label="Coverage" value={`${pct}%`} hint={`${done.length} of ${people.length} people`} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[.8fr_1.2fr]">
                <Card className="border border-default-200 shadow-sm">
                    <CardHeader className="border-b border-default-100"><h3 className="text-sm font-semibold">Reviewed vs waiting</h3></CardHeader>
                    <CardBody className="p-4">
                        <Donut centre={`${pct}%`} caption="reviewed" segments={[{ label: "Reviewed", value: done.length, color: REVIEWED }, { label: "Still waiting", value: waiting.length, color: PENDING }]} />
                    </CardBody>
                </Card>

                <Card className="border border-default-200 shadow-sm">
                    <CardHeader className="flex justify-between border-b border-default-100">
                        <h3 className="text-sm font-semibold">{quarterly ? "Reviewed in each quarter" : "Reviewed in each month"}, {year}</h3>
                        <span className="text-[11px] text-default-400">Click a column to filter</span>
                    </CardHeader>
                    <CardBody className="p-4">
                        <Columns labels={shown} max={Math.max(people.length, 1)} height={190}
                            series={[{ name: "Reviewed", color: REVIEWED, values: trend }, { name: "Still waiting", color: PENDING, values: trend.map((v) => people.length - v) }]}
                            onPick={(i) => setPeriod(period === periodKey(i) ? "ALL" : periodKey(i))} active={period === "ALL" ? null : shown.findIndex((_, i) => periodKey(i) === period)} />
                    </CardBody>
                </Card>
            </div>

            <Card className="border border-default-200 shadow-sm">
                <CardHeader className="flex flex-wrap justify-between gap-2 border-b border-default-100">
                    <h3 className="text-sm font-semibold">EL-wise team coverage, {label}</h3>
                    <span className="flex items-center gap-3 text-[11px] text-default-500">
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5" style={{ background: REVIEWED }} aria-hidden />Reviewed</span>
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 opacity-40" style={{ background: PENDING }} aria-hidden />Still waiting</span>
                    </span>
                </CardHeader>
                <CardBody className="p-0">
                    <ul className="divide-y divide-default-100">
                        {teams.map((t) => {
                            const open = openEl === t.name;
                            return (
                                <li key={t.name}>
                                    <button type="button" onClick={() => setOpenEl(open ? null : t.name)} aria-expanded={open}
                                        className="grid w-full grid-cols-[minmax(110px,170px)_minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5 text-left hover:bg-default-50">
                                        <span className="truncate text-sm font-semibold">{t.name}</span>
                                        <SplitBar done={t.done} rest={t.members.length - t.done} />
                                        <span className="w-28 text-right text-xs"><b>{t.done}</b>/{t.members.length} · {Math.round(t.pct * 100)}%</span>
                                    </button>
                                    {open && (
                                        <div className="bg-default-50 px-4 py-3 text-xs">
                                            {t.waiting.length === 0 ? (
                                                <p className="text-default-500">Everyone in this team has been reviewed.</p>
                                            ) : (
                                                <>
                                                    <p className="mb-2 font-semibold text-default-700">Still waiting ({t.waiting.length})</p>
                                                    <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                                                        {t.waiting.map((m) => <li key={m.userID} className="truncate"><span className="font-medium">{m.name}</span> <span className="text-default-400">· {m.department}</span></li>)}
                                                    </ul>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </CardBody>
            </Card>
        </section>
    );
}
