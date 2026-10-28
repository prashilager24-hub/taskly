import { PageHeader } from "@/components/page";
import { useSearchParams } from "react-router-dom";

import { Tab, Tabs } from "@/components/ui";
import { title } from "@/components/primitives";
import PrimaryDepartmentPage from "@/pages/PrimaryDepartment";
import SubDepartmentPage from "@/pages/subdepartment";

// One Departments module: primary departments, the sub departments under them, and the
// hierarchy of both. The tab lives in the URL (?tab=) so each view can be linked to.

const TABS = [
  { key: "primary", label: "Primary departments" },
  { key: "sub", label: "Sub departments" },
  { key: "hierarchy", label: "Hierarchy" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function DepartmentsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === requested) ? (requested as TabKey) : "primary";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Departments" subtitle="Primary departments group the sub departments where people, tasks, targets and goals live." className="mb-0" />

      <Tabs
        aria-label="Department views"
        selectedKey={tab}
        onSelectionChange={(key) => setParams({ tab: String(key) }, { replace: true })}
      >
        {TABS.map((t) => <Tab key={t.key} title={t.label} />)}
      </Tabs>

      <div>
        {tab === "primary" && <PrimaryDepartmentPage view="list" />}
        {tab === "sub" && <SubDepartmentPage />}
        {tab === "hierarchy" && <PrimaryDepartmentPage view="hierarchy" />}
      </div>
    </div>
  );
}
