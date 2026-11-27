import { useMemo, useState } from "react";
import { Button, toast } from "@/peoplehub/ui";
import { DataTable } from "@/peoplehub/blocks/data-table";
import { DetailSheet } from "@/peoplehub/blocks/detail-sheet";
import { FormDialog } from "@/peoplehub/blocks/form-dialog";
import { Meter, PageHeader, Panel, StatGrid } from "@/peoplehub/blocks/page";
import { isPerson } from "@/peoplehub/blocks/cell";
import { useRole } from "@/peoplehub/lib/role";
import { person } from "@/peoplehub/mocks/people";
import { MODULES, type ModuleId } from "@/peoplehub/modules/registry";
import type { Action, Row } from "@/peoplehub/modules/types";

/** Renders any data-driven People Hub screen from the registry (sample data, kept in this browser session only). */
export function ModulePage({ id }: { id: ModuleId }) {
  const config = MODULES[id];
  const { role, user } = useRole();
  const [added, setAdded] = useState<Row[]>([]);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [openForm, setOpenForm] = useState<Action | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);

  const isEmployee = role === "employee";
  const emp = config.employee;
  const selfScope = isEmployee && emp?.scope === "self";

  const rows = useMemo(() => {
    const base = [...added, ...config.table.rows].map((r) => (decisions[r.id] ? { ...r, status: decisions[r.id] } : r));
    return selfScope ? base.filter((r) => Object.values(r).some((v) => isPerson(v) && v.id === user.id)) : base;
  }, [added, config.table.rows, decisions, selfScope, user.id]);

  const actions = (config.actions ?? []).filter((a) => !a.role || a.role === role);
  const stats = isEmployee && emp?.stats ? emp.stats : config.stats;

  function submit(action: Action, values: Record<string, string | File>) {
    const row: Row = { id: `NEW-${String(added.length + 1).padStart(3, "0")}`, status: action.form?.status ?? "Pending" };
    for (const f of action.form?.fields ?? []) { const v = values[f.name]; const s = v instanceof File ? v.name : String(v ?? ""); row[f.name] = f.type === "person" ? person(s) : f.type === "number" && s ? Number(s) : s; }
    // Employees submit for themselves
    for (const c of config.table.columns) if (c.type === "person" && !row[c.key]) row[c.key] = user;
    setAdded((a) => [row, ...a]);
    toast.success(action.form?.success ?? "Saved successfully", { description: "Demo mode: stored in this browser session only." });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={config.eyebrow}
        title={(isEmployee && emp?.title) || config.title}
        description={(isEmployee && emp?.description) || config.description}
        actions={actions.map((a, i) => (
          <Button key={a.label} variant={i === actions.length - 1 ? "default" : "outline"}
            onClick={() => (a.form ? setOpenForm(a) : toast.success(a.toast ?? `${a.label}: done`, { description: "Demo action" }))}>
            {a.icon && <a.icon />}
            {a.label}
          </Button>
        ))}
      />

      {stats && <StatGrid stats={stats} />}

      {config.aside && (
        <Panel title={config.aside.title}>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {config.aside.items.map((it) => (
              <div key={it.label} className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{it.label}</span>
                  <span className="text-sm font-bold tabular-nums">{it.value}</span>
                </div>
                {it.pct !== undefined && <Meter value={it.pct} tone={it.tone} />}
                {it.hint && <p className="text-xs text-ink-500">{it.hint}</p>}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <DataTable key={`${id}-${role}`} title={config.table.title} description={config.table.description} columns={config.table.columns} rows={rows}
        tabsOn={config.table.tabsOn} filters={isEmployee ? [] : config.table.filters} onRowClick={setSelected} />

      {openForm?.form && <FormDialog config={openForm.form} open onOpenChange={(o) => !o && setOpenForm(null)} onSubmit={(v) => submit(openForm, v)} />}

      <DetailSheet
        row={selected}
        title={config.title}
        fields={[...config.table.columns, ...(config.table.details ?? [])]}
        onClose={() => setSelected(null)}
        onDecision={
          config.approvals && !isEmployee
            ? (row, status) => {
                setDecisions((d) => ({ ...d, [row.id]: status }));
                setSelected({ ...row, status });
                toast[status === "Approved" ? "success" : "error"](`Request ${status.toLowerCase()}`, { description: `${row.id} has been ${status.toLowerCase()}. The employee will be notified.` });
              }
            : undefined
        }
      />
    </div>
  );
}
