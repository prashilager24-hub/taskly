import type { LucideIcon } from "lucide-react"
import type { Stat } from "@/peoplehub/blocks/page"

/*
 * A module screen is described by data, not hand-built markup.
 * When the backend arrives, `rows` becomes an API call and the screen stays the same.
 */

export type ColumnType = "text" | "person" | "status" | "currency" | "progress" | "number" | "muted" | "rating" | "date"

export type Column = {
  key: string
  label: string
  type?: ColumnType
  /** hide on small screens to keep tables readable on mobile */
  minor?: boolean
  align?: "left" | "right"
}

export type FieldType = "text" | "number" | "date" | "select" | "textarea" | "person" | "file" | "email"

export type Field = {
  name: string
  label: string
  type: FieldType
  options?: string[]
  placeholder?: string
  required?: boolean
  /** span both columns of the form grid */
  full?: boolean
  hint?: string
}

export type FormConfig = {
  title: string
  description?: string
  submitLabel?: string
  fields: Field[]
  /** status given to the new row */
  status?: string
  success?: string
}

export type Row = { id: string } & Record<string, unknown>

export type Action = {
  label: string
  icon?: LucideIcon
  form?: FormConfig
  /** who sees the action; default both */
  role?: "admin" | "employee"
  /** toast text for actions without a form */
  toast?: string
}

export type ModuleConfig = {
  title: string
  description: string
  eyebrow?: string
  stats?: Stat[]
  actions?: Action[]
  /** Employee view overrides. scope "self" shows only the signed-in user's rows. */
  employee?: { title?: string; description?: string; stats?: Stat[]; scope?: "self" | "all" }
  table: {
    title: string
    description?: string
    columns: Column[]
    rows: Row[]
    /** quick-filter tabs on a column, e.g. status */
    tabsOn?: string
    /** dropdown filters on columns */
    filters?: { key: string; label: string }[]
    /** extra fields shown in the row's detail drawer */
    details?: { key: string; label: string; type?: ColumnType }[]
  }
  /** admins can approve / reject rows whose status is pending */
  approvals?: boolean
  /** small content block rendered between stats and table */
  aside?: { title: string; items: { label: string; value: string; hint?: string; tone?: "brand" | "success" | "warning" | "danger"; pct?: number }[] }
}
