import { useSearchParams } from "react-router-dom";

import { Tab, Tabs } from "@/components/ui";
import { hasModuleAccess } from "@/lib/permissions";
import DashboardPage from "@/pages/dashboard";
import PMSPage from "@/pages/pms";

// Dashboard home (requirements DASH / PMS-01): Overview Dashboard by default, and the PMS
// module as a second tab. ?view=pms selects PMS so the old /pms URL can redirect here.
export default function DashboardHome() {
    const [params, setParams] = useSearchParams();
    const showPms = hasModuleAccess("pms");
    const view = showPms && params.get("view") === "pms" ? "pms" : "overview";

    return (
        <div className="flex w-full flex-col gap-4">
            <Tabs
                aria-label="Dashboard views"
                selectedKey={view}
                variant="underlined"
                classNames={{ tabList: "border-b border-ink-200 dark:border-white/10 w-full", cursor: "bg-brand-600", tab: "font-medium uppercase tracking-wide text-xs" }}
                onSelectionChange={(key) => setParams(key === "pms" ? { view: "pms" } : {}, { replace: true })}
            >
                <Tab key="overview" title="Overview Dashboard" />
                {showPms && <Tab key="pms" title="PMS Dashboard" />}
            </Tabs>
            {view === "pms" ? <PMSPage /> : <DashboardPage />}
        </div>
    );
}
