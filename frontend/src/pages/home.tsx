import { useEffect, useState } from "react";
import axios from "axios";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowRight, ClipboardCheck, ClipboardList, LineChart, Target, UserX } from "lucide-react";

import { hasModuleAccess } from "@/lib/permissions";
import DashboardPage from "@/pages/dashboard";

// Taskly overview dashboard (requirements DASH). Flow: first the work that needs you, then the
// numbers. "Needs your attention" shows live counts and links straight to the page that clears
// them. PMS is its own menu item and page (/pms); old ?view=pms links are sent there.

const API = "/t2.0/authentificationUtilization";
const readUser = () => {
    try { return JSON.parse(localStorage.getItem("authUserLD") || "null"); } catch { return null; }
};
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

interface Action { to: string; icon: typeof Target; label: string; hint: string; count?: number | null; tone?: "warn" }

function useAttention(user: any): Action[] {
    const [pending, setPending] = useState<number | null>(null);
    const [missing, setMissing] = useState<number | null>(null);
    const admin = user?.userRole === 1;
    const canApprove = admin || hasModuleAccess("entryApproval");

    useEffect(() => {
        if (!user?.token || !canApprove) return;
        const headers = { Authorization: `Bearer ${user.token}` };
        axios.post(`${API}/combined/list?page=0&size=0`, {}, { headers })
            .then((r) => {
                const days: any[] = r.data?.data ?? [];
                setPending(days.reduce((n, d) => n + (d.entries ?? []).filter((e: any) => !e.approvedByEL && !e.commentForRejection).length, 0));
            })
            .catch(() => setPending(null));
    }, [user?.token, canApprove]);

    useEffect(() => {
        if (!user?.token || !admin) return;
        const end = new Date(); const start = new Date(); start.setDate(end.getDate() - 7);
        axios.get(`${API}/MissingData?startDate=${isoDay(start)}&endDate=${isoDay(end)}`, { headers: { Authorization: `Bearer ${user.token}` } })
            .then((r) => setMissing(Array.isArray(r.data) ? r.data.length : null))
            .catch(() => setMissing(null));
    }, [user?.token, admin]);

    const list: Action[] = [];
    if (admin || hasModuleAccess("dataentry")) list.push({ to: "/daily-activity", icon: ClipboardList, label: "Log today's activity", hint: "Fill, preview and save your daily entry" });
    if (canApprove) list.push({ to: "/Entry-Approval", icon: ClipboardCheck, label: "Entries to review", hint: "Approve or reject submitted work", count: pending, tone: "warn" });
    if (admin) list.push({ to: "/daily-log", icon: UserX, label: "Missing daily logs", hint: "People with no entry in the last 7 days", count: missing, tone: "warn" });
    if (admin || hasModuleAccess("goals")) list.push({ to: "/goals", icon: Target, label: "Goals achieved", hint: "Track goal progress over time" });
    if (admin || hasModuleAccess("perf")) list.push({ to: "/efficiency-report", icon: LineChart, label: "Performance insights", hint: "Efficiency and utilization by person" });
    return list;
}

export default function DashboardHome() {
    const [params] = useSearchParams();
    const user = readUser();
    const actions = useAttention(user);
    if (params.get("view") === "pms") return <Navigate to="/pms" replace />;

    return (
        <div className="flex w-full flex-col gap-6">
            <section aria-label="Needs your attention">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="eyebrow">Needs your attention</h2>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {actions.map((a) => (
                        <Link
                            key={a.to}
                            to={a.to}
                            className="group flex flex-col justify-between gap-4 border border-ink-200 bg-white p-4 transition-colors hover:border-brand-500 focus-ring dark:border-white/10 dark:bg-ink-900"
                        >
                            <div className="flex min-h-[24px] items-start justify-between">
                                <a.icon size={18} className="text-brand-600" aria-hidden />
                                {typeof a.count === "number" && (
                                    <span className={`min-w-[28px] px-2 py-0.5 text-center text-xs font-bold ${a.count > 0 && a.tone === "warn" ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-300"}`}>
                                        {a.count}
                                    </span>
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-ink-900 dark:text-white">{a.label}</p>
                                <p className="mt-1 text-xs leading-snug text-ink-500 dark:text-ink-400">{a.hint}</p>
                            </div>
                            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-ink-400 transition-colors group-hover:text-brand-600">
                                Open <ArrowRight size={12} aria-hidden />
                            </span>
                        </Link>
                    ))}
                </div>
            </section>

            <DashboardPage />
        </div>
    );
}
