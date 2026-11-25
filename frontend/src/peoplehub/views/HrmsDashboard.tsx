import { Link } from "react-router-dom"
import { ArrowRight, Cake, CalendarCheck, CalendarDays, Clock, Download, FileText, IdCard, Megaphone, Plus, Receipt, Sparkles, Target, Ticket, UserMinus, UserPlus, Users, Wallet } from "lucide-react"
import { BarsChart, DonutChart, TrendChart } from "@/peoplehub/blocks/charts"
import { IdeologyStrip } from "@/peoplehub/blocks/ideology"
import { Meter, PageHeader, Panel, StatGrid } from "@/peoplehub/blocks/page"
import { PersonAvatar } from "@/peoplehub/blocks/person-cell"
import { StatusBadge } from "@/peoplehub/blocks/status-badge"
import { useRole } from "@/peoplehub/lib/role"
import { PEOPLE } from "@/peoplehub/mocks/people"
import { Button, LinkButton, hubPath, toast } from "@/peoplehub/ui"

const headcount = [
  { m: "Jun", headcount: 198, joiners: 9, exits: 3 },
  { m: "Jul", headcount: 204, joiners: 11, exits: 5 },
  { m: "Aug", headcount: 211, joiners: 10, exits: 3 },
  { m: "Sep", headcount: 217, joiners: 8, exits: 2 },
  { m: "Oct", headcount: 225, joiners: 12, exits: 4 },
  { m: "Nov", headcount: 236, joiners: 14, exits: 3 },
]
const departments = [
  { name: "Engineering", value: 92 },
  { name: "Sales & Marketing", value: 48 },
  { name: "Operations & IT", value: 38 },
  { name: "Customer Success", value: 30 },
  { name: "HR & Finance", value: 28 },
]
const attendance = [
  { d: "Mon", office: 168, wfh: 46, leave: 12 },
  { d: "Tue", office: 175, wfh: 41, leave: 10 },
  { d: "Wed", office: 181, wfh: 38, leave: 9 },
  { d: "Thu", office: 172, wfh: 44, leave: 11 },
  { d: "Fri", office: 150, wfh: 62, leave: 14 },
]
const approvals = [
  { label: "Leave requests", count: 9, href: "/hrms/leave-attendance" },
  { label: "Reimbursement claims", count: 11, href: "/hrms/reimbursements" },
  { label: "Probation confirmations", count: 5, href: "/hrms/probation" },
  { label: "Loan & advance requests", count: 4, href: "/hrms/loans" },
  { label: "Internal movements", count: 3, href: "/hrms/internal-movements" },
]
const announcements = [
  { title: "Appraisal cycle FY 2026–27 is live", meta: "Self reviews due 30 Nov", tag: "PMS" },
  { title: "Submit IT declaration proofs", meta: "Window closes 31 Dec", tag: "Finance" },
  { title: "Q3 team outings: budget released", meta: "₹3,000 per head", tag: "Engagement" },
]

export function HrmsDashboard() {
  const { role, user } = useRole()
  return role === "admin" ? <AdminView name={user.name.split(" ")[0]} /> : <EmployeeView name={user.name.split(" ")[0]} />
}

function Greeting({ name, children }: { name: string; children?: React.ReactNode }) {
  return <PageHeader eyebrow="Tuesday, 24 November 2026" title={`Welcome back, ${name}`} description="Here's what's happening across PeopleHub today." actions={children} />
}

function AdminView({ name }: { name: string }) {
  return (
    <div className="space-y-6">
      <Greeting name={name}>
        <Button variant="outline" onClick={() => toast.success("Monthly HR report is being prepared")}>
          <Download /> Report
        </Button>
        <LinkButton to={hubPath("/hrms/onboarding")}>
          <UserPlus /> Add joiner
        </LinkButton>
      </Greeting>

      <IdeologyStrip />

      <StatGrid
        stats={[
          { label: "Total headcount", value: "236", delta: "+4.9%", trend: "up", hint: "vs last month", icon: Users },
          { label: "New joiners (Nov)", value: "14", delta: "+2", trend: "up", hint: "vs Oct", icon: UserPlus },
          { label: "Attrition (annualised)", value: "11.2%", delta: "-1.4%", trend: "down", upIsGood: false, icon: UserMinus },
          { label: "Present today", value: "89.8%", hint: "212 of 236", icon: CalendarCheck },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Headcount trend" description="Last 6 months" className="xl:col-span-2">
          <TrendChart data={headcount} x="m" series={[{ key: "headcount", label: "Headcount" }]} fit />
        </Panel>
        <Panel title="By department" description="236 employees">
          <DonutChart data={departments} center="236" centerLabel="employees" />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Attendance this week" description="Office vs WFH vs leave" className="xl:col-span-2">
          <BarsChart data={attendance} x="d" stacked series={[{ key: "office", label: "In office" }, { key: "wfh", label: "WFH" }, { key: "leave", label: "On leave" }]} />
        </Panel>
        <Panel title="Waiting for your approval" description="32 items across modules" bodyClassName="p-2">
          <ul>
            {approvals.map((a) => (
              <li key={a.label}>
                <Link to={hubPath(a.href)} className="flex items-center justify-between rounded-lg px-3 py-3 text-sm hover:bg-ink-100 dark:hover:bg-white/5">
                  <span>{a.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">{a.count}</span>
                    <ArrowRight className="size-4 text-ink-500 dark:text-ink-400" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Celebrations" description="This week">
          <ul className="space-y-4">
            {[
              [PEOPLE[3], "Birthday", "Today"],
              [PEOPLE[5], "6-year work anniversary", "26 Nov"],
              [PEOPLE[11], "Birthday", "27 Nov"],
              [PEOPLE[16], "6-year work anniversary", "29 Nov"],
            ].map(([p, what, when]) => {
              const person = p as (typeof PEOPLE)[number]
              return (
                <li key={person.id} className="flex items-center gap-3">
                  <PersonAvatar name={person.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{person.name}</p>
                    <p className="flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
                      <Cake className="size-3" /> {what as string}
                    </p>
                  </div>
                  <span className="text-xs text-ink-500 dark:text-ink-400">{when as string}</span>
                </li>
              )
            })}
          </ul>
        </Panel>
        <Panel title="Probation ending soon" action={<Link to={hubPath("/hrms/probation")} className="text-xs font-medium text-brand-600 hover:underline">View all</Link>}>
          <ul className="space-y-4">
            {PEOPLE.slice(-4).map((p, i) => (
              <li key={p.id} className="flex items-center gap-3">
                <PersonAvatar name={p.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">{p.designation}</p>
                </div>
                <StatusBadge status={["Due 28 Nov", "Due 2 Dec", "Due 5 Dec", "Due 12 Dec"][i]} tone={i === 0 ? "warning" : "neutral"} />
              </li>
            ))}
          </ul>
        </Panel>
        <Announcements />
      </div>
    </div>
  )
}

function Announcements() {
  return (
    <Panel title="Announcements">
      <ul className="space-y-4">
        {announcements.map((a) => (
          <li key={a.title} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-500/15 text-brand-600">
              <Megaphone className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {a.tag} · {a.meta}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

const quick = [
  { label: "Apply leave", icon: CalendarDays, href: "/hrms/leave-attendance" },
  { label: "Salary slips", icon: FileText, href: "/hrms/salary-slips" },
  { label: "New claim", icon: Receipt, href: "/hrms/reimbursements" },
  { label: "IT ticket", icon: Ticket, href: "/assets/it-support" },
  { label: "My ID card", icon: IdCard, href: "/assets/id-card" },
  { label: "Nominate", icon: Sparkles, href: "/pms/rnr" },
]

function EmployeeView({ name }: { name: string }) {
  return (
    <div className="space-y-6">
      <Greeting name={name}>
        <LinkButton to={hubPath("/hrms/leave-attendance")}>
          <Plus /> Apply leave
        </LinkButton>
      </Greeting>

      <StatGrid
        stats={[
          { label: "Leave balance", value: "25.5 days", hint: "CL 6 · SL 5 · EL 14.5", icon: CalendarDays },
          { label: "Attendance (Nov)", value: "96%", delta: "+2%", trend: "up", icon: Clock },
          { label: "Next payday", value: "30 Nov", hint: "in 6 days", icon: Wallet },
          { label: "Goals progress", value: "67%", hint: "3 goals · Q3", icon: Target },
        ]}
      />

      <Panel title="Quick actions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quick.map((q) => (
            <Link key={q.label} to={hubPath(q.href)} className="group flex flex-col items-center gap-2 rounded-xl border border-ink-200 dark:border-white/10 p-4 text-center transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-sm">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-500/15 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <q.icon className="size-5" />
              </span>
              <span className="text-sm font-medium">{q.label}</span>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="My working hours" description="This week · target 8h/day" className="xl:col-span-2">
          <BarsChart data={[{ d: "Mon", hours: 8.6 }, { d: "Tue", hours: 9.1 }, { d: "Wed", hours: 8.2 }, { d: "Thu", hours: 8.8 }, { d: "Fri", hours: 7.4 }]} x="d" series={[{ key: "hours", label: "Hours" }]} height={230} />
        </Panel>
        <Panel title="To do">
          <ul className="space-y-4">
            {[
              ["Complete your self review", "Appraisal · due 30 Nov", 40, "app:/appraisal"],
              ["Upload 80C investment proofs", "IT declaration · due 31 Dec", 60, "/hrms/it-declaration"],
              ["Finish 'Information Security Basics'", "L&D · mandatory", 75, "/ld/training"],
            ].map(([t, m, pct, href]) => (
              <li key={t as string}>
                <Link to={hubPath(href as string)} className="block space-y-2 rounded-lg p-1 hover:bg-ink-50 dark:hover:bg-white/5">
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-medium">{t as string}</p>
                    <span className="tabular-nums text-xs text-ink-500 dark:text-ink-400">{pct as number}%</span>
                  </div>
                  <Meter value={pct as number} />
                  <p className="text-xs text-ink-500 dark:text-ink-400">{m as string}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Upcoming holidays">
          <ul className="divide-y divide-ink-100 dark:divide-white/5">
            {[
              ["25 Dec", "Christmas", "Friday"],
              ["01 Jan", "New Year's Day", "Friday"],
              ["14 Jan", "Makar Sankranti / Pongal", "Thursday"],
              ["26 Jan", "Republic Day", "Tuesday"],
            ].map(([d, n, w]) => (
              <li key={n} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <span className="flex w-14 flex-col items-center rounded-lg border border-ink-200 dark:border-white/10 py-1.5">
                  <span className="text-base leading-none font-semibold">{d.split(" ")[0]}</span>
                  <span className="text-[11px] text-ink-500 dark:text-ink-400 uppercase">{d.split(" ")[1]}</span>
                </span>
                <div>
                  <p className="text-sm font-medium">{n}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">{w}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Announcements />
      </div>
    </div>
  )
}
