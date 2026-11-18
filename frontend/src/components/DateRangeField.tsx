import type React from "react";
import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { parseDate, today, getLocalTimeZone, type CalendarDate, type DateValue } from "@internationalized/date";

import { Button, Popover, PopoverContent, PopoverTrigger, RangeCalendar } from "@/components/ui";

/**
 * Date range picker: one button showing the range, a popover with quick presets and a two-month
 * calendar. Values are ISO "YYYY-MM-DD" strings so callers can send them straight to the API.
 */
export interface IsoRange { start: string; end: string }

const tz = getLocalTimeZone();
const iso = (d: DateValue) => d.toString();
// An empty or unreadable value means "no range chosen" (reports treat that as all dates)
const safe = (s?: string | null): CalendarDate | null => { try { return s ? parseDate(s) : null; } catch { return null; } };
const label = (d: DateValue) => d.toDate(tz).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** A page can pass its own quick ranges (e.g. a year and its quarters) in place of the default ones */
export interface DatePreset { name: string; start: string; end: string }

export default function DateRangeField({ value, onChange, maxToday = true, compact = false, fieldLabel, presets: custom }: { value: IsoRange; onChange: (r: IsoRange) => void; maxToday?: boolean; compact?: boolean; fieldLabel?: string; presets?: DatePreset[] }) {
    const [open, setOpen] = useState(false);
    // Inside a canvas / modal the calendar renders within it, so a click on a day is not an
    // "outside click" that would dismiss the canvas
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [host, setHost] = useState<HTMLElement | undefined>(undefined);
    const now = today(tz);
    const from = safe(value?.start), to = safe(value?.end);
    const chosen = from && to ? { start: from, end: to } : null;

    const apply = (start: DateValue, end: DateValue) => { onChange({ start: iso(start), end: iso(end) }); setOpen(false); };
    const presets: { name: string; run: () => void; on?: boolean }[] = custom ? custom.map((p) => ({ name: p.name, run: () => { const a = safe(p.start), b = safe(p.end); if (a && b) apply(a, b); }, on: value?.start === p.start && value?.end === p.end })) : [
        { name: "Today", run: () => apply(now, now) },
        { name: "Yesterday", run: () => apply(now.subtract({ days: 1 }), now.subtract({ days: 1 })) },
        { name: "Last 7 days", run: () => apply(now.subtract({ days: 6 }), now) },
        { name: "Last 30 days", run: () => apply(now.subtract({ days: 29 }), now) },
        { name: "This month", run: () => apply(now.set({ day: 1 }), now) },
        { name: "Last month", run: () => { const p = now.subtract({ months: 1 }); apply(p.set({ day: 1 }), p.set({ day: p.calendar.getDaysInMonth(p) })); } },
    ];

    return (
        <Popover placement={host ? "bottom-end" : "bottom-start"} isOpen={open} onOpenChange={(o) => { if (o) setHost((triggerRef.current?.closest("[role=dialog]") as HTMLElement | null) ?? undefined); setOpen(o); }} portalContainer={host}>
            <PopoverTrigger>
                <Button ref={triggerRef} variant="bordered" size={compact ? "sm" : undefined} className={fieldLabel ? "h-12 w-full min-w-0 justify-between gap-2 rounded-small border border-ink-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink-900 data-[hover=true]:border-ink-300 dark:border-white/10 dark:bg-ink-900 dark:text-white" : compact ? "w-full justify-between" : "min-w-[280px] justify-between"} startContent={<CalendarDays size={15} className="text-brand-600" />}>
                    {fieldLabel ? (
                        // same shape as the Select fields beside it: small label over the value
                        <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left leading-tight">
                            <span className="font-secondary text-[10.5px] font-medium uppercase tracking-label text-ink-500 dark:text-ink-400">{fieldLabel}</span>
                            <span className="truncate text-sm font-normal normal-case text-ink-900 dark:text-white">{chosen ? `${label(chosen.start)} → ${label(chosen.end)}` : "All dates"}</span>
                        </span>
                    ) : (
                        <span className="flex-1 text-left">{chosen ? `${label(chosen.start)} → ${label(chosen.end)}` : "All dates"}</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                    <ul className="flex shrink-0 flex-row flex-wrap gap-1 border-b border-ink-200 p-2 dark:border-white/10 sm:w-40 sm:flex-col sm:border-b-0 sm:border-r">
                        {presets.map((p) => (
                            <li key={p.name}>
                                <button type="button" onClick={p.run} aria-pressed={p.on ?? undefined} className={`w-full px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide hover:bg-ink-100 hover:text-brand-600 focus-ring dark:hover:bg-white/5 ${p.on ? "bg-brand-50 text-brand-700 dark:bg-white/10 dark:text-white" : "text-ink-700 dark:text-ink-200"}`}>
                                    {p.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="p-3">
                        <RangeCalendar
                            aria-label="Date range"
                            visibleMonths={host ? 1 : 2}
                            maxValue={maxToday ? now : undefined}
                            value={chosen as React.ComponentProps<typeof RangeCalendar>["value"]}
                            onChange={(r) => apply(r.start, r.end)}
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
