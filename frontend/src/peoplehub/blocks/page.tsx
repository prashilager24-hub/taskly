import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/peoplehub/ui";

/*
 * Layout + typography primitives for every People Hub screen, in the TapMind style:
 * flat bordered surfaces, uppercase eyebrow labels, bold titles, tabular numbers.
 */

export function PageHeader({ title, description, eyebrow, actions }: { title: string; description?: string; eyebrow?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow && <p className="eyebrow text-brand-600 dark:text-brand-400">{eyebrow}</p>}
        <h1 className="text-2xl font-black uppercase tracking-title text-ink-900 dark:text-white">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-ink-500 dark:text-ink-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, action, children, className, bodyClassName }: {
  title?: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cn("border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-ink-200 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export type Stat = {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  /** whether "up" is good (default) or bad, e.g. attrition */
  upIsGood?: boolean;
  hint?: string;
  icon?: LucideIcon;
};

export function StatCard({ label, value, delta, trend, upIsGood = true, hint, icon: Icon }: Stat) {
  const good = trend ? (trend === "up") === upIsGood : true;
  return (
    <div className="border border-t-[3px] border-ink-200 border-t-brand-600 bg-white p-5 dark:border-white/10 dark:border-t-brand-600 dark:bg-ink-900">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-ink-900 dark:text-white">{value}</p>
      {(delta || hint) && (
        <p className="mt-1 flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
          {delta && (
            <span className={cn("inline-flex items-center gap-0.5 font-semibold", good ? "text-emerald-600" : "text-rose-600")}>
              {trend === "down" ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
              {delta}
            </span>
          )}
          {hint}
        </p>
      )}
    </div>
  );
}

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((s) => <StatCard key={s.label} {...s} />)}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-ink-100 text-ink-500 dark:bg-white/10">
        <Icon className="size-5" />
      </span>
      <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Meter({ value, tone = "brand", className }: { value: number; tone?: "brand" | "success" | "warning" | "danger"; className?: string }) {
  const bar = { brand: "bg-brand-600", success: "bg-emerald-600", warning: "bg-amber-500", danger: "bg-rose-600" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-white/10", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export { NativeSelect } from "@/peoplehub/ui";
