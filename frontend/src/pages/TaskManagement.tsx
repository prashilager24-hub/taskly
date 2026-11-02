import { PageTitle } from "@/components/page";
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, addToast } from "@/components/ui";
import { Input } from "@/components/ui";
import axios from "axios";
import { Select, SelectItem } from "@/components/ui";
// import { addToast } from "@/components/ui" // Commented out
import { Textarea } from "@/components/ui";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { TableAction } from "@/components/table"
import DepartmentSplit, { TypeTag } from "@/components/DepartmentSplit";
import { title } from "@/components/primitives";
import { format } from "date-fns";
import { RollerCoaster } from 'lucide-react';

interface Task {
    taskID: number;
    departmentID: number;
    taskName: string;
    standardTimeMins: number;
    frequency: string;
    isDynamic: boolean;
    description: string;
    isActive: boolean;
    createdAt: string;
    modifiedAt: string;
    type?: string; // ✅ optional
}


/** departmentId: shown inside that sub department (Department Management), without the page title */
const TaskManagement: React.FC<{ departmentId?: number }> = ({ departmentId }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [departmentList, setDepartmentList] = useState<any[]>([])
    const [SelectedTask, setSelectedTask] = useState([])
    const [isEditing, setIsEditing] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Task[]>([]);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [toggleStatusValue, setToggleStatusValue] = useState<boolean | null>(null);
    const [tableRefreshKey, setTableRefreshKey] = useState(0);
    const [tasks, setTasks] = useState<Task[]>([

    ]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({
        taskId: -1,
        taskName: '',
        description: '',
        departmentID: '',
        standardTimeMins: 30,
        frequency: 'Daily' as 'Daily' | 'Weekly' | 'Monthly' | 'Dynamic' | 'Not Daily',
        isDynamic: false,
        type: '',
        roleID: '',
    });
    const handleAddTask = async () => {
        try {
            const payload = {
                taskName: newTask.taskName,
                description: newTask.description,
                departmentID: Number(selectedDepartment),
                standardTimeMins: Number(newTask.standardTimeMins),
                frequency: newTask.frequency,
                isDynamic: newTask.isDynamic,
                timingType: newTask.type,
                roleID: Number(newTask.roleID),
            };


            const headers = {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ''}`
            };

            const { data } = await axios.post(
                "/t2.0/authentificationUtilization/departmentTasks/create",
                payload,
                { headers }
            );

            console.log("Task Created:", data);

            addToast({
                title: "Task Created ",
                description: "Your task has been added successfully.",
                color: "success",
            });

            // append new task to table
            setTasks((prev) => [...prev, data.data]);
            setTableRefreshKey((p) => p + 1);

            setIsModalOpen(false);
            setNewTask({
                taskName: "",
                description: "",
                departmentID: "",
                standardTimeMins: 30,
                frequency: "Daily",
                isDynamic: false,
                roleID: "",
            });
        } catch (error: any) {
            console.error("Error creating task:", error);
            addToast({
                title: "Failed ",
                description: error?.response?.data?.message || "Failed to create task",
                color: "danger",
            });
            setIsModalOpen(false);
        }
    };

    const handleEditTask = async (id) => {
        try {
            const payload = {
                taskName: newTask.taskName,
                description: newTask.description,
                departmentID: Number(selectedDepartment),
                standardTimeMins: Number(newTask.standardTimeMins),
                frequency: newTask.frequency,
                isDynamic: newTask.isDynamic,
                timingType: newTask.type,
                roleID: Number(newTask.roleID),
            };

            const headers = {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ''}`
            };

            const { data } = await axios.put(
                `/t2.0/authentificationUtilization/departmentTasks/update/${id}`,
                payload,
                { headers }
            );

            console.log("Task Updated:", data);

            addToast({
                title: "Task Updated ",
                description: "Your task has been added successfully.",
                color: "success",
            });

            // append new task to table
            setTasks(prev =>
                prev.map(t => (t.taskID === id ? data.data : t))
            );
            setTableRefreshKey((p) => p + 1);

            setIsModalOpen(false);
            setNewTask({
                taskName: "",
                description: "",
                departmentID: "",
                standardTimeMins: 30,
                frequency: "Daily",
                isDynamic: false,
                roleID: "",
            });
        } catch (error: any) {
            console.error("Error Updating task:", error);
            addToast({
                title: "Failed ",
                description: error?.response?.data?.message || "Failed to update task",
                color: "danger",
            });
            setIsModalOpen(false);
        }
    };


    const authUserLD = localStorage.getItem("authUserLD");
    const authUser = authUserLD ? JSON.parse(authUserLD) : null;
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // Table configuration

    const taskActions: TableAction[] = [
        {
            key: 'edit',
            label: 'Edit',
            color: 'primary',
            onAction: (row) => {
                console.log("EDIT TASK:", row.taskID, row);
                setIsEditing(true);
                setSelectedTask(row);
                setNewTask({
                    taskId: row.taskID,
                    taskName: row?.taskName ?? "",
                    description: row.description,
                    departmentID: String(row.departmentID),
                    standardTimeMins: row.standardTimeMins || 30,
                    frequency: row.frequency,
                    isDynamic: row.isDynamic,
                    type: row.type || "",
                    roleID: row.roleID ? String(row.roleID) : "",
                });

                setSelectedDepartment(String(row.departmentID));
                setIsModalOpen(true)
            }
        },

    ];
    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const bodyData = {
                    searchText: "",
                    filter: "",
                    startDate: "",
                    endDate: "",
                    roleID: 1,
                    userID: 1,
                };

                const { data } = await axios.post(
                    "/t2.0/authentificationUtilization/Department/list?page=0&size=",
                    bodyData,
                    { headers: { "Content-Type": "application/json" } }
                );

                const formatted = data.response.departments?.map((dept: any) => ({
                    key: dept.departmentID,
                    name: dept.departmentName,
                    description: dept.departmentDescription,
                    status: dept.newStatus,
                })) || [];

                setDepartmentList(formatted);
                console.log("departmentlist", formatted);
            } catch (err) {
                console.error("Error fetching department list:", err);
            }
        };


        fetchDepartments();

    }, []);
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
                    `/t2.0/authentificationUtilization/departmentTasks/list?page=0&size=0`,
                    bodyData,
                    { headers: { "Content-Type": "application/json" } }
                );

                const tasks: Task[] = data.response.tasks
                    .filter((t: any) => t != null) // ✅ filter out null/undefined
                    .map((t: any) => ({
                        taskID: t.taskID,
                        createdAt: t.createdAt.split("T")[0],
                        taskName: t.taskName || "N/A", // default if missing
                        description: t.description || "",
                        departmentID: t.departmentID,
                        departmentName: t.departmentName,
                        standardTimeMins: t.standardTimeMins ?? "N/A",
                        frequency: t.frequency,
                        isDynamic: t.isDynamic,
                        isActive: t.isActive,
                        modifiedAt: t.modifiedAt,
                        type: t.timingType,
                        roleID: t.roleID
                    }));


                setTasks(tasks);
            } catch (err) {
                console.error("Error fetching tasks:", err);
            }
        };
        fetchTasks();

    }, [authUserLD, tableRefreshKey])

    const handleToggleStatus = async () => {
        if (selectedRows.length !== 1 || toggleStatusValue === null) return;

        const row = selectedRows[0];
        const newStatus = toggleStatusValue;

        try {
            const headers = {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ''}`
            };

            await axios.put(
                `/t2.0/authentificationUtilization/departmentTasks/${row.taskID}/status?isActive=${newStatus}`,
                {},
                { headers }
            );

            setTasks(prev =>
                prev.map(t =>
                    t.taskID === row.taskID ? { ...t, isActive: newStatus } : t
                )
            );

            addToast({
                title: newStatus ? "Task Activated" : "Task Deactivated",
                description: `"${row?.taskName ?? ""}" updated successfully.`,
                color: "success",
            });

            setSelectedRows([]);
        } catch (err) {
            console.error(err);
            addToast({
                title: "Error",
                description: "Failed to update task status.",
                color: "danger",
            });
        }
        setConfirmOpen(false);
        setSelectedRows([]);
        setTableRefreshKey(prev => prev + 1);
    };

    const openAdd = (dept = "") => {
        setIsEditing(false);
        setNewTask({ taskName: "", description: "", departmentID: dept, standardTimeMins: 30, frequency: "Daily", isDynamic: false });
        setSelectedDepartment(dept);
        setIsModalOpen(true);
    };

    // every active department, plus the ones an item names that the list did not return
    const splitDepartments = [
        ...departmentList.filter((d) => String(d.status ?? "Active") === "Active").map((d) => ({ id: Number(d.key), name: d.name })),
        ...tasks.filter((i: any) => i.departmentName).map((i: any) => ({ id: Number(i.departmentID), name: i.departmentName })),
    ];

    return (
        <div>

            {departmentId == null && (
            <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <PageTitle title="Task Management" subtitle="Manage and monitor all company Tasks" />
                <div className="flex justify-end m-3 gap-3">

                    <Button variant="flat"
                        size="sm"
                        color="primary"
                        className={`px-4 h-8 w-fit ${!authUserLD?.departmentID
                            ? ""
                            : "opacity-0 pointer-events-none select-none"
                            }`}
                        isDisabled={loading || !!authUserLD?.departmentID} >
                        Download All
                    </Button>
                    <Button
                        size="sm"
                        color="primary" onPress={() => openAdd()}
                    >
                        Add New Task
                    </Button>
                </div>

            </div>
            )}


            <DepartmentSplit<any>
                lockedDepartment={departmentId}
                noun="task"
                items={tasks}
                departments={splitDepartments}
                deptOf={(t) => Number(t.departmentID)}
                isActive={(t) => !!t.isActive}
                idOf={(t) => t.taskID}
                searchText={(t) => `${t.taskName} ${t.description ?? ""}`}
                columns={[
                    { label: "Task", cell: (t) => <span className="font-semibold text-ink-900 dark:text-white">{t.taskName}</span>, className: "min-w-[220px] max-w-[360px] whitespace-normal break-words" },
                    { label: "Standard time", cell: (t) => (t.standardTimeMins === "N/A" || t.standardTimeMins == null ? "—" : `${t.standardTimeMins} mins`), className: "whitespace-nowrap" },
                    { label: "How often", cell: (t) => t.frequency || "—" },
                    { label: "Type", cell: (t) => <TypeTag dynamic={t.isDynamic} /> },
                    { label: "Created", cell: (t) => (t.createdAt ? format(new Date(t.createdAt), "dd MMM yyyy") : "—"), className: "whitespace-nowrap" },
                ]}
                onAdd={(id) => openAdd(String(id))}
                onEdit={(t) => taskActions[0].onAction(t)}
                onToggle={(t) => { setSelectedRows([t]); setToggleStatusValue(!t.isActive); setConfirmOpen(true); }}
            />

            {/* Create / edit canvas */}
            <Drawer
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
            >
                <DrawerContent>
                    {(onClose: () => void) => (
                        <>
                            <DrawerHeader className="flex flex-col gap-1">{isEditing ? "Edit Task" : "Add New Task"}</DrawerHeader>
                            <DrawerBody>
                                <div className="space-y-4">
                                    <Input
                                        label="Task Name"
                                        placeholder="Enter task name"
                                        value={newTask.taskName}
                                        onChange={(e) => setNewTask({ ...newTask, taskName: e.target.value })}
                                    />

                                    <Textarea
                                        label="Description"
                                        placeholder="Enter task description"
                                        value={newTask.description}
                                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                    />
                                    <div className='flex'>

                                        <Select
                                            aria-label="filter by sub department"
                                            placeholder="filter by sub department"
                                            selectedKeys={[selectedDepartment]}
                                            onSelectionChange={(keys) => setSelectedDepartment(Array.from(keys)[0] as string)}
                                            className="max-w-xs"
                                        >
                                            {departmentList.filter((ele: any) => ele.status === "Active").map((ele: any) => (
                                                <SelectItem key={String(ele.key)}>{ele.name}</SelectItem>
                                            ))}
                                        </Select>
                                        <Select

                                            placeholder="Select task type"
                                            selectedKeys={[newTask.type]}
                                            onSelectionChange={(keys) => {
                                                const type = Array.from(keys)[0] as string;
                                                setNewTask({ ...newTask, type });
                                            }}
                                            className="max-w-xs"
                                        >
                                            {[
                                                "Fixed",
                                                "Each Client",
                                                "Each Deal",
                                                "Each Query",
                                                "Each Campaign",
                                                "Each Setup",
                                                "Each Agency",
                                                "Each Ad Unit",
                                                "Each Site",
                                                "Each Partner",
                                                "Daily",
                                                "Each UPR",
                                                "Each Tag",
                                                "Each Visit",
                                                "Each Request",
                                                "Each TAM",
                                                "Each Call",
                                                "Each RFI",
                                                "Each RFP",
                                                "Each Media Deck",
                                                "Each Ticket",
                                                "Each Channel",
                                                "Each Seat",
                                                "Each Floor",
                                                "Each Account",
                                                "Each MOM",
                                                "Each IO",
                                                "Each KYC",
                                                "Each Document",
                                                "Each Resume",
                                                "Each CV",
                                                "Each Schedule",
                                                "Each Screen",
                                                "Each JD",
                                                "Each ADS.txt",
                                                "Each Waterfall",
                                                "Each WF",
                                            ].map((type) => (
                                                <SelectItem key={type}>{type}</SelectItem>
                                            ))}
                                        </Select>
                                    </div>



                                    <Input
                                        type="text"

                                        label="Standard Time (mins)"
                                        placeholder="Enter standard time in mins"
                                        value={newTask.standardTimeMins?.toString() ?? ""}
                                        onChange={(e) =>
                                            setNewTask({
                                                ...newTask,
                                                standardTimeMins: e.target.value,
                                            })
                                        }
                                    />


                                    <div className="flex gap-4">
                                        <Select
                                            label="Frequency"
                                            placeholder="Select frequency"
                                            selectedKeys={[newTask.frequency]}
                                            onSelectionChange={(keys) => {
                                                const frequency = Array.from(keys)[0] as string;
                                                setNewTask({ ...newTask, frequency: frequency as 'Daily' | 'Weekly' | 'Monthly' | 'Dynamic' | 'Not Daily' });
                                            }}
                                        >
                                            <SelectItem key="Daily">Daily</SelectItem>
                                            <SelectItem key="Weekly">Weekly</SelectItem>
                                            <SelectItem key="Monthly">Monthly</SelectItem>
                                            <SelectItem key="Dynamic">Dynamic</SelectItem>
                                            <SelectItem key="Not Daily">Not Daily</SelectItem>
                                        </Select>


                                        <Select
                                            label="Is Dynamic"
                                            placeholder="Select if dynamic"
                                            selectedKeys={[newTask.isDynamic.toString()]}
                                            onSelectionChange={(keys) => {
                                                const isDynamic = Array.from(keys)[0] as string;
                                                setNewTask({ ...newTask, isDynamic: isDynamic === 'true' });
                                            }}
                                        >
                                            <SelectItem key="false">No</SelectItem>
                                            <SelectItem key="true">Yes</SelectItem>
                                        </Select>

                                        <Select
                                            label="Role"
                                            placeholder="Select role"
                                            selectedKeys={[newTask.roleID]}
                                            onSelectionChange={(keys) => {
                                                const roleID = Array.from(keys)[0] as string;
                                                setNewTask({ ...newTask, roleID });
                                            }}
                                        >
                                            <SelectItem key="1">Root User</SelectItem>
                                            <SelectItem key="2">User</SelectItem>
                                            <SelectItem key="3">EL</SelectItem>
                                            <SelectItem key="4">FL</SelectItem>
                                            <SelectItem key="5">Intern</SelectItem>
                                            <SelectItem key="6">Executive</SelectItem>
                                            <SelectItem key="7">Manager</SelectItem>
                                            <SelectItem key="23">Lead</SelectItem>
                                        </Select>
                                    </div>
                                </div>
                            </DrawerBody>
                            <DrawerFooter>
                                <Button color="danger" variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={() => {
                                        isEditing ? handleEditTask(newTask.taskId) : handleAddTask();
                                    }}
                                >
                                    {isEditing ? "Update Task" : "Add Task"}
                                </Button>

                            </DrawerFooter>
                        </>
                    )}
                </DrawerContent>
            </Drawer>


            <Modal isOpen={confirmOpen} onOpenChange={setConfirmOpen}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{toggleStatusValue ? "Activate Task" : "Deactivate Task"}</ModalHeader>
                            <ModalBody>
                                {selectedRows[0] && (
                                    <p>
                                        Are you sure you want to{" "}
                                        <b>{toggleStatusValue ? "activate" : "deactivate"}</b>{" "}
                                        task <b>"{selectedRows[0].taskName}"</b>?
                                    </p>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button
                                    variant='flat'
                                    color={toggleStatusValue ? "success" : "danger"}
                                    onPress={handleToggleStatus}
                                >
                                    {toggleStatusValue ? "Activate" : "Deactivate"}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>


        </div>
    );
};

export default TaskManagement;