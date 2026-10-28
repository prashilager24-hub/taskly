import React from 'react';
import { Tabs, Tab } from "@/components/ui";

import GoalSetting from '@/components/goalSetting';
import QuarterlyReview from '@/components/quarterlyReview';
import MonthlyReview from '@/components/monthlyReview';
import PmsDashboard from '@/components/pmsDashboard';
import PmsReport from '@/components/pmsReport';
import { hasModuleAccess } from "@/lib/permissions";

// Each PMS tab is a module in Access Management (pms_goals, pms_feedback, pms_quarterly, pms_dashboard,
// pms_report): a person sees exactly the tabs their role, department and personal access allow.
const TABS = [
    { id: "Goal Setting", module: "pms_goals", label: "Goal Setting", render: () => <GoalSetting /> },
    { id: "Manager Review", module: "pms_feedback", label: "Manager Feedback", render: () => <MonthlyReview /> },
    { id: "Quarterly Review", module: "pms_quarterly", label: "Quarterly Review", render: () => <QuarterlyReview /> },
    { id: "Dashboard", module: "pms_dashboard", label: "Dashboard", render: () => <PmsDashboard /> },
    { id: "Report", module: "pms_report", label: "Report", render: () => <PmsReport isReport={true} /> },
];

export default function PMSPage() {
    const tabs = TABS.filter((t) => hasModuleAccess(t.module));

    if (!tabs.length) {
        return (
            <div className="border border-ink-200 bg-white p-10 text-center dark:border-white/10 dark:bg-ink-900">
                <p className="text-sm font-semibold text-ink-900 dark:text-white">No PMS tabs are available to you</p>
                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Ask an administrator to give you access to the PMS tabs you need.</p>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col">
            <Tabs aria-label="PMS tabs" items={tabs}>
                {(item) => (
                    <Tab key={item.id} title={item.label}>
                        {item.render()}
                    </Tab>
                )}
            </Tabs>
        </div>
    );
}
