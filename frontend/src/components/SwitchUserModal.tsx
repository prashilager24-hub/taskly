import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";

import {
    Autocomplete,
    AutocompleteItem,
    Button,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
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

    if (!canSwitchUser()) return null;

    return (
        <>
            <Button size="sm" variant="bordered" startContent={<Users size={14} />} onPress={onOpen}>
                Switch User
            </Button>

            <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) reset(); onOpenChange(); }} size="md">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <span className="eyebrow">Admin</span>
                        <span className="text-base font-bold">Switch user</span>
                    </ModalHeader>
                    <ModalBody className="gap-4">
                        <Autocomplete
                            label="Department"
                            labelPlacement="outside"
                            placeholder="Select a department"
                            selectedKey={departmentId || null}
                            onSelectionChange={(key) => setDepartmentId(key ? String(key) : "")}
                        >
                            {departments.map((d) => (
                                <AutocompleteItem key={String(d.id)} textValue={d.name}>{d.name}</AutocompleteItem>
                            ))}
                        </Autocomplete>

                        <Autocomplete
                            label="User"
                            labelPlacement="outside"
                            placeholder={departmentId ? "Select a user" : "Choose a department first"}
                            isDisabled={!departmentId}
                            isLoading={loadingUsers}
                            selectedKey={userId || null}
                            onSelectionChange={(key) => setUserId(key ? String(key) : "")}
                        >
                            {users.map((u) => (
                                <AutocompleteItem key={String(u.id)} textValue={u.name}>{u.name}</AutocompleteItem>
                            ))}
                        </Autocomplete>
                        {departmentId && !loadingUsers && users.length === 0 && (
                            <p className="text-xs text-ink-500">No active users in this department.</p>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="bordered" onPress={() => { reset(); onClose(); }}>Cancel</Button>
                        <Button color="primary" isDisabled={!userId} isLoading={switching} onPress={handleSwitch}>
                            Switch
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
