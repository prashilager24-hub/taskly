import { Star } from "lucide-react";
import { inr, num } from "@/peoplehub/lib/format";
import type { ColumnType } from "@/peoplehub/modules/types";
import type { Person } from "@/peoplehub/mocks/people";
import { Meter } from "./page";
import { PersonCell } from "./person-cell";
import { StatusBadge } from "./status-badge";

export function isPerson(v: unknown): v is Person {
  return !!v && typeof v === "object" && "name" in v && "designation" in v;
}

/** Renders one value according to its column type. Shared by tables and detail drawers. */
export function Cell({ value, type = "text" }: { value: unknown; type?: ColumnType }) {
  if (value === undefined || value === null || value === "") return <span className="text-ink-400">—</span>;
  switch (type) {
    case "person":
      return isPerson(value) ? <PersonCell person={value} /> : <span>{String(value)}</span>;
    case "status":
      return <StatusBadge status={String(value)} />;
    case "currency":
      return <span className="font-semibold tabular-nums">{inr(Number(value))}</span>;
    case "number":
      return <span className="tabular-nums">{num(Number(value))}</span>;
    case "progress": {
      const v = Number(value);
      return (
        <div className="flex min-w-28 items-center gap-2">
          <Meter value={v} tone={v >= 80 ? "success" : v >= 50 ? "brand" : "warning"} />
          <span className="w-9 text-right text-xs tabular-nums text-ink-500">{v}%</span>
        </div>
      );
    }
    case "rating": {
      const v = Number(value);
      return (
        <span className="inline-flex items-center gap-1 font-semibold">
          <Star className="size-3.5 fill-amber-400 text-amber-400" />
          <span className="tabular-nums">{v.toFixed(1)}</span>
        </span>
      );
    }
    case "muted":
    case "date":
      return <span className="whitespace-nowrap text-ink-500 dark:text-ink-400">{String(value)}</span>;
    default:
      return isPerson(value) ? <span>{value.name}</span> : <span>{String(value)}</span>;
  }
}

export function plain(value: unknown): string {
  if (isPerson(value)) return value.name;
  return value === undefined || value === null ? "" : String(value);
}
