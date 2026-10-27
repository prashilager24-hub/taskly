import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, addToast } from "@/components/ui";
import { Input } from "@/components/ui";
import axios from "axios";
import { Select, SelectItem } from "@/components/ui";
// import { addToast } from "@/components/ui" // Commented out
import { Textarea } from "@/components/ui";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import ReusableTable, { TableColumn, TableAction } from "@/components/table"
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


const TaskManagement: React.FC = () => {
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
    const [pageNumber, setPageNumber] = useState(1)
    const [totalRecords, settotalRecords] = useState(0)
    const [pageSize, setPageSize] = useState(10)
    const [searchValue, setSearchValue] = useState("")
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
    const taskColumns: TableColumn[] = [
        {
            key: 'createdAt',
            label: 'Created At',
            sortable: true,
            renderCell: (item) =>
                item.createdAt
                    ? format(new Date(item.createdAt), "dd MMM yyyy")
                    : "—",
        }, { key: 'taskName', label: 'Task Name', sortable: true },
        // { key: 'description', label: 'Description' },
        { key: 'departmentID', label: 'Department ID', sortable: true },
        { key: 'departmentName', label: 'department Name', sortable: true },
        { key: 'standardTimeMins', label: 'Standard Time (mins)', sortable: true },
        { key: 'frequency', label: 'Frequency', sortable: true },
        { key: 'isDynamic', label: 'Dynamic', sortable: true },
        { key: 'isActive', label: 'Status', sortable: true },

    ];

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
                    searchText: searchValue,
                    filter: "",
                    startDate: "",
                    endDate: ""
                };

                const { data } = await axios.post(
                    `/t2.0/authentificationUtilization/departmentTasks/list?page=${pageNumber}&size=${pageSize}`,
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
                settotalRecords(data.response.totalRecords);
            } catch (err) {
                console.error("Error fetching tasks:", err);
            }
        };
        fetchTasks();

    }, [authUserLD, pageSize, pageNumber, searchValue])

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

    return (
        <div>

            <div className="flex justify-between items-center mb-4" style={{ height: "48px" }}>
                <div>

                    <h1 className={title({ size: "20px" })}>Task Management</h1>
                    <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
                        Manage and monitor all company Tasks
                    </p>
                </div>
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
                        color="primary" onPress={() => {
                            setIsEditing(false);
                            setNewTask({
                                taskName: "",
                                description: "",
                                departmentID: "",
                                standardTimeMins: 30,
                                frequency: "Daily",
                                isDynamic: false
                            });
                            setSelectedDepartment("");
                            setIsModalOpen(true);
                        }}


                    >
                        Add New Task
                    </Button>
                </div>

            </div>


            {/* Tasks Table */}
            {selectedRows.length > 0 && (
                <div className="flex justify-between items-center bg-ink-100 dark:bg-ink-800 p-3 rounded mb-3 shadow">
                    <span className="font-semibold">
                        {selectedRows.length} task(s) selected
                    </span>

                    <div className='flex gap-3'>

                        <Button
                            color="danger"
                            variant='flat'

                            onPress={() => {
                                if (selectedRows.length !== 1) {
                                    addToast({
                                        title: "Select exactly one task",
                                        description: "You can activate/deactivate only one task at a time.",
                                        color: "warning",
                                    });
                                    return;
                                }
                                setToggleStatusValue(false);
                                setConfirmOpen(true);
                            }}
                        >
                            Deactivate
                        </Button>

                        <Button
                            color="success"
                            variant="flat"
                            onPress={() => {
                                if (selectedRows.length !== 1) {
                                    addToast({
                                        title: "Select exactly one task",
                                        description: "You can activate/deactivate only one task at a time.",
                                        color: "warning",
                                    });
                                    return;
                                }
                                setToggleStatusValue(true);
                                setConfirmOpen(true);
                            }}
                        >
                            Activate
                        </Button>

                    </div>

                </div>
            )}

            <div className="bg-white dark:bg-ink-800 rounded-lg shadow overflow-hidden p-6">
                <ReusableTable
                    key={tableRefreshKey}
                    data={tasks}
                    columns={taskColumns}
                    actions={taskActions}
                    totalRecords={totalRecords}
                    searchable={true}
                    searchPlaceholder="Search tasks..."
                    searchKeys={['taskName', 'description']}
                    filterable={true}
                    onRowsPerPageChange={(value) => {
                        setPageSize(value)

                    }}
                    onPageChange={(page) => {
                        setPageNumber(page)
                    }}
                    onSearchChangeProp={(value) => {
                        setSearchValue(value);
                        // console.log("Search in parent:", value);
                    }}
                    filterOptions={[
                        {
                            key: 'frequency',
                            label: 'Frequency',
                            options: [
                                { key: 'Daily', label: 'Daily' },
                                { key: 'Weekly', label: 'Weekly' },
                                { key: 'Monthly', label: 'Monthly' },
                                { key: 'Dynamic', label: 'Dynamic' },
                                { key: 'Not Daily', label: 'Not Daily' }
                            ]
                        }
                        ,
                        {
                            key: 'isActive',
                            label: 'Status',
                            options: [
                                { key: 'true', label: 'Active' },
                                { key: 'false', label: 'Inactive' }
                            ]
                        }
                    ]}
                    selectable={true}
                    sortable={true}
                    paginated={true}
                    emptyContent="No tasks found"
                    onAdd={() => setIsModalOpen(true)}
                    addButtonLabel="Add New Task"
                    getRowId={(item) => item.taskID}
                    onSelectionChange={(rows) => setSelectedRows(rows)}
                />
            </div>

            {/* Add Task Modal */}
            <Modal
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
                size="2xl"
            >
                <ModalContent>
                    {(onClose: () => void) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">{isEditing ? "Edit Task" : "Add New Task"}</ModalHeader>
                            <ModalBody>
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
                            </ModalBody>
                            <ModalFooter>
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

                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>


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