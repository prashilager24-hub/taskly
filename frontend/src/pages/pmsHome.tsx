import { PageTitle } from "@/components/page";
import PMSPage from "@/pages/pms";

// PMS section: its own menu item. The tabs inside follow each person's access (see pages/pms.tsx).
export default function PmsHome() {
    return (
        <div className="flex w-full flex-col gap-6">
            <PageTitle title="Performance management" subtitle="Goals, manager feedback and quarterly reviews for your people." />
            <PMSPage />
        </div>
    );
}
