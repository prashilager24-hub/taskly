import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Tabs, Tab, Card, CardBody, Listbox, ListboxItem, addToast, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Autocomplete, AutocompleteItem } from "@/components/ui";
import { Input } from "@/components/ui";
import EmptyContainer from "@/components/EmptyContainer";
import { Select, SelectItem } from "@/components/ui";
import { DailyActivityLog } from "@/components";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
} from "@/components/ui";
import axios from "axios";
import { title } from "@/components/primitives";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

// Confirmation Modal Component
const ConfirmDeleteModal = ({
    isOpen,
    onClose,
    onConfirm,
    departmentName,
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    departmentName: string;
}) => (
    <Modal isOpen={isOpen} onOpenChange={onClose} size="sm">
        <ModalContent>
            <ModalHeader>Delete Department</ModalHeader>
            <ModalBody>
                <p>
                    Are you sure you want to delete <strong>{departmentName}</strong>?
                </p>
                <p className="text-sm text-default-500">
                    This action cannot be undone.
                </p>
            </ModalBody>
            <ModalFooter>
                <Button variant="light" onPress={onClose}>
                    Cancel
                </Button>
                <Button
                    color="danger"
                    onPress={() => {
                        onConfirm();
                        onClose();
                    }}
                >
                    Delete
                </Button>
            </ModalFooter>
        </ModalContent>
    </Modal>
);



export default function DepartmentPage() {
    const authUserLD = localStorage.getItem("authUserLD");
    const user = JSON.parse(authUserLD)
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState(
        user?.departmentID ? String(user.departmentID) : ""
    );
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [department, setDepartment] = useState("");
    const [taskList, setTaskList] = useState([]);
    const [departmentDescription, setDepartmentDescription] = useState("");
    const [users, setUsers] = useState<User[]>([

    ]);
    const [executiveLeader, setExecutiveLeader] = useState("")
    const [functionalLeader, setFunctionalLeader] = useState("")
    const [departmentList, setDepartmentList] = useState([]);
    const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
    const [edit, setEdit] = useState(false);
    const [toggleConfirm, setToggleConfirm] = useState<{
        open: boolean;
        id?: number;
        name?: string;
        status?: string;
    }>({ open: false });

    const [deleteConfirm, setDeleteConfirm] = useState<{
        open: boolean;
        id?: number;
        name?: string;
    }>({ open: false });
    const [tasks, setTasks] = useState<Task[]>([

    ]);
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);





    useEffect(() => {

        const fetchUsers = async () => {
            try {
                const body = {
                    filter: "",
                    searchText: "",
                    departmentID: null
                };

                const res = await axios.post(
                    "/t2.0/authentificationUtilization/users/read?page=0&size=0",
                    body,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
                        },
                    }
                );

                const usersData = res.data.response.users || [];

                const formatted: User[] = usersData.map((u: any) => ({
                    userID: u.userID,
                    userName: u.userName,
                    // departmentName: u.departmentName || "N/A",
                    // departmentID: u.departmentID,

                }));

                console.log(formatted, "hello")
                setUsers(formatted);
                console.log("Users formatted:", formatted);
            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };

        fetchUsers();


    }, []);


    useEffect(() => {

        const fetchDepartments = async () => {
            try {
                const bodyData = {
                    searchText: "",
                    filter: "",
                    startDate: "",
                    endDate: "",
                    roleID: user.userRole,
                    userID: user.isHeExecutiveLeader ? Number(user.userID) : Number(filterStatus),
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

                const formatted = data?.map((dept) => ({
                    key: dept.departmentID,
                    name: dept.departmentName,
                    description: dept.departmentDescription,
                    status: dept.newStatus,
                    departmentStatus: dept.departmentStatus,
                    executiveLeaderID: String(dept.executiveLeaderID || ""),
                    functionalLeaderID: String(dept.functionalLeaderID || ""),
                })) || [];


                setDepartmentList(formatted);
                console.log("departmentlist", formatted);
            } catch (err) {
                console.error("Error fetching department list:", err);
            }
        };

        fetchDepartments();
    }, [edit]);
    // useEffect(() => {
    //     const fetchDepartmentTask = async () => {
    //         try {
    //             const bodyData = { departmentId: Number(filterStatus) }


    //             const res = await axios.post(
    //                 "/t2.0/authentificationUtilization/departmentTasks/getTasksByDepartment",
    //                 bodyData,
    //                 {
    //                     headers: {
    //                         "Content-Type": "application/json",
    //                     },
    //                 }
    //             );

    //             const data = await res.data.result;

    //             console.log("tasklist", data)

    //             setTaskList(data);
    //         } catch (err) {
    //             console.error("Error fetching department list:", err);
    //         }
    //     };

    //     fetchDepartmentTask();
    // }, [filterStatus])

    // console.log(taskList)
    // useEffect(() => {
    //     const fetchTasks = async () => {
    //         try {
    //             const bodyData = {
    //                 searchText: "",
    //                 filter: "",
    //                 startDate: "",
    //                 endDate: ""
    //             };

    //             const { data } = await axios.post(
    //                 "/t2.0/authentificationUtilization/departmentTasks/list?page=1&size=50",
    //                 bodyData,
    //                 { headers: { "Content-Type": "application/json" } }
    //             );

    //             const tasks: Task[] = data.response.tasks.map((t: any) => ({
    //                 taskID: t.taskID,
    //                 createdAt: t.createdAt.split("T")[0],
    //                 taskName: t.taskName,
    //                 description: t.description,
    //                 departmentID: t.departmentID,
    //                 standardTimeMins: t.standardTimeMins ? t.standardTimeMins : "N/A",
    //                 frequency: t.frequency,
    //                 isDynamic: t.isDynamic,
    //                 isActive: t.isActive,

    //                 modifiedAt: t.modifiedAt
    //             }));

    //             setTasks(tasks);
    //         } catch (err) {
    //             console.error("Error fetching tasks:", err);
    //         }
    //     };
    //     fetchTasks();
    // }, [filterStatus])

    const handleAddDepartment = async () => {
        try {
            const payload = {
                departmentName: department,
                departmentDescription: departmentDescription,
                executiveLeaderID: executiveLeader
            };
            const headers = {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${JSON.parse(authUserLD).token}`,
            };

            const response = await axios.post(
                "/t2.0/authentificationUtilization/Department/create",
                payload,
                { headers }
            );

            console.log("Department Created:", response.data);
            addToast({
                title: "Success",
                description: "Department created successfully",
                color: "success",
            });

            setDepartment("");
            setDepartmentDescription("");

            // Refresh list
            const bodyData = {
                searchText: "",
                filter: "",
                startDate: "",
                endDate: "",
                roleID: user.userRole,
                userID: user.isHeExecutiveLeader ? Number(user.userID) : Number(filterStatus),
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

            const formatted = data?.map((dept) => ({
                key: dept.departmentID,
                name: dept.departmentName,
                description: dept.departmentDescription,
                status: dept.newStatus,
                departmentStatus: dept.departmentStatus,
                executiveLeaderID: String(dept.executiveLeaderID || ""),
                functionalLeaderID: String(dept.functionalLeaderID || ""),
            })) || [];


            setDepartmentList(formatted);
            console.log("departmentlist", formatted);
        } catch (error) {
            console.error("Error creating department:", error);
            addToast({
                title: "Error",
                description: "Failed to create department",
                color: "danger",
            });
        }
    };

    const handleEditDepartment = async (id: number) => {
        try {
            const payload = {
                departmentName: department,
                departmentDescription: departmentDescription,
                functionalLeaderID: Number(functionalLeader),
                executiveLeaderID: Number(executiveLeader)

            };
            const headers = {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${JSON.parse(authUserLD).token}`,
            };

            const response = await axios.post(
                `/t2.0/authentificationUtilization/Department/update/${id}`,
                payload,
                { headers }
            );

            console.log("Department Edited:", response.data);
            addToast({
                title: "Success",
                description: "Department updated successfully",
                color: "success",
            });

            setDepartment("");
            setEdit(false);
            setDepartmentDescription("");
            setSelectedDepartmentId("");


        } catch (error) {
            console.error("Error editing department:", error);
            addToast({
                title: "Error",
                description: "Failed to update department",
                color: "danger",
            });
        }
    };

    const handleDeleteDepartment = async (id: number) => {
        try {
            const payload = {
                departmentIDList: [id],
            };

            const headers = {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${JSON.parse(authUserLD).token}`,
            };

            const response = await axios.post(
                "/t2.0/authentificationUtilization/Department/archive",
                payload,
                { headers }
            );

            console.log("Department Deleted:", response.data);
            addToast({
                title: "Success",
                description: "Department deleted successfully",
                color: "success",
            });

            setDepartmentList((prev) => prev.filter((dept) => dept.key !== id));
        } catch (error) {
            console.error("Error deleting department:", error);
            addToast({
                title: "Error",
                description: "Failed to delete department",
                color: "danger",
            });
        }
    };

    const handleToggleDepartment = async (id: number, newStatus: boolean) => {
        try {
            const payload = {
                departmentIDList: [id],
                departmentStatus: newStatus
            };

            const headers = {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${JSON.parse(authUserLD).token}`,
            };

            await axios.post(
                `/t2.0/authentificationUtilization/Department/status`,
                payload,
                { headers }
            );

            addToast({
                title: "Success",
                description: `Department ${newStatus ? "activated" : "deactivated"} successfully`,
                color: newStatus ? "success" : "warning",
            });

            setDepartmentList(prev =>
                prev.map(dept =>
                    dept.key === id ? { ...dept, departmentStatus: newStatus } : dept
                )
            );
        } catch (error) {
            console.error("Status change error:", error);
            addToast({
                title: "Error",
                description: "Failed to update department status",
                color: "danger",
            });
        }
    };



    const openEditModal = (dept) => {
        setSelectedDepartmentId(dept.key);
        setEdit(true)
        setDepartment(dept.name);
        setDepartmentDescription(dept.description || "");
        setExecutiveLeader(dept.executiveLeaderID || "");
        setFunctionalLeader(dept.functionalLeaderID || "");
        onOpen();
    };


    const handleOpenModal = () => {
        setDepartment("");
        setDepartmentDescription("");
        setSelectedDepartmentId("");
        setExecutiveLeader("");
        setFunctionalLeader("");
        onOpen();
    };


    return (
        <div className="flex flex-col h-full">

            {/* HEADER */}
            <div className="flex justify-between items-center mb-4 h-12">
                <div>
                    <h1 className={title({ size: "20px" })}>Department</h1>
                    <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
                        Manage and monitor all company departments
                    </p>
                </div>

                <Button size="sm" color="primary" onClick={handleOpenModal}>
                    Add Department
                </Button>
            </div>

            {/* MAIN LIST AREA */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 p-4">

                {departmentList
                    // .filter((ele) => ele.status === "Active")
                    .sort((a, b) => a.key - b.key)
                    .map((ele) => (
                        <div
                            key={ele.key}
                            className="relative p-5 rounded-xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
                        >
                            {/* Top Section */}
                            <div className="flex justify-between items-start">

                                {/* Left: Icon + Name */}
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-white text-lg font-bold">
                                        {ele.name?.charAt(0)}
                                    </div>

                                    <div>
                                        <div
                                            className="text-sm font-semibold text-ink-800 dark:text-white break-all overflow-hidden"
                                            style={{
                                                display: "-webkit-box",
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: "vertical",
                                            }}
                                        >
                                            {ele.name}
                                        </div>
                                        <div className="text-xs text-ink-500 dark:text-ink-400">
                                            ID: {ele.key}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Dropdown */}
                                <Dropdown>
                                    <DropdownTrigger>
                                        <button
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-white text-lg"
                                        >
                                            ⋮
                                        </button>
                                    </DropdownTrigger>

                                    <DropdownMenu
                                        aria-label="Actions"
                                        onAction={(key) => {
                                            if (key === "edit") openEditModal(ele);
                                            if (key === "delete")
                                                setDeleteConfirm({
                                                    open: true,
                                                    id: ele.key,
                                                    name: ele.name,
                                                });
                                            if (key === "toggle") {
                                                setToggleConfirm({
                                                    open: true,
                                                    id: ele.key,
                                                    name: ele.name,
                                                    departmentStatus: ele.departmentStatus,
                                                });
                                            }
                                        }}
                                    >
                                        <DropdownItem key="edit" className="text-blue-600">
                                            Edit
                                        </DropdownItem>

                                        <DropdownItem key="delete" className="text-red-600">
                                            Delete
                                        </DropdownItem>

                                        <DropdownItem
                                            key="toggle"
                                            className={
                                                ele.departmentStatus ? "text-red-600" : "text-green-600"
                                            }
                                        >
                                            {ele.departmentStatus ? "Deactivate" : "Activate"}
                                        </DropdownItem>
                                    </DropdownMenu>
                                </Dropdown>
                            </div>

                            {/* Bottom Section */}
                            <div className="mt-4 flex justify-between items-center">

                                {/* Status Pill */}
                                <span
                                    className={`px-3 py-1 text-xs font-medium rounded-full ${ele.departmentStatus
                                        ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200"
                                        : "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200"
                                        }`}
                                >
                                    {ele.departmentStatus ? "Active" : "Inactive"}
                                </span>

                                {/* Optional subtle indicator */}
                                <div className="text-xs text-ink-400">
                                    Dept
                                </div>
                            </div>
                        </div>
                    ))}
            </div>
            {/* =========================== */}
            {/*       ADD / EDIT MODAL      */}
            {/* =========================== */}

            <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>
                                {selectedDepartmentId ? "Edit Department" : "Add New Department"}
                            </ModalHeader>

                            <ModalBody>
                                <div className="space-y-4">
                                    <Input
                                        label="Department"
                                        placeholder="Enter department name"
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        variant="bordered"
                                        isRequired
                                    />

                                    <Input
                                        label="Department Description"
                                        placeholder="Enter department description"
                                        value={departmentDescription}
                                        onChange={(e) => setDepartmentDescription(e.target.value)}
                                        variant="bordered"
                                    />

                                    <Select
                                        label="Executive Leader"
                                        placeholder="Select Executive Leader"
                                        selectedKeys={executiveLeader ? [executiveLeader] : []}
                                        onSelectionChange={(keys) =>
                                            setExecutiveLeader(Array.from(keys)[0] as string)
                                        }
                                        variant="bordered"
                                        isSearchable
                                        isRequired
                                    >
                                        {users.map((user) => (
                                            <SelectItem key={String(user.userID)}>
                                                {user.userName}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                    <Select
                                        label="Functional Leader"
                                        placeholder="Select Functional Leader"
                                        selectedKeys={functionalLeader ? [functionalLeader] : []}
                                        onSelectionChange={(keys) =>
                                            setFunctionalLeader(Array.from(keys)[0] as string)
                                        }
                                        variant="bordered"
                                        isSearchable
                                        isRequired
                                    >
                                        {users.map((user) => (
                                            <SelectItem key={String(user.userID)}>
                                                {user.userName}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                </div>
                            </ModalBody>

                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    Cancel
                                </Button>

                                <Button
                                    color="primary"
                                    onClick={() => {
                                        if (selectedDepartmentId) {
                                            handleEditDepartment(selectedDepartmentId);
                                        } else {
                                            handleAddDepartment();
                                        }
                                        onClose();
                                    }}

                                >
                                    {selectedDepartmentId ? "Update Department" : "Add Department"}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* ============================ */}
            {/*      ACTIVATE / DEACTIVATE    */}
            {/* ============================ */}

            <Modal
                isOpen={toggleConfirm.open}
                onOpenChange={() => setToggleConfirm({ open: false })}
                size="sm"
            >
                <ModalContent>
                    <ModalHeader>
                        {toggleConfirm.departmentStatus ? "Deactivate Department" : "Activate Department"}
                    </ModalHeader>

                    <ModalBody>
                        <p>
                            Are you sure you want to
                            <strong> {toggleConfirm.departmentStatus ? " deactivate " : " activate "} </strong>
                            <b>{toggleConfirm.name}</b>?
                        </p>
                    </ModalBody>

                    <ModalFooter>
                        <Button variant="light" onPress={() => setToggleConfirm({ open: false })}>
                            Cancel
                        </Button>

                        <Button
                            color={toggleConfirm.departmentStatus ? "danger" : "success"}
                            onPress={() => {
                                if (toggleConfirm.id !== undefined) {
                                    handleToggleDepartment(toggleConfirm.id, !toggleConfirm.departmentStatus);
                                }
                                setToggleConfirm({ open: false });
                            }}
                        >
                            {toggleConfirm.departmentStatus ? "Deactivate" : "Activate"}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* DELETE CONFIRMATION */}
            <ConfirmDeleteModal
                isOpen={deleteConfirm.open}
                onClose={() => setDeleteConfirm({ open: false })}
                onConfirm={() => {
                    if (deleteConfirm.id !== undefined) {
                        handleDeleteDepartment(deleteConfirm.id);
                    }
                }}
                departmentName={deleteConfirm.name || ""}
            />
        </div>
    );
}