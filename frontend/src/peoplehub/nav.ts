/** People Hub modules (from the PeopleHub blueprint). All links live under /hub. */
import {
  BadgeIndianRupee,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  GraduationCap,
  LayoutDashboard,
  Lightbulb,
  Laptop,
  ListTodo,
  Megaphone,
  Palette,
  PartyPopper,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import type { Role } from "@/peoplehub/lib/role"
export type { Role }

export type NavLeaf = {
  title: string
  href: string
  /** Who can see this item. Mirrors the "Role" column of the PeopleHub module sheet. */
  roles: Role[]
  /** Feature parked by the business (shown greyed out). */
  hold?: boolean
}

export type NavModule = {
  title: string
  icon: LucideIcon
  /** Single-page modules link directly; others expand into children. */
  href?: string
  roles: Role[]
  children?: NavLeaf[]
}

const both: Role[] = ["admin", "employee"]
const admin: Role[] = ["admin"]

export const NAV: NavModule[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    roles: both,
    children: [
      { title: "HRMS Dashboard", href: "/hub/dashboard/hrms", roles: both },
      { title: "PMS Dashboard", href: "/hub/dashboard/pms", roles: both },
    ],
  },
  {
    title: "PMS",
    icon: ListTodo,
    roles: both,
    children: [
      { title: "Worklog", href: "/hub/taskly/worklog", roles: both, hold: true },
      { title: "Target & Goals", href: "/hub/taskly/goals", roles: both },
    ],
  },
  {
    title: "Growth & Rewards",
    icon: ChartNoAxesCombined,
    roles: both,
    children: [
      { title: "Performance Bonus", href: "/hub/pms/performance-bonus", roles: both },
      { title: "R&R", href: "/hub/pms/rnr", roles: both },
    ],
  },
  // Variable Pay: its own module (sits below Appraisal in the sidebar)
  {
    title: "Variable Pay",
    icon: Wallet,
    roles: both,
    children: [
      { title: "My Variable Pay", href: "/hub/variable-pay/my", roles: both },
      { title: "Team Variable Pay", href: "/hub/variable-pay/team", roles: both },
      { title: "Variable Pay Overview", href: "/hub/variable-pay/finance", roles: admin },
      { title: "Policy & Slabs", href: "/hub/variable-pay/policy", roles: both },
      { title: "Eligibility", href: "/hub/variable-pay/eligibility", roles: admin },
    ],
  },
  {
    title: "HRMS",
    icon: UsersRound,
    roles: both,
    children: [
      { title: "Onboarding", href: "/hub/hrms/onboarding", roles: admin },
      { title: "Probation", href: "/hub/hrms/probation", roles: both },
      { title: "Exit (F&F)", href: "/hub/hrms/exit", roles: both },
      { title: "Leave & Attendance", href: "/hub/hrms/leave-attendance", roles: both },
      { title: "Internal Movements", href: "/hub/hrms/internal-movements", roles: both },
      { title: "Payroll", href: "/hub/hrms/payroll", roles: admin },
      { title: "Salary Slips", href: "/hub/hrms/salary-slips", roles: both },
      { title: "Loans & Salary Advance", href: "/hub/hrms/loans", roles: both },
      { title: "Reimbursements", href: "/hub/hrms/reimbursements", roles: both },
      { title: "IT Declaration", href: "/hub/hrms/it-declaration", roles: both },
      { title: "Document Centre", href: "/hub/hrms/documents", roles: both },
      { title: "Reports", href: "/hub/hrms/reports", roles: admin },
    ],
  },
  {
    title: "L&D",
    icon: GraduationCap,
    roles: both,
    children: [
      { title: "Training Modules", href: "/hub/ld/training", roles: both },
      { title: "Employee Feedback (30/60/90)", href: "/hub/ld/feedback", roles: both },
      { title: "PIP", href: "/hub/ld/pip", roles: both },
    ],
  },
  { title: "Marketing & Events", icon: Megaphone, href: "/hub/marketing", roles: both },
  {
    title: "Talent Acquisition",
    icon: BriefcaseBusiness,
    roles: both,
    children: [
      { title: "Open Roles", href: "/hub/talent/open-roles", roles: both },
      { title: "Interview Tracker", href: "/hub/talent/interview-tracker", roles: admin },
      { title: "Interview Stages", href: "/hub/talent/interview-stages", roles: admin },
      { title: "Employee Database", href: "/hub/talent/employee-database", roles: admin },
      { title: "Offer Letter Generation", href: "/hub/talent/offer-letter", roles: admin },
      { title: "New Hire Notification", href: "/hub/talent/new-hire", roles: admin },
    ],
  },
  {
    title: "Assets & IT",
    icon: Laptop,
    roles: both,
    children: [
      { title: "Asset Issuance", href: "/hub/assets/issuance", roles: both },
      { title: "Insurance", href: "/hub/assets/insurance", roles: both },
      { title: "IT Troubleshooting", href: "/hub/assets/it-support", roles: both },
      { title: "Override Options", href: "/hub/assets/overrides", roles: admin },
      { title: "ID Card Generation & QR", href: "/hub/assets/id-card", roles: both },
    ],
  },
  {
    title: "Finance",
    icon: BadgeIndianRupee,
    roles: admin,
    children: [
      { title: "Payroll", href: "/hub/finance/payroll", roles: admin },
      { title: "Payslips", href: "/hub/finance/payslips", roles: admin },
      { title: "IT Declaration", href: "/hub/finance/it-declaration", roles: admin },
      { title: "Loans & Salary Advance", href: "/hub/finance/loans", roles: admin },
      { title: "Reimbursements", href: "/hub/finance/reimbursements", roles: admin },
      { title: "Salary Revisions", href: "/hub/finance/salary-revisions", roles: admin },
    ],
  },
  { title: "Quarterly Outing / Team Budget", icon: PartyPopper, href: "/hub/outings", roles: both },
  { title: "Ideabox", icon: Lightbulb, href: "/hub/ideabox", roles: both },
  { title: "Brand Kit", icon: Palette, href: "/hub/brand-kit", roles: both },
]

/**
 * Access Management ids for People Hub (the server's access catalog lists the same ids, see
 * nodejs-backend/src/modules/access/catalog.ts): a page is "hub_" + its path, a group "hubg_" + its title.
 */
export const hubPageAccess = (href: string) => "hub_" + href.replace(/^\/hub\//, "").replace(/[^a-z0-9]+/gi, "_").toLowerCase()
export const hubGroupAccess = (title: string) => "hubg_" + title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")

export type FlatNavItem = NavLeaf & { module: string; moduleHref?: string; icon: LucideIcon }

/** Every page in a flat list: used by search, breadcrumbs and access checks. */
export const FLAT_NAV: FlatNavItem[] = NAV.flatMap((m) =>
  m.children
    ? m.children.map((c) => ({ ...c, module: m.title, icon: m.icon }))
    : [{ title: m.title, href: m.href!, roles: m.roles, module: m.title, icon: m.icon }]
)

export function findNav(pathname: string) {
  return FLAT_NAV.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
}

export function visibleNav(role: Role): NavModule[] {
  return NAV.filter((m) => m.roles.includes(role))
    .map((m) => (m.children ? { ...m, children: m.children.filter((c) => c.roles.includes(role)) } : m))
    .filter((m) => !m.children || m.children.length > 0)
}
