import { Navigate, useSearchParams } from "react-router-dom";

import DashboardPage from "@/pages/dashboard";

// Taskly overview dashboard. PMS is its own menu item and page (/pms); old ?view=pms links are sent there.

export default function DashboardHome() {
    const [params] = useSearchParams();
    if (params.get("view") === "pms") return <Navigate to="/pms" replace />;

    return (
        <div className="flex w-full flex-col gap-4">
            <DashboardPage />
        </div>
    );
}
