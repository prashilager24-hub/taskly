import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft } from "lucide-react";

import { PageHeader, Segmented } from "@/components/page";
import { addToast } from "@/components/ui";
import { errorText } from "@/components/access/api";

const API = "/t2.0/authentificationUtilization/profile";

interface Person { userId: number; name: string; designation: string | null }
interface Profile {
    userId: number; name: string; email: string; employeeId: string | null;
    designation: string | null; jobLevel: string | null; band: string | null;
    role: { id: number; name: string | null }; secondaryRole: { id: number; name: string | null } | null;
    active: boolean; appraisalCycle: string | null; addedOn: string | null;
    reportingManager: Person | null; executiveLeader: Person | null;
    departments: { id: number; name: string; primaryDepartment: string | null }[];
    leads: { id: number; name: string; as: string }[];
}
type Ended = "ACTIVE" | "LOGOUT" | "REPLACED" | "EXPIRED" | "REVOKED";
interface Session { id: number; signedIn: string; endedAt: string | null; endedBy: Ended; minutes: number; keepSignedIn: boolean; device: string | null; ip: string | null }
interface AuthEvt { id: number; event: string; at: string; ip: string | null; device: string | null }
interface Activity { days: number; summary: { lastSignIn: string | null; activeNow: number; signIns: number; failedAttempts: number }; sessions: Session[]; events: AuthEvt[] }

const ENDED: Record<Ended, { label: string; tone: string }> = {
    ACTIVE: { label: "Signed in", tone: "text-emerald-600 dark:text-emerald-400" },
    LOGOUT: { label: "Signed out", tone: "text-ink-600 dark:text-ink-300" },
    REPLACED: { label: "Signed in elsewhere", tone: "text-amber-600 dark:text-amber-400" },
    EXPIRED: { label: "Session expired", tone: "text-ink-500" },
    REVOKED: { label: "Ended by admin", tone: "text-red-600 dark:text-red-400" },
};
const EVENTS: Record<string, string> = {
    LOGIN_SUCCESS: "Signed in", LOGIN: "Signed in", LOGOUT: "Signed out", PASSWORD_OK: "Password accepted", PASSWORD_FAIL: "Wrong password",
    OTP_SENT: "Code sent", OTP_RESENT: "Code sent again", OTP_OK: "Code accepted", OTP_FAIL: "Wrong code", OTP_LOCKED: "Too many wrong codes", SESSION_REPLACED: "Signed out by a newer sign-in",
};
const eventLabel = (e: string) => EVENTS[e] ?? e.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const bad = (e: string) => /FAIL|LOCK|REVOK/.test(e);

const stamp = (s: string | null) => {
    if (!s) return "—";
    const d = new Date(s.replace(" ", "T"));
    return isNaN(+d) ? s : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
};
const length = (m: number) => (m < 1 ? "under a minute" : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`);
const browser = (ua: string | null) => {
    if (!ua) return "—";
    const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
    const o = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
    return o ? `${b} on ${o}` : b;
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        <div className="mt-1 truncate text-sm text-ink-900 dark:text-white">{children || <span className="text-ink-400">—</span>}</div>
    </div>
);
const PersonLine = ({ p }: { p: Person | null }) => (p ? <span>{p.name}{p.designation && <span className="text-ink-500 dark:text-ink-400"> · {p.designation}</span>}</span> : null);

const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="border border-ink-200 px-4 py-3 dark:border-white/10"><p className="eyebrow">{label}</p><p className="mt-1 text-lg font-bold text-ink-900 dark:text-white">{value}</p></div>
);

export default function ProfilePage() {
    const { userId } = useParams();
    const base = userId ? `${API}/${userId}` : API;
    const [profile, setProfile] = useState<Profile | null>(null);
    const [activity, setActivity] = useState<Activity | null>(null);
    const [days, setDays] = useState("30");
    const [view, setView] = useState<"sessions" | "events">("sessions");
    const [failed, setFailed] = useState("");

    useEffect(() => {
        setProfile(null); setFailed("");
        axios.get<Profile>(base).then((r) => setProfile(r.data)).catch((e) => { setFailed(errorText(e)); addToast({ title: "Could not load profile", description: errorText(e), color: "danger" }); });
    }, [base]);
    useEffect(() => {
        setActivity(null);
        axios.get<Activity>(`${base}/activity`, { params: { days } }).then((r) => setActivity(r.data)).catch(() => setActivity(null));
    }, [base, days]);

    if (failed) return <p className="border border-dashed border-ink-300 py-16 text-center text-sm text-ink-500 dark:border-white/20">{failed}</p>;
    if (!profile) return <p className="py-16 text-center text-sm text-ink-500">Loading profile…</p>;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title={userId ? profile.name : "My profile"} subtitle={userId ? "User profile" : "Your details and sign-in activity"}>
                {userId && <Link to="/access-management" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"><ArrowLeft size={14} /> Back to users</Link>}
            </PageHeader>

            <section className="border border-ink-200 bg-white p-6 dark:border-white/10 dark:bg-ink-900">
                <div className="mb-6 flex items-center gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-brand-600 text-lg font-bold text-white">
                        {profile.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-ink-900 dark:text-white">{profile.name}</h2>
                        <p className="truncate text-sm text-ink-500 dark:text-ink-400">{profile.designation || "Designation not set"} · {profile.email}</p>
                    </div>
                    <span className={`ml-auto text-xs font-bold ${profile.active ? "text-emerald-600 dark:text-emerald-400" : "text-ink-500"}`}>{profile.active ? "Active" : "Inactive"}</span>
                </div>
                <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Employee ID">{profile.employeeId}</Field>
                    <Field label="Designation">{profile.designation}</Field>
                    <Field label="Level / Band">{profile.jobLevel || profile.band ? [profile.jobLevel && `Level ${profile.jobLevel}`, profile.band && `Band ${profile.band}`].filter(Boolean).join(" · ") : null}</Field>
                    <Field label="Role">{profile.role.name}{profile.secondaryRole?.name && <span className="text-ink-500"> + {profile.secondaryRole.name}</span>}</Field>
                    <Field label="Department">{profile.departments.map((d) => d.name).join(", ")}</Field>
                    <Field label="Appraisal cycle">{profile.appraisalCycle?.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</Field>
                    <Field label="Reporting manager"><PersonLine p={profile.reportingManager} /></Field>
                    <Field label="Executive Leader (EL)"><PersonLine p={profile.executiveLeader} /></Field>
                    <Field label="Added on">{profile.addedOn ? stamp(profile.addedOn) : null}</Field>
                </div>
                {profile.leads.length > 0 && (
                    <p className="mt-5 border-t border-ink-100 pt-4 text-sm text-ink-600 dark:border-white/5 dark:text-ink-300">
                        Leads: {profile.leads.map((l) => `${l.name} (${l.as})`).join(", ")}
                    </p>
                )}
            </section>

            <section className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-6 py-4 dark:border-white/10">
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Activity log</h3>
                        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">When {userId ? "they" : "you"} signed in and out</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Segmented size="sm" label="Period" value={days} onChange={setDays} options={[{ key: "7", label: "7 days" }, { key: "30", label: "30 days" }, { key: "90", label: "90 days" }]} />
                        <Segmented size="sm" label="View" value={view} onChange={setView} options={[{ key: "sessions", label: "Sessions" }, { key: "events", label: "All events" }]} />
                    </div>
                </div>

                {!activity ? <p className="px-6 py-12 text-center text-sm text-ink-500">Loading activity…</p> : (
                    <>
                        <div className="grid grid-cols-2 gap-3 p-6 lg:grid-cols-4">
                            <Stat label="Last sign-in" value={<span className="text-sm">{stamp(activity.summary.lastSignIn)}</span>} />
                            <Stat label="Sign-ins" value={activity.summary.signIns} />
                            <Stat label="Signed in now" value={activity.summary.activeNow} />
                            <Stat label="Failed attempts" value={activity.summary.failedAttempts} />
                        </div>
                        <div className="overflow-x-auto">
                            {view === "sessions" ? (
                                <table className="w-full text-sm">
                                    <thead><tr className="border-y border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-white/5">
                                        {["Signed in", "Signed out", "How it ended", "Duration", "Device", "IP"].map((h) => <th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {activity.sessions.map((s) => (
                                            <tr key={s.id} className="border-b border-ink-100 last:border-0 dark:border-white/5">
                                                <td className="whitespace-nowrap px-4 py-2.5">{stamp(s.signedIn)}</td>
                                                <td className="whitespace-nowrap px-4 py-2.5">{s.endedBy === "ACTIVE" ? <span className="text-ink-400">Still signed in</span> : stamp(s.endedAt)}</td>
                                                <td className={`whitespace-nowrap px-4 py-2.5 font-semibold ${ENDED[s.endedBy].tone}`}>{ENDED[s.endedBy].label}</td>
                                                <td className="whitespace-nowrap px-4 py-2.5">{length(s.minutes)}</td>
                                                <td className="whitespace-nowrap px-4 py-2.5">{browser(s.device)}</td>
                                                <td className="whitespace-nowrap px-4 py-2.5 text-ink-500">{s.ip || "—"}</td>
                                            </tr>
                                        ))}
                                        {!activity.sessions.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-xs text-ink-500">No sign-ins in this period.</td></tr>}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead><tr className="border-y border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-white/5">
                                        {["When", "Event", "Device", "IP"].map((h) => <th key={h} className="px-4 py-2.5 text-left">{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {activity.events.map((e) => (
                                            <tr key={e.id} className="border-b border-ink-100 last:border-0 dark:border-white/5">
                                                <td className="whitespace-nowrap px-4 py-2.5">{stamp(e.at)}</td>
                                                <td className={`whitespace-nowrap px-4 py-2.5 font-semibold ${bad(e.event) ? "text-red-600 dark:text-red-400" : ""}`}>{eventLabel(e.event)}</td>
                                                <td className="whitespace-nowrap px-4 py-2.5">{browser(e.device)}</td>
                                                <td className="whitespace-nowrap px-4 py-2.5 text-ink-500">{e.ip || "—"}</td>
                                            </tr>
                                        ))}
                                        {!activity.events.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-xs text-ink-500">No events in this period.</td></tr>}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
