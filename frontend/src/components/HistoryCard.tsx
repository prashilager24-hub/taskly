import { Card, CardBody, Chip, Button, Divider } from "@/components/ui";

interface HistoryActivity {
    taskName: string;
    workDate: string;
    allocatedTime: string | number;
    timeTakenToWork: string | number;
    remarks: string;
    isForTarget?: boolean;
    dailyTaskLogID?: string;
    taskID?: string;
    targetID?: string;
    [key: string]: any;
}

interface HistoryCardProps {
    activity: HistoryActivity;
    index: number;
    onEdit: (activity: HistoryActivity) => void;
}

export default function HistoryCard({ activity, index, onEdit }: HistoryCardProps) {
    return (
        <Card className="border border-ink-200 dark:border-ink-700 shadow-sm hover:shadow-md">
            <CardBody>
                <div className="flex justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-ink-500 dark:text-ink-400">
                                #{index + 1}
                            </span>
                            <Chip size="sm" color={activity.isForTarget ? "primary" : "default"}>
                                {activity.isForTarget ? "Target" : "Task"}
                            </Chip>
                            <Button
                                size="sm"
                                color="primary"
                                onPress={() => onEdit(activity)}
                            >
                                Edit
                            </Button>
                        </div>

                        <h4 className="font-semibold text-lg mt-2">
                            {activity.taskName}
                        </h4>
                    </div>
                </div>

                <Divider className="my-4" />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <p className="text-ink-500 dark:text-ink-400">Work Date</p>
                        <p className="font-medium">{activity.workDate}</p>
                    </div>

                    <div>
                        <p className="text-ink-500 dark:text-ink-400">Allocated</p>
                        <p className="font-medium">{activity.allocatedTime} mins</p>
                    </div>

                    <div>
                        <p className="text-ink-500 dark:text-ink-400">Time Taken</p>
                        <p className="font-medium">{activity.timeTakenToWork} mins</p>
                    </div>

                    <div>
                        <p className="text-ink-500 dark:text-ink-400">Status</p>
                        <p className="font-medium">{activity.remarks}</p>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}
