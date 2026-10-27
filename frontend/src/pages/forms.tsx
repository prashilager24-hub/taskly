import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui";
import { Autocomplete, AutocompleteItem } from "@/components/ui";
import EmptyContainer from "@/components/EmptyContainer";
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
                    departmentId: filterStatus, roleId: [1, 3, 4].includes(user.userRole)
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


    return (
        <div>
            <div className="flex justify-between items-center mb-4" style={{ height: "48px" }}>

                <div>
                    <h1 className={title({ size: "20px" })}>Department Form</h1>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Submit your department's daily tasks and activity updates
                    </p>
                </div>

                <div className=" flex flex-col sm:flex-row gap-4 items-end">


                    <div className="flex gap-3 items-center">

                        {
                            user.userRole == 2 ||
                                user.userRole == 5 ||
                                user.userRole == 6 ||
                                user.userRole == 7 ||
                                user.userRole == 23 ? null : (
                                <div className="mb-6 flex flex-col sm:flex-row gap-4">

                                    <Autocomplete
                                        aria-label="Filter by Department"
                                        placeholder="Filter by Department"
                                        className="max-w-xs"
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

                                    {(user.userRole === 3 || user.userRole === 4 || user.userRole === 1) && (
                                        <Autocomplete
                                            aria-label="Filter by User"
                                            placeholder="Select User"
                                            className="max-w-xs"
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
                            )
                        }
                    </div>



                </div>

            </div>




            <div>
                {filterStatus ? (
                    <DailyActivityLog task={taskList} DeptId={filterStatus} selectedUserId={selectedUserId} selectedUserRole={
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


        </div>
    );
}