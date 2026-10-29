/**
 * Shared page furniture so every module has the same header, summary strip and table panel.
 * PageTitle = heading + one-line description; SummaryBar = row of label/value stats;
 * Panel = bordered surface with an optional title row.
 */
import type { ReactNode } from "react";
import { cn } from "@heroui/theme";

import { title as titleStyle } from "@/components/primitives";

export function PageTitle({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
    return (
        <div className="min-w-0">
            <h1 className={titleStyle({ size: "20px" })}>{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>}
        </div>
    );
}

/** Title on the left, filters / actions on the right; wraps cleanly on narrow screens */
export function PageHeader({ title, subtitle, children, className }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode; className?: string }) {
    return (
        <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
            <PageTitle title={title} subtitle={subtitle} />
            {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
        </div>
    );
}

export interface SummaryItem { label: string; value: ReactNode; hint?: string }

export function SummaryBar({ items, className }: { items: SummaryItem[]; className?: string }) {
    return (
        <div className={cn("mb-6 grid grid-cols-1 border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900 sm:grid-cols-2 lg:grid-cols-4", className)}>
            {items.map((it, i) => (
                <div key={it.label} className={cn("px-5 py-4", i > 0 && "border-t border-ink-200 dark:border-white/10 sm:border-l sm:border-t-0")}>
                    <p className="eyebrow">{it.label}</p>
                    <p className="mt-1.5 text-2xl font-bold leading-none text-ink-900 dark:text-white">{it.value}</p>
                    {it.hint && <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">{it.hint}</p>}
                </div>
            ))}
        </div>
    );
}

export function Panel({ title, actions, children, className, flush }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
    return (
        <section className={cn("border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900", className)}>
            {(title || actions) && (
                <div className="flex items-center justify-between gap-3 border-b border-ink-200 px-5 py-3.5 dark:border-white/10">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900 dark:text-white">{title}</h2>
                    {actions}
                </div>
            )}
            <div className={flush ? "" : "p-5"}>{children}</div>
        </section>
    );
}

/** Compact segmented switch (2–4 options) for views that replace each other */
export function Segmented<T extends string>({ value, onChange, options, label, size = "md" }: { value: T; onChange: (v: T) => void; options: { key: T; label: ReactNode }[]; label: string; size?: "sm" | "md" }) {
    return (
        <div role="group" aria-label={label} className="inline-flex border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900">
            {options.map((o) => (
                <button
                    key={o.key}
                    type="button"
                    aria-pressed={value === o.key}
                    onClick={() => onChange(o.key)}
                    className={cn(
                        "px-4 text-xs font-bold uppercase tracking-wide transition-colors focus-ring",
                        size === "sm" ? "h-8" : "h-10",
                        value === o.key ? "bg-brand-600 text-white" : "text-ink-600 hover:text-brand-600 dark:text-ink-300",
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
