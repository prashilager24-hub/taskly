import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { showOnboarding } from "@/lib/onboarding";
import { appraisalApi, type Availability } from "@/components/appraisal/api";
import {
  Award,
  BarChart3,
  Bell,
  Database,
  Building2,
  GitPullRequestArrow,
  LayoutGrid,
  CheckCircle2,
  ClipboardCheck,
  ChevronDown,
  ClipboardList,
  FileText,
  Goal,
  History,
  LayoutDashboard,
  LifeBuoy,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Smile,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";

// Sidebar in the TapMind CRM style: always dark, uppercase section labels, an orange bar on the
// active item. The menu below is also what the top bar uses for page titles (pageMeta).

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  currentPage?: string;
}

interface MenuItem {
  icon: any;
  label: string;
  href: string;
  module: string;
  adminOnly?: boolean;
  departments?: number[];
  children?: MenuItem[];
  onlyNewJoiners?: boolean;
  /** Appraisal pages appear only while there is something for this person (from /appraisal/availability) */
  avail?: keyof Omit<Availability, "any">;
  /** Stays highlighted on its sub-pages, e.g. appraisal/team/12 */
  prefix?: boolean;
}

export const MENU: MenuItem[] = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "dashboard-group",
    module: "dashboard",
    children: [
      { icon: LayoutDashboard, label: "Taskly", href: "dashboard", module: "dashboard" },
      { icon: TrendingUp, label: "PMS", href: "pms/dashboard", module: "pms_dashboard" },
    ],
  },
  {
    icon: ClipboardCheck,
    label: "PMS",
    href: "pms",
    module: "pms",
    children: [
      { icon: ClipboardList, label: "Quarterly Review", href: "pms/quarterly-review", module: "pms_quarterly" },
      { icon: FileText, label: "Report", href: "pms/report", module: "pms_report" },
    ],
  },
  { icon: MessageSquareText, label: "Manager Feedback", href: "manager-feedback", module: "pms_feedback" },
  {
    icon: Award,
    label: "Appraisal",
    href: "appraisal-group",
    module: "appraisal",
    children: [
      { icon: Award, label: "My Appraisal", href: "appraisal", module: "appraisal", avail: "my" },
      { icon: LayoutGrid, label: "Overview", href: "appraisal/overview", module: "appraisal", avail: "overview" },
      { icon: Building2, label: "Department Budgets", href: "appraisal/departments", module: "appraisal", avail: "departments", prefix: true },
      { icon: Wallet, label: "Budget Split", href: "appraisal/split", module: "appraisal", avail: "split" },
      { icon: UserCheck, label: "Team Allocation", href: "appraisal/allocation", module: "appraisal", avail: "allocation" },
      { icon: GitPullRequestArrow, label: "Change Requests", href: "appraisal/requests", module: "appraisal", avail: "requests" },
      { icon: ShieldCheck, label: "HR Postponements", href: "appraisal/hr", module: "appraisal", avail: "hr" },
      { icon: UserCog, label: "Appraisal Setup", href: "appraisal/setup", module: "appraisal", avail: "setup" },
    ],
  },
  { icon: ClipboardList, label: "Daily Activity", href: "daily-activity", module: "dataentry" },
  {
    icon: BarChart3,
    label: "Reports",
    href: "reports",
    module: "reports",
    children: [
      { icon: FileText, label: "Employee Performance Insights", href: "efficiency-report", module: "perf" },
      { icon: Users, label: "User Logs", href: "daily-log", module: "mydata" },
      { icon: Goal, label: "Employee Goals", href: "goals", module: "goals" },
      { icon: CheckCircle2, label: "Logs Approval", href: "entry-approval", module: "entryApproval" },
      { icon: History, label: "User Archive Logs", href: "user-history", module: "userHistory" },
      { icon: MessageSquareText, label: "Query Report", href: "query-report", module: "queryReport" },
    ],
  },
  {
    icon: Database,
    label: "Data Management",
    href: "data-management",
    module: "datamgmt",
    children: [
      { icon: ClipboardList, label: "Task Management", href: "tasks", module: "taskmgmt" },
      { icon: Target, label: "Target Management", href: "target", module: "targetmgmt" },
      { icon: Goal, label: "Goal Management", href: "Goal-management", module: "goalmgmt" },
    ],
  },
  {
    icon: Settings,
    label: "Admin",
    href: "admin",
    module: "admin",
    children: [
      { icon: ShieldCheck, label: "Access Management", href: "access-management", module: "accessmgmt" },
      { icon: Building2, label: "Departments", href: "departments", module: "deptmgmt" },
      { icon: Bell, label: "Notifications", href: "notifications", module: "notifications" },
    ],
  },
  // Support (formerly HR Feedback); PMS lives on the Dashboard as a tab
  {
    icon: LifeBuoy,
    label: "HR Support",
    href: "support",
    module: "hrfeedback",
    children: [
      { icon: Sparkles, label: "Onboarding Experience", href: "support/onboarding", module: "hr_onboarding", onlyNewJoiners: true },
      { icon: MessageSquareText, label: "Query & HR", href: "support/query", module: "hr_query" },
      { icon: Smile, label: "Employee Engagement", href: "support/engagement", module: "hr_engagement" },
    ],
  },
];

const norm = (path: string) => path.replace(/^\/+|\/+$/g, "").toLowerCase();

// Pages reached from inside other pages, not from the menu
const EXTRA_PAGES: Record<string, { section: string; label: string }> = {
  "activity-log": { section: "Workspace", label: "Activity Log" },
  "hr-feedback": { section: "Support", label: "HR Feedback" },
  support: { section: "Support", label: "Support" },
};

/** Section + title for the page at `pathname`, for the top bar */
export function pageMeta(pathname: string): { section: string; label: string } {
  const path = norm(pathname);
  for (const item of MENU) {
    if (norm(item.href) === path) return { section: "Workspace", label: item.label };
    const child = item.children?.find((c) => norm(c.href) === path || (c.prefix && path.startsWith(`${norm(c.href)}/`)));
    if (child) return { section: item.label, label: child.label };
  }
  return EXTRA_PAGES[path] ?? { section: "Taskly", label: "" };
}

const readJson = (key: string) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, currentPage = "/" }) => {
  const navigate = useNavigate();
  const [authUserLD, setAuthUserLD] = useState<any>(() => readJson("authUserLD"));
  const [rolePermissions] = useState<any>(() => {
    try {
      return JSON.parse(readJson("roles")?.rolePrivileges || "{}");
    } catch {
      return {};
    }
  });

  // Sync with changes from other tabs or after login/logout
  useEffect(() => {
    const onStorage = () => setAuthUserLD(readJson("authUserLD"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const hasAccess = (module: string, permission = "read") => rolePermissions?.[module]?.includes(permission);

  // Appraisal follows each person's cycle: ask the server what is open for them whenever they move to another page
  const [avail, setAvail] = useState<Availability | null>(null);
  const canAppraisal = !!rolePermissions?.["appraisal"]?.includes("read");
  useEffect(() => {
    if (!canAppraisal) { setAvail(null); return; }
    let live = true;
    appraisalApi.availability().then((a) => { if (live) setAvail(a); }).catch(() => { if (live) setAvail(null); });
    return () => { live = false; };
  }, [currentPage, canAppraisal]);

  // The menu shows only what this person's access allows (role + department + their own access)
  const menu = useMemo(() => MENU
    .map((item) => item.children
      ? { ...item, children: item.children.filter((child) => hasAccess(child.module) && (!child.onlyNewJoiners || showOnboarding(authUserLD)) && (!child.avail || !!avail?.[child.avail]?.show)) }
      : item)
    .filter((item) => (item.children ? item.children.length > 0 : hasAccess(item.module))), [rolePermissions, authUserLD, avail]);

  const active = norm(currentPage);
  const isActive = (href: string) => active === norm(href) || (MENU.some((g) => g.children?.some((c) => c.prefix && c.href === href)) && active.startsWith(`${norm(href)}/`));

  // The group holding the current page starts open
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    // A page can be listed in two groups (PMS dashboard): keep the group the person opened it from
    const owner = MENU.find((item) => item.label === expanded && item.children?.some((c) => isActive(c.href)));
    const group = owner ?? MENU.find((item) => item.children?.some((c) => isActive(c.href)));
    if (group) setExpanded(group.label);
  }, [currentPage]);

  const initials = (authUserLD?.name ?? "")
    .split(" ")
    .map((p: string) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const itemClass = (on: boolean) =>
    `group relative flex w-full items-center gap-3 px-3 py-2.5 text-[13px] transition-colors focus-ring ${on ? "bg-white/[0.06] font-medium text-white" : "text-ink-400 hover:bg-white/[0.04] hover:text-white"
    }`;
  const bar = (on: boolean) => (
    <span aria-hidden className={`absolute inset-y-1.5 left-0 w-[3px] transition-colors ${on ? "bg-brand-600" : "bg-transparent"}`} />
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={toggleSidebar} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-white/10 bg-black text-white transition-transform duration-300 ease-out lg:static lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <button type="button" className="flex items-center gap-2.5 focus-ring" onClick={() => navigate("/dashboard")}>
            <img src="/Tapmind.ico" alt="" className="h-7 w-7" />
            <span className="text-base font-black uppercase tracking-btn">Taskly</span>
          </button>
          <button type="button" onClick={toggleSidebar} aria-label="Close menu" className="p-1.5 text-ink-400 hover:text-white focus-ring lg:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Main">
          <p className="mb-2 px-3 font-secondary text-[10px] font-medium uppercase tracking-eyebrow text-ink-500">Menu</p>
          <ul className="space-y-0.5">
            {menu.map((item) => {
              const groupActive = (item.children?.some((c) => isActive(c.href)) ?? false) && (expanded === null || expanded === item.label || !menu.some((m) => m.label === expanded && m.children?.some((c) => isActive(c.href))));
              const open = expanded === item.label;

              if (!item.children) {
                const on = isActive(item.href);
                return (
                  <li key={item.label}>
                    <Link to={`/${item.href}`} onClick={() => { setExpanded(null); if (isOpen) toggleSidebar(); }}
                      className={itemClass(on)} aria-current={on ? "page" : undefined}>
                      {bar(on)}
                      <item.icon size={17} strokeWidth={1.75} className={on ? "text-brand-500" : ""} />
                      {item.label}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={item.label}>
                  <button type="button" onClick={() => setExpanded(open ? null : item.label)} aria-expanded={open}
                    className={itemClass(groupActive && !open)}>
                    {bar(groupActive && !open)}
                    <item.icon size={17} strokeWidth={1.75} className={groupActive ? "text-brand-500" : ""} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown size={14} className={`text-ink-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <ul className="overflow-hidden">
                      <li className="ml-[22px] mt-0.5 border-l border-white/10 pb-1">
                        <ul>
                          {item.children.map((child) => {
                            const on = isActive(child.href) && open;
                            return (
                              <li key={child.label}>
                                <Link to={`/${child.href}`} onClick={() => { setExpanded(item.label); if (isOpen) toggleSidebar(); }} tabIndex={open ? 0 : -1}
                                  aria-current={on ? "page" : undefined}
                                  className={`relative -ml-px flex items-center border-l py-2 pl-4 pr-2 text-[12.5px] transition-colors focus-ring ${on ? "border-brand-600 font-medium text-white" : "border-transparent text-ink-400 hover:border-white/30 hover:text-white"
                                    }`}>
                                  {child.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Signed-in user */}
        {authUserLD && (
          <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-brand-600 text-xs font-bold text-white">{initials || "?"}</span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{authUserLD.name}</p>
              <p className="truncate text-[11px] text-ink-500">{authUserLD.email ?? authUserLD.departmentName ?? ""}</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
