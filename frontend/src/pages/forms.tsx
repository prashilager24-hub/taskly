import { PageHeader, Segmented } from "@/components/page";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui";
import { Autocomplete, AutocompleteItem } from "@/components/ui";
import EmptyContainer from "@/components/EmptyContainer";
import PastEntries from "@/components/PastEntries";
import { Tab, Tabs } from "@/components/ui";
import { DailyActivityLog } from "@/components";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,

} from "@/components/ui";
import axios from "axios";
import { title } from "@/components/primitives";





export default function FormPage() {
    const authUserLD = localStorage.getItem("authUserLD");
    const user = JSON.parse(authUserLD)
    // Normalizes both user shapes: { departmentID } and { departments: [...] }
    const getUserDepartments = (u) => {
        if (Array.isArray(u?.departments) && u.departments.length > 0) {
            return u.departments.map((dept) => ({
                key: dept.departmentID,
                name: dept.departmentName,
                description: dept.departmentDescription || "",
                status: dept.newStatus || "Active",
                departmentStatus: dept.departmentStatus || "",
            }));
        }
        if (u?.departmentID) {
            return [{
                key: u.departmentID,
                name: u.departmentName || "",
                description: "",
                status: "Active",
                departmentStatus: "",
            }];
        }
        return [];
    };

    const getPrimaryDepartmentId = (u) => {
        if (Array.isArray(u?.departments) && u.departments.length > 0) {
            return u.departments[0].departmentID;
        }
        return u?.departmentID ?? null;
    };
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [selectedUserId, setSelectedUserId] = useState<number>(user.userID);
    const [taskList, setTaskList] = useState([]);
    const [users, setUsers] = useState<User[]>([

    ]);
    const [departmentList, setDepartmentList] = useState([]);
    const [filterStatus, setFilterStatus] = useState<number | null>(null);
    const [departmentInput, setDepartmentInput] = useState("");
    // Opens on past entries (DA-02); "Log activity" shows the entry form, filtered by frequency (DA-03)
    const [view, setView] = useState<"entries" | "log">("entries");

    useEffect(() => {
        if (filterStatus !== null) return;

        const primaryDeptId = getPrimaryDepartmentId(user);

        if (primaryDeptId) {
            const dept = departmentList.find(d => d.key === primaryDeptId);
            if (dept) {
                setFilterStatus(dept.key);
                setDepartmentInput(dept.name);
                return;
            }
        }

        if (departmentList.length > 0) {
            setFilterStatus(departmentList[0].key);
            setDepartmentInput(departmentList[0].name);
        }
    }, [user, departmentList, filterStatus]);






    const [tasks, setTasks] = useState<Task[]>([

    ]);
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);





    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const body = {
                    filter: "",
                    searchText: "",
                    departmentID: filterStatus ? Number(filterStatus) : 0,
                };

                const res = await axios.post(
                    "/t2.0/authentificationUtilization/users/read?page=0&size=0",
                    body,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""
                                }`,
                        },
                    }
                );

                const usersData = res.data.response.users || [];

                const mappedUsers = usersData.map((u: any) => ({
                    userID: u.userID,
                    userName: u.userName,
                    roleID: u.roleID,
                }));

                setUsers(mappedUsers);

                setSelectedUserId((prev) => {
                    const exists = mappedUsers.find((u) => u.userID === prev);

                    if (exists) {
                        return prev;
                    }

                    return mappedUsers.length
                        ? mappedUsers[0].userID
                        : user.userID;
                });
            } catch (err) {
                console.error(err);
            }
        };

        fetchUsers();
    }, [filterStatus]);


    useEffect(() => {

        const fetchDepartments = async () => {
            try {
                const bodyData = {
                    searchText: "",
                    filter: "",
                    startDate: "",
                    endDate: "",
                    roleID: user.userRole,
                    userID: (user.isHeExecutiveLeader) ? Number(user.userID) : Number(filterStatus),
                };

                const res = await axios.post(
                    "/t2.0/authentificationUtilization/Department/list?page=0&size=0",
                    bodyData,
                    {
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );

                const data = await res.data.response.departments;
                const userDepartmentIds = getUserDepartments(user);
                const formatted = data?.map((dept) => ({
                    key: dept.departmentID,
                    name: dept.departmentName,
                    description: dept.departmentDescription,
                    status: dept.newStatus,
                    departmentStatus: dept.departmentStatus
                })) || [];

                // If this user has an explicit multi-department list, prefer it — regardless of role
                if (Array.isArray(user?.departments) && user.departments.length > 0) {
                    setDepartmentList(userDepartmentIds);
                    console.log("Department List (multi-department user):", userDepartmentIds);
                    return;
                } else {
                    setDepartmentList(formatted);
                }

            } catch (err) {
                console.error("Error fetching department list:", err);
            }
        };

        fetchDepartments();
    }, []);

    useEffect(() => {
        if (!filterStatus || !selectedUserId) return;
        const fetchDepartmentTask = async () => {
            try {
                const bodyData = {
                    departmentId: filterStatus, roleId: [1, 3, 4, 7, 23].includes(user.userRole)
                        ? (users.find((u) => u.userID === selectedUserId)?.roleID ?? null)
                        : user.userRole
                };

                const res = await axios.post(
                    "/t2.0/authentificationUtilization/departmentTasks/getTasksByDepartment",
                    bodyData,
                    { headers: { "Content-Type": "application/json" } }
                );

                setTaskList(res.data.result);
            } catch (err) {
                console.error(err);
            }
        };

        fetchDepartmentTask();
    }, [filterStatus, selectedUserId, users]);


    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const bodyData = {
                    searchText: "",
                    filter: "",
                    startDate: "",
                    endDate: ""
                };

                const { data } = await axios.post(
                    "/t2.0/authentificationUtilization/departmentTasks/list?page=1&size=50",
                    bodyData,
                    { headers: { "Content-Type": "application/json" } }
                );

                const tasks: Task[] = data.response.tasks.map((t: any) => ({
                    taskID: t.taskID,
                    createdAt: t.createdAt.split("T")[0],
                    taskName: t.taskName,
                    description: t.description,
                    departmentID: t.departmentID,
                    standardTimeMins: t.standardTimeMins ? t.standardTimeMins : "N/A",
                    frequency: t.frequency,
                    isDynamic: t.isDynamic,
                    isActive: t.isActive,

                    modifiedAt: t.modifiedAt
                }));

                setTasks(tasks);
            } catch (err) {
                console.error("Error fetching tasks:", err);
            }
        };
        fetchTasks();
    }, [filterStatus])


    // Daily and weekly tasks are offered together; each task keeps its own frequency
    const frequencyTasks = taskList;

    return (
        <div>
            <PageHeader title="Daily Activity" subtitle="Log what you worked on today, or review the entries already submitted." />

            {!(
                user.userRole == 2 ||
                user.userRole == 5 ||
                user.userRole == 6
            ) && (
                <section aria-label="Whose activity" className="mb-6 border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
                    <p className="eyebrow mb-3">Logging for</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-3xl">
                        <Autocomplete
                                        label="Department"
                                labelPlacement="outside"
                                        placeholder="Select department"
                                        className="w-full"
                                        selectedKey={filterStatus}
                                        inputValue={departmentInput}
                                        onInputChange={setDepartmentInput}
                                        onSelectionChange={(key) => {
                                            if (!key) return;

                                            const selectedDept = departmentList.find(
                                                (d) => d.key === Number(key)
                                            );

                                            if (selectedDept) {
                                                // setSelectedUserId(0);
                                                setFilterStatus(selectedDept.key);
                                                setDepartmentInput(selectedDept.name);
                                            }
                                        }}
                                    >
                                        {departmentList.sort((a, b) => a.name.localeCompare(b.name))
                                            .filter((ele) => ele.status === "Active")
                                            .map((ele) => (
                                                <AutocompleteItem key={ele.key}>
                                                    {ele.name}
                                                </AutocompleteItem>
                                            ))}
                                    </Autocomplete>
                        {(user.userRole === 3 || user.userRole === 4 || user.userRole === 7 || user.userRole === 23 || user.userRole === 1) && (
                            <Autocomplete
                                            label="Person"
                                labelPlacement="outside"
                                            placeholder="Select person"
                                            className="w-full"
                                            selectedKey={String(selectedUserId)}
                                            onSelectionChange={(key) =>
                                                setSelectedUserId(Number(key))
                                            }
                                        >
                                            {users.sort((a, b) => a.userName.localeCompare(b.userName)).map((u) => (
                                                <AutocompleteItem key={u.userID}>
                                                    {u.userName}
                                                </AutocompleteItem>
                                            ))}
                                        </Autocomplete>
                        )}
                    </div>
                </section>
            )}

            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <Segmented
                    label="Daily Activity views"
                    value={view}
                    onChange={setView}
                    options={[
                        { key: "entries", label: selectedUserId === user.userID ? "My entries" : "Entries" },
                        { key: "log", label: "Log activity" },
                    ]}
                />
                {/* Import / Export template are rendered here by the Log activity form */}
                <div id="da-toolbar-slot" className="flex items-center gap-2" />
            </div>

            {view === "entries" ? (
                <PastEntries userId={selectedUserId} departmentId={filterStatus} onLogActivity={() => setView("log")} />
            ) : (
            <div>
                {filterStatus ? (
                    <DailyActivityLog task={frequencyTasks} DeptId={filterStatus} selectedUserId={selectedUserId} selectedUserRole={
                        [1, 3, 4].includes(user.userRole)
                            ? (users.find((u) => u.userID === selectedUserId)?.roleID ?? null)
                            : user.userRole
                    }
                    />
                ) : (
                    <EmptyContainer
                        title="No Forms"
                        description="Select the filters to see the Results"
                    />
                )}
            </div>
            )}


        </div>
    );
}