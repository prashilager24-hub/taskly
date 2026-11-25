import { useState } from "react"
import { CalendarDays, Clock, Download, FileSpreadsheet, Hourglass, UserX } from "lucide-react"
import { BarsChart, DonutChart, TrendChart } from "@/peoplehub/blocks/charts"
import { NativeSelect, PageHeader, Panel, StatGrid } from "@/peoplehub/blocks/page"
import { DEPARTMENTS } from "@/peoplehub/mocks/people"
import { Button, cn, toast } from "@/peoplehub/ui"

const TABS = ["Attendance", "Leaves", "Working Hours", "Overtime"] as const
type Tab = (typeof TABS)[number]

const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]

const data: Record<Tab, { stats: Parameters<typeof StatGrid>[0]["stats"]; trend: Record<string, string | number>[]; series: { key: string; label: string }[]; dept: Record<string, string | number>[]; deptKey: string; split: { name: string; value: number }[]; splitTitle: string; unit?: string }> = {
  Attendance: {
    stats: [
      { label: "Avg. attendance", value: "92.4%", delta: "+1.2%", trend: "up", icon: CalendarDays },
      { label: "Late check-ins", value: "3.1%", delta: "-0.6%", trend: "down", upIsGood: false, icon: Clock },
      { label: "Absent (unplanned)", value: "1.8%", icon: UserX },
      { label: "WFH share", value: "21%", icon: Hourglass },
    ],
    trend: months.map((m, i) => ({ m, attendance: [90.1, 91.2, 90.8, 92.0, 91.6, 92.4][i] })),
    series: [{ key: "attendance", label: "Attendance %" }],
    dept: DEPARTMENTS.slice(0, 6).map((d, i) => ({ d, value: [94, 89, 92, 95, 91, 93][i] })),
    deptKey: "Attendance %",
    split: [{ name: "In office", value: 71 }, { name: "Work from home", value: 21 }, { name: "On leave", value: 6 }, { name: "Absent", value: 2 }],
    splitTitle: "Nov split (%)",
  },
  Leaves: {
    stats: [
      { label: "Leaves taken (Nov)", value: "312 days", icon: CalendarDays },
      { label: "Avg. per employee", value: "1.3 days", icon: UserX },
      { label: "Approval rate", value: "94%", icon: Clock },
      { label: "Encashable balance", value: "2,940 days", icon: Hourglass },
    ],
    trend: months.map((m, i) => ({ m, casual: [80, 92, 70, 88, 140, 110][i], sick: [60, 74, 58, 66, 52, 71][i], earned: [120, 90, 160, 84, 210, 131][i] })),
    series: [{ key: "casual", label: "Casual" }, { key: "sick", label: "Sick" }, { key: "earned", label: "Earned" }],
    dept: DEPARTMENTS.slice(0, 6).map((d, i) => ({ d, value: [128, 22, 34, 41, 19, 26][i] })),
    deptKey: "Leave days",
    split: [{ name: "Earned", value: 131 }, { name: "Casual", value: 110 }, { name: "Sick", value: 71 }],
    splitTitle: "Nov by type (days)",
  },
  "Working Hours": {
    stats: [
      { label: "Avg. daily hours", value: "8h 42m", delta: "+12m", trend: "up", icon: Clock },
      { label: "Below 8h", value: "14%", icon: UserX },
      { label: "Above 10h", value: "6%", hint: "burnout watch", icon: Hourglass },
      { label: "Core-hour compliance", value: "96%", icon: CalendarDays },
    ],
    trend: months.map((m, i) => ({ m, hours: [8.4, 8.5, 8.6, 8.5, 8.6, 8.7][i] })),
    series: [{ key: "hours", label: "Avg hours" }],
    dept: DEPARTMENTS.slice(0, 6).map((d, i) => ({ d, value: [9.1, 8.2, 8.5, 8.9, 8.4, 8.6][i] })),
    deptKey: "Avg hours",
    split: [{ name: "< 8 hrs", value: 14 }, { name: "8–10 hrs", value: 80 }, { name: "> 10 hrs", value: 6 }],
    splitTitle: "Distribution (%)",
  },
  Overtime: {
    stats: [
      { label: "OT hours (Nov)", value: "486 hrs", delta: "+8%", trend: "up", upIsGood: false, icon: Clock },
      { label: "Employees with OT", value: "41", icon: UserX },
      { label: "OT payout", value: "₹2.9L", icon: Hourglass },
      { label: "Comp-offs granted", value: "37", icon: CalendarDays },
    ],
    trend: months.map((m, i) => ({ m, ot: [380, 402, 455, 410, 450, 486][i] })),
    series: [{ key: "ot", label: "OT hours" }],
    dept: DEPARTMENTS.slice(0, 6).map((d, i) => ({ d, value: [210, 8, 26, 64, 92, 18][i] })),
    deptKey: "OT hours",
    split: [{ name: "Paid OT", value: 62 }, { name: "Comp-off", value: 38 }],
    splitTitle: "Settlement (%)",
  },
}

export function Reports() {
  const [tab, setTab] = useState<Tab>("Attendance")
  const d = data[tab]
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="HRMS"
        title="Reports"
        description="Attendance, leave, working-hours and overtime analytics. Filter, compare and export."
        actions={
          <>
            <NativeSelect className="w-40" aria-label="Period" defaultValue="Last 6 months">
              <option>Last 6 months</option>
              <option>This quarter</option>
              <option>This financial year</option>
            </NativeSelect>
            <Button variant="outline" onClick={() => toast.success(`${tab} report exported to Excel`)}>
              <FileSpreadsheet /> Excel
            </Button>
            <Button onClick={() => toast.success(`${tab} report exported as PDF`)}>
              <Download /> PDF
            </Button>
          </>
        }
      />

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-900 p-1 sm:w-fit" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("h-8 shrink-0 rounded-md px-3.5 text-sm font-medium transition-colors", tab === t ? "bg-brand-600 text-white shadow-sm" : "text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white")}
          >
            {t}
          </button>
        ))}
      </div>

      <StatGrid stats={d.stats} />

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title={`${tab} trend`} description="Last 6 months" className="xl:col-span-2">
          {d.series.length > 1 ? <BarsChart data={d.trend} x="m" series={d.series} stacked /> : <TrendChart data={d.trend} x="m" series={d.series} />}
        </Panel>
        <Panel title={d.splitTitle}>
          <DonutChart data={d.split} height={200} />
        </Panel>
      </div>

      <Panel title={`${tab} by department`} description="November 2026">
        <BarsChart data={d.dept} x="d" series={[{ key: "value", label: d.deptKey }]} layout="vertical" height={280} />
      </Panel>
    </div>
  )
}
