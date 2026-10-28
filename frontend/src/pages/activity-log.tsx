import { DailyActivityLog } from "@/components";

export default function ActivityLogPage() {
    return (
        <div className="min-h-screen bg-ink-50 dark:bg-ink-900 p-6">
            <div className="max-w-6xl mx-auto">
                <DailyActivityLog />
            </div>
        </div>
    );
}