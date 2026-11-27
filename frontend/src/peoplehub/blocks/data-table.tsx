import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Download, Inbox, Search, Upload, X, ChevronDown, Check } from "lucide-react";
import { Button, NativeSelect, cn, toast } from "@/peoplehub/ui";
import type { Column, Row } from "@/peoplehub/modules/types";
import { Cell, plain } from "./cell";
import { EmptyState } from "./page";

const PAGE = 8;

// ── Column-picker modal ───────────────────────────────────────────────────────
function ColumnPicker({ columns, selected, onConfirm, onCancel }: {
  columns: Column[];
  selected: Set<string>;
  onConfirm: (s: Set<string>) => void;
  onCancel: () => void;
}) {
  const [local, setLocal] = useState(new Set(selected));
  const toggle = (k: string) => setLocal(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10 rounded-xl shadow-2xl w-80 p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-ink-900 dark:text-white mb-1">Select Columns</h3>
        <p className="text-xs text-ink-400 mb-4">Choose which columns to include in the export.</p>
        <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
          {columns.map(c => (
            <label key={c.key} className="flex items-center gap-3 px-2 py-2 rounded hover:bg-ink-50 dark:hover:bg-white/[0.04] cursor-pointer">
              <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                local.has(c.key) ? "bg-brand-600 border-brand-600" : "border-ink-300 dark:border-white/20")}>
                {local.has(c.key) && <Check className="size-3 text-white" />}
              </span>
              <input type="checkbox" className="sr-only" checked={local.has(c.key)} onChange={() => toggle(c.key)} />
              <span className="text-sm text-ink-700 dark:text-ink-200">{c.label}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={() => onConfirm(local)} disabled={local.size === 0}>
            Export {local.size} column{local.size !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Import progress toast ─────────────────────────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map(line => {
    const vals: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"' && !inQ) { inQ = true; continue; }
      if (ch === '"' && inQ) { inQ = false; continue; }
      if (ch === "," && !inQ) { vals.push(cur); cur = ""; continue; }
      cur += ch;
    }
    vals.push(cur);
    return Object.fromEntries(header.map((h, i) => [h, (vals[i] ?? "").trim()]));
  });
}

export function DataTable({ title, description, columns, rows, tabsOn, filters = [], onRowClick, rowButton, exportExtras = [], onImport, searchExtras = [] }: {
  title: string; description?: string; columns: Column[]; rows: Row[]; tabsOn?: string; filters?: { key: string; label: string }[]; onRowClick?: (row: Row) => void; rowButton?: { label: string; onClick: (row: Row) => void };
  exportExtras?: { key: string; label: string }[];
  onImport?: (parsedRows: Record<string, string>[]) => Promise<void>;
  searchExtras?: string[];
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All");
  const [active, setActive] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    function close(e: MouseEvent) { if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [exportOpen]);

  const tabs = useMemo(() => (tabsOn ? ["All", ...Array.from(new Set(rows.map((r) => plain(r[tabsOn]))))] : []), [rows, tabsOn]);
  const options = useMemo(
    () => Object.fromEntries(filters.map((f) => [f.key, Array.from(new Set(rows.map((r) => plain(r[f.key])))).sort()])),
    [rows, filters],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (tabsOn && tab !== "All" && plain(r[tabsOn]) !== tab) return false;
      for (const [k, v] of Object.entries(active)) if (v && plain(r[k]) !== v) return false;
      if (!q) return true;
      return columns.some((c) => plain(r[c.key]).toLowerCase().includes(q))
        || searchExtras.some((k) => plain(r[k]).toLowerCase().includes(q));
    });
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      const numeric = col && ["currency", "number", "progress", "rating"].includes(col.type ?? "");
      out = [...out].sort((a, b) => {
        const x = plain(a[sort.key]), y = plain(b[sort.key]);
        return (numeric ? Number(x) - Number(y) : x.localeCompare(y)) * sort.dir;
      });
    }
    return out;
  }, [rows, query, tab, active, sort, columns, tabsOn]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE, current * PAGE + PAGE);
  const hasFilters = query || Object.values(active).some(Boolean) || tab !== "All";

  function doExport(keys?: Set<string>) {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const exportCols = keys ? columns.filter(c => keys.has(c.key)) : columns;
    const extraCols = exportExtras;
    const header = [...exportCols.map(c => esc(c.label)), ...extraCols.map(c => esc(c.label))].join(",");
    const dataRows = filtered.map(r => [
      ...exportCols.map(c => esc(plain(r[c.key]))),
      ...extraCols.map(c => esc(plain(r[c.key] ?? ""))),
    ].join(","));
    const csv = "﻿" + [header, ...dataRows].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${title.toLowerCase().replace(/\W+/g, "-")}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePickerConfirm(s: Set<string>) {
    setPickerOpen(false);
    doExport(s);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onImport) return;
    e.target.value = "";
    const text = await file.text();
    const parsed = parseCsv(text);
    if (!parsed.length) { toast.error("Could not parse CSV — no rows found."); return; }
    setImporting(true);
    try {
      await onImport(parsed);
      toast.success(`Import complete — ${parsed.length} rows processed.`);
    } catch {
      toast.error("Import failed. Check the CSV format and try again.");
    } finally {
      setImporting(false);
    }
  }

  const toggleSort = (key: string) => setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));

  return (
    <section className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
      <header className="flex flex-col gap-3 border-b border-ink-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between dark:border-white/10">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{description}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Search…" className="input-base pl-9" aria-label={`Search ${title}`} />
          </div>
          {filters.map((f) => (
            <NativeSelect key={f.key} aria-label={f.label} className="sm:w-44" value={active[f.key] ?? ""}
              onChange={(e) => { setActive((a) => ({ ...a, [f.key]: e.target.value })); setPage(0); }}>
              <option value="">All {f.label.toLowerCase()}</option>
              {options[f.key].map((o) => <option key={o}>{o}</option>)}
            </NativeSelect>
          ))}
          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <Button variant="outline" onClick={() => setExportOpen(o => !o)}>
              <Download /> Export <ChevronDown className="size-3 opacity-60" />
            </Button>
            {exportOpen && (
              <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 shadow-xl py-1">
                <button className="w-full px-4 py-2.5 text-left text-sm text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-white/[0.05]"
                  onClick={() => { setExportOpen(false); doExport(); }}>
                  All columns
                </button>
                <button className="w-full px-4 py-2.5 text-left text-sm text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-white/[0.05]"
                  onClick={() => { setExportOpen(false); setPickerOpen(true); }}>
                  Select columns…
                </button>
              </div>
            )}
          </div>
          {/* Import button */}
          {onImport && (
            <>
              <input ref={importRef} type="file" accept=".csv" className="sr-only" onChange={handleImport} />
              <Button variant="outline" onClick={() => importRef.current?.click()} disabled={importing}>
                <Upload /> {importing ? "Importing…" : "Import"}
              </Button>
            </>
          )}
        </div>
      </header>

      {tabs.length > 2 && (
        <div className="flex gap-1 overflow-x-auto border-b border-ink-200 px-3 dark:border-white/10" role="tablist">
          {tabs.map((t) => {
            const count = t === "All" ? rows.length : rows.filter((r) => plain(r[tabsOn!]) === t).length;
            return (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setPage(0); }}
                className={cn("-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors focus-ring",
                  tab === t ? "border-brand-600 text-ink-900 dark:text-white" : "border-transparent text-ink-500 hover:text-ink-900 dark:hover:text-white")}>
                {t}
                <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] tabular-nums", tab === t ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "bg-ink-100 dark:bg-white/10")}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState icon={Inbox} title="No records found"
          description={hasFilters ? "Try a different search or clear the filters." : "Records will appear here once they're added."}
          action={hasFilters ? <Button variant="outline" onClick={() => { setQuery(""); setActive({}); setTab("All"); }}><X /> Clear filters</Button> : undefined} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 dark:bg-white/[0.03]">
                {columns.map((c) => (
                  <th key={c.key} className={cn("h-10 px-5 text-left", c.minor && "hidden md:table-cell", c.align === "right" && "text-right")}>
                    <button type="button" className="inline-flex items-center gap-1 uppercase hover:text-ink-900 dark:hover:text-white" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      {sort?.key === c.key ? (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ChevronsUpDown className="size-3 opacity-40" />}
                    </button>
                  </th>
                ))}
                {rowButton && <th className="w-24" />}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} onClick={() => onRowClick?.(r)} tabIndex={onRowClick ? 0 : undefined} onKeyDown={(e) => e.key === "Enter" && onRowClick?.(r)}
                  className={cn("border-t border-ink-100 transition-colors hover:bg-ink-50 dark:border-white/5 dark:hover:bg-white/[0.03]", onRowClick && "cursor-pointer focus-ring")}>
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-5 py-3 text-ink-700 dark:text-ink-200", c.minor && "hidden md:table-cell", c.align === "right" && "text-right")}>
                      <Cell value={r[c.key]} type={c.type} />
                    </td>
                  ))}
                  {rowButton && (
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => rowButton.onClick(r)}
                        className="px-3 py-1 text-xs font-semibold rounded border border-ink-200 dark:border-white/10 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-white/[0.06] transition-colors">
                        {rowButton.label}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="flex items-center justify-between gap-3 border-t border-ink-200 px-5 py-3 text-xs text-ink-500 dark:border-white/10">
        <span className="font-semibold tabular-nums text-ink-700 dark:text-ink-200">
          {filtered.length === 0 ? "0 results" : `Showing ${current * PAGE + 1}–${Math.min(filtered.length, (current + 1) * PAGE)} of ${filtered.length}`}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page"><ChevronLeft /></Button>
          <span className="px-2 tabular-nums">{current + 1} / {pages}</span>
          <Button variant="outline" size="icon-sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page"><ChevronRight /></Button>
        </div>
      </footer>

      {pickerOpen && (
        <ColumnPicker
          columns={columns}
          selected={new Set(columns.map(c => c.key))}
          onConfirm={handlePickerConfirm}
          onCancel={() => setPickerOpen(false)}
        />
      )}
    </section>
  );
}
