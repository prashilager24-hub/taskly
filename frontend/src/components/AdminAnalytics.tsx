import { useMemo, useState } from "react";
import {
    Card,
    CardBody,
    CardHeader,
    Chip,
    Drawer,
    DrawerBody,
    DrawerContent,
    DrawerHeader,
} from "@heroui/react";

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const GRADE_LABELS: Record<number, string> = {
    1: "Critical Concern",
    2: "Unsatisfactory",
    3: "Needs Significant Improvement",
    4: "Needs Improvement",
    5: "Partially Meets Expectations",
    6: "Approaching Expectations",
    7: "Meets Expectations",
    8: "Exceeds Expectations",
    9: "Significantly Exceeds",
    10: "Outstanding",
};

const GRADE_COLORS = [
    "#d65353", "#e47777", "#dc921f", "#efb34e", "#6d8fe0",
    "#88a9ed", "#29915f", "#2457d6", "#8b5cf6", "#a855f7",
];

// Fallback only: when the API has no elManager field, the EL is taken from the
// assessors. This top-level reviewer is skipped so the direct EL is picked.
const TOP_ASSESSOR = "Naveen Chennala";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

const parseJSON = (v: any, fallback: any) => {
    if (typeof v !== "string") return v ?? fallback;
    try {
        return JSON.parse(v);
    } catch {
        return fallback;
    }
};

const tone = (v: number) =>
    v >= 90 ? "text-success-600" : v >= 60 ? "text-warning-600" : "text-danger-600";

interface Row {
    id: number;
    empId: number;
    name: string;
    email: string;
    department: string;
    elManager: string;
    assessors: string;
    quarter: string;
    systemGrade: number;
    managerRating: number;
    finalRating: number;
    finalRatingPct: number;
    grade: number;
    gradeLabel: string;
    goal: number;
    target: number;
    goalWeight: number;
    targetWeight: number;
}

// Maps one API review to the flat shape the charts and tables use.
const toRow = (r: any): Row => {
    const g = parseJSON(r.grade, [])[0] || {};
    const fb = parseJSON(r.feedback, [])[0] || {};
    const a1: string = fb.assessor1Name || "";
    const a2: string = fb.assessor2Name || "";
    const derivedEL = a2 && a2 !== TOP_ASSESSOR ? a2 : a1 || a2;

    // API sends 0 for "Critical Concern"; the grade scale starts at 1.
    const grade = Math.min(Math.max(num(g.finalGrade), 1), 10);

    return {
        id: r.id,
        empId: r.empId,
        name: (r.employeeName || "").trim(),
        email: r.employeeEmail || "",
        department: r.departmentName ?? r.department ?? "—",
        elManager: r.elManager ?? r.elManagerName ?? (derivedEL || "—"),
        assessors: [a1, a2].filter((x, i, arr) => x && arr.indexOf(x) === i).join(", ") || "—",
        quarter: `${r.quarter ?? ""} ${r.quarterYear ?? ""}`.trim(),
        systemGrade: num(r.systemGrade),
        managerRating: num(r.managerAvgRating),
        finalRating: num(r.finalRating),
        finalRatingPct: num(r.finalRating) * 10,
        grade,
        gradeLabel: g.finalGradeLabel || GRADE_LABELS[grade],
        goal: num(r.goalAchievement),
        target: num(r.targetPercent),
        goalWeight: num(g.goalWeight),
        targetWeight: num(g.targetWeight),
    };
};

// ─── Charts (plain SVG / CSS, no chart library needed) ────────────────────────

function DonutChart({ counts }: { counts: number[] }) {
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const R = 44;
    const C = 2 * Math.PI * R;
    let offset = 0;

    return (
        <div className="flex flex-col sm:flex-row items-center gap-6">
            <svg viewBox="0 0 120 120" className="w-48 h-48 shrink-0" role="img" aria-label="Final grade distribution">
                <g transform="rotate(-90 60 60)">
                    <circle cx="60" cy="60" r={R} fill="none" stroke="#eef1f6" strokeWidth="18" />
                    {counts.map((c, i) => {
                        if (!c) return null;
                        const len = (c / total) * C;
                        const el = (
                            <circle
                                key={i}
                                cx="60"
                                cy="60"
                                r={R}
                                fill="none"
                                stroke={GRADE_COLORS[i]}
                                strokeWidth="18"
                                strokeDasharray={`${len} ${C - len}`}
                                strokeDashoffset={-offset}
                            >
                                <title>{`Grade ${GRADES[i]} — ${GRADE_LABELS[GRADES[i]]}: ${c}`}</title>
                            </circle>
                        );
                        offset += len;
                        return el;
                    })}
                </g>
                <text x="60" y="64" textAnchor="middle" className="fill-default-900" fontSize="20" fontWeight="800">
                    {counts.reduce((a, b) => a + b, 0)}
                </text>
            </svg>

            <ul className="flex-1 w-full grid gap-1.5 text-xs">
                {GRADES.map((g, i) => (
                    <li key={g} className={`flex items-center gap-2 ${counts[i] ? "" : "opacity-40"}`}>
                        <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: GRADE_COLORS[i] }} />
                        <span className="flex-1 text-default-600">
                            {g} — {GRADE_LABELS[g]}
                        </span>
                        <span className="font-semibold text-default-800">{counts[i]}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

interface Series {
    name: string;
    color: string;
    data: number[];
}

function BarChart({
    labels,
    series,
    max,
    stacked = false,
    showValues = false,
    height = 300,
}: {
    labels: string[];
    series: Series[];
    max?: number;
    stacked?: boolean;
    showValues?: boolean;
    height?: number;
}) {
    const top =
        max ??
        Math.max(
            1,
            ...(stacked
                ? labels.map((_, i) => series.reduce((s, x) => s + x.data[i], 0))
                : series.flatMap((s) => s.data))
        );
    const groupW = stacked ? 56 : Math.max(64, series.length * 30);

    return (
        <div>
            <div className="flex gap-2" style={{ height }}>
                {/* Y axis */}
                <div className="grid grid-rows-[1fr_28px] w-9 shrink-0">
                    <div className="flex flex-col justify-between text-right text-[10px] leading-none text-default-400">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                            <span key={i}>{Math.round(top * (1 - i / 5))}</span>
                        ))}
                    </div>
                </div>

                {/* Plot */}
                <div className="flex-1 overflow-x-auto">
                    <div className="grid grid-rows-[1fr_28px] h-full" style={{ minWidth: labels.length * groupW }}>
                        <div className="relative">
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                                <div
                                    key={i}
                                    className="absolute inset-x-0 border-t border-default-200"
                                    style={{ top: `${i * 20}%` }}
                                />
                            ))}
                            <div className="absolute inset-0 flex">
                                {labels.map((lab, li) => (
                                    <div
                                        key={lab + li}
                                        className={`flex-1 h-full flex justify-center px-1 ${stacked ? "items-end" : "items-end gap-1"}`}
                                    >
                                        {stacked ? (
                                            <div className="w-8 flex flex-col-reverse h-full justify-start">
                                                {series.map((s) => {
                                                    const v = s.data[li];
                                                    if (!v) return null;
                                                    return (
                                                        <div
                                                            key={s.name}
                                                            title={`${lab} — ${s.name}: ${v}`}
                                                            style={{ height: `${(v / top) * 100}%`, background: s.color }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            series.map((s) => {
                                                const v = s.data[li];
                                                return (
                                                    <div
                                                        key={s.name}
                                                        title={`${lab} — ${s.name}: ${v.toFixed(1)}`}
                                                        className="relative w-5 rounded-t-sm"
                                                        style={{
                                                            height: `${Math.min((v / top) * 100, 100)}%`,
                                                            minHeight: v > 0 ? 2 : 0,
                                                            background: s.color,
                                                        }}
                                                    >
                                                        {showValues && (
                                                            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] text-default-500">
                                                                {v.toFixed(0)}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex">
                            {labels.map((lab, i) => (
                                <div
                                    key={lab + i}
                                    className="flex-1 pt-2 text-center text-[10px] text-default-500 truncate px-0.5"
                                    title={lab}
                                >
                                    {lab}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pl-11 text-[11px] text-default-600">
                {series.map((s) => (
                    <span key={s.name} className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                        {s.name}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="mt-8 mb-3">
            <h3 className="text-lg font-semibold text-default-900">{title}</h3>
            <p className="text-xs text-default-500">{subtitle}</p>
        </div>
    );
}

const th = "px-3 py-2.5 text-left text-[10px] uppercase tracking-wide font-semibold text-default-500 bg-default-50 whitespace-nowrap";
const td = "px-3 py-2.5 text-xs border-t border-default-100 whitespace-nowrap";

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminAnalytics({ reviews }: { reviews: any[] }) {
    const rows = useMemo(() => reviews.map(toRow), [reviews]);
    console.log("AdminAnalytics rows:", rows);
    const [selected, setSelected] = useState<Row | null>(null);

    const counts = useMemo(() => GRADES.map((g) => rows.filter((r) => r.grade === g).length), [rows]);
    const goalAvg = avg(rows.map((r) => r.goal));
    const targetAvg = avg(rows.map((r) => r.target));

    const els = useMemo(() => {
        const names = [...new Set(rows.map((r) => r.elManager).filter((x) => x && x !== "—"))].sort((a, b) =>
            a.localeCompare(b)
        );
        return names.map((name) => {
            const t = rows.filter((r) => r.elManager === name);
            const goal = avg(t.map((r) => r.goal));
            const target = avg(t.map((r) => r.target));
            return {
                name,
                team: t.length,
                final: avg(t.map((r) => r.finalRating)),
                finalPct: avg(t.map((r) => r.finalRatingPct)),
                goal,
                target,
                gap: goal - target,
                high: t.length ? (t.filter((r) => r.grade >= 7).length / t.length) * 100 : 0,
                mix: GRADES.map((g) => t.filter((r) => r.grade === g).length),
            };
        });
    }, [rows]);

    if (!rows.length) return null;

    const chartMax = Math.max(100, Math.ceil(Math.max(goalAvg, targetAvg, ...els.flatMap((e) => [e.goal, e.target])) / 10) * 10);

    return (
        <section className="mt-10">
            {/* Distribution + overall */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-4">
                <Card className="border border-default-200 shadow-sm">
                    <CardHeader className="flex justify-between border-b border-default-100">
                        <h3 className="text-sm font-semibold">Final Grade Distribution</h3>
                        <span className="text-[11px] text-default-400">{rows.length} reviews</span>
                    </CardHeader>
                    <CardBody className="p-4">
                        <DonutChart counts={counts} />
                    </CardBody>
                </Card>

                <Card className="border border-default-200 shadow-sm">
                    <CardHeader className="flex justify-between border-b border-default-100">
                        <h3 className="text-sm font-semibold">Overall Goal vs Target</h3>
                        <span className="text-[11px] text-default-400">Average %</span>
                    </CardHeader>
                    <CardBody className="p-4">
                        <BarChart
                            labels={["Overall"]}
                            series={[
                                { name: "Goal %", color: "#2457d6", data: [goalAvg] },
                                { name: "Target %", color: "#29915f", data: [targetAvg] },
                            ]}
                            max={chartMax}
                            showValues
                        />
                    </CardBody>
                </Card>
            </div>

            {/* EL table */}
            <SectionTitle
                title="EL-wise Overall Team Comparison"
                subtitle="Team size and average performance metrics for each EL in the selected population."
            />
            <Card className="border border-default-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] border-collapse">
                        <thead>
                            <tr>
                                {["EL Manager", "Team Size", "Avg Final Rating", "Avg Final Rating %", "Goal Achievement %", "Target Achievement %", "Goal vs Target Gap", "Grade 7+ %"].map((h) => (
                                    <th key={h} className={th}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {els.map((e) => (
                                <tr key={e.name}>
                                    <td className={`${td} font-semibold`}>{e.name}</td>
                                    <td className={td}>{e.team}</td>
                                    <td className={`${td} font-semibold`}>{e.final.toFixed(2)}</td>
                                    <td className={`${td} font-semibold`}>{e.finalPct.toFixed(1)}%</td>
                                    <td className={`${td} font-semibold ${tone(e.goal)}`}>{e.goal.toFixed(1)}%</td>
                                    <td className={`${td} font-semibold ${tone(e.target)}`}>{e.target.toFixed(1)}%</td>
                                    <td className={`${td} font-semibold ${e.gap >= 0 ? "text-success-600" : "text-danger-600"}`}>
                                        {e.gap >= 0 ? "+" : ""}
                                        {e.gap.toFixed(1)} pp
                                    </td>
                                    <td className={`${td} font-semibold`}>{e.high.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* EL goal vs target */}
            <SectionTitle
                title="EL-wise Goal vs Target Achievement"
                subtitle="Direct percentage comparison of goal achievement and target achievement by EL."
            />
            <Card className="border border-default-200 shadow-sm">
                <CardBody className="p-4">
                    <BarChart
                        labels={els.map((e) => e.name)}
                        series={[
                            { name: "Goal %", color: "#2457d6", data: els.map((e) => e.goal) },
                            { name: "Target %", color: "#29915f", data: els.map((e) => e.target) },
                        ]}
                        max={chartMax}
                        showValues
                        height={340}
                    />
                </CardBody>
            </Card>

            {/* EL grade mix */}
            <SectionTitle title="EL-wise Final Grade Mix" subtitle="Distribution of final grades across each EL team." />
            <Card className="border border-default-200 shadow-sm">
                <CardBody className="p-4">
                    <BarChart
                        labels={els.map((e) => e.name)}
                        series={GRADES.map((g, i) => ({
                            name: `${g} — ${GRADE_LABELS[g]}`,
                            color: GRADE_COLORS[i],
                            data: els.map((e) => e.mix[i]),
                        }))}
                        max={Math.max(1, ...els.map((e) => e.team))}
                        stacked
                    />
                </CardBody>
            </Card>

            {/* Reviewed users */}
            <SectionTitle title="Reviewed Users" subtitle="Employee-level PMS data. Click a row for details." />
            <Card className="border border-default-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse">
                        <thead>
                            <tr>
                                {["Employee", "Department", "EL Manager", "System Grade", "Manager Rating", "Final Rating", "Final Grade", "Goal %", "Target %"].map((h) => (
                                    <th key={h} className={th}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr
                                    key={r.id}
                                    tabIndex={0}
                                    onClick={() => setSelected(r)}
                                    onKeyDown={(e) => e.key === "Enter" && setSelected(r)}
                                    className="cursor-pointer hover:bg-default-50 focus:bg-default-50 outline-none"
                                >
                                    <td className={td}>
                                        <p className="font-semibold">{r.name}</p>
                                        <p className="text-[10px] text-default-400">ID: {r.empId}</p>
                                    </td>
                                    <td className={td}>{r.department}</td>
                                    <td className={td}>{r.elManager}</td>
                                    <td className={td}>{r.systemGrade.toFixed(0)}</td>
                                    <td className={td}>{r.managerRating.toFixed(2)}</td>
                                    <td className={`${td} font-bold`}>{r.finalRating.toFixed(1)}</td>
                                    <td className={td}>
                                        <Chip size="sm" variant="flat" classNames={{ content: "text-[10px] font-semibold" }}
                                            style={{ background: `${GRADE_COLORS[r.grade - 1]}22`, color: GRADE_COLORS[r.grade - 1] }}>
                                            {r.grade} — {r.gradeLabel}
                                        </Chip>
                                    </td>
                                    <td className={td}>{r.goal.toFixed(1)}%</td>
                                    <td className={td}>{r.target.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Detail drawer */}
            <Drawer isOpen={!!selected} onOpenChange={(o) => !o && setSelected(null)} placement="right" size="md">
                <DrawerContent>
                    {() =>
                        selected && (
                            <>
                                <DrawerHeader className="flex flex-col gap-0.5">
                                    <span className="text-lg font-semibold">{selected.name}</span>
                                    <span className="text-xs font-normal text-default-500">
                                        {selected.department} · Emp ID {selected.empId}
                                    </span>
                                </DrawerHeader>
                                <DrawerBody className="pb-6">
                                    <div className="grid gap-2">
                                        {(
                                            [
                                                ["Email", selected.email],
                                                ["Quarter", selected.quarter],
                                                ["EL Manager", selected.elManager],
                                                ["Assessors", selected.assessors],
                                                ["System Grade", selected.systemGrade.toFixed(0)],
                                                ["Manager Avg Rating", selected.managerRating.toFixed(2)],
                                                ["Final Rating", selected.finalRating.toFixed(1)],
                                                ["Final Rating %", `${selected.finalRatingPct.toFixed(1)}%`],
                                                ["Final Grade", `${selected.grade} — ${selected.gradeLabel}`],
                                                ["Goal %", `${selected.goal.toFixed(2)}% (weight ${selected.goalWeight}%)`],
                                                ["Target %", `${selected.target.toFixed(2)}% (weight ${selected.targetWeight}%)`],
                                            ] as [string, string][]
                                        )
                                            .filter(([, v]) => v)
                                            .map(([k, v]) => (
                                                <div key={k} className="rounded-xl border border-default-200 bg-default-50 px-3 py-2">
                                                    <p className="text-[10px] font-semibold text-default-500">{k}</p>
                                                    <p className="text-sm font-semibold text-default-900">{v}</p>
                                                </div>
                                            ))}
                                    </div>
                                </DrawerBody>
                            </>
                        )
                    }
                </DrawerContent>
            </Drawer>
        </section>
    );
}