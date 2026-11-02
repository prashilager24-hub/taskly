import { useCallback, useState } from "react";
import axios from "axios";
import { format, subDays } from "date-fns";

import { Button, Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, addToast } from "@/components/ui";
import { EmptyContainer } from "@/components";
import CustomDateRangePicker from "./customDateRangePicker";

// People who did not log work in a date range. Lives on the User Data page (admins, not tied to a department).
const lastDays = (n: number) => ({ startDate: format(subDays(new Date(), n), "yyyy-MM-dd"), endDate: format(new Date(), "yyyy-MM-dd") });

export default function MissingLogsButton() {
    const [open, setOpen] = useState(false);
    const [range, setRange] = useState(() => lastDays(7));
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const run = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/t2.0/authentificationUtilization/MissingData?startDate=${range.startDate}&endDate=${range.endDate}`, { headers: { "Content-Type": "application/json" } });
            setUsers(res.data ?? []);
            addToast({ title: "Success", description: "Log Successfully Generated", color: "success" });
        } catch {
            addToast({ title: "Error", description: "Failed to fetch log data", color: "danger" });
        } finally {
            setLoading(false);
        }
    }, [range]);

    return (
        <>
            <Button size="sm" variant="bordered" onPress={() => setOpen(true)}>Missing logs</Button>

            <Drawer size="4xl" isOpen={open} onOpenChange={setOpen}>
                <DrawerContent>
                    {(onClose) => (
                        <>
                            <DrawerHeader className="flex flex-col gap-1">Person not Logged</DrawerHeader>
                            <DrawerBody>
                                <div className="flex items-center justify-center gap-3">
                                    <CustomDateRangePicker value={range} onChange={setRange} />
                                    <Button color="primary" isLoading={loading} onPress={run}>Run Log</Button>
                                </div>

                                {users.length === 0 && !loading && (
                                    <EmptyContainer title="No Missing Logs" description="No users found for selected date range" />
                                )}

                                {users.length > 0 && (
                                    <div className="mt-4 divide-y rounded-lg border">
                                        {users.map((u) => (
                                            <div key={u.userID} className="flex flex-col p-3">
                                                <span className="text-sm font-medium">{u.userName}</span>
                                                <span className="text-xs text-ink-500 dark:text-ink-400">{u.userEmail}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </DrawerBody>
                            <DrawerFooter>
                                <Button color="danger" variant="light" onPress={onClose}>Close</Button>
                            </DrawerFooter>
                        </>
                    )}
                </DrawerContent>
            </Drawer>
        </>
    );
}
