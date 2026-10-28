import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";

import {
    Button,
    Drawer,
    DrawerBody,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    Input,
    addToast,
    useDisclosure,
} from "@/components/ui";
import { getCurrentUser, getOriginalUser, switchToUser } from "./userSwitch";

// Topbar "Switch User" (requirements ADM-01–ADM-03): pick a department, then a user in it,
// and open the app as that user. The "Viewing as … / Return" banner comes from SwitchedUserBanner.

interface Option {
    id: number;
    name: string;
}

const API = "/t2.0/authentificationUtilization";

/** The real signed-in admin — while switched, the active session belongs to the target user */
const adminUser = () => getOriginalUser() ?? getCurrentUser();

export function canSwitchUser() {
    // Backend /user/switch allows Root (role 1) only; Access Management will make this a permission
    return adminUser()?.userRole === 1;
}

export default function SwitchUserModal() {
    const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
    const navigate = useNavigate();

    const [departments, setDepartments] = useState<Option[]>([]);
    const [users, setUsers] = useState<Option[]>([]);
    const [departmentId, setDepartmentId] = useState<string>("");
    const [userId, setUserId] = useState<string>("");
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [switching, setSwitching] = useState(false);

    // Departments: loaded when the modal first opens
    useEffect(() => {
        if (!isOpen || departments.length) return;
        const admin = adminUser();
        axios
            .post(
                `${API}/Department/list?page=0&size=0`,
                { searchText: "", filter: "Active", roleID: admin?.userRole, userID: admin?.userID },
                { headers: { Authorization: `Bearer ${admin?.token ?? ""}` } },
            )
            .then((res) =>
                setDepartments(
                    (res.data?.response?.departments ?? []).map((d: any) => ({ id: d.departmentID, name: d.departmentName })),
                ),
            )
            .catch(() => addToast({ title: "Could not load departments", color: "danger" }));
    }, [isOpen, departments.length]);

    // Users: reloaded whenever the department changes
    useEffect(() => {
        setUserId("");
        setUsers([]);
        if (!departmentId) return;
        setLoadingUsers(true);
        axios
            .post(
                `${API}/users/read?page=0&size=0`,
                { filter: "Active", searchText: "", departmentID: Number(departmentId) },
                { headers: { Authorization: `Bearer ${adminUser()?.token ?? ""}` } },
            )
            .then((res) =>
                setUsers(
                    (res.data?.response?.users ?? [])
                        .map((u: any) => ({ id: u.userID, name: u.userName }))
                        .sort((a: Option, b: Option) => a.name.localeCompare(b.name)),
                ),
            )
            .catch(() => addToast({ title: "Could not load users", color: "danger" }))
            .finally(() => setLoadingUsers(false));
    }, [departmentId]);

    const reset = () => {
        setDepartmentId("");
        setUserId("");
    };

    const handleSwitch = async () => {
        if (!userId) return;
        setSwitching(true);
        try {
            await switchToUser(Number(userId), adminUser()?.token ?? "");
            const name = users.find((u) => String(u.id) === userId)?.name ?? "the selected user";
            addToast({ title: "Switched user", description: `You are now viewing Taskly as ${name}.`, color: "success" });
            reset();
            onClose();
            navigate("/dashboard");
            // Every page reads the active user from storage on mount — reload so they all pick it up
            window.location.reload();
        } catch (err: any) {
            addToast({
                title: "Switch failed",
                description: err?.response?.data?.message || "Could not switch to that user.",
                color: "danger",
            });
        } finally {
            setSwitching(false);
        }
    };

    const [deptSearch, setDeptSearch] = useState("");
    const [userSearch, setUserSearch] = useState("");
    const shownDepartments = departments.filter((d) => d.name.toLowerCase().includes(deptSearch.toLowerCase()));
    const shownUsers = users.filter((u) => u.name.toLowerCase().includes(userSearch.toLowerCase()));

    if (!canSwitchUser()) return null;

    const row = (active: boolean) =>
        `flex w-full items-center justify-between border px-3 py-2.5 text-left text-sm transition-colors focus-ring ${
            active
                ? "border-brand-600 bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                : "border-ink-200 text-ink-800 hover:border-brand-500 dark:border-white/10 dark:text-ink-100"
        }`;

    // Plain lists inside the canvas (no pop-up menus), so picking a department never dismisses it
    return (
        <>
            <Button size="sm" variant="bordered" startContent={<Users size={14} />} onPress={onOpen}>
                Switch User
            </Button>

            <Drawer isOpen={isOpen} onOpenChange={(open) => { if (!open) reset(); onOpenChange(); }} size="md">
                <DrawerContent>
                    <DrawerHeader className="flex flex-col gap-1">
                        <span className="eyebrow">Admin</span>
                        <span>Switch user</span>
                    </DrawerHeader>
                    <DrawerBody className="gap-6">
                        <section className="flex flex-col gap-2">
                            <p className="eyebrow">1 · Department</p>
                            <Input size="sm" placeholder="Search departments" value={deptSearch} onValueChange={setDeptSearch} />
                            <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                                {shownDepartments.map((d) => (
                                    <button key={d.id} type="button" className={row(String(d.id) === departmentId)} onClick={() => { setDepartmentId(String(d.id)); setUserSearch(""); }}>
                                        {d.name}
                                    </button>
                                ))}
                                {!shownDepartments.length && <p className="text-xs text-ink-500 dark:text-ink-400">{departments.length ? "No matching department." : "Loading departments…"}</p>}
                            </div>
                        </section>

                        <section className="flex flex-col gap-2">
                            <p className="eyebrow">2 · User</p>
                            <Input size="sm" placeholder="Search users" value={userSearch} onValueChange={setUserSearch} isDisabled={!departmentId} />
                            <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                                {shownUsers.map((u) => (
                                    <button key={u.id} type="button" className={row(String(u.id) === userId)} onClick={() => setUserId(String(u.id))}>
                                        {u.name}
                                    </button>
                                ))}
                                {!departmentId && <p className="text-xs text-ink-500 dark:text-ink-400">Choose a department first.</p>}
                                {departmentId && loadingUsers && <p className="text-xs text-ink-500 dark:text-ink-400">Loading users…</p>}
                                {departmentId && !loadingUsers && users.length === 0 && <p className="text-xs text-ink-500 dark:text-ink-400">No active users in this department.</p>}
                            </div>
                        </section>
                    </DrawerBody>
                    <DrawerFooter>
                        <Button variant="bordered" onPress={() => { reset(); onClose(); }}>Cancel</Button>
                        <Button color="primary" isDisabled={!userId} isLoading={switching} onPress={handleSwitch}>
                            Switch
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </>
    );
}
