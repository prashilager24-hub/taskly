import { Navigate } from "react-router-dom";

import { PageTitle } from "@/components/page";
import { hasModuleAccess } from "@/lib/permissions";
import GoalSetting from "@/components/goalSetting";
import MonthlyReview from "@/components/monthlyReview";
import QuarterlyReview from "@/components/quarterlyReview";
import PmsDashboard from "@/components/pmsDashboard";
import PmsReport from "@/components/pmsReport";

// PMS is a section of the sidebar; each former tab is its own page. Access to each follows
// Access Management (pms_dashboard, pms_goals, pms_feedback, pms_quarterly, pms_report).

const ORDER = [
    { module: "pms_goals", to: "/pms/goal-setting" },
    { module: "pms_feedback", to: "/pms/manager-feedback" },
    { module: "pms_quarterly", to: "/pms/quarterly-review" },
    { module: "pms_report", to: "/pms/report" },
    { module: "pms_dashboard", to: "/pms/dashboard" },
];

/** /pms opens the first PMS page this person can use */
export function PmsIndex() {
    const first = ORDER.find((o) => hasModuleAccess(o.module));
    return first ? <Navigate to={first.to} replace /> : <Navigate to="/dashboard" replace />;
}

const Page = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
    <div className="flex w-full flex-col gap-5">
        <PageTitle title={title} subtitle={subtitle} />
        {children}
    </div>
);

export const PmsDashboardPage = () => <Page title="PMS dashboard" subtitle="Quarterly reviews and manager feedback for one person at a time."><PmsDashboard /></Page>;
export const PmsGoalPage = () => <Page title="Goal setting" subtitle="Set quarterly goals for each department (3 to 5 goals, weights total 100%)."><GoalSetting /></Page>;
export const PmsFeedbackPage = () => <Page title="Manager feedback" subtitle="Record feedback for a team member."><MonthlyReview /></Page>;
export const PmsQuarterlyPage = () => <Page title="Quarterly review" subtitle="Review a person's quarter: numbers, behaviour ratings and final grade."><QuarterlyReview /></Page>;
export const PmsReportPage = () => <Page title="PMS report" subtitle="Who has been reviewed this quarter, and who is still waiting."><PmsReport isReport={true} /></Page>;
