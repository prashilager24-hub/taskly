import { useEffect, useState } from "react";
import axios from "axios";
import { Plus } from "lucide-react";

import DateRangeField from "@/components/DateRangeField";
import {
    Button,
    Chip,
    Pagination,
    Spinner,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
    Tooltip,
} from "@/components/ui";

// Daily Activity → My entries (requirements DA-02, DA-09): the user's logged work, newest first,
// with approval status and the EL's comment on rejected entries.

interface Entry {
    dailyTaskLogID: number;
    workDate: string;
    taskName: string | null;
    isForTarget: boolean | null;
    leaveType: string | null;
    allocatedTime: number | null;
    timeTakenToWork: number | null;
    units: number | null;
    achivedUnits: number | null;
    remarks: string | null;
    approvedByEL: boolean | null;
    commentForRejection?: string | null;
}

const PAGE_SIZE = 10;
const isoDate = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

function entryType(e: Entry) {
    if (e.leaveType === "FULL_DAY") return "Leave";
    if (e.leaveType === "HALF_DAY") return "Half day";
    return e.isForTarget ? "Target" : "Task";
}

function StatusChip({ entry }: { entry: Entry }) {
    if (entry.approvedByEL) return <Chip size="sm" color="success" variant="flat">Approved</Chip>;
    if (entry.commentForRejection) {
        return (
            <Tooltip content={entry.commentForRejection}>
                <Chip size="sm" color="danger" variant="flat">Rejected</Chip>
            </Tooltip>
        );
    }
    return <Chip size="sm" variant="flat">Pending</Chip>;
}

export default function PastEntries({
    userId,
    departmentId,
    onLogActivity,
}: {
    userId: number;
    departmentId: number | null;
    onLogActivity: () => void;
}) {
    const today = new Date();
    const [startDate, setStartDate] = useState(isoDate(new Date(today.getTime() - 6 * 86_400_000)));
    const [endDate, setEndDate] = useState(isoDate(today));
    const [page, setPage] = useState(1);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => setPage(1), [userId, departmentId, startDate, endDate]);

    useEffect(() => {
        if (!userId) return;
        const controller = new AbortController();
        setLoading(true);
        setError(false);
        axios
            .post(
                `/t2.0/authentificationUtilization/form/list?page=${page}&size=${PAGE_SIZE}&sortBy=workDate`,
                // No roleID: the list must stay scoped to the selected user, even for admins
                { userID: userId, departmentID: departmentId || null, startDate, endDate },
                { signal: controller.signal },
            )
            .then((res) => {
                setEntries(res.data?.response?.userWorkDataList ?? []);
                setTotalPages(res.data?.response?.totalPages ?? 0);
            })
            .catch((err) => { if (!axios.isCancel(err)) setError(true); })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [userId, departmentId, startDate, endDate, page]);

    return (
        <div className="flex flex-col gap-4 border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <DateRangeField value={{ start: startDate, end: endDate }} onChange={(r) => { setStartDate(r.start); setEndDate(r.end); }} />
                <Button color="primary" startContent={<Plus size={14} />} onPress={onLogActivity}>
                    Log activity
                </Button>
            </div>

            <Table aria-label="Past entries" removeWrapper>
                <TableHeader>
                    <TableColumn>Date</TableColumn>
                    <TableColumn>Item</TableColumn>
                    <TableColumn>Type</TableColumn>
                    <TableColumn>Planned (min)</TableColumn>
                    <TableColumn>Time taken (min)</TableColumn>
                    <TableColumn>Units</TableColumn>
                    <TableColumn>Status</TableColumn>
                    <TableColumn>Remarks</TableColumn>
                </TableHeader>
                <TableBody
                    items={entries}
                    isLoading={loading}
                    loadingContent={<Spinner size="sm" />}
                    emptyContent={error ? "Could not load entries — try again." : "No entries in this date range."}
                >
                    {(e) => (
                        <TableRow key={e.dailyTaskLogID}>
                            <TableCell className="whitespace-nowrap">{e.workDate}</TableCell>
                            <TableCell>{e.taskName ?? "—"}</TableCell>
                            <TableCell>{entryType(e)}</TableCell>
                            <TableCell>{e.allocatedTime ?? "—"}</TableCell>
                            <TableCell>{e.timeTakenToWork ?? "—"}</TableCell>
                            <TableCell>{e.isForTarget ? `${e.achivedUnits ?? 0} / ${e.units ?? "—"}` : e.achivedUnits ?? "—"}</TableCell>
                            <TableCell><StatusChip entry={e} /></TableCell>
                            <TableCell className="max-w-xs truncate" title={e.remarks ?? ""}>{e.remarks ?? "—"}</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            {totalPages > 1 && (
                <div className="flex justify-end">
                    <Pagination showControls page={page} total={totalPages} onChange={setPage} />
                </div>
            )}
        </div>
    );
}
