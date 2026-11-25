import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { showOnboarding } from "@/lib/onboarding";
import { homePath, isAdminUser } from "@/lib/permissions";
import { appraisalApi, type Availability } from "@/components/appraisal/api";
import { NAV as HUB_NAV, FLAT_NAV as HUB_FLAT, hubGroupAccess, hubPageAccess } from "@/peoplehub/nav";
import {
  Award,
  PenLine,
  BarChart3,
  Bell,
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
  /** People Hub: feature parked by the business (shown greyed out with a "Hold" tag) */
  hold?: boolean;
}

export const MENU: MenuItem[] = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "dashboard-group",
    module: "dashboard",
    children: [
      { icon: LayoutDashboard, label: "Taskly", href: "dashboard", module: "dashboard" },
      { icon: TrendingUp, label: "Performance Management System", href: "pms/dashboard", module: "pms_dashboard" },
      { icon: BarChart3, label: "Performance Overview", href: "dashboard/performance-report", module: "perf_report" },
    ],
  },
  {
    icon: ClipboardCheck,
    label: "PMS",
    href: "pms",
    module: "pms",
    children: [
      { icon: ClipboardList, label: "Quarterly Review", href: "pms/quarterly-review", module: "pms_quarterly" },
      { icon: PenLine, label: "Quarter Highlights", href: "pms/my-quarter", module: "pms_my_quarter" },
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
  // Tasks, targets and goals are managed inside each sub department (Department Management); the Data Management menu is gone
  {
    icon: Settings,
    label: "Admin",
    href: "admin",
    module: "admin",
    children: [
      { icon: ShieldCheck, label: "Access Management", href: "access-management", module: "accessmgmt" },
      { icon: Building2, label: "Department Management", href: "departments", module: "deptmgmt", prefix: true },
      { icon: Bell, label: "Notifications", href: "notifications", module: "notifications" },
    ],
  },
  // HR Experience: the onboarding and engagement surveys. Support: queries to HR. (The pages keep their /support/… links.)
  {
    icon: Sparkles,
    label: "HR Experience",
    href: "hr-experience",
    module: "hrfeedback",
    children: [
      { icon: Sparkles, label: "Onboarding Experience", href: "support/onboarding", module: "hr_onboarding", onlyNewJoiners: true },
      { icon: Smile, label: "Employee Engagement", href: "support/engagement", module: "hr_engagement" },
    ],
  },
  {
    icon: LifeBuoy,
    label: "Support",
    href: "support",
    module: "hrfeedback",
    children: [
      { icon: MessageSquareText, label: "Query", href: "support/query", module: "hr_query" },
    ],
  },
];

const norm = (path: string) => path.replace(/^\/+|\/+$/g, "").toLowerCase();

/** People Hub modules beside Taskly (screens under /hub), in the menu's shape; each page is its own Access Management module */
export const HUB_MENU: MenuItem[] = HUB_NAV.map((m) => ({
  icon: m.icon,
  label: m.title,
  href: m.children ? `hub:${m.title}` : norm(m.href!),
  module: m.children ? hubGroupAccess(m.title) : hubPageAccess(m.href!),
  children: m.children?.map((c) => ({ icon: m.icon, label: c.title, href: norm(c.href), module: hubPageAccess(c.href), hold: c.hold })),
}));

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
  const hub = HUB_FLAT.find((i) => norm(i.href) === path);
  if (hub) return { section: hub.module === hub.title ? "People Hub" : hub.module, label: hub.title };
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

  // People Hub pages that only make sense for someone with a team by the Hierarchy (people they assess, and below
  // them): shown only when the server says they have one, whatever their role allows
  const TEAM_ONLY = ["hub_variable_pay_team"];
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);
  const canTeamPages = TEAM_ONLY.some((m) => rolePermissions?.[m]?.includes("read"));
  useEffect(() => {
    if (!canTeamPages) return;
    let live = true;
    axios.get("/t2.0/authentificationUtilization/access/hierarchy-team")
      .then((r) => { const t = r.data?.response; if (live) setHasTeam(!!t && (t.all || (t.userIds?.length ?? 0) > 0)); })
      .catch(() => { if (live) setHasTeam(false); });
    return () => { live = false; };
  }, [canTeamPages]);

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
    const shown = [...mainMenu, ...tasklyMenu];
    const owner = shown.find((item) => item.href === expanded && item.children?.some((c) => isActive(c.href)));
    const group = owner ?? shown.find((item) => item.children?.some((c) => isActive(c.href)));
    if (group) setExpanded(group.href);
  }, [currentPage]);

  // Taskly parent: open by default, the viewer's choice remembered on this browser
  const [tasklyOpen, setTasklyOpenState] = useState<boolean>(() => {
    try { return localStorage.getItem("sidebar.tasklyOpen") !== "0"; } catch { return true; }
  });
  const setTasklyOpen = (f: (v: boolean) => boolean) => setTasklyOpenState((v) => {
    const next = f(v);
    try { localStorage.setItem("sidebar.tasklyOpen", next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });
  // Parts of the existing app shown in the main menu instead of under Taskly (same pages, same access rules):
  //  - Appraisal, below People Hub's Growth & Rewards
  //  - Performance Overview (from Taskly → Dashboard), inside People Hub's PMS, for Admins only
  //  - Admin, HR Experience and Support, at the end of the main menu
  const APPRAISAL = "appraisal-group";
  const PERF_REPORT = "dashboard/performance-report";
  const AT_END = ["admin", "hr-experience", "support"];
  const MOVED = [APPRAISAL, ...AT_END];
  const perfReport = isAdminUser() ? menu.flatMap((m) => m.children ?? []).find((c) => c.href === PERF_REPORT) : undefined;
  const tasklyMenu = menu
    .filter((item) => !MOVED.includes(item.href))
    .map((item) => (item.children ? { ...item, children: item.children.filter((c) => c.href !== PERF_REPORT) } : item))
    .filter((item) => !item.children || item.children.length > 0);
  const hubMenu = HUB_MENU
    .map((item) => (item.children ? { ...item, children: item.children.filter((c) => hasAccess(c.module) && (!TEAM_ONLY.includes(c.module) || hasTeam === true)) } : item))
    .filter((item) => (item.children ? item.children.length > 0 : hasAccess(item.module)));
  // Appraisal (Taskly's own) takes Growth & Rewards' place + 1, so it sits above Variable Pay even when this person
  // cannot see Growth & Rewards
  const appraisal = menu.find((m) => m.href === APPRAISAL);
  const afterGrowth = HUB_MENU.findIndex((m) => m.href === "hub:Growth & Rewards") + 1;
  const hubItems = hubMenu.map((item) => (item.href === "hub:PMS" && perfReport ? { ...item, children: [...(item.children ?? []), perfReport] } : item));
  const at = hubItems.findIndex((item) => HUB_MENU.findIndex((m) => m.href === item.href) >= afterGrowth);
  const mainMenu = [
    ...(appraisal ? [...hubItems.slice(0, at < 0 ? hubItems.length : at), appraisal, ...(at < 0 ? [] : hubItems.slice(at))] : hubItems),
    ...AT_END.map((href) => menu.find((m) => m.href === href)).filter((m): m is MenuItem => !!m),
  ];
  const tasklyActive = tasklyMenu.some((item) => isActive(item.href) || item.children?.some((c) => isActive(c.href)));

  // One menu entry: a link, or a group that opens to show its pages
  const renderItem = (item: MenuItem, list: MenuItem[]) => {
          const groupActive = (item.children?.some((c) => isActive(c.href)) ?? false) && (expanded === null || expanded === item.href || !list.some((m) => m.href === expanded && m.children?.some((c) => isActive(c.href))));
          const open = expanded === item.href;

          if (!item.children) {
            const on = isActive(item.href);
            return (
              <li key={item.href}>
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
            <li key={item.href}>
              <button type="button" onClick={() => setExpanded(open ? null : item.href)} aria-expanded={open}
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
                            <Link to={`/${child.href}`} onClick={() => { setExpanded(item.href); if (isOpen) toggleSidebar(); }} tabIndex={open ? 0 : -1}
                              aria-current={on ? "page" : undefined}
                              className={`relative -ml-px flex items-center border-l py-2 pl-4 pr-2 text-[12.5px] transition-colors focus-ring ${on ? "border-brand-600 font-medium text-white" : "border-transparent text-ink-400 hover:border-white/30 hover:text-white"
                                }`}>
                              <span className={child.hold ? "opacity-50" : ""}>{child.label}</span>
                              {child.hold && <span className="ml-auto bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-400">Hold</span>}
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
  };

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
          <button type="button" className="flex items-center gap-2.5 focus-ring" onClick={() => navigate(homePath())}>
            <img src="/peoplehub-logo.svg" alt="People Hub by TapMind" className="h-9 w-auto max-w-[190px]" />
          </button>
          <button type="button" onClick={toggleSidebar} aria-label="Close menu" className="p-1.5 text-ink-400 hover:text-white focus-ring lg:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Main">
          <p className="mb-2 px-3 font-secondary text-[10px] font-medium uppercase tracking-eyebrow text-ink-500">Menu</p>
          {/* People Hub modules (sample data for now) */}
          <ul className="space-y-0.5">
            {mainMenu.map((item) => renderItem(item, mainMenu))}
          </ul>
          <div className="mt-0.5">
          {/* Taskly (every existing menu group) sits last, below the People Hub modules */}
          <button type="button" onClick={() => setTasklyOpen((v) => !v)} aria-expanded={tasklyOpen}
            className={itemClass(!tasklyOpen && tasklyActive)}>
            {bar(!tasklyOpen && tasklyActive)}
            <LayoutGrid size={17} strokeWidth={1.75} className={tasklyActive ? "text-brand-500" : ""} />
            <span className="flex-1 text-left font-semibold">Taskly</span>
            <ChevronDown size={14} className={`text-ink-500 transition-transform duration-200 ${tasklyOpen ? "rotate-180" : ""}`} />
          </button>
          <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${tasklyOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <ul className={`ml-3 mt-0.5 space-y-0.5 overflow-hidden border-l border-white/10 pl-1.5 ${tasklyOpen ? "" : "invisible"}`}>
            {tasklyMenu.map((item) => renderItem(item, tasklyMenu))}
          </ul>
          </div>
          </div>
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
