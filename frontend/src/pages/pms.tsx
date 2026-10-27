import React from 'react';
import { Tabs, Tab } from "@/components/ui";

import GoalSetting from '@/components/goalSetting';
import QuarterlyReview from '@/components/quarterlyReview';
import MonthlyReview from '@/components/monthlyReview';
import PmsDashboard from '@/components/pmsDashboard';
import PmsReport from '@/components/pmsReport';
import { useMemo } from "react";

export default function PMSPage() {
    const user = useMemo<any>(() => {
        const raw = localStorage.getItem("authUserLD");
        return raw ? JSON.parse(raw) : null;
    }, []);
    const storedRole = JSON.parse(
        localStorage.getItem("roles") || "{}"
    );

    const permissions = JSON.parse(
        storedRole.rolePrivileges || "{}"
    );

    const pmsPermissions = permissions?.pms || [];

    const isReadOnly = user?.userRole === 2 ||
        user?.userRole === 5 ||
        user?.userRole === 6 ||

        user?.userRole === 23;

    // const isReportUser =
    //     Number(user?.userID) === 1 ||
    //     (user?.departments ?? []).some((d) => Number(d?.departmentID) === 16);
    const isReportUser =
        Number(user?.userID) === 1 ||
        Number(user?.departmentID) === 16 ||
        (Array.isArray(user?.departments) &&
            user.departments.some(
                (d: any) => Number(d?.departmentID) === 16
            ));

    const tabs = isReadOnly
        ? [
            {
                id: "Dashboard",
                label: "Dashboard",
                content: <PmsDashboard />
            }
        ]
        : [
            {
                id: "Goal Setting",
                label: "Goal Setting",
                content: <GoalSetting />
            },
            {
                id: "Manager Review",
                label: "Manager Feedback",
                content: <MonthlyReview />
            },
            {
                id: "Quarterly Review",
                label: "Quarterly Review",
                content: <QuarterlyReview />
            },
            {
                id: "Dashboard",
                label: "Dashboard",
                content: <PmsDashboard />
            },

            // Report visible only for userID 1 and 142
            ...(isReportUser
                ? [
                    {
                        id: "Report",
                        label: "Report",
                        content: <PmsReport isReport={true} />
                    }
                ]
                : [])
        ];

    return (
        <div className="flex w-full flex-col">
            <Tabs aria-label="Dynamic tabs" items={tabs}>
                {(item) => (
                    <Tab key={item.id} title={item.label}>
                        {item.content}
                    </Tab>
                )}
            </Tabs>
        </div>
    );
}