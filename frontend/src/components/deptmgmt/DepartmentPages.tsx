import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@heroui/theme";
import { ArrowLeft, Pencil, Plus, UserPlus } from "lucide-react";

import { Segmented } from "@/components/page";
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, addToast } from "@/components/ui";
import { hasModuleAccess } from "@/lib/permissions";
import TaskManagement from "@/pages/TaskManagement";
import TargetManagement from "@/pages/targetManagement";
import GoalManagement from "@/pages/goalManagement";
import { criteriaLabel, deptApi, errorText, type Candidate, type Department, type Person, type SubDepartment } from "./api";
import { DepartmentDrawer, SubDrawer } from "./forms";
import { Avatar, CodeTag, MoveModal, PeoplePicker, PeopleTable, Stat, StatRow, StatusText, TypeTag } from "./parts";

type DataTab = "tasks" | "targets" | "goals";
const DATA: { key: DataTab; label: string; module: string }[] = [
    { key: "tasks", label: "Tasks", module: "taskmgmt" }, { key: "targets", label: "Targets", module: "targetmgmt" }, { key: "goals", label: "Goals", module: "goalmgmt" },
];
const fmt = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null);

/** Everything both pages need: the overview (codes, every department / sub department) and the people who can be picked */
function useShared() {
    const [all, setAll] = useState<{ departments: Department[]; subDepartments: SubDepartment[] }>({ departments: [], subDepartments: [] });
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const reloadAll = useCallback(async () => {
        const [o, c] = await Promise.all([deptApi.overview(), deptApi.candidates().catch(() => [])]);
        setAll(o); setCandidates(c);
    }, []);
    useEffect(() => { reloadAll().catch(() => undefined); }, [reloadAll]);
    const subLabel = useCallback((id: number) => { const s = all.subDepartments.find((x) => x.id === id); return s ? `${s.name}` : null; }, [all]);
    const moveTargets = useMemo(() => all.subDepartments.filter((s) => s.active).map((s) => {
        const d = all.departments.find((x) => x.id === s.departmentId);
        return { id: s.id, label: `${s.code} · ${s.name}${d ? ` (${d.name})` : ""}` };
    }), [all]);
    return { all, candidates, reloadAll, subLabel, moveTargets };
}

const Back = ({ to, label }: { to: string; label: string }) => (
    <Link to={to} className="inline-flex w-fit items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-500 hover:text-brand-600"><ArrowLeft size={14} />{label}</Link>
);

const Loading = ({ error }: { error?: string | null }) => <p className="py-24 text-center text-sm text-ink-500">{error ?? "Loading…"}</p>;

/** The tasks, targets or goals of one sub department: the Data Management pages, locked to it */
function DataPanel({ subId, tab }: { subId: number; tab: DataTab }) {
    if (!hasModuleAccess(DATA.find((d) => d.key === tab)!.module)) return <p className="px-5 py-12 text-center text-sm text-ink-500">You do not have access to {tab}.</p>;
    return (
        <div className="[&>div]:border-0">
            {tab === "tasks" && <TaskManagement key={`t${subId}`} departmentId={subId} />}
            {tab === "targets" && <TargetManagement key={`g${subId}`} departmentId={subId} />}
            {tab === "goals" && <GoalManagement key={`o${subId}`} departmentId={subId} />}
        </div>
    );
}

/** People, tasks, targets and goals of one sub department (its own page, or a department that is one team) */
function SubBody({ sub, people, canWrite, onAddPeople, onMove, onTab }: {
    sub: SubDepartment; people: Person[]; canWrite: boolean; onAddPeople: () => void; onMove: (p: Person) => void; onTab: () => void;
}) {
    const [tab, setTab] = useState<"people" | DataTab>("people");
    const count = (k: DataTab) => sub[k];
    return (
        <section className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
            <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 px-5 py-3 dark:border-white/10">
                <Segmented label="Sub department sections" value={tab} onChange={(t) => { setTab(t); onTab(); }} options={[
                    { key: "people", label: <span>People <span className="ml-1 opacity-60">{people.length}</span></span> },
                    ...DATA.filter((d) => hasModuleAccess(d.module)).map((d) => ({ key: d.key, label: <span>{d.label} <span className="ml-1 opacity-60">{count(d.key)}</span></span> })),
                ]} />
            </div>
            {tab === "people" ? (
                <PeopleTable people={people} showCycle onMove={canWrite ? onMove : undefined}
                    actions={canWrite && <Button size="sm" color="primary" startContent={<UserPlus size={14} />} onPress={onAddPeople}>Add people</Button>}
                    empty={<>Nobody in {sub.name} yet.{canWrite && <> <button type="button" className="font-semibold text-brand-600 hover:underline" onClick={onAddPeople}>Add people</button></>}</>} />
            ) : (
                <div className="p-4"><DataPanel subId={sub.id} tab={tab} /></div>
            )}
        </section>
    );
}

function Leader({ role, who, onChoose }: { role: string; who: { name: string } | null; onChoose?: () => void }) {
    return (
        <div className="flex items-center gap-3 px-5 py-4">
            {who ? <Avatar name={who.name} userType={role === "Executive Leader" ? "EL" : "FL"} size={36} /> : <span className="flex h-9 w-9 items-center justify-center border border-dashed border-ink-300 text-ink-400 dark:border-white/20">?</span>}
            <div className="min-w-0 flex-1"><p className="eyebrow">{role}</p><p className={cn("mt-1 truncate text-sm font-semibold", who ? "text-ink-900 dark:text-white" : "text-ink-400")}>{who?.name ?? "Not set"}</p></div>
            {!who && onChoose && <Button size="sm" variant="bordered" onPress={onChoose}>Choose</Button>}
        </div>
    );
}

// ── Department ───────────────────────────────────────────────────────────────────────────────────

export function DepartmentPage({ id }: { id: number }) {
    const navigate = useNavigate();
    const { all, candidates, reloadAll, subLabel, moveTargets } = useShared();
    const [data, setData] = useState<Awaited<ReturnType<typeof deptApi.department>> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<"people" | DataTab>("people");
    const [dataSub, setDataSub] = useState<number | null>(null);
    const [editDept, setEditDept] = useState(false);
    const [subForm, setSubForm] = useState<{ open: boolean; editing: SubDepartment | null }>({ open: false, editing: null });
    const [addTo, setAddTo] = useState<SubDepartment | null>(null);
    const [moving, setMoving] = useState<Person | null>(null);
    const canWrite = hasModuleAccess("deptmgmt", "update");
    const canCreate = hasModuleAccess("deptmgmt", "create");

    const load = useCallback(async () => {
        try { setData(await deptApi.department(id)); setError(null); } catch (e) { setError(errorText(e)); }
    }, [id]);
    useEffect(() => { load(); }, [load]);
    const refresh = () => { load(); reloadAll(); };

    if (!data) return <Loading error={error} />;
    const { department: d, subDepartments: subs, people } = data;
    const team = d.singleTeam ? subs[0]! : null;
    const firstWith = (k: DataTab) => subs.find((s) => s[k] > 0)?.id ?? subs[0]?.id ?? null;
    const shownSub = dataSub ?? (tab !== "people" ? firstWith(tab) : null);
    const codes = subs.map((s) => s.code).filter(Boolean).sort();

    const addPeople = async (sub: SubDepartment, ids: number[]) => {
        try { await deptApi.addPeople(sub.id, ids); addToast({ title: `${ids.length} moved into ${sub.name}`, color: "success" }); refresh(); }
        catch (e) { addToast({ title: "Could not move people", description: errorText(e), color: "danger" }); throw e; }
    };
    const move = async (subId: number) => {
        if (!moving) return;
        try { await deptApi.addPeople(subId, [moving.userId]); addToast({ title: `${moving.name} moved`, color: "success" }); refresh(); }
        catch (e) { addToast({ title: "Could not move", description: errorText(e), color: "danger" }); throw e; }
    };

    return (
        <div className="flex flex-col gap-5">
            <Back to="/departments" label="All departments" />
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><CodeTag code={d.code} /><TypeTag type={d.type} /><StatusText on={d.active} /></div>
                    <h1 className="mt-2 text-[26px] font-black uppercase leading-tight tracking-tight text-ink-900 dark:text-white">{d.name}</h1>
                    <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Goal criteria <b className="text-ink-800 dark:text-ink-100">{criteriaLabel(d.goalCriteria)}</b> · Target criteria <b className="text-ink-800 dark:text-ink-100">{criteriaLabel(d.targetCriteria)}</b>{d.createdAt && <> · created {fmt(d.createdAt)}</>}</p>
                    {d.description && <p className="mt-2 max-w-3xl text-sm text-ink-700 dark:text-ink-200">{d.description}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                    {canWrite && <Button variant="bordered" startContent={<Pencil size={14} />} onPress={() => setEditDept(true)}>Edit department</Button>}
                    {canCreate && <Button color="primary" startContent={<Plus size={14} />} onPress={() => setSubForm({ open: true, editing: null })}>Add sub department</Button>}
                </div>
            </header>

            <StatRow>
                <Stat label="People" value={d.people} hint={`${d.activePeople} active · ${d.people - d.activePeople} inactive`} />
                <Stat label="Sub departments" value={team ? "One team" : d.subDepartments} hint={team ? "No sub departments yet" : codes.length ? `${codes[0]} – ${codes[codes.length - 1]}` : undefined} />
                <Stat label="Tasks" value={d.tasks} hint={team ? undefined : "Across sub departments"} />
                <Stat label="Targets" value={d.targets} hint={criteriaLabel(d.targetCriteria)} />
                <Stat label="Goals" value={d.goals} hint={criteriaLabel(d.goalCriteria)} />
            </StatRow>

            {team ? (
                <>
                    <div className="grid grid-cols-1 border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900 sm:grid-cols-2 sm:divide-x sm:divide-ink-200 dark:sm:divide-white/10">
                        <Leader role="Executive Leader" who={team.el} onChoose={canWrite ? () => setSubForm({ open: true, editing: team }) : undefined} />
                        <Leader role="Functional Leader" who={team.fl} onChoose={canWrite ? () => setSubForm({ open: true, editing: team }) : undefined} />
                    </div>
                    <SubBody sub={team} people={people} canWrite={canWrite} onAddPeople={() => setAddTo(team)} onMove={setMoving} onTab={load} />
                </>
            ) : (
                <section className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
                    <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 px-5 py-3 dark:border-white/10">
                        <Segmented label="Department sections" value={tab} onChange={(t) => { setTab(t); setDataSub(null); load(); }} options={[
                            { key: "people", label: "People & sub departments" },
                            ...DATA.filter((x) => hasModuleAccess(x.module)).map((x) => ({ key: x.key, label: <span>{x.label} <span className="ml-1 opacity-60">{d[x.key]}</span></span> })),
                        ]} />
                    </div>
                    {tab === "people" ? (
                        <>
                            <div className="px-5 pt-4"><p className="text-sm font-bold text-ink-900 dark:text-white">People in {d.name} · {people.length}</p></div>
                            <PeopleTable people={people} subs={subs} showSub onMove={canWrite ? setMoving : undefined}
                                actions={canWrite && subs.length > 0 && (
                                    <Dropdown placement="bottom-end">
                                        <DropdownTrigger><Button size="sm" color="primary" startContent={<UserPlus size={14} />}>Add people</Button></DropdownTrigger>
                                        <DropdownMenu aria-label="Add people to" onAction={(k) => setAddTo(subs.find((s) => String(s.id) === String(k)) ?? null)}>
                                            {subs.filter((s) => s.active).map((s) => <DropdownItem key={String(s.id)} description={s.code ?? undefined}>{`Into ${s.name}`}</DropdownItem>)}
                                        </DropdownMenu>
                                    </Dropdown>
                                )} />
                            <div className="border-t border-ink-200 px-5 py-4 dark:border-white/10">
                                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                                    <p className="text-sm font-bold text-ink-900 dark:text-white">Sub departments · {subs.length}</p>
                                    <p className="text-xs text-ink-500">Open one to see its people, tasks, targets and goals.</p>
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {subs.map((s) => (
                                        <Link key={s.id} to={`/departments/sub/${s.id}`} className={cn("group flex flex-col border border-ink-200 p-4 transition-colors hover:border-ink-900 dark:border-white/10 dark:hover:border-white/40", !s.active && "opacity-60")}>
                                            <div className="flex items-center justify-between"><CodeTag code={s.code} /><StatusText on={s.active} /></div>
                                            <p className="mt-2.5 truncate text-[15px] font-bold text-ink-900 dark:text-white">{s.name}</p>
                                            <p className="mt-0.5 truncate text-xs text-ink-500">EL {s.el?.name ?? "not set"} · FL {s.fl?.name ?? "not set"}</p>
                                            <div className="mt-3 grid grid-cols-4 border-t border-ink-100 pt-2.5 text-center dark:border-white/5">
                                                {([["people", s.activePeople], ["tasks", s.tasks], ["targets", s.targets], ["goals", s.goals]] as const).map(([k, v]) => (
                                                    <div key={k}><p className="text-base font-bold text-ink-900 dark:text-white">{v}</p><p className="text-[10px] uppercase tracking-wide text-ink-500">{k}</p></div>
                                                ))}
                                            </div>
                                        </Link>
                                    ))}
                                    {canCreate && (
                                        <button type="button" onClick={() => setSubForm({ open: true, editing: null })}
                                            className="flex min-h-[140px] flex-col items-center justify-center gap-1.5 border border-dashed border-ink-300 p-4 text-ink-500 transition-colors hover:border-brand-500 hover:text-brand-600 dark:border-white/20">
                                            <Plus size={20} /><span className="text-sm font-bold">Add sub department</span><span className="text-xs">goes under {d.name}</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div>
                            <div className="flex flex-wrap gap-1.5 border-b border-ink-100 px-5 py-3 dark:border-white/5">
                                {subs.map((s) => {
                                    const on = s.id === shownSub;
                                    return (
                                        <button key={s.id} type="button" aria-pressed={on} onClick={() => setDataSub(s.id)}
                                            className={cn("inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-semibold transition-colors", on ? "border-ink-900 bg-ink-900 text-white dark:border-white dark:bg-white dark:text-ink-900" : "border-ink-200 text-ink-700 hover:border-ink-400 dark:border-white/15 dark:text-ink-200")}>
                                            {s.name}<span className={cn("text-[11px]", on ? "opacity-70" : "text-ink-400")}>{s[tab]}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {shownSub ? <div className="p-4"><DataPanel subId={shownSub} tab={tab} /></div> : <p className="px-5 py-12 text-center text-sm text-ink-500">Add a sub department first.</p>}
                        </div>
                    )}
                </section>
            )}

            <DepartmentDrawer open={editDept} editing={d} departments={all.departments} subCodes={all.subDepartments.map((s) => s.code)} candidates={candidates} onClose={() => setEditDept(false)} onSaved={refresh} />
            <SubDrawer open={subForm.open} department={d} editing={subForm.editing} siblings={subs} departments={all.departments} subCodes={all.subDepartments.map((s) => s.code)}
                candidates={candidates} departmentPeople={people.map((p) => p.userId)} onClose={() => setSubForm({ open: false, editing: null })}
                onSaved={(newId) => { if (!subForm.editing) navigate(`/departments/sub/${newId}`); else refresh(); }} />
            <PeoplePicker open={!!addTo} title={addTo ? `Add people to ${addTo.name}` : ""} candidates={candidates} suggested={people.map((p) => p.userId)} subName={subLabel}
                exclude={people.filter((p) => p.subDepartmentId === addTo?.id).map((p) => p.userId)} onClose={() => setAddTo(null)} onPick={(ids) => addPeople(addTo!, ids)} />
            <MoveModal person={moving} subs={moveTargets} onClose={() => setMoving(null)} onMove={move} />
        </div>
    );
}

// ── Sub department ───────────────────────────────────────────────────────────────────────────────

export function SubDepartmentPage({ id }: { id: number }) {
    const navigate = useNavigate();
    const { all, candidates, reloadAll, subLabel, moveTargets } = useShared();
    const [data, setData] = useState<Awaited<ReturnType<typeof deptApi.subDepartment>> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [edit, setEdit] = useState(false);
    const [adding, setAdding] = useState(false);
    const [moving, setMoving] = useState<Person | null>(null);
    const [removing, setRemoving] = useState(false);
    const canWrite = hasModuleAccess("deptmgmt", "update");

    const load = useCallback(async () => {
        try { setData(await deptApi.subDepartment(id)); setError(null); } catch (e) { setError(errorText(e)); }
    }, [id]);
    useEffect(() => { load(); }, [load]);
    const refresh = () => { load(); reloadAll(); };

    if (!data) return <Loading error={error} />;
    const { subDepartment: s, department: d, people } = data;
    const siblings = all.subDepartments.filter((x) => x.departmentId === s.departmentId);

    const addPeople = async (ids: number[]) => {
        try { await deptApi.addPeople(s.id, ids); addToast({ title: `${ids.length} moved into ${s.name}`, color: "success" }); refresh(); }
        catch (e) { addToast({ title: "Could not move people", description: errorText(e), color: "danger" }); throw e; }
    };
    const move = async (subId: number) => {
        if (!moving) return;
        try { await deptApi.addPeople(subId, [moving.userId]); addToast({ title: `${moving.name} moved`, color: "success" }); refresh(); }
        catch (e) { addToast({ title: "Could not move", description: errorText(e), color: "danger" }); throw e; }
    };
    const remove = async () => {
        if (!window.confirm(`Remove ${s.name} (${s.code})? Its ID is not given again.`)) return;
        setRemoving(true);
        try { await deptApi.removeSub(s.id); addToast({ title: `${s.name} removed`, color: "success" }); navigate(d ? `/departments/${d.id}` : "/departments"); }
        catch (e) { addToast({ title: "Could not remove", description: errorText(e), color: "danger" }); } finally { setRemoving(false); }
    };

    const header: ReactNode = (
        <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <CodeTag code={s.code} />
                    {d ? <span>sub department of <Link to={`/departments/${d.id}`} className="font-semibold text-ink-700 hover:text-brand-600 dark:text-ink-200">{d.code} {d.name}</Link></span> : <span className="font-semibold text-amber-700">not under a department yet</span>}
                    <StatusText on={s.active} />
                </div>
                <h1 className="mt-2 text-[26px] font-black uppercase leading-tight tracking-tight text-ink-900 dark:text-white">{s.name}</h1>
                <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{d ? <>Goal and target criteria come from {d.name}: <b className="text-ink-800 dark:text-ink-100">{criteriaLabel(d.goalCriteria)} · {criteriaLabel(d.targetCriteria)}</b></> : "Place it in a department to give it goal and target criteria."}</p>
                {s.description && <p className="mt-2 max-w-3xl text-sm text-ink-700 dark:text-ink-200">{s.description}</p>}
            </div>
            {canWrite && (
                <div className="flex flex-wrap gap-2">
                    <Button variant="bordered" startContent={<Pencil size={14} />} onPress={() => setEdit(true)}>Edit sub department</Button>
                    <Button color="primary" startContent={<UserPlus size={14} />} onPress={() => setAdding(true)}>Add people</Button>
                    <Dropdown placement="bottom-end">
                        <DropdownTrigger><Button variant="light" isIconOnly aria-label="More" isLoading={removing}>⋯</Button></DropdownTrigger>
                        <DropdownMenu aria-label="More actions" onAction={(k) => k === "remove" && remove()}>
                            <DropdownItem key="remove" className="text-danger" color="danger" description="Only when nobody active works here">Remove sub department</DropdownItem>
                        </DropdownMenu>
                    </Dropdown>
                </div>
            )}
        </header>
    );

    return (
        <div className="flex flex-col gap-5">
            <Back to={d ? `/departments/${d.id}` : "/departments"} label={d?.name ?? "All departments"} />
            {header}
            <div className="grid grid-cols-1 border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900 sm:grid-cols-3 sm:divide-x sm:divide-ink-200 dark:sm:divide-white/10">
                <Leader role="Executive Leader" who={s.el} onChoose={canWrite ? () => setEdit(true) : undefined} />
                <Leader role="Functional Leader" who={s.fl} onChoose={canWrite ? () => setEdit(true) : undefined} />
                <Stat label="People" value={s.people} hint={`${s.activePeople} active · ${s.people - s.activePeople} inactive`} />
            </div>
            <SubBody sub={s} people={people} canWrite={canWrite} onAddPeople={() => setAdding(true)} onMove={setMoving} onTab={load} />

            <SubDrawer open={edit} department={d} editing={s} siblings={siblings} departments={all.departments} subCodes={all.subDepartments.map((x) => x.code)}
                candidates={candidates} departmentPeople={[]} onClose={() => setEdit(false)} onSaved={refresh} />
            <PeoplePicker open={adding} title={`Add people to ${s.name}`} candidates={candidates} subName={subLabel}
                suggested={all.subDepartments.filter((x) => x.departmentId && x.departmentId === s.departmentId).length ? candidates.filter((c) => c.subDepartmentIds.some((sid) => siblings.some((x) => x.id === sid))).map((c) => c.userId) : []}
                exclude={people.map((p) => p.userId)} onClose={() => setAdding(false)} onPick={addPeople} />
            <MoveModal person={moving} subs={moveTargets} onClose={() => setMoving(null)} onMove={move} />
        </div>
    );
}
