import DateRangeField from "@/components/DateRangeField";

// The date range control every report page uses. Pages keep their { startDate, endDate } state
// (yyyy-MM-dd strings) and pass it as value / onChange; the control is the whole picker
// (button, presets, calendar), so pages no longer wrap it in a Dropdown.
export interface DateRangeValue { startDate: string; endDate: string }

export default function CustomDateRangePicker({ value, onChange, compact }: { value: DateRangeValue; onChange: (range: DateRangeValue) => void; compact?: boolean }) {
    return (
        <DateRangeField
            compact={compact}
            value={{ start: value.startDate, end: value.endDate }}
            onChange={(r) => onChange({ startDate: r.start, endDate: r.end })}
        />
    );
}
