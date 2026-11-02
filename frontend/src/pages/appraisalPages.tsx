import { PageTitle } from "@/components/page";
import MyAppraisal from "@/components/appraisal/MyAppraisal";
import { DepartmentBoard, DepartmentDetail } from "@/components/appraisal/Departments";
import Split from "@/components/appraisal/Split";
import Allocation from "@/components/appraisal/Allocation";
import Requests from "@/components/appraisal/Requests";
import PersonView from "@/components/appraisal/PersonView";
import HrPostponements from "@/components/appraisal/HrPostponements";
import PeopleSetup from "@/components/appraisal/PeopleSetup";
import Overview from "@/components/appraisal/Overview";

// Appraisal is a sidebar section after PMS. Each page is its own route; the section shows only the pages that
// have something for this person (see /appraisal/availability). Requests go up, money comes down:
// everyone appeals -> Finance Head sets each department's budget -> the EL splits it -> each FL allocates -> the EL approves.

const Page = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
    <div className="flex w-full flex-col gap-5">
        <PageTitle title={title} subtitle={subtitle} />
        {children}
    </div>
);

export const MyAppraisalPage = () => <Page title="My appraisal" subtitle="Your yearly appraisal: appeal for your hike, then see it and answer."><MyAppraisal /></Page>;
export const AppraisalDepartmentsPage = () => <Page title="Department budgets" subtitle="Every department's appeals. Set each department's budget once its appeals are in."><DepartmentBoard /></Page>;
export const DepartmentDetailPage = () => <Page title="Department budget" subtitle="Every appeal in the department, the totals, and the budget you give its EL."><DepartmentDetail /></Page>;
export const AppraisalOverviewPage = () => <Page title="Appraisal overview" subtitle="How the appraisal is going in every department: appeals, expectations, budgets and each department's split."><Overview /></Page>;
export const SplitPage = () => <Page title="Budget split" subtitle="Agree the budget with the Finance Head, split it between your own hike, people reporting to you and the FLs, then approve, revise or reset their proposals."><Split /></Page>;
export const AllocationPage = () => <Page title="Team allocation" subtitle="Turn the share your EL gave you into a hike for each team member and your own, then send it to your EL."><Allocation /></Page>;
export const RequestsPage = () => <Page title="Change requests" subtitle="Designation and team requests: FLs forward their team's with a recommendation, the EL decides."><Requests /></Page>;
export const PersonPage = () => <Page title="Appraisal" subtitle="One person's appeal, PMS quarters, hike and requests."><PersonView /></Page>;
export const HrPostponementsPage = () => <Page title="HR postponements" subtitle="Offers that employees rejected, with their reason and what they expect."><HrPostponements /></Page>;
export const AppraisalSetupPage = () => <Page title="Appraisal setup" subtitle="Joining dates decide each person's April or October cycle. Level sets the fixed and variable split."><PeopleSetup /></Page>;
