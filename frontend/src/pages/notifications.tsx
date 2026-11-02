import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { CalendarClock, Mail, Megaphone, Pencil, Plus, Repeat2, Send, Trash2, Workflow } from "lucide-react";
import { cn } from "@heroui/theme";

import { PageHeader, Segmented, SummaryBar } from "@/components/page";
import { Button, Chip, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, Input, Select, SelectItem, Switch, Textarea, addToast } from "@/components/ui";
import { LEVELS, notificationsApi, type Audience, type Level, type NotificationDraft, type SentNotification, type SystemJob } from "@/components/notifications/api";
import { hasModuleAccess } from "@/lib/permissions";

interface Options { departments: { id: number; name: string }[]; roles: { id: number; name: string }[]; users: { id: number; name: string; email: string; dept: string | null }[] }

const BASE = "/t2.0/authentificationUtilization/notifications";
type When = "now" | "later" | "weekly";
type View = "sent" | "scheduled" | "weekly" | "system";
interface Form extends NotificationDraft { when: When }
const EMPTY: Form = { title: "", body: "", level: "info", linkUrl: "", expiresAt: null, active: true, audience: { all: false, departments: [], roles: [], users: [] }, when: "now", sendAt: null, repeatDay: 1, repeatTime: "09:00", sendEmail: false };
const errorText = (e: any) => e?.response?.data?.message || e?.message || "Something went wrong.";

const BAR: Record<Level, string> = { info: "bg-sky-500", success: "bg-emerald-500", warning: "bg-amber-500", urgent: "bg-rose-600" };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
/** A moment as India time 'YYYY-MM-DDTHH:MM', for the date-time box */
const istInput = (iso: string | Date) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 16);
const when = (iso: string | null) => (iso ? format(new Date(iso), "dd MMM yyyy, HH:mm") : "—");

/** A toggle button for choosing departments / roles */
const Pick = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" aria-pressed={on} onClick={onClick}
        className={cn("border px-3 py-1.5 text-xs font-semibold transition-colors focus-ring", on ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 text-ink-700 hover:border-brand-500 dark:border-white/20 dark:text-ink-200")}>
        {children}
    </button>
);

const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

function audienceSummary(a: Audience, o: Options | null) {
    if (a.all) return ["Everyone"];
    const name = <T extends { id: number; name: string }>(list: T[] | undefined, id: number) => list?.find((x) => x.id === id)?.name ?? `#${id}`;
    return [
        ...a.departments.map((d) => name(o?.departments, d)),
        ...a.roles.map((r) => `${name(o?.roles, r)} (role)`),
        ...a.users.map((u) => name(o?.users, u)),
    ];
}

/** The scheduled jobs that notify people on their own: when they run, what they send, and their email switch */
function SystemList({ jobs, canUpdate, onChanged }: { jobs: SystemJob[]; canUpdate: boolean; onChanged: () => void }) {
    const flip = async (j: SystemJob) => {
        try { await notificationsApi.setJobEmail(j.key, !j.email); addToast({ title: `${j.name}: email ${j.email ? "off" : "on"}`, color: "success" }); onChanged(); }
        catch (e) { addToast({ title: "Could not change", description: errorText(e), color: "danger" }); }
    };
    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {jobs.map((j) => (
                <div key={j.key} className="flex flex-col gap-3 border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><Workflow size={18} /></span>
                            <div><p className="font-semibold text-ink-900 dark:text-white">{j.name}</p><p className="text-xs text-ink-500 dark:text-ink-400">{j.when} · {j.channel}</p></div>
                        </div>
                        {j.canToggle
                            ? <Switch size="sm" isSelected={j.email} isDisabled={!canUpdate} onValueChange={() => flip(j)} aria-label={`Email for ${j.name}`}>Email</Switch>
                            : <Chip size="sm" variant="flat" color="success">Always on</Chip>}
                    </div>
                    <p className="text-sm text-ink-700 dark:text-ink-200">{j.what}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">Last ran {j.lastRun ? when(j.lastRun) : "not yet"}{j.canToggle && !j.email ? " · email switched off" : ""}</p>
                </div>
            ))}
        </div>
    );
}

// Notifications: write a message, choose who gets it and when (now, at a set time, or every week), and whether it is
// also emailed. It appears in each person's bell, and they can close it. Appraisal messages are sent by the appraisal
// itself and are not managed here; System lists the jobs that notify people on their own.
export default function NotificationsPage() {
    const [rows, setRows] = useState<SentNotification[]>([]);
    const [jobs, setJobs] = useState<SystemJob[]>([]);
    const [options, setOptions] = useState<Options | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<View>("sent");
    const [edit, setEdit] = useState<{ open: boolean; id?: number }>({ open: false });
    const [draft, setDraft] = useState<Form>(EMPTY);
    const [reach, setReach] = useState<number | null>(null);
    const [userSearch, setUserSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const canCreate = hasModuleAccess("notifications", "create");
    const canUpdate = hasModuleAccess("notifications", "update");
    const canDelete = hasModuleAccess("notifications", "delete");

    const load = useCallback(async () => {
        try { setRows(await notificationsApi.list()); } catch (e) { addToast({ title: "Could not load notifications", description: errorText(e), color: "danger" }); }
        notificationsApi.system().then(setJobs).catch(() => undefined);
        setLoading(false);
    }, []);
    useEffect(() => {
        load();
        axios.get(`${BASE}/audience-options`).then((r) => setOptions(r.data.response)).catch(() => undefined);
    }, [load]);

    // How many people the current choice reaches
    useEffect(() => {
        if (!edit.open) return;
        const a = draft.audience;
        if (!a.all && !a.departments.length && !a.roles.length && !a.users.length) { setReach(0); return; }
        const t = setTimeout(() => notificationsApi.reach(a).then(setReach).catch(() => setReach(null)), 250);
        return () => clearTimeout(t);
    }, [draft.audience, edit.open]);

    const open = (n?: SentNotification) => {
        setDraft(n ? {
            title: n.title, body: n.body, level: n.level, linkUrl: n.linkUrl ?? "", expiresAt: n.expiresAt ? n.expiresAt.slice(0, 10) : null, active: n.active, audience: n.audience,
            when: n.repeat === "WEEKLY" ? "weekly" : !n.deliveredAt && n.sendAt ? "later" : "now",
            sendAt: n.sendAt ? istInput(n.sendAt) : null, repeatDay: n.repeatDay ?? 1, repeatTime: n.repeatTime ?? "09:00", sendEmail: n.sendEmail,
        } : { ...EMPTY, when: view === "weekly" ? "weekly" : view === "scheduled" ? "later" : "now" });
        setUserSearch("");
        setEdit({ open: true, id: n?.id });
    };
    const setAudience = (patch: Partial<Audience>) => setDraft((d) => ({ ...d, audience: { ...d.audience, ...patch } }));

    const later = draft.when === "later" && !!draft.sendAt && new Date(`${draft.sendAt}:00+05:30`).getTime() > Date.now();
    const valid = draft.title.trim().length > 0 && (draft.audience.all || draft.audience.departments.length + draft.audience.roles.length + draft.audience.users.length > 0)
        && (draft.when !== "later" || later) && (draft.when !== "weekly" || (!!draft.repeatDay && !!draft.repeatTime));
    const sentNow = edit.id ? rows.find((r) => r.id === edit.id)?.deliveredAt : null;

    const save = async () => {
        setSaving(true);
        const { when: w, ...rest } = draft;
        try {
            await notificationsApi.save({
                ...rest, expiresAt: draft.expiresAt ? `${draft.expiresAt}T23:59:59` : null,
                sendAt: w === "later" ? draft.sendAt : null, repeat: w === "weekly" ? "WEEKLY" : "NONE",
                repeatDay: w === "weekly" ? draft.repeatDay : null, repeatTime: w === "weekly" ? draft.repeatTime : null,
            }, edit.id);
            const what = w === "weekly" ? `every ${DAYS[(draft.repeatDay ?? 1) - 1]} at ${draft.repeatTime}` : w === "later" ? `on ${format(new Date(`${draft.sendAt}:00+05:30`), "dd MMM, HH:mm")}` : `to ${reach ?? 0} people`;
            addToast({ title: edit.id ? "Notification updated" : w === "now" ? "Notification sent" : "Notification scheduled", description: `${draft.title} · ${what}${draft.sendEmail ? " · by email too" : ""}`, color: "success" });
            setEdit({ open: false });
            setView(w === "weekly" ? "weekly" : w === "later" ? "scheduled" : "sent");
            load();
        } catch (e) { addToast({ title: "Could not save", description: errorText(e), color: "danger" }); } finally { setSaving(false); }
    };

    const flip = async (n: SentNotification) => {
        try {
            await notificationsApi.save({
                title: n.title, body: n.body, level: n.level, linkUrl: n.linkUrl ?? "", expiresAt: n.expiresAt, active: !n.active, audience: n.audience,
                sendAt: !n.deliveredAt && n.sendAt ? istInput(n.sendAt) : null, repeat: n.repeat, repeatDay: n.repeatDay, repeatTime: n.repeatTime, sendEmail: n.sendEmail,
            }, n.id);
            load();
        } catch (e) { addToast({ title: "Could not change", description: errorText(e), color: "danger" }); }
    };
    const remove = async (n: SentNotification) => {
        if (!window.confirm(`Delete "${n.title}"? People who have not read it will no longer see it${n.repeat === "WEEKLY" ? ", and it stops repeating" : ""}.`)) return;
        try { await notificationsApi.remove(n.id); addToast({ title: "Notification deleted", description: n.title, color: "success" }); load(); }
        catch (e) { addToast({ title: "Could not delete", description: errorText(e), color: "danger" }); }
    };

    const people = useMemo(() => {
        const q = userSearch.trim().toLowerCase();
        return (options?.users ?? []).filter((u) => !q || u.name.toLowerCase().includes(q) || (u.dept ?? "").toLowerCase().includes(q)).slice(0, 60);
    }, [options, userSearch]);

    const groups = useMemo(() => ({
        sent: rows.filter((r) => r.repeat !== "WEEKLY" && !!r.deliveredAt),
        scheduled: rows.filter((r) => r.repeat !== "WEEKLY" && !r.deliveredAt),
        weekly: rows.filter((r) => r.repeat === "WEEKLY"),
    }), [rows]);
    const shown = view === "system" ? [] : groups[view];

    const timing = (n: SentNotification) => {
        if (n.repeat === "WEEKLY") return <><span className="flex items-center gap-1.5 font-semibold text-ink-900 dark:text-white"><Repeat2 size={13} />Every {DAYS[(n.repeatDay ?? 1) - 1]}, {n.repeatTime}</span><span>{n.active && n.status !== "ENDED" ? `next ${when(n.nextAt)}` : n.status === "ENDED" ? "ended" : "paused"}{n.deliveredAt ? ` · last ${format(new Date(n.deliveredAt), "dd MMM")}` : ""}</span></>;
        if (!n.deliveredAt) return <><span className="flex items-center gap-1.5 font-semibold text-ink-900 dark:text-white"><CalendarClock size={13} />Goes out {when(n.sendAt)}</span><span>{n.active ? "waiting" : "paused, will not go out"}</span></>;
        return <><span className="text-ink-900 dark:text-white">{when(n.deliveredAt)}</span><span>by {n.createdBy}{n.expiresAt ? ` · ends ${format(new Date(n.expiresAt), "dd MMM")}` : ""}</span></>;
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Notifications" subtitle="Send a message now, at a set time, or every week, to everyone, departments, roles or named people. It shows in their bell, and can be emailed too.">
                {canCreate && <Button color="primary" startContent={<Plus size={14} />} onPress={() => open()}>New notification</Button>}
            </PageHeader>

            <SummaryBar className="lg:grid-cols-4" items={[
                { label: "Sent", value: groups.sent.length, hint: `${groups.sent.filter((r) => r.active && r.status !== "ENDED").length} live in bells now` },
                { label: "Scheduled", value: groups.scheduled.length, hint: groups.scheduled.length ? `next ${when([...groups.scheduled].sort((a, b) => (a.sendAt ?? "").localeCompare(b.sendAt ?? ""))[0].sendAt)}` : "Nothing waiting" },
                { label: "Weekly", value: groups.weekly.length, hint: `${groups.weekly.filter((r) => r.active).length} repeating` },
                { label: "Emails sent", value: rows.reduce((t, r) => t + r.emailedCount, 0), hint: "From notifications sent by email" },
            ]} />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented label="Show" value={view} onChange={setView} options={[
                    { key: "sent", label: `Sent (${groups.sent.length})` }, { key: "scheduled", label: `Scheduled (${groups.scheduled.length})` },
                    { key: "weekly", label: `Weekly (${groups.weekly.length})` }, { key: "system", label: "System" },
                ]} />
                {view === "system" && <p className="text-xs text-ink-500 dark:text-ink-400">Jobs that notify people on their own. Appraisal messages are sent by the appraisal and are not listed here.</p>}
            </div>

            {view === "system" ? <SystemList jobs={jobs} canUpdate={canUpdate} onChanged={load} /> : (
                <div className="overflow-x-auto border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                    <table className="w-full min-w-[960px] text-sm">
                        <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-white/5">{["Message", "Sent to", view === "sent" ? "Sent" : view === "scheduled" ? "Goes out" : "Repeats", "Email", "Read", "Live", ""].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                        <tbody>
                            {shown.map((n) => {
                                const who = audienceSummary(n.audience, options);
                                return (
                                    <tr key={n.id} className="border-b border-ink-100 align-top last:border-0 dark:border-white/5">
                                        <td className="px-4 py-3">
                                            <div className="flex gap-3">
                                                <span className={cn("w-1 shrink-0 self-stretch", BAR[n.level])} aria-hidden />
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-ink-900 dark:text-white">{n.title}</p>
                                                    {n.body && <p className="line-clamp-2 max-w-md text-xs text-ink-500 dark:text-ink-400">{n.body}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3"><div className="flex max-w-xs flex-wrap gap-1">{who.slice(0, 4).map((w) => <Chip key={w} size="sm" variant="flat">{w}</Chip>)}{who.length > 4 && <Chip size="sm" variant="flat">+{who.length - 4}</Chip>}</div><p className="mt-1 text-xs text-ink-500">{n.reach} people</p></td>
                                        <td className="px-4 py-3"><div className="flex flex-col gap-0.5 whitespace-nowrap text-xs text-ink-500 dark:text-ink-400">{timing(n)}</div></td>
                                        <td className="px-4 py-3 whitespace-nowrap text-xs">{n.sendEmail ? <span className="flex items-center gap-1.5 font-semibold text-ink-900 dark:text-white"><Mail size={13} />{n.emailedCount ? `${n.emailedCount} sent` : "Yes"}</span> : <span className="text-ink-400">Bell only</span>}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{n.deliveredAt ? `${n.readCount} of ${n.reach}` : "—"}</td>
                                        <td className="px-4 py-3"><Switch size="sm" isSelected={n.active} isDisabled={!canUpdate} onValueChange={() => flip(n)} aria-label={`${n.title} live`} /></td>
                                        <td className="px-4 py-3"><div className="flex justify-end gap-1.5">
                                            {canUpdate && <Button size="sm" variant="bordered" isIconOnly aria-label={`Edit ${n.title}`} onPress={() => open(n)}><Pencil size={13} /></Button>}
                                            {canDelete && <Button size="sm" variant="bordered" isIconOnly aria-label={`Delete ${n.title}`} onPress={() => remove(n)}><Trash2 size={13} /></Button>}
                                        </div></td>
                                    </tr>
                                );
                            })}
                            {!shown.length && (
                                <tr><td colSpan={7} className="px-4 py-16 text-center">
                                    {view === "weekly" ? <Repeat2 size={26} className="mx-auto text-ink-300 dark:text-ink-600" /> : view === "scheduled" ? <CalendarClock size={26} className="mx-auto text-ink-300 dark:text-ink-600" /> : <Megaphone size={26} className="mx-auto text-ink-300 dark:text-ink-600" />}
                                    <p className="mt-3 text-sm font-semibold text-ink-900 dark:text-white">{loading ? "Loading…" : view === "weekly" ? "Nothing repeats every week" : view === "scheduled" ? "Nothing scheduled" : "No notifications yet"}</p>
                                    {!loading && <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{view === "weekly" ? "Set a day and time and it goes out each week, by email too if you like." : view === "scheduled" ? "Choose a date and time and it goes out then." : "Write one and choose who should see it."}</p>}
                                    {!loading && canCreate && <Button className="mt-4" size="sm" color="primary" startContent={<Plus size={14} />} onPress={() => open()}>New notification</Button>}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <Drawer isOpen={edit.open} onOpenChange={(o) => { if (!o) setEdit({ open: false }); }} size="3xl">
                <DrawerContent>
                    <DrawerHeader className="flex flex-col gap-1"><span className="eyebrow">Notifications</span><span>{edit.id ? "Edit notification" : "New notification"}</span></DrawerHeader>
                    <DrawerBody className="gap-6">
                        <section className="flex flex-col gap-4">
                            <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">1 · Message</h3>
                            <Input label="Title" labelPlacement="outside" placeholder="e.g. Q3 reviews close on 8 October" value={draft.title} onValueChange={(v) => setDraft((d) => ({ ...d, title: v }))} maxLength={160} isRequired />
                            <Textarea label="Details" labelPlacement="outside" placeholder="Optional: what should people do?" value={draft.body} onValueChange={(v) => setDraft((d) => ({ ...d, body: v }))} minRows={3} />
                            <div className="flex flex-wrap items-end gap-6">
                                <div className="flex flex-col gap-1.5"><span className="eyebrow">Importance</span><Segmented size="sm" label="Importance" value={draft.level} onChange={(v) => setDraft((d) => ({ ...d, level: v }))} options={LEVELS} /></div>
                                <Input className="max-w-[200px]" type="date" label="Stop showing after" labelPlacement="outside" value={draft.expiresAt ?? ""} onValueChange={(v) => setDraft((d) => ({ ...d, expiresAt: v || null }))} description="Optional" />
                            </div>
                            <Input label="Link" labelPlacement="outside" placeholder="/dashboard?view=pms (optional)" value={draft.linkUrl} onValueChange={(v) => setDraft((d) => ({ ...d, linkUrl: v }))} description="An app page such as /daily-activity, or a full web address. Shows as an Open button, and in the email." />
                        </section>

                        <section className="flex flex-col gap-4">
                            <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">2 · When</h3>
                            {sentNow && draft.when === "now"
                                ? <p className="text-sm text-ink-600 dark:text-ink-300">Sent {when(sentNow)}. Saving changes updates it in people's bells; it is not sent again.</p>
                                : <Segmented label="When" value={draft.when} onChange={(v) => setDraft((d) => ({ ...d, when: v, sendAt: v === "later" && !d.sendAt ? istInput(new Date(Date.now() + 3_600_000)) : d.sendAt }))} options={[{ key: "now", label: "Send now" }, { key: "later", label: "Schedule" }, { key: "weekly", label: "Every week" }]} />}
                            {draft.when === "later" && (
                                <Input className="max-w-xs" type="datetime-local" label="Goes out on (India time)" labelPlacement="outside" value={draft.sendAt ?? ""} onValueChange={(v) => setDraft((d) => ({ ...d, sendAt: v || null }))}
                                    isInvalid={!!draft.sendAt && !later} errorMessage="Choose a time that is still ahead" />
                            )}
                            {draft.when === "weekly" && (
                                <div className="flex flex-wrap items-end gap-4">
                                    <Select className="max-w-[220px]" label="Every" labelPlacement="outside" selectedKeys={new Set([String(draft.repeatDay ?? 1)])} onSelectionChange={(k) => setDraft((d) => ({ ...d, repeatDay: Number(Array.from(k)[0] ?? 1) }))}>
                                        {DAYS.map((d, i) => <SelectItem key={String(i + 1)}>{d}</SelectItem>)}
                                    </Select>
                                    <Input className="max-w-[160px]" type="time" label="At (India time)" labelPlacement="outside" value={draft.repeatTime ?? ""} onValueChange={(v) => setDraft((d) => ({ ...d, repeatTime: v || null }))} />
                                    <p className="pb-2 text-xs text-ink-500 dark:text-ink-400">It comes back as new in each bell every week, until you pause or delete it.</p>
                                </div>
                            )}
                            <div className="flex items-start gap-3 border border-ink-200 p-4 dark:border-white/10">
                                <Switch isSelected={!!draft.sendEmail} onValueChange={(v) => setDraft((d) => ({ ...d, sendEmail: v }))} aria-label="Also send by email" />
                                <div><p className="text-sm font-semibold text-ink-900 dark:text-white">Also send by email</p><p className="text-xs text-ink-500 dark:text-ink-400">Each person gets it by email too, with an Open in Taskly button that takes them to the link{draft.when === "weekly" ? ", every week" : ""}.</p></div>
                            </div>
                        </section>

                        <section className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">3 · Who gets it</h3>
                                <span className="text-xs font-semibold text-brand-600">{reach === null ? "" : `Reaches ${reach} ${reach === 1 ? "person" : "people"}`}</span>
                            </div>
                            <Segmented label="Audience" value={draft.audience.all ? "all" : "pick"} onChange={(v) => setAudience({ all: v === "all" })} options={[{ key: "all", label: "Everyone" }, { key: "pick", label: "Choose who" }]} />

                            {!draft.audience.all && (
                                <div className="flex flex-col gap-5">
                                    <div className="flex flex-col gap-2">
                                        <span className="eyebrow">Departments</span>
                                        <div className="flex flex-wrap gap-1.5">{options?.departments.map((d) => <Pick key={d.id} on={draft.audience.departments.includes(d.id)} onClick={() => setAudience({ departments: toggle(draft.audience.departments, d.id) })}>{d.name}</Pick>)}</div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <span className="eyebrow">Roles</span>
                                        <div className="flex flex-wrap gap-1.5">{options?.roles.map((r) => <Pick key={r.id} on={draft.audience.roles.includes(r.id)} onClick={() => setAudience({ roles: toggle(draft.audience.roles, r.id) })}>{r.name}</Pick>)}</div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <span className="eyebrow">People{draft.audience.users.length ? ` · ${draft.audience.users.length} chosen` : ""}</span>
                                        <Input aria-label="Search people" placeholder="Search by name or department" value={userSearch} onValueChange={setUserSearch} />
                                        <ul className="max-h-56 divide-y divide-ink-100 overflow-y-auto border border-ink-200 dark:divide-white/5 dark:border-white/10">
                                            {people.map((u) => {
                                                const on = draft.audience.users.includes(u.id);
                                                return (
                                                    <li key={u.id}>
                                                        <button type="button" aria-pressed={on} onClick={() => setAudience({ users: toggle(draft.audience.users, u.id) })} className={cn("flex w-full items-center gap-3 px-3 py-2 text-left text-sm focus-ring", on ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-ink-50 dark:hover:bg-white/5")}>
                                                            <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center border text-[10px] font-bold", on ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 dark:border-white/20")}>{on ? "✓" : ""}</span>
                                                            <span className="min-w-0 flex-1"><span className="block truncate font-medium text-ink-900 dark:text-white">{u.name}</span><span className="block truncate text-xs text-ink-500 dark:text-ink-400">{u.dept ?? u.email}</span></span>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                            {!people.length && <li className="px-3 py-6 text-center text-xs text-ink-500">No one matches.</li>}
                                        </ul>
                                    </div>
                                    <p className="text-xs text-ink-500 dark:text-ink-400">Anyone who matches a department, a role or a name below gets it once.</p>
                                </div>
                            )}
                        </section>

                        <section className="flex flex-col gap-3">
                            <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">4 · Preview</h3>
                            <div className="flex gap-3 border border-ink-200 bg-brand-50/60 py-3 pl-4 pr-3 dark:border-white/10 dark:bg-brand-500/10">
                                <span className={cn("w-1 shrink-0 self-stretch", BAR[draft.level])} aria-hidden />
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-ink-900 dark:text-white">{draft.title || "Your title appears here"}</p>
                                    {draft.body && <p className="mt-0.5 whitespace-pre-line text-[12.5px] text-ink-600 dark:text-ink-300">{draft.body}</p>}
                                    <p className="mt-1.5 text-[11px] text-ink-400">{draft.when === "weekly" ? `every ${DAYS[(draft.repeatDay ?? 1) - 1]} at ${draft.repeatTime ?? ""}` : draft.when === "later" && draft.sendAt ? format(new Date(`${draft.sendAt}:00+05:30`), "dd MMM, HH:mm") : "just now"}{draft.sendEmail ? " · also by email" : ""}</p>
                                </div>
                            </div>
                            <Switch isSelected={draft.active} onValueChange={(v) => setDraft((d) => ({ ...d, active: v }))}>Live (people can see it)</Switch>
                        </section>
                    </DrawerBody>
                    <DrawerFooter>
                        <Button variant="bordered" onPress={() => setEdit({ open: false })}>Cancel</Button>
                        <Button color="primary" isDisabled={!valid} isLoading={saving} startContent={draft.when === "now" ? <Send size={14} /> : draft.when === "later" ? <CalendarClock size={14} /> : <Repeat2 size={14} />} onPress={save}>
                            {edit.id ? "Save changes" : draft.when === "later" ? "Schedule" : draft.when === "weekly" ? "Start weekly" : "Send notification"}
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    );
}
