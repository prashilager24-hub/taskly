import { PageTitle } from "@/components/page";
import MyAppraisal from "@/components/appraisal/MyAppraisal";
import TeamAppraisals from "@/components/appraisal/TeamAppraisals";
import ReviewForm from "@/components/appraisal/ReviewForm";
import Budget from "@/components/appraisal/Budget";
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

export const MyAppraisalPage = () => <Page title="My appraisal" subtitle="Your yearly appraisal: fill in your part, then see your offer."><MyAppraisal /></Page>;
export const TeamAppraisalsPage = () => <Page title="Team appraisals" subtitle="Everyone you assess, together: their PMS quarters, what they ask for, and the hike you propose."><TeamAppraisals /></Page>;
export const ReviewFormPage = () => <Page title="Appraisal review" subtitle="Read the PMS quarters, comment on what the employee asks for, and propose a hike."><ReviewForm /></Page>;
export const BudgetPage = () => <Page title="Budget" subtitle="Finance gives each EL a hike budget, the EL splits it between FLs, and each FL proposes hikes inside their share."><Budget /></Page>;
export const HrPostponementsPage = () => <Page title="HR postponements" subtitle="Offers that employees rejected, with their reason and what they expect."><HrPostponements /></Page>;
export const AppraisalSetupPage = () => <Page title="Appraisal setup" subtitle="Joining dates start each person's cycle. Level sets the fixed and variable split."><PeopleSetup /></Page>;
