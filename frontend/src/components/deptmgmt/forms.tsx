import { useEffect, useMemo, useState } from "react";
import { cn } from "@heroui/theme";
import { Check, Plus, X } from "lucide-react";

import { Segmented } from "@/components/page";
import {
    Autocomplete, AutocompleteItem, Button, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, Input, Switch, Textarea, addToast,
} from "@/components/ui";
import { CRITERIA, deptApi, errorText, type Candidate, type Criteria, type Department, type DeptType, type SubDepartment } from "./api";
import { CodeTag, PersonField } from "./parts";

const nextCode = (codes: (string | null)[], prefix: string, plus = 1) => {
    const n = Math.max(0, ...codes.map((c) => (c?.startsWith(prefix) ? Number(c.slice(prefix.length)) || 0 : 0)));
    return `${prefix}${String(n + plus).padStart(2, "0")}`;
};

/** Two or more cards to choose one from */
function ChoiceCards<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { key: T; title: string; hint: string }[]; label: string }) {
    return (
        <div role="radiogroup" aria-label={label} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((o) => {
                const on = value === o.key;
                return (
                    <button key={o.key} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.key)}
                        className={cn("flex items-start gap-3 border px-3.5 py-3 text-left transition-colors", on ? "border-brand-500 bg-brand-50 shadow-[inset_3px_0_0_#ff6a1f] dark:bg-brand-500/10" : "border-ink-200 bg-white hover:border-ink-400 dark:border-white/10 dark:bg-ink-900")}>
                        <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", on ? "border-brand-500 bg-brand-500 text-white" : "border-ink-300 dark:border-white/30")}>{on && <Check size={10} strokeWidth={3.5} />}</span>
                        <span>
                            <span className={cn("block text-[13px] font-semibold", on ? "text-brand-700 dark:text-brand-300" : "text-ink-900 dark:text-white")}>{o.title}</span>
                            <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{o.hint}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

// same look as the inputs' own labels
const FieldLabel = ({ children, optional }: { children: string; optional?: boolean }) => (
    <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-700 dark:text-ink-300">{children}{optional && <span className="font-normal normal-case tracking-normal text-ink-500"> (optional)</span>}</span>
);
const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

interface SubRow { key: number; name: string; elId: number | null; flId: number | null }

/** New department (with the "sub departments?" question) or edit one */
export function DepartmentDrawer({ open, editing, departments, subCodes, candidates, onClose, onSaved }: {
    open: boolean; editing: Department | null; departments: Department[]; subCodes: (string | null)[]; candidates: Candidate[];
    onClose: () => void; onSaved: (id: number) => void;
}) {
    const [name, setName] = useState("");
    const [type, setType] = useState<DeptType>("BUSINESS");
    const [goal, setGoal] = useState<Criteria>("MONTHLY");
    const [target, setTarget] = useState<Criteria>("DAILY");
    const [description, setDescription] = useState("");
    const [active, setActive] = useState(true);
    const [withSubs, setWithSubs] = useState<"yes" | "no">("yes");
    const [rows, setRows] = useState<SubRow[]>([]);
    const [elId, setElId] = useState<number | null>(null);
    const [flId, setFlId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(editing?.name ?? ""); setType(editing?.type ?? "BUSINESS"); setGoal(editing?.goalCriteria ?? "MONTHLY"); setTarget(editing?.targetCriteria ?? "DAILY");
        setDescription(editing?.description ?? ""); setActive(editing?.active ?? true);
        setWithSubs("yes"); setRows([{ key: 1, name: "", elId: null, flId: null }]); setElId(null); setFlId(null);
    }, [open, editing]);

    const code = editing?.code ?? nextCode(departments.map((d) => d.code), "TM-D");
    const set = (key: number, patch: Partial<SubRow>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    const filled = rows.filter((r) => r.name.trim());
    const valid = name.trim().length >= 2 && (editing || withSubs === "no" || (filled.length > 0 && filled.every((r) => r.name.trim().length >= 2)));

    const save = async () => {
        setSaving(true);
        try {
            if (editing) {
                await deptApi.updateDepartment(editing.id, { name: name.trim(), type, goalCriteria: goal, targetCriteria: target, description, active });
                addToast({ title: "Department saved", description: name, color: "success" });
                onSaved(editing.id);
            } else {
                const r = await deptApi.createDepartment({
                    name: name.trim(), type, goalCriteria: goal, targetCriteria: target, description: description || null,
                    ...(withSubs === "yes" ? { subDepartments: filled.map((s) => ({ name: s.name.trim(), elId: s.elId, flId: s.flId })) } : { elId, flId }),
                });
                addToast({ title: `${r.code} created`, description: name, color: "success" });
                onSaved(r.id);
            }
            onClose();
        } catch (e) { addToast({ title: "Could not save the department", description: errorText(e), color: "danger" }); } finally { setSaving(false); }
    };

    return (
        <Drawer isOpen={open} onOpenChange={(o) => !o && onClose()} size="2xl">
            <DrawerContent>
                <DrawerHeader className="flex flex-col gap-1"><span className="eyebrow">Department Management</span><span>{editing ? `Edit ${editing.name}` : "New department"}</span></DrawerHeader>
                <DrawerBody className="gap-5">
                    <div className="flex items-center gap-3 border border-ink-200 bg-ink-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                        <span className="eyebrow">Department ID</span><CodeTag code={code} />
                        <span className="text-xs text-ink-500 dark:text-ink-400">{editing ? "Fixed for this department" : "Given automatically, never reused"}</span>
                    </div>
                    <Input label="Department name" labelPlacement="outside" placeholder="e.g. Customer Experience" value={name} onValueChange={setName} isRequired />
                    <div className="flex flex-col gap-2">
                        <FieldLabel>Type</FieldLabel>
                        <ChoiceCards label="Type" value={type} onChange={setType} options={[{ key: "BUSINESS", title: "Business", hint: "Earns or drives revenue" }, { key: "SUPPORT", title: "Support", hint: "HR, Finance, Admin, L&D" }]} />
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        <div className="flex flex-col gap-2"><FieldLabel>Goal criteria</FieldLabel><Segmented size="sm" label="Goal criteria" value={goal} onChange={setGoal} options={CRITERIA.map((c) => ({ key: c.key, label: c.label }))} /></div>
                        <div className="flex flex-col gap-2"><FieldLabel>Target criteria</FieldLabel><Segmented size="sm" label="Target criteria" value={target} onChange={setTarget} options={CRITERIA.map((c) => ({ key: c.key, label: c.label }))} /></div>
                    </div>
                    <Textarea label="Description (optional)" labelPlacement="outside" placeholder="What this department does" value={description} onValueChange={setDescription} minRows={2} />

                    {editing ? (
                        <Switch isSelected={active} onValueChange={setActive}>Active</Switch>
                    ) : (
                        <div className="flex flex-col gap-3 border-t border-ink-200 pt-5 dark:border-white/10">
                            <p className="text-sm font-bold text-ink-900 dark:text-white">Would you like sub departments for this department?</p>
                            <ChoiceCards label="Sub departments" value={withSubs} onChange={setWithSubs} options={[
                                { key: "yes", title: "Yes, add sub departments", hint: "People, tasks, targets and goals go into each sub department. Each gets its own TM-SD ID." },
                                { key: "no", title: "No, keep it as one team", hint: "People, tasks, targets and goals sit directly in the department. You can still add sub departments later." },
                            ]} />
                            {withSubs === "yes" ? (
                                <div className="flex flex-col gap-2">
                                    <p className="eyebrow mt-1">First sub departments</p>
                                    {rows.map((r, i) => (
                                        <div key={r.key} className="flex flex-col gap-2 border border-ink-200 p-3 dark:border-white/10">
                                            <div className="flex items-center gap-2">
                                                <CodeTag code={nextCode(subCodes, "TM-SD", i + 1)} className="shrink-0" />
                                                <Input aria-label="Sub department name" size="sm" placeholder="Sub department name" value={r.name} onValueChange={(v) => set(r.key, { name: v })} />
                                                <Button isIconOnly size="sm" variant="light" aria-label="Remove this row" isDisabled={rows.length === 1} onPress={() => setRows((x) => x.filter((y) => y.key !== r.key))}><X size={14} /></Button>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                <PersonField size="sm" placeholder="Executive Leader (EL)" value={r.elId} onChange={(v) => set(r.key, { elId: v })} candidates={candidates} />
                                                <PersonField size="sm" placeholder="Functional Leader (FL)" value={r.flId} onChange={(v) => set(r.key, { flId: v })} candidates={candidates} />
                                            </div>
                                        </div>
                                    ))}
                                    <Button size="sm" variant="bordered" className="w-fit" startContent={<Plus size={14} />} onPress={() => setRows((x) => [...x, { key: Math.max(...x.map((y) => y.key)) + 1, name: "", elId: null, flId: null }])}>Add another sub department</Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <PersonField label="Executive Leader (EL)" value={elId} onChange={setElId} candidates={candidates} />
                                    <PersonField label="Functional Leader (FL)" value={flId} onChange={setFlId} candidates={candidates} />
                                </div>
                            )}
                        </div>
                    )}
                </DrawerBody>
                <DrawerFooter>
                    <Button variant="bordered" onPress={onClose}>Cancel</Button>
                    <Button color="primary" isDisabled={!valid} isLoading={saving} onPress={save}>{editing ? "Save department" : "Create department"}</Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}

/** Add a sub department to a department (people to move in, data to start from) or edit one */
export function SubDrawer({ open, department, editing, siblings, departments, subCodes, candidates, departmentPeople, onClose, onSaved }: {
    open: boolean; department: Department | null; editing: SubDepartment | null; siblings: SubDepartment[]; departments: Department[];
    subCodes: (string | null)[]; candidates: Candidate[]; departmentPeople: number[]; onClose: () => void; onSaved: (id: number) => void;
}) {
    const [name, setName] = useState("");
    const [elId, setElId] = useState<number | null>(null);
    const [flId, setFlId] = useState<number | null>(null);
    const [description, setDescription] = useState("");
    const [people, setPeople] = useState<number[]>([]);
    const [copyFrom, setCopyFrom] = useState<string>("none");
    const [parent, setParent] = useState<string>("");
    const [active, setActive] = useState(true);
    const [find, setFind] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(editing?.name ?? ""); setElId(editing?.el?.userId ?? null); setFlId(editing?.fl?.userId ?? null); setDescription(editing?.description ?? "");
        setPeople([]); setCopyFrom("none"); setParent(String(editing?.departmentId ?? department?.id ?? "")); setActive(editing?.active ?? true); setFind(null);
    }, [open, editing, department]);

    const code = editing?.code ?? nextCode(subCodes, "TM-SD");
    const byId = useMemo(() => new Map(candidates.map((c) => [c.userId, c])), [candidates]);
    const suggestions = departmentPeople.filter((id) => byId.get(id)?.active).slice(0, 8);
    const togglePerson = (id: number) => setPeople((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    const sources = siblings.filter((s) => s.id !== editing?.id && s.tasks + s.targets + s.goals > 0);

    const save = async () => {
        setSaving(true);
        try {
            if (editing) {
                await deptApi.updateSub(editing.id, { name: name.trim(), elId, flId, description, active, ...(parent && Number(parent) !== editing.departmentId ? { departmentId: Number(parent) } : {}) });
                addToast({ title: "Sub department saved", description: name, color: "success" });
                onSaved(editing.id);
            } else {
                const r = await deptApi.createSub({ departmentId: department?.id ?? null, name: name.trim(), elId, flId, description: description || null, people, copyFrom: copyFrom === "none" ? null : Number(copyFrom) });
                const c = r.copied;
                addToast({ title: `${r.code} added`, description: c ? `${name}: copied ${c.tasks} tasks, ${c.targets} targets, ${c.goals} goals` : name, color: "success" });
                onSaved(r.id);
            }
            onClose();
        } catch (e) { addToast({ title: "Could not save the sub department", description: errorText(e), color: "danger" }); } finally { setSaving(false); }
    };

    return (
        <Drawer isOpen={open} onOpenChange={(o) => !o && onClose()} size="xl">
            <DrawerContent>
                <DrawerHeader className="flex flex-col gap-1">
                    <span className="eyebrow">{department ? `${department.name} · ${department.code}` : "Sub department"}</span>
                    <span>{editing ? `Edit ${editing.name}` : "Add sub department"}</span>
                </DrawerHeader>
                <DrawerBody className="gap-5">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="border border-ink-200 bg-ink-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                            <p className="eyebrow">Sub department ID</p>
                            <p className="mt-1.5 flex items-center gap-2"><CodeTag code={code} /><span className="text-xs text-ink-500">{editing ? "Fixed" : "Given automatically"}</span></p>
                        </div>
                        <div className="border border-ink-200 bg-ink-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                            <p className="eyebrow">Department</p>
                            {editing ? (
                                <Autocomplete aria-label="Department" size="sm" className="mt-1" selectedKey={parent || null} onSelectionChange={(k) => k && setParent(String(k))}>
                                    {departments.map((d) => <AutocompleteItem key={String(d.id)} textValue={d.name}>{`${d.code} · ${d.name}`}</AutocompleteItem>)}
                                </Autocomplete>
                            ) : (
                                <p className="mt-1.5 text-sm font-semibold text-ink-900 dark:text-white">{department?.name ?? "—"} <span className="text-xs font-normal text-ink-500">set, because you are inside it</span></p>
                            )}
                        </div>
                    </div>
                    <Input label="Sub department name" labelPlacement="outside" placeholder="e.g. Quality Assurance" value={name} onValueChange={setName} isRequired />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <PersonField label="Executive Leader (EL)" value={elId} onChange={setElId} candidates={candidates} />
                        <PersonField label="Functional Leader (FL)" value={flId} onChange={setFlId} candidates={candidates} />
                    </div>
                    <Textarea label="Description (optional)" labelPlacement="outside" placeholder="What this team does" value={description} onValueChange={setDescription} minRows={2} />

                    {editing ? (
                        <Switch isSelected={active} onValueChange={setActive}>Active</Switch>
                    ) : (
                        <>
                            <div className="flex flex-col gap-2">
                                <FieldLabel optional>Move people in</FieldLabel>
                                <div className="flex flex-wrap gap-1.5">
                                    {[...new Set([...suggestions, ...people])].map((id) => {
                                        const on = people.includes(id);
                                        return (
                                            <button key={id} type="button" aria-pressed={on} onClick={() => togglePerson(id)}
                                                className={cn("inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium transition-colors", on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "border-ink-200 text-ink-700 hover:border-ink-400 dark:border-white/15 dark:text-ink-200")}>
                                                {on && <Check size={12} strokeWidth={3} />}{byId.get(id)?.name ?? id}
                                            </button>
                                        );
                                    })}
                                </div>
                                <Autocomplete aria-label="Find someone" size="sm" placeholder="+ Find someone" className="max-w-xs" selectedKey={find} onSelectionChange={(k) => { if (k) { togglePerson(Number(k)); setFind(null); } }}>
                                    {candidates.filter((c) => c.active && !people.includes(c.userId)).map((c) => <AutocompleteItem key={String(c.userId)} textValue={c.name}>{c.name}</AutocompleteItem>)}
                                </Autocomplete>
                                <p className="text-xs text-ink-500 dark:text-ink-400">People already in {department?.name ?? "the department"} are suggested. Each person belongs to one sub department.</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <FieldLabel optional>Start with tasks, targets and goals from</FieldLabel>
                                <div role="radiogroup" aria-label="Copy from" className="flex flex-col border border-ink-200 dark:border-white/10">
                                    {[{ key: "none", title: "Nothing, I will add them", hint: "" }, ...sources.map((s) => ({ key: String(s.id), title: `${s.name} (${s.code})`, hint: [s.tasks && plural(s.tasks, "task"), s.targets && plural(s.targets, "target"), s.goals && plural(s.goals, "goal")].filter(Boolean).join(", ") }))].map((o) => {
                                        const on = copyFrom === o.key;
                                        return (
                                            <button key={o.key} type="button" role="radio" aria-checked={on} onClick={() => setCopyFrom(o.key)}
                                                className={cn("flex items-center gap-3 border-b border-ink-100 px-3 py-2.5 text-left last:border-0 dark:border-white/5", on ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-ink-50 dark:hover:bg-white/5")}>
                                                <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", on ? "border-brand-500 bg-brand-500 text-white" : "border-ink-300 dark:border-white/30")}>{on && <Check size={10} strokeWidth={3.5} />}</span>
                                                <span className="text-[13px] text-ink-900 dark:text-white">{o.title}</span>
                                                {o.hint && <span className="ml-auto text-xs text-ink-500">{o.hint}</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </DrawerBody>
                <DrawerFooter>
                    <Button variant="bordered" onPress={onClose}>Cancel</Button>
                    <Button color="primary" isDisabled={name.trim().length < 2} isLoading={saving} onPress={save}>{editing ? "Save sub department" : "Add sub department"}</Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}

/** Older sub departments under no department: choose a department for each */
export function MapDrawer({ open, loose, departments, onClose, onSaved }: { open: boolean; loose: SubDepartment[]; departments: Department[]; onClose: () => void; onSaved: () => void }) {
    const [pick, setPick] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (open) setPick({}); }, [open]);
    const chosen = Object.entries(pick).filter(([, d]) => d);
    const save = async () => {
        setSaving(true);
        try {
            await deptApi.map(chosen.map(([s, d]) => ({ subDepartmentId: Number(s), departmentId: Number(d) })));
            addToast({ title: `${chosen.length} sub ${chosen.length === 1 ? "department" : "departments"} placed`, color: "success" });
            onSaved(); onClose();
        } catch (e) { addToast({ title: "Could not save", description: errorText(e), color: "danger" }); } finally { setSaving(false); }
    };
    return (
        <Drawer isOpen={open} onOpenChange={(o) => !o && onClose()} size="2xl">
            <DrawerContent>
                <DrawerHeader className="flex flex-col gap-1"><span className="eyebrow">Not under a department · {loose.length}</span><span>Place older sub departments</span></DrawerHeader>
                <DrawerBody className="gap-3">
                    <p className="text-sm text-ink-500 dark:text-ink-400">These sub departments were made before departments existed. Choose a department for each; its people, tasks, targets and goals then show up under it. Leave any you are not sure about.</p>
                    <div className="border border-ink-200 dark:border-white/10">
                        {loose.map((s) => (
                            <div key={s.id} className="grid grid-cols-1 items-center gap-2 border-b border-ink-100 px-4 py-2.5 last:border-0 dark:border-white/5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                                <div className="min-w-0">
                                    <p className="flex items-center gap-2 text-sm font-semibold text-ink-900 dark:text-white"><CodeTag code={s.code} /><span className="truncate">{s.name}</span></p>
                                    <p className="mt-0.5 text-xs text-ink-500">{s.people} {s.people === 1 ? "person" : "people"} · {s.active ? "active" : "inactive"}</p>
                                </div>
                                <Autocomplete aria-label={`Department for ${s.name}`} size="sm" placeholder="Choose a department" selectedKey={pick[s.id] || null} onSelectionChange={(k) => setPick((p) => ({ ...p, [s.id]: k ? String(k) : "" }))}>
                                    {departments.map((d) => <AutocompleteItem key={String(d.id)} textValue={d.name}>{`${d.code} · ${d.name}`}</AutocompleteItem>)}
                                </Autocomplete>
                            </div>
                        ))}
                    </div>
                </DrawerBody>
                <DrawerFooter>
                    <Button variant="bordered" onPress={onClose}>Cancel</Button>
                    <Button color="primary" isDisabled={!chosen.length} isLoading={saving} onPress={save}>{chosen.length ? `Place ${chosen.length}` : "Choose departments"}</Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
