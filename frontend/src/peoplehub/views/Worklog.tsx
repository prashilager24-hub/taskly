import { CalendarClock, Clock3, ListChecks, PauseCircle, Timer } from "lucide-react"
import { PageHeader } from "@/peoplehub/blocks/page"
import { StatusBadge } from "@/peoplehub/blocks/status-badge"
import { LinkButton, hubPath } from "@/peoplehub/ui"

export function Worklog() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="PMS"
        title="Worklog"
        description="Daily time and task logging against projects."
        actions={<StatusBadge status="On Hold" />}
      />
      <div className="relative overflow-hidden rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900">
        {/* Greyed preview of the planned screen */}
        <div aria-hidden className="pointer-events-none grid gap-4 p-6 opacity-40 grayscale select-none sm:grid-cols-3">
          {[ListChecks, Timer, CalendarClock].map((I, i) => (
            <div key={i} className="rounded-xl border border-ink-200 dark:border-white/10 p-5">
              <I className="size-5 text-ink-500 dark:text-ink-400" />
              <div className="mt-4 h-6 w-20 rounded bg-ink-100 dark:bg-white/10" />
              <div className="mt-2 h-3 w-32 rounded bg-ink-100 dark:bg-white/10" />
            </div>
          ))}
          <div className="rounded-xl border border-ink-200 dark:border-white/10 p-5 sm:col-span-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-ink-200 dark:border-white/10 py-3 last:border-0">
                <div className="size-8 rounded-full bg-ink-100 dark:bg-white/10" />
                <div className="h-3 flex-1 rounded bg-ink-100 dark:bg-white/10" />
                <div className="h-3 w-16 rounded bg-ink-100 dark:bg-white/10" />
              </div>
            ))}
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-black/40 p-6 backdrop-blur-[2px]">
          <div className="max-w-md rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 p-6 text-center shadow-lg">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-ink-400">
              <PauseCircle className="size-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">This module is on hold</h2>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              Worklog is parked in the current roadmap. It stays visible (greyed out) so the full product scope is clear, and will be designed in detail once it&apos;s prioritised.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <LinkButton to={hubPath("/taskly/goals")}>
                <Clock3 /> Go to Target & Goals
              </LinkButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
