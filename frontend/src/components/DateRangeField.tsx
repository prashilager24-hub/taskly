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

export default function DateRangeField({ value, onChange, maxToday = true }: { value: IsoRange; onChange: (r: IsoRange) => void; maxToday?: boolean }) {
    const [open, setOpen] = useState(false);
    // Inside a canvas / modal the calendar renders within it, so a click on a day is not an
    // "outside click" that would dismiss the canvas
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [host, setHost] = useState<HTMLElement | undefined>(undefined);
    const now = today(tz);
    const from = safe(value?.start), to = safe(value?.end);
    const chosen = from && to ? { start: from, end: to } : null;

    const apply = (start: DateValue, end: DateValue) => { onChange({ start: iso(start), end: iso(end) }); setOpen(false); };
    const presets: { name: string; run: () => void }[] = [
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
                <Button ref={triggerRef} variant="bordered" className="min-w-[280px] justify-between" startContent={<CalendarDays size={15} className="text-brand-600" />}>
                    <span className="flex-1 text-left">{chosen ? `${label(chosen.start)} → ${label(chosen.end)}` : "All dates"}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                    <ul className="flex shrink-0 flex-row flex-wrap gap-1 border-b border-ink-200 p-2 dark:border-white/10 sm:w-40 sm:flex-col sm:border-b-0 sm:border-r">
                        {presets.map((p) => (
                            <li key={p.name}>
                                <button type="button" onClick={p.run} className="w-full px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-700 hover:bg-ink-100 hover:text-brand-600 focus-ring dark:text-ink-200 dark:hover:bg-white/5">
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
