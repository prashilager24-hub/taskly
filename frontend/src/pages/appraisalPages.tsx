import { PageTitle } from "@/components/page";
import MyAppraisal from "@/components/appraisal/MyAppraisal";
import TeamAppraisals from "@/components/appraisal/TeamAppraisals";
import ReviewForm from "@/components/appraisal/ReviewForm";
import BudgetApproval from "@/components/appraisal/BudgetApproval";
import HrPostponements from "@/components/appraisal/HrPostponements";
import PeopleSetup from "@/components/appraisal/PeopleSetup";

// Appraisal is a sidebar section after PMS. Each page is its own route; the section shows only the pages that
// have something for this person right now (see /appraisal/availability), so the menu follows each person's cycle.

const Page = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
    <div className="flex w-full flex-col gap-5">
        <PageTitle title={title} subtitle={subtitle} />
        {children}
    </div>
);

export const MyAppraisalPage = () => <Page title="My appraisal" subtitle="Your yearly appraisal: fill your part while your window is open, then see your offer."><MyAppraisal /></Page>;
export const TeamAppraisalsPage = () => <Page title="Team appraisals" subtitle="Review the people you assess, in the window after their own."><TeamAppraisals /></Page>;
export const ReviewFormPage = () => <Page title="Appraisal review" subtitle="Rate each quarter, set the minimal hike and write your comments."><ReviewForm /></Page>;
export const BudgetApprovalPage = () => <Page title="Budget approval" subtitle="Approve each hike. Every amount is annual and split into fixed and variable by level."><BudgetApproval /></Page>;
export const HrPostponementsPage = () => <Page title="HR postponements" subtitle="Offers that employees rejected, with their reason and what they expect."><HrPostponements /></Page>;
export const AppraisalSetupPage = () => <Page title="Appraisal setup" subtitle="Joining dates start each person's cycle. Level sets the fixed and variable split."><PeopleSetup /></Page>;
