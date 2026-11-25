import { Outlet, useLocation } from "react-router-dom";
import { Eye, FlaskConical } from "lucide-react";
import { RoleProvider, useRole } from "@/peoplehub/lib/role";
import { cn } from "@/peoplehub/ui";
import AccessDenied from "@/components/AccessDenied";
import { hasModuleAccess, isAdminUser } from "@/lib/permissions";
import { findNav, hubPageAccess } from "@/peoplehub/nav";

/** Frame for every People Hub page: a "sample data" notice with the Admin / Employee view switch, then the page */
function DemoBar() {
  const { role, setRole } = useRole();
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 border border-dashed border-brand-300 bg-brand-50/60 px-4 py-2.5 text-xs text-ink-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-ink-200">
      <span className="flex items-center gap-2">
        <FlaskConical size={14} className="text-brand-600" />
        <span><b>People Hub preview</b>: sample data only; anything you add or approve stays in this browser tab.</span>
      </span>
      <span className="flex items-center gap-2">
        <Eye size={14} className="text-ink-500" />
        <span className="eyebrow">View as</span>
        <span className="inline-flex border border-ink-300 dark:border-white/15" role="group" aria-label="View as">
          {(["admin", "employee"] as const).map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)} aria-pressed={role === r}
              className={cn("px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors focus-ring",
                role === r ? "bg-ink-900 text-white dark:bg-white dark:text-ink-900" : "bg-white text-ink-600 hover:text-brand-600 dark:bg-ink-900 dark:text-ink-300")}>
              {r}
            </button>
          ))}
        </span>
      </span>
    </div>
  );
}

/** Pages that show real data from the database: no "sample data" bar, and their own access rules instead of the View-as switch */
const REAL = ["/hub/taskly/goals", "/hub/dashboard/pms", "/hub/variable-pay/my", "/hub/variable-pay/team", "/hub/variable-pay/finance", "/hub/variable-pay/policy", "/hub/variable-pay/eligibility"];

export default function HubShell() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, "").toLowerCase();
  const real = REAL.includes(path);
  // Each page is an Access Management module; a page not in the menu (old sample pages) is for Admins only
  const page = findNav(path);
  const allowed = page ? hasModuleAccess(hubPageAccess(page.href)) : isAdminUser();
  if (!allowed) return <AccessDenied module={page ? hubPageAccess(page.href) : undefined} />;
  return (
    <RoleProvider>
      <div className="space-y-6">
        {!real && <DemoBar />}
        <Outlet />
      </div>
    </RoleProvider>
  );
}
