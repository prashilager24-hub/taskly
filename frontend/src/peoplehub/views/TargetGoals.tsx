import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Calculator, CalendarDays, ChevronDown, Flag, Lightbulb, Plus, Target, Users } from "lucide-react";
import { ScoreGuide } from "@/peoplehub/views/ScoreGuide";
import {
  addToast, Autocomplete, AutocompleteItem, Button, Card, Checkbox, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader,
  Select, SelectItem, Spinner, Tab, Tabs, Textarea,
} from "@/components/ui";
import DateRangeField from "@/components/DateRangeField";
import {
  ALL_Q, BarChart, CalcToggle, DataTable, FIRST_YEAR, Meter, PERIODS, PctChip, fmtDate, hm, num, pad, pct, periodLabel, rangeOfQuarters,
  type Col, type GoalRow, type Grain, type QuarterRow, type TargetRow, type Weighted,
} from "@/pages/performanceReport";

/**
 * Real Taskly targets and goals in People Hub (server: /target-goals, figures worked out exactly like Performance Overview):
 *  - Dashboard → PMS Dashboard: every filter and calculation — the % cards, combined score with each person's saved
 *    weights, team scores, "why this score", and the charts.
 *  - PMS → Target & Goals: the target and goal entries themselves (All / Goals / Targets), and adding new ones.
 * Who sees what:
 *  - Employee: only their own targets and goals; adds their own target entries.
 *  - EL / leader: themselves and their team; adds goal entries for teammates and sets each teammate's combined-score weights.
 *  - Admin: the whole company.
 */
const BASE = "/t2.0/authentificationUtilization/target-goals";

type Kind = "admin" | "lead" | "employee";
type TabKey = "all" | "goals" | "targets";
interface Options { departments: { id: number; name: string }[]; subDepartments: { id: number; name: string; departmentId: number }[]; people: { id: number; name: string; subDepartmentId: number }[]; allCompany: boolean }
interface Context { viewer: { id: number; kind: Kind }; options: Options }
interface Score { weighted: number | null; avg: number | null; entries: number }
/** Model X (People Hub PMS score), figures in % */
interface PersonPms { goalPct: number | null; targetPct: number | null; score: number | null; goalWeight: number | null; shift: number; reasonCode: string; goalMetrics: number; targetMetrics: number }
interface Person { userId: number; name: string; subDepartment: string; department: string; target: Score; goal: Score; pms: PersonPms }
interface PmsResult { score: number | null; scoreWithoutShift: number | null; goalPct: number | null; targetPct: number | null; goalCredited: number | null; targetCredited: number | null; goalWeight: number | null; targetWeight: number | null; managerShift: number; reasonCode: string; reasonFlags: string[]; nudges: { side: "GOAL" | "TARGET"; from: number; to: number; newScore: number }[] }
interface PmsBlock {
  goalPct: number | null; targetPct: number | null; score: number | null; shiftYear: number; people: number;
  goalMetrics: number; targetMetrics: number; goalEntries: number; targetEntries: number;
  person: { result: PmsResult; reason: { why: string; raise: string[] }; human: { wentWell: string | null; heldBack: string | null; nextStep: string | null; trend: string | null }; goalMetrics: number; targetMetrics: number; goalEntries: number; targetEntries: number } | null;
  charts: { period: string; goalPct: number | null; targetPct: number | null; score: number | null }[];
}
interface Shift { shift: number; justification: string; setBy: string | null; setAt: string }
interface Cards { avgTargetPct: number | null; avgGoalPct: number | null; avgWorkingHrs: number | null; avgAllocatedHrs: number | null; targetEntries: number; goalEntries: number; weightedTarget: Weighted; weightedGoal: Weighted; people: number }
interface Report {
  level: "person" | "sub" | "dept" | "company"; quarters: QuarterRow[]; cards: Cards;
  charts: { target: { period: string; value: number }[]; goal: { period: string; value: number }[] };
  targetTable: TargetRow[]; goalTable: GoalRow[]; people: Person[]; pms: PmsBlock; shifts: Record<string, Shift>; editable: number[];
}
interface AddItem { id: number; name: string; unit: number | null; frequency: string | null; subDepartmentId: number; subDepartment: string }
interface AddOptions { canAddGoal: boolean; targets: AddItem[]; people: { id: number; name: string; subDepartmentIds: number[] }[]; goals: AddItem[] }
type EntryRow = { type: "Target" | "Goal"; period: string; date: string; department: string; subDepartment: string; associate: string; name: string; expected: number | null; achieved: number | null; pct: number | null; frequency: string | null; remarks: string };

const data = <T,>(r: { data?: any }): T => r.data?.response ?? r.data?.data ?? r.data;
const errText = (e: any, fallback: string) => e?.response?.data?.message ?? fallback;
const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
/** "+5% to Goal", "−3% to Target", "none" */
const shiftText = (x: number) => (x > 0 ? `+${Math.round(x * 100)}% to Goal` : x < 0 ? `${Math.round(x * 100)}% to Target` : "none");
const weightsText = (w: number | null) => (w == null ? "—" : `${Math.round(w * 100)} / ${Math.round((1 - w) * 100)}`);

function PmsDashboardView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [qs, setQs] = useState<number[]>(ALL_Q);
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(`${now.getFullYear()}-12-31`);
  const [dept, setDept] = useState("");
  const [sub, setSub] = useState("");
  const [person, setPerson] = useState("");
  const [grain, setGrain] = useState<Grain>("quarter");
  const [excludeZero, setExcludeZero] = useState(false);
  const [tab, setTab] = useState<TabKey>("all");
  const [showMore, setShowMore] = useState(false);
  const [openCalc, setOpenCalc] = useState<Set<string>>(new Set());
  const toggleCalc = (id: string) => setOpenCalc((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [ctx, setCtx] = useState<Context | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // the manager's yearly weight shift being edited (Model X: up to ±5% between Goal and Target, with a justification)
  const [shiftFor, setShiftFor] = useState<{ userId: number; name: string } | null>(null);
  const [shiftVal, setShiftVal] = useState("0");
  const [shiftWhy, setShiftWhy] = useState("");
  const [savingShift, setSavingShift] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const kind = ctx?.viewer.kind ?? "employee";
  // Who sees what:
  //  - Admin / Super Admin: only "PMS Overview" (the whole company, every filter)
  //  - EL / Manager / FL / Lead with a team: "My PMS Dashboard" first, then "Team PMS Overview" (their teammates)
  //  - everyone else (Associates, and leaders without a team): only "My PMS Dashboard"
  // Picking one person in an overview shows that person's figures only.
  const hasTeam = kind === "lead";
  const [view, setView] = useState<"mine" | "team">("mine");
  /** true while only the viewer's own figures are shown */
  const isEmployee = kind === "employee" || (hasTeam && view === "mine");
  const years = useMemo(() => { const out: number[] = []; for (let y = Math.max(now.getFullYear(), FIRST_YEAR); y >= FIRST_YEAR; y--) out.push(y); return out; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── period (same behaviour as Performance Overview) ──
  const pickQuarters = (list: number[], y = year) => { const q = [...new Set(list)].sort(); setQs(q); setCustom(false); const r = rangeOfQuarters(q, y); setFrom(r[0]); setTo(r[1]); };
  const periodKeys = custom ? new Set(["custom"]) : new Set([...(qs.length === 4 ? ["all"] : []), ...qs.map((q) => `Q${q}`)]);
  const onPeriod = (keys: Set<string>) => {
    const added = [...keys].filter((k) => !periodKeys.has(k)), removed = [...periodKeys].filter((k) => !keys.has(k));
    if (added.includes("custom")) { setCustom(true); return; }
    if (added.includes("all")) { pickQuarters(ALL_Q); return; }
    if (removed.includes("all") && !added.length) { const q = qs.filter((x) => keys.has(`Q${x}`)); pickQuarters(q.length < 4 ? q : [Math.ceil((now.getMonth() + 1) / 3)]); return; }
    const next = [...(custom ? [] : qs).filter((q) => !removed.includes(`Q${q}`)), ...added.filter((k) => k[0] === "Q").map((k) => Number(k[1]))];
    if (next.length) pickQuarters(next);
  };
  const periodText = custom ? "Custom dates" : qs.length === 4 ? "All quarters" : qs.map((q) => `Q${q}`).join(" + ");
  const datePresets = useMemo(() => [
    { name: `Year ${year}`, start: `${year}-01-01`, end: `${year}-12-31` },
    ...ALL_Q.map((q) => { const r = rangeOfQuarters([q], year); return { name: `Q${q} ${year}`, start: r[0], end: r[1] }; }),
  ], [year]);

  // ── who is looking + filter lists ──
  useEffect(() => {
    if (!from || !to || from > to) return;
    axios.get(`${BASE}/context`, { params: { from, to } }).then((r) => setCtx(data<Context>(r))).catch((e) => setError(errText(e, "Could not load your access. Please refresh.")));
  }, [from, to]);
  const options = ctx?.options;
  const subs = useMemo(() => (options?.subDepartments ?? []).filter((s) => dept === "" || String(s.departmentId) === dept), [options, dept]);
  const people = useMemo(() => {
    const ok = new Set(subs.map((s) => s.id)); const m = new Map<number, string>();
    for (const p of options?.people ?? []) if (sub ? String(p.subDepartmentId) === sub : ok.has(p.subDepartmentId)) m.set(p.id, p.name);
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [options, subs, sub]);
  useEffect(() => { if (sub && !subs.some((s) => String(s.id) === sub)) setSub(""); }, [subs, sub]);
  useEffect(() => { if (person && options && !people.some((p) => String(p.id) === person)) setPerson(""); }, [people, person, options]);

  const load = useCallback(() => {
    if (!ctx || !from || !to) return;
    if (from > to) { setError("The start date must be on or before the end date."); return; }
    setLoading(true); setError("");
    const own = isEmployee;
    axios.post(`${BASE}/report`, { from, to, quarters: custom || qs.length === 4 ? null : qs, departmentId: own || dept === "" ? null : Number(dept), subDepartmentId: own || !sub ? null : Number(sub), userId: own ? ctx.viewer.id : person ? Number(person) : null, grain, excludeZero })
      .then((r) => setReport(data<Report>(r)))
      .catch((e) => { setReport(null); setError(errText(e, "Could not load the figures. Please try again.")); })
      .finally(() => setLoading(false));
  }, [ctx, from, to, qs, custom, dept, sub, person, grain, excludeZero, isEmployee]);
  useEffect(() => { load(); }, [load]);
  const switchView = (v: "mine" | "team") => { if (v === view) return; setReport(null); setView(v); };

  const reset = () => { setDept(""); setSub(""); setPerson(""); setGrain("quarter"); setExcludeZero(false); setYear(now.getFullYear()); pickQuarters(ALL_Q, now.getFullYear()); };
  const sel = (v: string) => (v === "" ? new Set<string>(["__all"]) : new Set([v]));
  const val = (k: unknown) => { const v = String(Array.from(k as Set<string>)[0] ?? "__all"); return v === "__all" ? "" : v; };

  // ── whose figures these are ──
  const c = report?.cards;
  const focusId = isEmployee ? ctx?.viewer.id ?? null : person ? Number(person) : null; // one person in view
  const focus = focusId != null ? report?.people.find((p) => p.userId === focusId) : undefined;
  const focusName = isEmployee ? "Your" : focus ? `${focus.name}'s` : person ? `${people.find((p) => String(p.id) === person)?.name ?? "This person"}'s` : null;
  const scopeName = isEmployee ? `${hasTeam ? "Your own" : "Your"} targets and goals` : person ? people.find((p) => String(p.id) === person)?.name : sub ? subs.find((s) => String(s.id) === sub)?.name : dept !== "" ? options?.departments.find((d) => String(d.id) === dept)?.name : options && !options.allCompany ? "You and your team" : "All company";
  const title = isEmployee ? "My PMS Dashboard" : kind === "admin" ? "PMS Overview" : "Team PMS Overview";

  // ── department breakdown (Team PMS Overview): each person counts once in their sub department; a department is
  // the average of its sub departments, like the figures above ──
  const deptRows = useMemo(() => {
    const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null; };
    type Agg = { goal: number | null; target: number | null; score: number | null; people: number };
    const agg = (ps: Person[]): Agg => ({ goal: avg(ps.map((p) => p.pms.goalPct)), target: avg(ps.map((p) => p.pms.targetPct)), score: avg(ps.map((p) => p.pms.score)), people: ps.length });
    const of = (subs: Agg[]): Agg => ({ goal: avg(subs.map((x) => x.goal)), target: avg(subs.map((x) => x.target)), score: avg(subs.map((x) => x.score)), people: subs.reduce((a, x) => a + x.people, 0) });
    const byDept = new Map<string, Map<string, Person[]>>();
    for (const p of report?.people ?? []) {
      const d = p.department.split(", ")[0] || "No Department", sname = p.subDepartment.split(", ")[0] || "—";
      const m = byDept.get(d) ?? new Map<string, Person[]>(); m.set(sname, [...(m.get(sname) ?? []), p]); byDept.set(d, m);
    }
    return [...byDept.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, m]) => {
      const subsList = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, ps]) => ({ name, ...agg(ps) }));
      return { name: d, ...of(subsList), subs: subsList };
    });
  }, [report]);
  const [openDept, setOpenDept] = useState<Set<string>>(new Set());

  const canEdit = (uid: number) => !!report?.editable.includes(uid) && (kind === "admin" || uid !== ctx?.viewer.id);
  const shiftYear = report?.pms.shiftYear ?? year;
  const shiftOf = (uid: number) => report?.shifts[String(uid)] ?? null;
  const openShift = (uid: number, name: string) => { const cur = shiftOf(uid); setShiftFor({ userId: uid, name }); setShiftVal(String(Math.round((cur?.shift ?? 0) * 100))); setShiftWhy(cur?.justification ?? ""); };
  const saveShift = () => {
    if (!shiftFor) return;
    const v = Number(shiftVal);
    if (v !== 0 && !shiftWhy.trim()) { addToast({ title: "Add a justification", description: "HR sees why the weighting was changed.", color: "warning" }); return; }
    setSavingShift(true);
    axios.put(`${BASE}/shift/${shiftFor.userId}`, { year: shiftYear, shift: v / 100, justification: shiftWhy.trim() || null })
      .then(() => { addToast({ title: v ? "Weighting saved" : "Weighting removed", description: `${shiftFor.name}, ${shiftYear}: ${shiftText(v / 100)}`, color: "success" }); setShiftFor(null); load(); })
      .catch((e) => addToast({ title: "Could not save", description: errText(e, "Please try again."), color: "danger" }))
      .finally(() => setSavingShift(false));
  };

  // ── cards: Avg Goal %, Avg Target % and the PMS Score (Model X, worked out on the server) ──
  const m = report?.pms;
  const one = m?.person ?? null;
  const plural = (n: number, w: string) => `${n.toLocaleString("en-IN")} ${w}${n === 1 ? "" : "s"}`;
  const avgLines = (k: "goal" | "target"): string[] => {
    if (!m) return [];
    const metrics = k === "goal" ? (one ? one.goalMetrics : m.goalMetrics) : (one ? one.targetMetrics : m.targetMetrics);
    const entries = k === "goal" ? (one ? one.goalEntries : m.goalEntries) : (one ? one.targetEntries : m.targetEntries);
    const v = k === "goal" ? m.goalPct : m.targetPct;
    if (v == null) return [`No ${k} entries in the selected quarters`];
    return [
      `${plural(metrics, k)} · ${plural(entries, "entry")}`,
      `Each ${k}'s entries are averaged, then the ${k}s are averaged, so every ${k} counts the same. Entries with nothing expected are left out; a repeated entry counts once.`,
      ...(one ? [] : ["Then each person's figure, averaged person → sub department → department → company."]),
      `= ${v.toFixed(2)}%`,
    ];
  };
  const scoreLines = (): string[] => {
    if (!m) return [];
    if (!one) return m.score == null ? ["Nobody has both goal and target figures in these quarters"] : [`Each person's PMS score, averaged person → sub department → department → company (${plural(report?.people.filter((p) => p.pms.score != null).length ?? 0, "person")} with a score)`, `= ${m.score.toFixed(2)}%`];
    const r = one.result;
    if (r.score == null) return [r.reasonCode === "NO_GOAL" ? "No goal figures in these quarters, so there is no PMS score" : r.reasonCode === "NO_TARGET" ? "No target figures in these quarters, so there is no PMS score" : "No goal or target figures in these quarters"];
    const goalLed = (r.goalCredited ?? 0) > (r.targetCredited ?? 0);
    const w = r.goalWeight!, gc = r.goalCredited!, tc = r.targetCredited!;
    return [
      `Goal ${(r.goalPct! * 100).toFixed(2)}% ${goalLed ? ">" : "≤"} Target ${(r.targetPct! * 100).toFixed(2)}% → ${goalLed ? "Goal-led: 70 / 30" : "50 / 50"}${r.managerShift ? `, manager shift ${shiftText(r.managerShift)} → ${weightsText(w)}` : ""}`,
      ...(r.reasonFlags.includes("FLOOR_APPLIED") ? ["Below 5% counts as 5%"] : []), ...(r.reasonFlags.includes("CAP_APPLIED") ? ["Above 150% counts as 150%"] : []),
      `Score = ${gc.toFixed(4)}^${w.toFixed(2)} × ${tc.toFixed(4)}^${(1 - w).toFixed(2)} = ${(r.score * 100).toFixed(2)}%`,
      ...(r.managerShift ? [`Without the manager's shift: ${(r.scoreWithoutShift! * 100).toFixed(2)}%`] : []),
    ];
  };
  const cards = [
    ...(tab !== "targets" ? [{ key: "goal", title: "Avg Goal %", v: m?.goalPct ?? null, meta: m ? `${plural(one ? one.goalMetrics : m.goalMetrics, "goal")}, each counts the same` : "", lines: avgLines("goal"), weighted: false }] : []),
    ...(tab !== "goals" ? [{ key: "target", title: "Avg Target %", v: m?.targetPct ?? null, meta: m ? `${plural(one ? one.targetMetrics : m.targetMetrics, "target")}, each counts the same` : "", lines: avgLines("target"), weighted: false }] : []),
    ...(tab === "all" ? [{ key: "score", title: "PMS Score", v: m?.score ?? null, meta: one?.result.goalWeight != null ? `Goal ${weightsText(one.result.goalWeight)} Target${one.result.managerShift ? " (manager shift)" : ""}` : m && !one ? "PMS Goal + PMS Target" : "", lines: scoreLines(), weighted: true }] : []),
  ];

  // ── the target and goal entries behind the figures (same tables as Target & Goals) ──
  const { tCols, gCols, aCols } = useMemo(() => entryColumns(isEmployee), [isEmployee]);
  const tRows = useMemo(() => newestFirst(report?.targetTable ?? []), [report]);
  const gRows = useMemo(() => newestFirst(report?.goalTable ?? []), [report]);
  const aRows = useMemo(() => newestFirst<EntryRow>([
    ...tRows.map((r): EntryRow => ({ type: "Target", period: r.period, date: r.date, department: r.department, subDepartment: r.subDepartment, associate: r.associate, name: r.targetName, expected: r.expected, achieved: r.achieved, pct: r.pct, frequency: r.frequency, remarks: r.remarks })),
    ...gRows.map((r): EntryRow => ({ type: "Goal", period: r.period, date: r.date, department: r.department, subDepartment: r.subDepartment, associate: r.associate, name: r.goalName, expected: r.expected, achieved: r.achieved, pct: r.pct, frequency: r.frequency, remarks: r.remarks })),
  ]), [tRows, gRows]);
  const downloadExcel = async () => {
    const XLSX = await import("xlsx");
    const sheet = (rows: unknown[][]) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = rows[0]!.map((_, i) => ({ wch: Math.min(50, Math.max(10, ...rows.map((r) => String(r[i] ?? "").length + 2))) })); return ws; };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet([["Period", "Date", "Department", "Sub Department", "Associate", "Goal", "Expected", "Achieved", "% Achieved", "Frequency", "Comments"],
      ...gRows.map((r) => [periodLabel(r.period, grain), r.date, r.department, r.subDepartment, r.associate, r.goalName, r.expected ?? "", r.achieved ?? "", r.pct ?? "", r.frequency ?? "", r.remarks])]), "Goals");
    XLSX.utils.book_append_sheet(wb, sheet([["Period", "Date", "Department", "Sub Department", "Associate", "Target", "Expected", "Achieved", "% Achieved", "Allocated Time", "Time Taken", "Frequency", "Remarks"],
      ...tRows.map((r) => [periodLabel(r.period, grain), r.date, r.department, r.subDepartment, r.associate, r.targetName, r.expected ?? "", r.achieved ?? "", r.pct ?? "", hm(r.allocatedHrs), hm(r.takenHrs), r.frequency ?? "", r.remarks])]), "Targets");
    const slug = String(scopeName ?? "all").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    XLSX.writeFile(wb, `pms-dashboard-${slug}-${from}-to-${to}.xlsx`);
  };

  const showTeam = !isEmployee && focusId == null && (report?.people.length ?? 0) > 0;
  const showGoals = tab !== "targets", showTargets = tab !== "goals";

  return (
    <section className="flex flex-col gap-5">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">{title}</h1>
          <p className="mt-1 text-sm text-ink-500">{scopeName ?? "…"} · {custom || qs.length === 4 ? "" : `${periodText} ${year} · `}{fmtDate(from)} – {fmtDate(to)}{c && c.people > 1 ? ` · ${c.people} people` : ""}</p>
        </div>
        <Button size="sm" variant="bordered" startContent={<Calculator size={15} />} onPress={() => setGuideOpen(true)}>{isEmployee ? "How your score is calculated" : "How the score is calculated"}</Button>
      </div>
      <ScoreGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
      {hasTeam && (
        <Tabs aria-label="Dashboard view" selectedKey={view} onSelectionChange={(k) => switchView(String(k) as "mine" | "team")} color="primary">
          <Tab key="mine" title="My PMS Dashboard" />
          <Tab key="team" title="Team PMS Overview" />
        </Tabs>
      )}

      {/* filters */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Filters</h2>
          <Button size="sm" variant="light" className="ml-auto" onPress={reset}>Reset</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {!isEmployee && (
            <>
              <Select label="Department" size="sm" selectedKeys={sel(dept)} disallowEmptySelection onSelectionChange={(k) => { setDept(val(k)); setSub(""); setPerson(""); }}>
                {[{ id: "__all", name: options && !options.allCompany ? "All my departments" : "All departments" }, ...(options?.departments ?? []).map((d) => ({ id: String(d.id), name: d.name }))].map((d) => <SelectItem key={d.id}>{d.name}</SelectItem>)}
              </Select>
              <Select label="Sub Department" size="sm" selectedKeys={sel(sub)} disallowEmptySelection onSelectionChange={(k) => { setSub(val(k)); setPerson(""); }}>
                {[{ id: "__all", name: "All sub departments" }, ...subs.map((s) => ({ id: String(s.id), name: s.name }))].map((s) => <SelectItem key={s.id}>{s.name}</SelectItem>)}
              </Select>
              <Autocomplete key={`${dept}-${sub}-${people.length}`} label="Associate" size="sm" placeholder="All associates — type a name" selectedKey={person || null} onSelectionChange={(k) => setPerson(k == null ? "" : String(k))} defaultItems={people.map((p) => ({ id: String(p.id), name: p.name }))}>
                {(p: { id: string; name: string }) => <AutocompleteItem key={p.id}>{p.name}</AutocompleteItem>}
              </Autocomplete>
            </>
          )}
          <Select label="Year" size="sm" selectedKeys={new Set([String(year)])} disallowEmptySelection onSelectionChange={(k) => { const y = Number(Array.from(k)[0]); setYear(y); pickQuarters(custom ? ALL_Q : qs, y); }}>
            {years.map((y) => <SelectItem key={String(y)}>{String(y)}</SelectItem>)}
          </Select>
          <Select label="View by" size="sm" selectedKeys={new Set([grain])} disallowEmptySelection onSelectionChange={(k) => setGrain(String(Array.from(k)[0]) as Grain)}>
            <SelectItem key="day">Day</SelectItem><SelectItem key="month">Month</SelectItem><SelectItem key="quarter">Quarter</SelectItem><SelectItem key="year">Year</SelectItem>
          </Select>
          <Select label="Period" size="sm" selectionMode="multiple" selectedKeys={periodKeys} disallowEmptySelection renderValue={() => periodText} onSelectionChange={(k) => onPeriod(new Set(Array.from(k as Set<string>).map(String)))}>
            {PERIODS.map(([k, l]) => <SelectItem key={k}>{l}</SelectItem>)}
          </Select>
          <div className={isEmployee ? "" : "sm:col-span-2"}>
            <DateRangeField fieldLabel="Dates" maxToday={false} presets={datePresets} value={{ start: from, end: to }} onChange={(r) => { setFrom(r.start); setTo(r.end); setCustom(true); }} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Checkbox size="sm" isSelected={excludeZero} onValueChange={setExcludeZero}>Exclude days with no target set (0%)</Checkbox>
          {loading && <span className="flex items-center gap-2 text-xs text-ink-500"><Spinner size="sm" /> Loading…</span>}
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </div>
      </Card>

      {/* All / Goals / Targets */}
      <Tabs aria-label="Show" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as TabKey)}>
        <Tab key="all" title={`All${report ? ` (${(report.targetTable.length + report.goalTable.length).toLocaleString("en-IN")})` : ""}`} />
        <Tab key="goals" title={`Goals${report ? ` (${report.goalTable.length.toLocaleString("en-IN")})` : ""}`} />
        <Tab key="targets" title={`Targets${report ? ` (${report.targetTable.length.toLocaleString("en-IN")})` : ""}`} />
      </Tabs>

      {/* headline cards */}
      <div className={`grid grid-cols-1 gap-3 ${cards.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {cards.map((k) => (
          <Card key={k.key} className={`flex h-full flex-col border-t-[3px] p-5 ${k.weighted ? "border-t-brand-600" : "border-t-ink-900 dark:border-t-white"}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="eyebrow line-clamp-2 min-h-[2.6em] leading-snug">{k.title}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${k.weighted ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-300"}`}>{k.weighted ? "Score" : "Average"}</span>
            </div>
            <p className="mt-2 text-3xl font-extrabold tabular-nums leading-none text-ink-900 dark:text-white">{pct(k.v)}</p>
            <p className="mt-1.5 min-h-[1.25rem] text-xs text-ink-500">{k.meta}</p>
            <Meter v={k.v} weighted={k.weighted} />
            <div className="mt-auto pt-3">
              {k.lines.length > 0 && (
                <CalcToggle id={k.key} open={openCalc} onToggle={toggleCalc}>
                  {k.lines.map((l, i) => <p key={i} className={i === 0 ? "" : "font-semibold text-ink-700 dark:text-ink-200"}>{l}</p>)}
                </CalcToggle>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* why this score (one person): what went well, what held it back, the next step, and what would raise it most */}
      {focusId != null && one && (
        <Card className="border-l-[3px] border-l-brand-600 p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Lightbulb size={16} className="text-brand-600" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Why {focusName === "Your" ? "your" : focusName} score is what it is</h2>
            {one.human.trend && (
              <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${one.human.trend.startsWith("Up") ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : one.human.trend.startsWith("Down") ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" : "bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-300"}`}>{one.human.trend}</span>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {([
              ["What went well", one.human.wentWell, "border-l-emerald-500"],
              ["What held it back", one.human.heldBack, "border-l-amber-500"],
              [focusName === "Your" ? "Your next step" : "Next step", one.human.nextStep, "border-l-brand-600"],
            ] as const).filter(([, text]) => !!text).map(([label, text, tone]) => (
              <div key={label} className={`border border-l-[3px] border-ink-200 bg-white p-3 dark:border-white/10 dark:bg-ink-900 ${tone}`}>
                <p className="eyebrow mb-1">{label}</p>
                <p className="text-sm leading-relaxed text-ink-700 dark:text-ink-200">{text}</p>
              </div>
            ))}
          </div>
          {(one.result.reasonFlags.includes("FLOOR_APPLIED") || one.result.reasonFlags.includes("CAP_APPLIED")) && (
            <p className="mt-3 text-xs text-ink-500">{[one.result.reasonFlags.includes("FLOOR_APPLIED") && "Anything below 5% is counted as 5%.", one.result.reasonFlags.includes("CAP_APPLIED") && "Anything above 150% is counted as 150%."].filter(Boolean).join(" ")}</p>
          )}
          {one.reason.raise.length > 0 && (
            <div className="mt-4">
              <p className="eyebrow mb-1">What would raise it most</p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-700 dark:text-ink-200">{one.reason.raise.map((l) => <li key={l}>{l}</li>)}</ul>
            </div>
          )}
          {shiftOf(focusId) && <p className="mt-3 text-xs text-ink-500">Manager's weighting for {shiftYear}: {shiftText(shiftOf(focusId)!.shift)} · “{shiftOf(focusId)!.justification}”{shiftOf(focusId)!.setBy ? ` (${shiftOf(focusId)!.setBy})` : ""}{one.result.scoreWithoutShift != null && one.result.managerShift ? ` · score without the change: ${(one.result.scoreWithoutShift * 100).toFixed(1)}%` : ""}</p>}
          {canEdit(focusId) && <div className="mt-3"><Button size="sm" variant="bordered" onPress={() => openShift(focusId, focus?.name ?? "This person")}>{shiftOf(focusId) ? "Change weighting" : "Adjust weighting (±5%)"}</Button></div>}
        </Card>
      )}

      {/* hours */}
      {tab === "all" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="bordered" onPress={() => setShowMore((v) => !v)} aria-expanded={showMore}
              endContent={<ChevronDown size={15} className={`transition-transform ${showMore ? "rotate-180" : ""}`} />}>
              {showMore ? "Hide working hours" : "Working hours"}
            </Button>
          </div>
          {showMore && (
            <div className="grid max-w-xl grid-cols-2 gap-3">
              {([["Avg Working Hours", hm(c?.avgWorkingHrs ?? null)], ["Avg Allocated Hours", hm(c?.avgAllocatedHrs ?? null)]] as const).map(([k, v]) => (
                <Card key={k} className="p-4">
                  <p className="eyebrow leading-snug">{k}</p>
                  <p className="mt-2 text-2xl font-extrabold tabular-nums leading-none text-ink-900 dark:text-white">{v}</p>
                  <p className="mt-1 text-[11px] text-ink-500">h:mm per day</p>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* department-wise (Team PMS Overview) */}
      {!isEmployee && focusId == null && tab === "all" && deptRows.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">By department</h2>
            <span className="text-xs text-ink-500">Each person's Avg Goal %, Avg Target % and PMS Score; a sub department is the average of its people and a department the average of its sub departments. Open a department to see its sub departments; "Show only" filters the whole page.</span>
          </div>
          <div className="overflow-x-auto border border-ink-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-800">
                <tr className="text-left">{["Department / sub department", "People", "Avg Goal %", "Avg Target %", "PMS Score", ""].map((h, i) => <th key={h || i} className={`whitespace-nowrap px-3 py-2.5 ${i >= 1 && i <= 4 ? "text-right" : ""}`}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {deptRows.flatMap((d) => {
                  const isOpen = openDept.has(d.name);
                  const deptId = options?.departments.find((x) => x.name === d.name)?.id;
                  const cells = (x: { people: number; goal: number | null; target: number | null; score: number | null }) => (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums">{x.people}</td>
                      <td className="px-3 py-2 text-right"><PctChip v={x.goal} /></td>
                      <td className="px-3 py-2 text-right"><PctChip v={x.target} /></td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{pct(x.score)}</td>
                    </>
                  );
                  return [
                    <tr key={d.name} className="border-t border-ink-100 bg-white dark:border-white/5 dark:bg-ink-900">
                      <td className="px-3 py-2">
                        <button type="button" className="inline-flex items-center gap-1.5 font-semibold text-ink-900 hover:text-brand-600 focus-ring dark:text-white" aria-expanded={isOpen}
                          onClick={() => setOpenDept((s) => { const n = new Set(s); if (n.has(d.name)) n.delete(d.name); else n.add(d.name); return n; })}>
                          <ChevronDown size={14} className={`transition-transform ${isOpen ? "" : "-rotate-90"}`} />{d.name}
                        </button>
                        <span className="ml-2 text-xs text-ink-500">{d.subs.length} sub dept{d.subs.length === 1 ? "" : "s"}</span>
                      </td>
                      {cells(d)}
                      <td className="px-3 py-2 text-right">{deptId != null && dept !== String(deptId) && <button type="button" className="text-xs font-semibold text-brand-600 hover:underline focus-ring" onClick={() => { setDept(String(deptId)); setSub(""); setPerson(""); }}>Show only</button>}</td>
                    </tr>,
                    ...(isOpen ? d.subs.map((s) => {
                      const subId = options?.subDepartments.find((x) => x.name === s.name && (deptId == null || x.departmentId === deptId))?.id;
                      return (
                        <tr key={`${d.name}|${s.name}`} className="border-t border-ink-100 dark:border-white/5">
                          <td className="py-2 pl-10 pr-3 text-ink-700 dark:text-ink-200">{s.name}</td>
                          {cells(s)}
                          <td className="px-3 py-2 text-right">{subId != null && sub !== String(subId) && <button type="button" className="text-xs font-semibold text-brand-600 hover:underline focus-ring" onClick={() => { if (deptId != null) setDept(String(deptId)); setSub(String(subId)); setPerson(""); }}>Show only</button>}</td>
                        </tr>
                      );
                    }) : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* team scores: each person's Model X figures and the manager's yearly weighting */}
      {showTeam && tab === "all" && report && (
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Team scores</h2>
            <span className="text-xs text-ink-500">Each person's own figures for these filters. Weights are set automatically (70 / 30 when Goal is ahead, else 50 / 50); you can move up to 5% for {shiftYear} with a justification. Click a name to see only them.</span>
          </div>
          <div className="max-h-[520px] overflow-auto border border-ink-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-ink-50 dark:bg-ink-800">
                <tr className="text-left">
                  {["Associate", "Sub Department", "Avg Goal %", "Avg Target %", "Weights (goal / target)", `Manager shift ${shiftYear}`, "PMS Score"].map((h, i) => <th key={h} className={`whitespace-nowrap px-3 py-2.5 ${i >= 2 && i <= 3 || i === 6 ? "text-right" : ""}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {report.people.map((p) => {
                  const sh = shiftOf(p.userId);
                  return (
                    <tr key={p.userId} className="border-t border-ink-100 align-middle hover:bg-brand-50/40 dark:border-white/5 dark:hover:bg-white/5">
                      <td className="whitespace-nowrap px-3 py-2"><button type="button" className="font-semibold text-ink-900 hover:text-brand-600 focus-ring dark:text-white" onClick={() => setPerson(String(p.userId))}>{p.name}</button></td>
                      <td className="px-3 py-2 text-ink-600 dark:text-ink-300">{p.subDepartment || "—"}</td>
                      <td className="px-3 py-2 text-right"><PctChip v={p.pms.goalPct} /></td>
                      <td className="px-3 py-2 text-right"><PctChip v={p.pms.targetPct} /></td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-700 dark:text-ink-200">{weightsText(p.pms.goalWeight)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-xs ${sh ? "font-semibold text-brand-700 dark:text-brand-300" : "text-ink-400"}`} title={sh ? `${sh.justification}${sh.setBy ? ` (${sh.setBy})` : ""}` : undefined}>{shiftText(sh?.shift ?? 0)}</span>
                          {canEdit(p.userId) && <button type="button" className="text-xs font-semibold text-brand-600 hover:underline focus-ring" onClick={() => openShift(p.userId, p.name)}>{sh ? "Change" : "Adjust"}</button>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{pct(p.pms.score)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* charts */}
      <div className={`grid grid-cols-1 gap-5 ${tab === "all" ? "xl:grid-cols-3" : ""}`}>
        {showGoals && (
          <Card className="p-5">
            <div className="mb-2 flex items-baseline gap-2"><h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Avg Goal %</h2><span className="text-xs text-ink-500">by {grain}</span></div>
            <BarChart points={(m?.charts ?? []).filter((x) => x.goalPct != null).map((x) => ({ period: x.period, value: x.goalPct! }))} grain={grain} empty="No goals for this selection." />
          </Card>
        )}
        {showTargets && (
          <Card className="p-5">
            <div className="mb-2 flex items-baseline gap-2"><h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">Avg Target %</h2><span className="text-xs text-ink-500">by {grain}</span></div>
            <BarChart points={(m?.charts ?? []).filter((x) => x.targetPct != null).map((x) => ({ period: x.period, value: x.targetPct! }))} grain={grain} empty="No target data for this selection." />
          </Card>
        )}
        {tab === "all" && (
          <Card className="p-5">
            <div className="mb-2 flex items-baseline gap-2"><h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">PMS Score</h2><span className="text-xs text-ink-500">by {grain}</span></div>
            <BarChart points={(m?.charts ?? []).filter((x) => x.score != null).map((x) => ({ period: x.period, value: x.score! }))} grain={grain} empty="Needs both goal and target figures in a period." />
          </Card>
        )}
      </div>

      {/* the entries behind the figures, for the filters above */}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="bordered" onPress={downloadExcel} isDisabled={!aRows.length}>Download Goal + Target Excel</Button>
        <span className="text-xs text-ink-500">{`${tRows.length.toLocaleString("en-IN")} target + ${gRows.length.toLocaleString("en-IN")} goal rows for the filters above (Goals and Targets on separate sheets)`}</span>
      </div>
      {tab === "all" && <DataTable defaultSort={NEWEST} title="Target & goal entries" note={`${aRows.length} rows · newest first`} cols={aCols} rows={aRows} csvName={`target-goals-${from}-to-${to}.csv`} empty="No targets or goals match these filters." />}
      {tab === "goals" && <DataTable defaultSort={NEWEST} title="Goal performance" note={`${gRows.length} rows · newest first`} cols={gCols} rows={gRows} csvName={`goal-performance-${from}-to-${to}.csv`} empty="No goals match these filters." />}
      {tab === "targets" && <DataTable defaultSort={NEWEST} title="Target performance" note={`${tRows.length} rows · newest first`} cols={tCols} rows={tRows} csvName={`target-performance-${from}-to-${to}.csv`} empty="No target entries match these filters." />}

      <Modal isOpen={!!shiftFor} onOpenChange={(o) => { if (!o) setShiftFor(null); }} size="md">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span>Adjust weighting · {shiftFor?.name}</span>
            <span className="text-xs font-normal text-ink-500">Goal counts 70 / Target 30 when Goal is ahead, else 50 / 50. You can move up to 5% between them for {shiftYear}. HR sees the justification.</span>
          </ModalHeader>
          <ModalBody className="gap-3">
            <Select label="Shift" size="sm" selectedKeys={new Set([shiftVal])} disallowEmptySelection onSelectionChange={(k) => setShiftVal(String(Array.from(k)[0]))}>
              {[5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5].map((v) => <SelectItem key={String(v)}>{v === 0 ? "No shift" : v > 0 ? `+${v}% to Goal (from Target)` : `${v}% to Target (from Goal)`}</SelectItem>)}
            </Select>
            <Textarea label={`Justification${shiftVal === "0" ? " (not needed to remove a shift)" : ""}`} size="sm" minRows={3} value={shiftWhy} onValueChange={setShiftWhy} />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setShiftFor(null)}>Cancel</Button>
            <Button color="primary" isLoading={savingShift} onPress={saveShift}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </section>
  );
}

// ── entries: the Target & Goals page ──
const remarksCell = (r: { remarks: string }) => (r.remarks ? <span className="line-clamp-2" title={r.remarks}>{r.remarks}</span> : <span className="text-ink-400">—</span>);
const dayCol = <T extends { date: string }>(): Col<T> => ({ key: "date" as keyof T & string, label: "Date", render: (r) => periodLabel(r.date, "day"), csv: (r) => r.date });
function entryColumns(isEmployee: boolean) {
  const who = <T,>(): Col<T>[] => (isEmployee ? [] : [{ key: "associate" as keyof T & string, label: "Associate" }]);
  const tCols: Col<TargetRow>[] = [
    dayCol<TargetRow>(), ...who<TargetRow>(), { key: "subDepartment", label: "Sub Department" }, { key: "targetName", label: "Target" },
    { key: "expected", label: "Expected", num: true, render: (r) => num(r.expected) }, { key: "achieved", label: "Achieved", num: true, render: (r) => num(r.achieved) },
    { key: "pct", label: "% Achieved", num: true, render: (r) => <PctChip v={r.pct} /> },
    { key: "takenHrs", label: "Time Taken", num: true, render: (r) => hm(r.takenHrs), csv: (r) => hm(r.takenHrs) },
    { key: "frequency", label: "Frequency" }, { key: "remarks", label: "Remarks", render: remarksCell },
  ];
  const gCols: Col<GoalRow>[] = [
    dayCol<GoalRow>(), ...who<GoalRow>(), { key: "subDepartment", label: "Sub Department" }, { key: "goalName", label: "Goal" },
    { key: "expected", label: "Expected", num: true, render: (r) => num(r.expected) }, { key: "achieved", label: "Achieved", num: true, render: (r) => num(r.achieved) },
    { key: "pct", label: "% Achieved", num: true, render: (r) => <PctChip v={r.pct} /> },
    { key: "frequency", label: "Frequency" }, { key: "remarks", label: "Comments", render: remarksCell },
  ];
  const aCols: Col<EntryRow>[] = [
    { key: "type", label: "Type", render: (r) => <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${r.type === "Goal" ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "bg-ink-100 text-ink-700 dark:bg-white/10 dark:text-ink-200"}`}>{r.type}</span>, csv: (r) => r.type },
    dayCol<EntryRow>(), ...who<EntryRow>(), { key: "subDepartment", label: "Sub Department" }, { key: "name", label: "Target / Goal" },
    { key: "expected", label: "Expected", num: true, render: (r) => num(r.expected) }, { key: "achieved", label: "Achieved", num: true, render: (r) => num(r.achieved) },
    { key: "pct", label: "% Achieved", num: true, render: (r) => <PctChip v={r.pct} /> },
    { key: "frequency", label: "Frequency" }, { key: "remarks", label: "Remarks", render: remarksCell },
  ];
  return { tCols, gCols, aCols };
}
/** entries tables open newest first (click a column to sort by it) */
const NEWEST = { k: "date", d: -1 as const };
const newestFirst = <T extends { date: string; associate: string }>(rows: T[]) => [...rows].sort((a, b) => b.date.localeCompare(a.date) || a.associate.localeCompare(b.associate));

/** PMS → Target & Goals: each target and goal entry; everyone adds their own targets, only Admins add goals */
function TargetGoalsList() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState("all");
  const [sub, setSub] = useState("");
  const [person, setPerson] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [ctx, setCtx] = useState<Context | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<"target" | "goal" | null>(null);
  const [from, to] = quarter === "all" ? [`${year}-01-01`, `${year}-12-31`] : rangeOfQuarters([Number(quarter)], year);
  const years = useMemo(() => { const out: number[] = []; for (let y = Math.max(now.getFullYear(), FIRST_YEAR); y >= FIRST_YEAR; y--) out.push(y); return out; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    axios.get(`${BASE}/context`, { params: { from, to } }).then((r) => setCtx(data<Context>(r))).catch((e) => setError(errText(e, "Could not load your access. Please refresh.")));
  }, [from, to]);
  // "My Target & Goals" (own entries, shown first) and, for anyone with a team, "Team Target & Goals"
  // (their team, or everyone for an Admin)
  const hasTeam = (ctx?.viewer.kind ?? "employee") !== "employee";
  const [view, setView] = useState<"mine" | "team">("mine");
  /** true while only the viewer's own entries are shown */
  const isEmployee = !hasTeam || view === "mine";
  /** Goals are added by Admins only */
  const isAdmin = ctx?.viewer.kind === "admin";
  const switchView = (v: "mine" | "team") => { if (v === view) return; setReport(null); setView(v); };
  const subs = ctx?.options.subDepartments ?? [];
  const people = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of ctx?.options.people ?? []) if (!sub || String(p.subDepartmentId) === sub) m.set(p.id, p.name);
    return [...m.entries()].map(([id, name]) => ({ id: String(id), name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [ctx, sub]);

  const load = useCallback(() => {
    if (!ctx) return;
    setLoading(true); setError("");
    axios.post(`${BASE}/report`, { from, to, grain: "month", excludeZero: false, subDepartmentId: isEmployee || !sub ? null : Number(sub), userId: isEmployee ? ctx.viewer.id : person ? Number(person) : null })
      .then((r) => setReport(data<Report>(r)))
      .catch((e) => { setReport(null); setError(errText(e, "Could not load the entries. Please try again.")); })
      .finally(() => setLoading(false));
  }, [ctx, from, to, sub, person, isEmployee]);
  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const targets = useMemo(() => newestFirst((report?.targetTable ?? []).filter((r) => !q || [r.targetName, r.associate, r.subDepartment, r.remarks].some((x) => String(x ?? "").toLowerCase().includes(q)))), [report, q]);
  const goals = useMemo(() => newestFirst((report?.goalTable ?? []).filter((r) => !q || [r.goalName, r.associate, r.subDepartment, r.remarks].some((x) => String(x ?? "").toLowerCase().includes(q)))), [report, q]);
  const all = useMemo(() => newestFirst<EntryRow>([
    ...targets.map((r): EntryRow => ({ type: "Target", period: r.period, date: r.date, department: r.department, subDepartment: r.subDepartment, associate: r.associate, name: r.targetName, expected: r.expected, achieved: r.achieved, pct: r.pct, frequency: r.frequency, remarks: r.remarks })),
    ...goals.map((r): EntryRow => ({ type: "Goal", period: r.period, date: r.date, department: r.department, subDepartment: r.subDepartment, associate: r.associate, name: r.goalName, expected: r.expected, achieved: r.achieved, pct: r.pct, frequency: r.frequency, remarks: r.remarks })),
  ]), [targets, goals]);
  const { tCols, gCols, aCols } = useMemo(() => entryColumns(isEmployee), [isEmployee]);

  const latest = all[0]?.date;
  const stats = [
    { label: "Target entries", value: targets.length.toLocaleString("en-IN"), hint: `${new Set(targets.map((r) => r.targetName)).size} targets`, icon: Target },
    { label: "Goal entries", value: goals.length.toLocaleString("en-IN"), hint: `${new Set(goals.map((r) => r.goalName)).size} goals`, icon: Flag },
    isEmployee
      ? { label: "Sub departments", value: String(new Set(all.map((r) => r.subDepartment)).size), hint: "with entries", icon: Users }
      : { label: "People", value: String(new Set(all.map((r) => r.associate)).size), hint: "with entries", icon: Users },
    { label: "Latest entry", value: latest ? fmtDate(latest) : "—", hint: quarter === "all" ? `in ${year}` : `in Q${quarter} ${year}`, icon: CalendarDays },
  ];

  const downloadExcel = async () => {
    const XLSX = await import("xlsx");
    const sheet = (rows: unknown[][]) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = rows[0]!.map((_, i) => ({ wch: Math.min(50, Math.max(10, ...rows.map((r) => String(r[i] ?? "").length + 2))) })); return ws; };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet([["Date", "Department", "Sub Department", "Associate", "Goal", "Expected", "Achieved", "% Achieved", "Frequency", "Comments"],
      ...goals.map((r) => [r.date, r.department, r.subDepartment, r.associate, r.goalName, r.expected ?? "", r.achieved ?? "", r.pct ?? "", r.frequency ?? "", r.remarks])]), "Goals");
    XLSX.utils.book_append_sheet(wb, sheet([["Date", "Department", "Sub Department", "Associate", "Target", "Expected", "Achieved", "% Achieved", "Time Taken", "Frequency", "Remarks"],
      ...targets.map((r) => [r.date, r.department, r.subDepartment, r.associate, r.targetName, r.expected ?? "", r.achieved ?? "", r.pct ?? "", hm(r.takenHrs), r.frequency ?? "", r.remarks])]), "Targets");
    XLSX.writeFile(wb, `target-goals-${from}-to-${to}.xlsx`);
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">PMS</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">{isEmployee ? "My Target & Goals" : isAdmin ? "Company Target & Goals" : "Team Target & Goals"}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">{isEmployee ? `Your target and goal entries. Add what you achieved against your targets; ${isAdmin ? "as an Admin you also add goals." : "goals are added by an Admin."}` : isAdmin ? "Target and goal entries for everyone. Employees add their targets; you add goals." : "Target and goal entries for your team. Employees add their targets; goals are added by an Admin."} Scores and charts are on the PMS Dashboard.</p>
        </div>
        {ctx && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" color="primary" startContent={<Target size={15} />} onPress={() => setAdding("target")}>Add target</Button>
            {isAdmin && <Button size="sm" variant="bordered" startContent={<Flag size={15} />} onPress={() => setAdding("goal")}>Add goal</Button>}
          </div>
        )}
      </div>

      {hasTeam && (
        <Tabs aria-label="Target & Goals view" selectedKey={view} onSelectionChange={(k) => switchView(String(k) as "mine" | "team")} color="primary">
          <Tab key="mine" title="My Target & Goals" />
          <Tab key="team" title={isAdmin ? "Company Target & Goals" : "Team Target & Goals"} />
        </Tabs>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((k) => (
          <Card key={k.label} className="flex flex-row items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="eyebrow">{k.label}</p>
              <p className="mt-1.5 truncate text-2xl font-extrabold tabular-nums leading-none text-ink-900 dark:text-white">{k.value}</p>
              <p className="mt-1 text-xs text-ink-500">{k.hint}</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><k.icon size={17} /></span>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Tabs aria-label="Show" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as TabKey)}>
            <Tab key="all" title={`All (${all.length.toLocaleString("en-IN")})`} />
            <Tab key="goals" title={`Goals (${goals.length.toLocaleString("en-IN")})`} />
            <Tab key="targets" title={`Targets (${targets.length.toLocaleString("en-IN")})`} />
          </Tabs>
          {loading && <Spinner size="sm" />}
          <Button size="sm" variant="bordered" className="ml-auto" onPress={downloadExcel} isDisabled={!all.length}>Download Excel</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select label="Year" size="sm" selectedKeys={new Set([String(year)])} disallowEmptySelection onSelectionChange={(k) => setYear(Number(Array.from(k)[0]))}>
            {years.map((y) => <SelectItem key={String(y)}>{String(y)}</SelectItem>)}
          </Select>
          <Select label="Quarter" size="sm" selectedKeys={new Set([quarter])} disallowEmptySelection onSelectionChange={(k) => setQuarter(String(Array.from(k)[0]))}>
            {[["all", "Whole year"], ["1", "Q1 (Jan – Mar)"], ["2", "Q2 (Apr – Jun)"], ["3", "Q3 (Jul – Sep)"], ["4", "Q4 (Oct – Dec)"]].map(([k, l]) => <SelectItem key={k}>{l}</SelectItem>)}
          </Select>
          {!isEmployee && (
            <>
              <Select label="Sub Department" size="sm" selectedKeys={new Set([sub || "__all"])} disallowEmptySelection onSelectionChange={(k) => { const v = String(Array.from(k)[0]); setSub(v === "__all" ? "" : v); setPerson(""); }}>
                {[{ id: "__all", name: "All sub departments" }, ...subs.map((x) => ({ id: String(x.id), name: x.name }))].map((x) => <SelectItem key={x.id}>{x.name}</SelectItem>)}
              </Select>
              <Autocomplete key={`${sub}-${people.length}`} label="Associate" size="sm" placeholder="Everyone" selectedKey={person || null} onSelectionChange={(k) => setPerson(k == null ? "" : String(k))} defaultItems={people}>
                {(p: { id: string; name: string }) => <AutocompleteItem key={p.id}>{p.name}</AutocompleteItem>}
              </Autocomplete>
            </>
          )}
          <Input label="Search" size="sm" placeholder={isEmployee ? "Target, goal or remark" : "Name, target, goal or remark"} value={search} onValueChange={setSearch} isClearable onClear={() => setSearch("")} className={isEmployee ? "lg:col-span-3" : ""} />
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </Card>

      {tab === "all" && <DataTable defaultSort={NEWEST} title="All entries" note="targets and goals, newest first" cols={aCols} rows={all} csvName={`target-goals-${from}-to-${to}.csv`} empty="No targets or goals for this period." />}
      {tab === "goals" && <DataTable defaultSort={NEWEST} title="Goals" note="newest first" cols={gCols} rows={goals} csvName={`goals-${from}-to-${to}.csv`} empty={isAdmin ? "No goals for this period." : "No goals for this period yet. Goals are added by an Admin."} />}
      {tab === "targets" && <DataTable defaultSort={NEWEST} title="Targets" note="newest first" cols={tCols} rows={targets} csvName={`targets-${from}-to-${to}.csv`} empty="No target entries for this period. Use Add target to log one." />}

      {adding && <AddEntryModal kind={adding} onClose={() => setAdding(null)} onSaved={(isTarget) => { setAdding(null); load(); if (isTarget) setTimeout(load, 8000); }} />}
    </section>
  );
}

/** Add target (the viewer's own) / Add goal (Admins only, for anyone) */
function AddEntryModal({ kind, onClose, onSaved }: { kind: "target" | "goal"; onClose: () => void; onSaved: (isTarget: boolean) => void }) {
  const [opts, setOpts] = useState<AddOptions | null>(null);
  const [userId, setUserId] = useState("");
  const [itemId, setItemId] = useState("");
  const [workDate, setWorkDate] = useState(todayIso());
  const [expected, setExpected] = useState("");
  const [achieved, setAchieved] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { axios.get(`${BASE}/add-options`).then((r) => setOpts(data<AddOptions>(r))).catch((e) => setErr(errText(e, "Could not load the list."))); }, []);

  const isTarget = kind === "target";
  const personSubs = useMemo(() => new Set(opts?.people.find((p) => String(p.id) === userId)?.subDepartmentIds ?? []), [opts, userId]);
  const items = useMemo(() => (isTarget ? opts?.targets ?? [] : (opts?.goals ?? []).filter((g) => personSubs.has(g.subDepartmentId))), [opts, isTarget, personSubs]);
  const item = items.find((i) => String(i.id) === itemId);
  useEffect(() => { if (itemId && !item) setItemId(""); }, [item, itemId]);
  const pick = (id: string) => { setItemId(id); const it = items.find((i) => String(i.id) === id); if (it?.unit != null && expected === "") setExpected(String(it.unit)); };

  const ready = itemId && workDate && expected !== "" && achieved !== "" && (isTarget || userId) && Number(expected) >= 0 && Number(achieved) >= 0;
  const save = () => {
    if (!ready) return;
    setBusy(true); setErr("");
    const body = isTarget
      ? { targetId: Number(itemId), workDate, expected: Number(expected), achieved: Number(achieved), remarks: note || null }
      : { userId: Number(userId), goalId: Number(itemId), workDate, expected: Number(expected), achieved: Number(achieved), comment: note || null };
    axios.post(`${BASE}/${kind}`, body)
      .then(() => { addToast({ title: isTarget ? "Target saved" : "Goal saved", description: isTarget ? "The figures refresh in a few seconds." : undefined, color: "success" }); onSaved(isTarget); })
      .catch((e) => setErr(errText(e, "Could not save. Please check the fields and try again.")))
      .finally(() => setBusy(false));
  };

  return (
    <Modal isOpen onOpenChange={(o) => { if (!o) onClose(); }} size="lg">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="flex items-center gap-2">{isTarget ? <Target size={18} /> : <Flag size={18} />}{isTarget ? "Add target" : "Add goal"}</span>
          <span className="text-xs font-normal text-ink-500">{isTarget ? "Log what you achieved against one of your targets. It counts in your target % like a Daily Activity entry." : "Log a goal result for an employee (Admins only). Adding the same goal for the same person and date replaces the earlier value."}</span>
        </ModalHeader>
        <ModalBody className="gap-3">
          {!opts && !err && <span className="flex items-center gap-2 text-sm text-ink-500"><Spinner size="sm" /> Loading…</span>}
          {opts && !isTarget && (
            <Autocomplete label="Associate" size="sm" isRequired selectedKey={userId || null} onSelectionChange={(k) => setUserId(k == null ? "" : String(k))} defaultItems={opts.people.map((p) => ({ id: String(p.id), name: p.name }))}>
              {(p: { id: string; name: string }) => <AutocompleteItem key={p.id}>{p.name}</AutocompleteItem>}
            </Autocomplete>
          )}
          {opts && (
            <Select label={isTarget ? "Target" : "Goal"} size="sm" isRequired isDisabled={!isTarget && !userId} selectedKeys={itemId ? new Set([itemId]) : new Set<string>()} onSelectionChange={(k) => pick(String(Array.from(k)[0] ?? ""))}
              description={!items.length ? (isTarget ? "No active targets for your sub departments. Ask your Admin to add them in Department Management." : userId ? "No active goals for this person's sub departments." : "Pick an associate first.") : item ? `${item.subDepartment}${item.frequency ? ` · ${item.frequency}` : ""}` : undefined}>
              {items.map((i) => <SelectItem key={String(i.id)} textValue={i.name}>{i.name}<span className="ml-2 text-xs text-ink-400">{i.subDepartment}</span></SelectItem>)}
            </Select>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input type="date" label="Date" size="sm" isRequired value={workDate} max={todayIso()} onValueChange={setWorkDate} />
            <Input type="number" label="Expected" size="sm" isRequired min={0} value={expected} onValueChange={setExpected} />
            <Input type="number" label="Achieved" size="sm" isRequired min={0} value={achieved} onValueChange={setAchieved} />
          </div>
          {expected !== "" && achieved !== "" && Number(expected) > 0 && <p className="text-xs text-ink-500">% achieved: <b className="text-ink-900 dark:text-white">{((Number(achieved) * 100) / Number(expected)).toFixed(2)}%</b></p>}
          <Textarea label={isTarget ? "Remarks" : "Comment"} size="sm" minRows={2} value={note} onValueChange={setNote} />
          {err && <p className="text-sm text-rose-600">{err}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>Cancel</Button>
          <Button color="primary" startContent={<Plus size={15} />} isDisabled={!ready} isLoading={busy} onPress={save}>{isTarget ? "Save target" : "Save goal"}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function TargetGoals() { return <TargetGoalsList />; }
export function PmsDashboard() { return <PmsDashboardView />; }
