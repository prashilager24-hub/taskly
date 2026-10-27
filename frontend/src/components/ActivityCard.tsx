import { Card, CardBody, Chip, Button, Divider } from "@/components/ui";

interface ActivityEntry {
    id: string;
    task: string;
    taskName: string;
    customTask: string;
    timeType: string;
    customTime: string;
    setup: string;
    workDate: string;
    timeTaken?: string;
    remark?: string;
    targetName?: string;
    targetID?: string;
    unit?: string | number;
    frequency?: string;
    achievedUnit?: string;
    goalID?: string;
    goalName?: string;
    expectedUnit?: string;
    isGoal?: boolean;
    comment?: string;
    isDynamic?: boolean;
    isForTarget?: boolean;
    miscallenous?: string;
    NoOfPlayer?: string;
    dailyTaskLogID?: string;
    userGoalDataID?: string;
    remarks?: string;
}

interface ActivityCardProps {
    activity: ActivityEntry;
    index: number;
    onRemove: (id: string) => void;
}

export default function ActivityCard({ activity, index, onRemove }: ActivityCardProps) {
    if (!activity) return null;
    return (
        <Card className="border border-ink-200 dark:border-ink-700 shadow-sm hover:shadow-md transition-all">
            <CardBody>
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-ink-500 dark:text-ink-400">
                                #{index + 1}
                            </span>
                            <Chip
                                size="sm"
                                color={
                                    activity.isGoal
                                        ? "secondary"
                                        : activity.targetName
                                            ? "primary"
                                            : "default"
                                }
                            >
                                {activity.isGoal
                                    ? "Goal"
                                    : activity.targetName
                                        ? "Target"
                                        : "Task"}
                            </Chip>
                        </div>
                        <h4 className="font-semibold text-lg mt-2">
                            {activity.goalName || activity.targetName || activity.taskName}
                        </h4>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            isIconOnly
                            variant="flat"
                            color="danger"
                            size="sm"
                            onClick={() => onRemove(activity.id)}
                        >
                            <svg fill="#ff0000" height="20px" width="20px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 457.503 457.503" xml:space="preserve" stroke="#ff0000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <g> <path d="M381.575,57.067h-90.231C288.404,25.111,261.461,0,228.752,0C196.043,0,169.1,25.111,166.16,57.067H75.929 c-26.667,0-48.362,21.695-48.362,48.362c0,26.018,20.655,47.292,46.427,48.313v246.694c0,31.467,25.6,57.067,57.067,57.067 h195.381c31.467,0,57.067-25.6,57.067-57.067V153.741c25.772-1.02,46.427-22.294,46.427-48.313 C429.936,78.761,408.242,57.067,381.575,57.067z M165.841,376.817c0,8.013-6.496,14.509-14.508,14.509 c-8.013,0-14.508-6.496-14.508-14.509V186.113c0-8.013,6.496-14.508,14.508-14.508c8.013,0,14.508,6.496,14.508,14.508V376.817z M243.26,376.817c0,8.013-6.496,14.509-14.508,14.509c-8.013,0-14.508-6.496-14.508-14.509V186.113 c0-8.013,6.496-14.508,14.508-14.508c8.013,0,14.508,6.496,14.508,14.508V376.817z M320.679,376.817 c0,8.013-6.496,14.509-14.508,14.509c-8.013,0-14.509-6.496-14.509-14.509V186.113c0-8.013,6.496-14.508,14.509-14.508 s14.508,6.496,14.508,14.508V376.817z"></path> </g> </g> </g></svg>
                        </Button>
                    </div>
                </div>

                <Divider className="my-4" />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <p className="text-ink-500 dark:text-ink-400">Frequency</p>
                        <p className="font-medium">
                            {activity.targetName ? activity.frequency || "-" : activity.setup || 1}
                        </p>
                    </div>
                    <div>
                        <p className="text-ink-500 dark:text-ink-400">Expected</p>
                        <p className="font-medium">
                            {activity.targetName
                                ? activity.unit || "-"
                                : activity.goalID
                                    ? activity.unit || activity.expectedUnit || 0
                                    : `${(Number(activity.customTime || 0) * Number(activity.setup || 1)).toFixed(2)} mins`}
                        </p>
                    </div>
                    <div>
                        <p className="text-ink-500 dark:text-ink-400">Achieved</p>
                        <p className="font-medium">
                            {activity.targetName
                                ? activity.achievedUnit || 0
                                : activity.goalID
                                    ? activity.achievedUnit || 0
                                    : `${Number(activity.timeTaken).toFixed(2)} mins`}
                        </p>
                    </div>
                    <div>
                        <p className="text-ink-500 dark:text-ink-400">status</p>
                        <p className="font-medium">{activity.remark}</p>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}
