import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@heroui/theme";

import { PageHeader, Segmented, SummaryBar } from "@/components/page";
import { Button, Chip, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, Input, Switch, Textarea, addToast } from "@/components/ui";
import { LEVELS, notificationsApi, type Audience, type Level, type NotificationDraft, type SentNotification } from "@/components/notifications/api";
import { hasModuleAccess } from "@/lib/permissions";

interface Options { departments: { id: number; name: string }[]; roles: { id: number; name: string }[]; users: { id: number; name: string; email: string; dept: string | null }[] }

const BASE = "/t2.0/authentificationUtilization/notifications";
const EMPTY: NotificationDraft = { title: "", body: "", level: "info", linkUrl: "", expiresAt: null, active: true, audience: { all: false, departments: [], roles: [], users: [] } };
const errorText = (e: any) => e?.response?.data?.message || e?.message || "Something went wrong.";

const BAR: Record<Level, string> = { info: "bg-sky-500", success: "bg-emerald-500", warning: "bg-amber-500", urgent: "bg-rose-600" };

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

// Admin → Notifications: write a message, choose who gets it (everyone, departments, roles or named people), send.
// It appears in each person's bell, and they can close it.
export default function NotificationsPage() {
    const [rows, setRows] = useState<SentNotification[]>([]);
    const [options, setOptions] = useState<Options | null>(null);
    const [loading, setLoading] = useState(true);
    const [edit, setEdit] = useState<{ open: boolean; id?: number }>({ open: false });
    const [draft, setDraft] = useState<NotificationDraft>(EMPTY);
    const [reach, setReach] = useState<number | null>(null);
    const [userSearch, setUserSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const canCreate = hasModuleAccess("notifications", "create");
    const canUpdate = hasModuleAccess("notifications", "update");
    const canDelete = hasModuleAccess("notifications", "delete");

    const load = useCallback(async () => {
        try { setRows(await notificationsApi.list()); } catch (e) { addToast({ title: "Could not load notifications", description: errorText(e), color: "danger" }); }
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
        setDraft(n ? { title: n.title, body: n.body, level: n.level, linkUrl: n.linkUrl ?? "", expiresAt: n.expiresAt ? n.expiresAt.slice(0, 10) : null, active: n.active, audience: n.audience } : EMPTY);
        setUserSearch("");
        setEdit({ open: true, id: n?.id });
    };
    const setAudience = (patch: Partial<Audience>) => setDraft((d) => ({ ...d, audience: { ...d.audience, ...patch } }));

    const valid = draft.title.trim().length > 0 && (draft.audience.all || draft.audience.departments.length + draft.audience.roles.length + draft.audience.users.length > 0);

    const save = async () => {
        setSaving(true);
        try {
            await notificationsApi.save({ ...draft, expiresAt: draft.expiresAt ? `${draft.expiresAt}T23:59:59` : null }, edit.id);
            addToast({ title: edit.id ? "Notification updated" : "Notification sent", description: `${draft.title} · ${reach ?? 0} people`, color: "success" });
            setEdit({ open: false }); load();
        } catch (e) { addToast({ title: "Could not save", description: errorText(e), color: "danger" }); } finally { setSaving(false); }
    };

    const flip = async (n: SentNotification) => {
        try {
            await notificationsApi.save({ title: n.title, body: n.body, level: n.level, linkUrl: n.linkUrl ?? "", expiresAt: n.expiresAt, active: !n.active, audience: n.audience }, n.id);
            load();
        } catch (e) { addToast({ title: "Could not change", description: errorText(e), color: "danger" }); }
    };
    const remove = async (n: SentNotification) => {
        if (!window.confirm(`Delete "${n.title}"? People who have not read it will no longer see it.`)) return;
        try { await notificationsApi.remove(n.id); addToast({ title: "Notification deleted", description: n.title, color: "success" }); load(); }
        catch (e) { addToast({ title: "Could not delete", description: errorText(e), color: "danger" }); }
    };

    const people = useMemo(() => {
        const q = userSearch.trim().toLowerCase();
        return (options?.users ?? []).filter((u) => !q || u.name.toLowerCase().includes(q) || (u.dept ?? "").toLowerCase().includes(q)).slice(0, 60);
    }, [options, userSearch]);

    const active = rows.filter((r) => r.active).length;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Notifications" subtitle="Send a message to everyone, to whole departments, to roles, or to named people. It shows in their bell and they can close it.">
                {canCreate && <Button color="primary" startContent={<Plus size={14} />} onPress={() => open()}>New notification</Button>}
            </PageHeader>

            <SummaryBar className="lg:grid-cols-3" items={[
                { label: "Sent", value: rows.length, hint: "All notifications" },
                { label: "Live now", value: active, hint: "Showing in people's bells" },
                { label: "Read by", value: rows.reduce((n, r) => n + r.readCount, 0), hint: "Reads across all notifications" },
            ]} />

            <div className="overflow-x-auto border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-ink-200 bg-ink-50 dark:border-white/10 dark:bg-white/5">{["Message", "Sent to", "Reach", "Read", "Sent", "Live", ""].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
                    <tbody>
                        {rows.map((n) => {
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
                                    <td className="px-4 py-3"><div className="flex max-w-xs flex-wrap gap-1">{who.slice(0, 4).map((w) => <Chip key={w} size="sm" variant="flat">{w}</Chip>)}{who.length > 4 && <Chip size="sm" variant="flat">+{who.length - 4}</Chip>}</div></td>
                                    <td className="px-4 py-3 whitespace-nowrap">{n.reach} people</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{n.readCount} of {n.reach}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500 dark:text-ink-400">{format(new Date(n.createdAt), "dd MMM yyyy, HH:mm")}<br />by {n.createdBy}{n.expiresAt && <><br />ends {format(new Date(n.expiresAt), "dd MMM")}</>}</td>
                                    <td className="px-4 py-3"><Switch size="sm" isSelected={n.active} isDisabled={!canUpdate} onValueChange={() => flip(n)} aria-label={`${n.title} live`} /></td>
                                    <td className="px-4 py-3"><div className="flex justify-end gap-1.5">
                                        {canUpdate && <Button size="sm" variant="bordered" isIconOnly aria-label={`Edit ${n.title}`} onPress={() => open(n)}><Pencil size={13} /></Button>}
                                        {canDelete && <Button size="sm" variant="bordered" isIconOnly aria-label={`Delete ${n.title}`} onPress={() => remove(n)}><Trash2 size={13} /></Button>}
                                    </div></td>
                                </tr>
                            );
                        })}
                        {!rows.length && (
                            <tr><td colSpan={7} className="px-4 py-16 text-center">
                                <Megaphone size={26} className="mx-auto text-ink-300 dark:text-ink-600" />
                                <p className="mt-3 text-sm font-semibold text-ink-900 dark:text-white">{loading ? "Loading…" : "No notifications yet"}</p>
                                {!loading && <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Write one and choose who should see it.</p>}
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

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
                            <Input label="Link" labelPlacement="outside" placeholder="/dashboard?view=pms (optional)" value={draft.linkUrl} onValueChange={(v) => setDraft((d) => ({ ...d, linkUrl: v }))} description="An app page such as /daily-activity, or a full web address. Shows as an Open button." />
                        </section>

                        <section className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">2 · Who gets it</h3>
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
                            <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">3 · Preview</h3>
                            <div className="flex gap-3 border border-ink-200 bg-brand-50/60 py-3 pl-4 pr-3 dark:border-white/10 dark:bg-brand-500/10">
                                <span className={cn("w-1 shrink-0 self-stretch", BAR[draft.level])} aria-hidden />
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-ink-900 dark:text-white">{draft.title || "Your title appears here"}</p>
                                    {draft.body && <p className="mt-0.5 whitespace-pre-line text-[12.5px] text-ink-600 dark:text-ink-300">{draft.body}</p>}
                                    <p className="mt-1.5 text-[11px] text-ink-400">just now</p>
                                </div>
                            </div>
                            <Switch isSelected={draft.active} onValueChange={(v) => setDraft((d) => ({ ...d, active: v }))}>Live (people can see it)</Switch>
                        </section>
                    </DrawerBody>
                    <DrawerFooter>
                        <Button variant="bordered" onPress={() => setEdit({ open: false })}>Cancel</Button>
                        <Button color="primary" isDisabled={!valid} isLoading={saving} onPress={save}>{edit.id ? "Save changes" : "Send notification"}</Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>
    );
}
