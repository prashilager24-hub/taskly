import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Download, Inbox, Search, X } from "lucide-react";
import { Button, NativeSelect, cn } from "@/peoplehub/ui";
import type { Column, Row } from "@/peoplehub/modules/types";
import { Cell, plain } from "./cell";
import { EmptyState } from "./page";

const PAGE = 8;

export function DataTable({ title, description, columns, rows, tabsOn, filters = [], onRowClick }: {
  title: string; description?: string; columns: Column[]; rows: Row[]; tabsOn?: string; filters?: { key: string; label: string }[]; onRowClick?: (row: Row) => void;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All");
  const [active, setActive] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

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
      return columns.some((c) => plain(r[c.key]).toLowerCase().includes(q));
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

  function exportCsv() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = "﻿" + [columns.map((c) => esc(c.label)).join(","), ...filtered.map((r) => columns.map((c) => esc(plain(r[c.key]))).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${title.toLowerCase().replace(/\W+/g, "-")}.csv` });
    a.click();
    URL.revokeObjectURL(url);
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
          <Button variant="outline" onClick={exportCsv}><Download /> Export</Button>
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
    </section>
  );
}
