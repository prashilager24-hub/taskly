import { DailyActivityLog } from "@/components";

export default function ActivityLogPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-6xl mx-auto">
                <DailyActivityLog />
            </div>
        </div>
    );
}