import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
    DateRangePicker, Autocomplete, addToast, AutocompleteItem, Dropdown, DropdownTrigger, Button, DropdownMenu, Card, CardBody, CardHeader, Tabs, Tab, DropdownItem,
    Chip,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Textarea,
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerBody,
    DrawerFooter,

    useDisclosure,
} from "@/components/ui";
import ReusableTable, { TableColumn, TableAction } from "@/components/table"
import CustomDateRangePicker from "../components/CustomDateRangePicker"
import { format } from "date-fns";

import {
    FunnelIcon,
    ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { keyframes } from "framer-motion";
import UpdateForm from "@/components/updateForm";

interface User {
    userID: number;
    userName: string;
}

interface Department {
    key: number;
    name: string;
    description: string;
    status: string;
}

const pendingTasks = [
    {
        id: 1,
        date: "Oct 12, 2023",
        task: "Q4 Infrastructure Audit",
        requester: "Alex Rivera",
        department: "Operations",
        priority: "High",
        status: "Pending",
    },
    {
        id: 2,
        date: "Oct 14, 2023",
        task: "CRM Database Cleanup",
        requester: "Sarah Jenkins",
        department: "Marketing",
        priority: "Medium",
        status: "Pending",
    },
];




const rejectedTasks = [
    {
        id: 1,
        date: "Oct 05, 2023",
        task: "Legacy Server Cleanup",
        requester: "Emily Wong",
        status: "Rejected",
        comment:
            "This task is currently on hold until the budget review for next quarter is finalized.",
    },
    {
        id: 2,
        date: "Oct 03, 2023",
        task: "New Office Signage",
        requester: "John Doe",
        status: "Rejected",
        comment:
            "Re-routed to Facility Management department. Please re-submit using the FM template.",
    },
];

const getPriorityChip = (priority) => {
    switch (priority) {
        case "High":
            return (
                <Chip
                    size="sm"
                    className="bg-red-100 text-red-600 font-medium"
                    radius="sm"
                >
                    High
                </Chip>
            );
        case "Medium":
            return (
                <Chip
                    size="sm"
                    className="bg-blue-100 text-blue-600 font-medium"
                    radius="sm"
                >
                    Medium
                </Chip>
            );
        default:
            return (
                <Chip
                    size="sm"
                    className="bg-gray-100 text-gray-600 font-medium"
                    radius="sm"
                >
                    Low
                </Chip>
            );
    }
};

const getStatusChip = (status) => {
    switch (status) {
        case "Pending":
            return (
                <div className="flex items-center gap-2 text-orange-500 text-sm font-medium">
                    <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                    Pending
                </div>
            );

        case "Approved":
            return (
                <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    Approved
                </div>
            );

        case "Rejected":
            return (
                <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
                    <span className="h-2 w-2 rounded-full bg-red-500"></span>
                    Rejected
                </div>
            );

        default:
            return null;
    }
};

export default function EntryApproval() {
    const navigate = useNavigate();
    const [isUpdateOpen, setIsUpdateOpen] = useState(false);

    const [selectedUpdateItem, setSelectedUpdateItem] =
        useState(null);

    const [selectedDepartmentId, setSelectedDepartmentId] =
        useState(null);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectComment, setRejectComment] = useState("");
    const [departmentList, setDepartmentList] = useState<Department[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [tableData, setTableData] = useState([]);

    const [pageNumber, setPageNumber] = useState(1)
    const [totalRecords, settotalRecords] = useState(0)
    const [pageSize, setPageSize] = useState(10)
    const [searchValue, setSearchValue] = useState("")
    const [selectedRows, setSelectedRows] = useState([]);

    const [loading, setLoading] = useState(false);
    const [dateRange, setDateRange] = useState(() => {
        const today = new Date();

        const endDate = today.toISOString().split("T")[0];

        const start = new Date();
        start.setDate(start.getDate() - 7);
        const startDate = start.toISOString().split("T")[0];

        return { startDate, endDate };
    });
    const authUserLD = localStorage.getItem("authUserLD");
    // safely parse stored user
    const user = authUserLD ? JSON.parse(authUserLD) : null;
    const token = user?.token;
    const isELORUSER = [2, 3, 4, 5, 6, 7, 23].includes(user?.userRole);    // initial state values
    const [taskOptionsForUpdate, setTaskOptionsForUpdate] = useState([]);


    const [filterStatus, setFilterStatus] = useState(
        user?.departmentID ? String(user.departmentID) : ""
    );
    const [selectedUser, setSelectedUser] = useState(
        isELORUSER ? String(user?.userID) : ""
    );
    const [entryTypeFilter, setEntryTypeFilter] = useState("");
    const [userSearch, setUserSearch] = useState("");

    const filteredUsers = users.filter((u) =>
        u.userName.toLowerCase().includes(userSearch.toLowerCase())
    );

    const approvalColumns = [
        {
            key: "workDate",
            label: "Date",
            sortable: true,
        },
        {
            key: "userName",
            label: "User",
            sortable: true,
        },

        // =========================
        // ENTRY TYPE
        // =========================
        {
            key: "entryType",
            label: "Entry Type",
            sortable: true,
            renderCell: (item) => {

                if (item.goalID) {
                    return "Goal";
                }

                if (item.targetID) {
                    return "Target";
                }

                if (item.taskID) {
                    return "Task";
                }

                return "-";
            },
        },

        // =========================
        // TYPE / ID
        // =========================
        {
            key: "type",
            label: "TypeID",
            sortable: true,
            renderCell: (item) => (
                item.goalID ||
                item.targetID ||
                item.taskID ||
                "-"
            ),
        },

        // =========================
        // NAME
        // =========================
        {
            key: "taskName",
            label: "Task / Goal",
            sortable: true,
            renderCell: (item) => (
                item.goalName ||
                item.targetName ||
                item.taskName ||
                "-"
            ),
        },

        // =========================
        // ALLOCATED
        // =========================
        {
            key: "allocatedTime",
            label: "Allocated",
            sortable: true,
            renderCell: (item) => {

                // GOAL
                if (item.goalID) {
                    return item.fixedGoal ?? "-";
                }

                // TASK / TARGET
                return item.allocatedTime ?? "-";
            },
        },

        // =========================
        // WORKED
        // =========================
        {
            key: "workedTime",
            label: "Worked",
            sortable: true,
            renderCell: (item) => {

                // GOAL
                if (item.goalID) {
                    return item.achievedGoal ?? "-";
                }

                // TASK / TARGET
                return item.timeTakenToWork ?? "-";
            },
        },

        // =========================
        // UNITS
        // =========================
        {
            key: "achievedUnits",
            label: "Units",
            sortable: true,
            renderCell: (item) => {

                // GOAL
                if (item.goalID) {
                    return item.achievedGoal ?? "-";
                }

                return item.achievedUnits ?? "-";
            },
        },

        // =========================
        // STATUS
        // =========================
        {
            key: "status",
            label: "Status",
            sortable: true,
            renderCell: (item) =>
                getStatusChip(item.status),
        },

        // =========================
        // COMMENT
        // =========================
        {
            key: "commentForRejection",
            label: "Comment",
        },

        // =========================
        // REMARKS
        // =========================
        {
            key: "remarks",
            label: "Remarks",
        },

        // =========================
        // ACTIONS
        // =========================
        {
            key: "actions",
            label: "Actions",

            // renderCell: (item) => {

            //     if (
            //         user?.userRole === 2 &&
            //         item.commentForRejection
            //     ) {

            //         return (
            //             <Button
            //                 size="sm"
            //                 color="primary"
            //                 variant="flat"
            //                 onPress={() => {

            //                     console.log("UPDATE ITEM", item);

            //                     setSelectedUpdateItem(item);

            //                     setSelectedDepartmentId(
            //                         item.departmentId
            //                     );

            //                     setIsUpdateOpen(true);
            //                 }}
            //             >
            //                 Update
            //             </Button>
            //         );
            //     }

            //     return (
            //         item.commentForRejection || "-"
            //     );
            // },
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
                    roleID: user.userRole,
                    userID: user.isHeExecutiveLeader ? Number(user.userID) : user?.userID || null,
                };

                const res = await fetch("/t2.0/authentificationUtilization/Department/list?page=0&size=0", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(bodyData)
                });

                const resData = await res.json();
                const data = resData.response.departments;

                const formatted: Department[] = data?.map((dept: any) => ({
                    key: dept.departmentID,
                    name: dept.departmentName,
                    description: dept.departmentDescription,
                    status: dept.newStatus,
                })) || [];

                setDepartmentList(formatted);

                if (!filterStatus) {
                    if ([2, 5, 6, 7, 23].includes(user.userRole)) {
                        setFilterStatus(String(user.departmentID));
                    } else if (formatted.length > 0) {
                        setFilterStatus(String(formatted[0].key));
                    }
                }

            } catch (err) {
                console.error("Error fetching department list:", err);
            }
        };

        fetchDepartments();
    }, []);

    useEffect(() => {
        if (!selectedDepartmentId) return;

        const fetchTasks = async () => {
            try {
                const res = await axios.post(
                    "/t2.0/authentificationUtilization/departmentTasks/getTasksByDepartment",
                    { departmentId: selectedDepartmentId },
                    { headers: { "Content-Type": "application/json" } }
                );
                setTaskOptionsForUpdate(res.data.result || []);
            } catch (err) {
                console.error("Error fetching tasks for update:", err);
                setTaskOptionsForUpdate([]);
            }
        };

        fetchTasks();
    }, [selectedDepartmentId]);



    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const body = {
                    filter: "",
                    searchText: "",
                    departmentID: filterStatus ? Number(filterStatus) : 0
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

                setUsers(formatted);
            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };

        fetchUsers();


    }, [filterStatus]);

    const getCombinedApprovalList = async ({
        page = 1,
        size = 10,
        userID = null,
        departmentID = null,
        startDate = null,
        endDate = null,
        entryType = null,
    }) => {
        try {
            setLoading(true);

            const entryTypeParam = entryType ? `&entryType=${entryType}` : "";
            const response = await axios.post(
                `/t2.0/authentificationUtilization/combined/list?page=${0}&size=${0}${entryTypeParam}`,
                {
                    userID,
                    departmentID,
                    startDate,
                    endDate,
                    entryType,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const resData = response.data;

            // ENHANCED: Map all fields needed for update functionality
            // const formattedData =
            //     resData.data?.flatMap((entry) =>
            //         entry.entries.map((item) => ({
            //             // Core identifiers
            //             id: item.id,
            //             dailyTaskLogID: item.type === "Task" ? item.id : null,
            //             userGoalDataID: item.type === "Goal" ? item.id : null,

            //             // Entry type indicators
            //             type: item.type,
            //             entryType: item.type,

            //             // Date and user info
            //             workDate: entry.workDate,
            //             userName: entry.userName,
            //             departmentName: entry.departmentName,

            //             // Task/Goal/Target details
            //             taskName: item.taskName,
            //             allocatedTime:
            //                 item.type === "Goal"
            //                     ? item.fixedGoal
            //                     : item.allocatedTime,
            //             workedTime:
            //                 item.type === "Goal"
            //                     ? item.achievedGoal
            //                     : item.timeTakenToWork,
            //             achievedUnits:
            //                 item.type === "Goal" ? "-" : item.achievedUnits,

            //             // Leave and status
            //             leaveType: item.leaveType || "-",
            //             status: item.approvedByEL ? "Approved" : "Pending",
            //             remarks: item.remarks || "-",
            //             approvedByEL: item.approvedByEL,
            //             commentForRejection: item.commentForRejection,

            //             // ADDED FOR UPDATE SUPPORT:
            //             // Target-related
            //             targetID: item.targetID || null,

            //             // Goal-related
            //             goalID: item.goalID || null,
            //             expectedUnit: item.expectedUnit || null,

            //             // Task-related
            //             setUp: item.setUp || 1,
            //             taskID: item.taskID || null,

            //             // Frequency (for targets and goals)
            //             frequency: item.frequency || null,

            //             // Department-specific fields
            //             miscallenous: item.miscallenous || null,
            //             NoOfPlayer: item.NoOfPlayer || null,
            //         }))
            //     ) || [];

            const formattedData =
                resData.data?.flatMap((entry) =>
                    entry.entries.map((item) => {

                        const isTask = !!item.taskID;
                        const isTarget = !!item.targetID;
                        const isGoal = !!item.goalID;

                        return {
                            // =========================
                            // COMMON
                            // =========================
                            id: item.id,
                            entryType:
                                isGoal
                                    ? "Goal"
                                    : isTarget
                                        ? "Target"
                                        : isTask
                                            ? "Task"
                                            : "",

                            ID:
                                item.taskID ||
                                item.targetID ||
                                item.goalID,

                            Name:
                                item.taskName ||
                                item.targetName ||
                                item.goalName,

                            workDate: entry.workDate,
                            userName: entry.userName,
                            departmentName: entry.departmentName,
                            departmentId: entry.departmentID,
                            remarks: item.remarks || "",

                            approvedByEL: item.approvedByEL,

                            commentForRejection:
                                item.commentForRejection || "",

                            leaveType: item.leaveType || "-",

                            status: item.approvedByEL
                                ? "Approved"
                                : "Pending",

                            // =========================
                            // TASK
                            // =========================
                            dailyTaskLogID:
                                isTask || isTarget
                                    ? item.dailyTaskLogID
                                    : null,

                            taskID:
                                isTask
                                    ? item.taskID
                                    : null,

                            // =========================
                            // TARGET
                            // =========================
                            targetID:
                                isTarget
                                    ? item.targetID
                                    : null,

                            targetName:
                                item.targetName || "",

                            // =========================
                            // TIMES
                            // =========================
                            allocatedTime:
                                item.allocatedTime || 0,

                            workedTime:
                                item.timeTakenToWork || 0,

                            setUp:
                                item.setUp || 1,

                            // =========================
                            // UNITS
                            // =========================
                            units:
                                item.units || "",

                            achievedUnits:
                                item.achievedUnits || "",

                            totalUnitValues:
                                item.totalUnitValues || "",

                            // =========================
                            // GOAL
                            // =========================
                            userGoalDataID:
                                isGoal
                                    ? item.userGoalDataID
                                    : null,

                            goalID:
                                isGoal
                                    ? item.goalID
                                    : null,

                            goalName:
                                item.goalName || "",

                            fixedGoal:
                                item.fixedGoal || "",

                            achievedGoal:
                                item.achievedGoal || "",

                            goalType:
                                item.goalType || "",

                            isTarget:
                                item.isTarget || false,

                            // =========================
                            // EXTRA
                            // =========================
                            overAllTime:
                                item.overAllTime || 0,

                            isForTarget:
                                item.isForTarget || false,

                            isHalfDayLeave:
                                item.isHalfDayLeave || false,
                        };
                    })
                ) || [];


            setTableData(formattedData);
            settotalRecords(resData.pagination?.totalRecords || 0);
        } catch (err) {
            console.error("Combined API Error:", err);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {

        // wait until department default is set
        if (user.userRole !== 2 && !filterStatus) {
            return;
        }

        getCombinedApprovalList({
            page: pageNumber,
            size: pageSize,
            userID: selectedUser ? Number(selectedUser) : null,
            departmentID: filterStatus ? Number(filterStatus) : null,
            startDate: dateRange?.startDate || null,
            endDate: dateRange?.endDate || null,
            entryType: entryTypeFilter || null,
        });

    }, [
        filterStatus,
        selectedUser,
        pageNumber,
        pageSize,
        dateRange,
        entryTypeFilter
    ]);


    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <Modal
                isOpen={rejectModalOpen}
                onOpenChange={setRejectModalOpen}
                size="md"
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                Reject Entry
                            </ModalHeader>

                            <ModalBody>
                                {selectedRows.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="bg-gray-100 rounded p-3 text-sm">
                                            <p>
                                                <span className="font-semibold">
                                                    ID:
                                                </span>{" "}
                                                {selectedRows[0]?.id}
                                            </p>

                                            <p>
                                                <span className="font-semibold">
                                                    Type:
                                                </span>{" "}
                                                {selectedRows[0]?.type}
                                            </p>

                                            <p>
                                                <span className="font-semibold">
                                                    Task:
                                                </span>{" "}
                                                {selectedRows[0]?.taskName}
                                            </p>
                                        </div>

                                        <Textarea
                                            label="Rejection Comment"
                                            placeholder="Enter rejection reason..."
                                            value={rejectComment}
                                            onValueChange={setRejectComment}
                                            minRows={4}
                                        />
                                    </div>
                                )}
                            </ModalBody>

                            <ModalFooter>
                                <Button
                                    variant="light"
                                    onPress={() => {
                                        setRejectComment("");
                                        onClose();
                                    }}
                                >
                                    Cancel
                                </Button>

                                <Button
                                    color="danger"
                                    onPress={async () => {
                                        try {
                                            const row = selectedRows[0];

                                            await axios.post(
                                                "/t2.0/authentificationUtilization/combined/reject",
                                                {
                                                    id: row.id,
                                                    type: row.entryType,
                                                    comment: rejectComment,
                                                },
                                                {
                                                    headers: {
                                                        Authorization: `Bearer ${token}`,
                                                    },
                                                }
                                            );

                                            addToast({
                                                title: "Rejected",
                                                description: "Entry rejected successfully",
                                                color: "danger",
                                            });

                                            setRejectComment("");
                                            setRejectModalOpen(false);
                                            setSelectedRows([]);

                                            getCombinedApprovalList({
                                                page: pageNumber,
                                                size: pageSize,
                                                userID: selectedUser
                                                    ? Number(selectedUser)
                                                    : null,
                                                departmentID: filterStatus
                                                    ? Number(filterStatus)
                                                    : null,
                                                startDate:
                                                    dateRange?.startDate || null,
                                                endDate:
                                                    dateRange?.endDate || null,
                                                entryType: entryTypeFilter || null,
                                            });
                                        } catch (err) {
                                            console.error(err);

                                            addToast({
                                                title: "Error",
                                                description: "Reject failed",
                                                color: "danger",
                                            });
                                        }
                                    }}
                                >
                                    Reject
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        Task Approval Management
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Review and manage organizational task requests
                    </p>
                </div>
                <div className="flex gap-3 items-center">
                    {![2, 5, 6, 7, 23].includes(user.userRole) && (
                        <>
                            <Dropdown placement="bottom-start">
                                <DropdownTrigger>
                                    <Button
                                        variant="flat"
                                        size="sm"
                                        className="w-[260px] justify-between bg-gray-200"
                                    >
                                        {dateRange?.startDate && dateRange?.endDate
                                            ? `${format(new Date(dateRange.startDate), "dd MMM yyyy")} → ${format(
                                                new Date(dateRange.endDate),
                                                "dd MMM yyyy"
                                            )}`
                                            : "Select Date Range"}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label="Date range picker"
                                    className="p-0"
                                    closeOnSelect={false}
                                >
                                    <DropdownItem key="calendar" className="p-0">
                                        <CustomDateRangePicker
                                            value={dateRange}
                                            onChange={(range) => setDateRange(range)}
                                        />
                                    </DropdownItem>
                                </DropdownMenu>
                            </Dropdown>

                            <Dropdown isOpen={isFilterOpen} onOpenChange={setIsFilterOpen}>
                                <DropdownTrigger>
                                    <Button
                                        variant="flat"
                                        size="sm"
                                        color="primary"
                                        className="px-6 gap-2"
                                        onPress={() => setIsFilterOpen(true)}
                                    >
                                        <FunnelIcon className="h-4 w-4" />
                                        Filter
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu aria-label="Static Actions" closeOnSelect={false}>
                                    <DropdownItem key="edit" className="!bg-transparent hover:!bg-transparent">
                                        <Autocomplete
                                            aria-label="filter by Department"
                                            placeholder="Filter by Department"
                                            className="max-w-xs"
                                            selectedKey={filterStatus}
                                            onSelectionChange={(key) => {
                                                const dep = key as string;
                                                setFilterStatus(dep);
                                                setSelectedUser("");
                                            }}
                                        >
                                            {departmentList.sort((a, b) => a.name.localeCompare(b.name))
                                                .filter((ele) => ele.status === "Active")
                                                .map((ele) => (
                                                    <AutocompleteItem key={ele.key} value={ele.name}>
                                                        {ele.name.replace(/([A-Z])/g, " $1").trim()}
                                                    </AutocompleteItem>
                                                ))}
                                        </Autocomplete>
                                    </DropdownItem>

                                    <DropdownItem key="user-filter" className="!bg-transparent hover:!bg-transparent">
                                        <Autocomplete
                                            aria-label="filter by User"
                                            placeholder="Filter by User"
                                            className="max-w-xs"
                                            selectedKey={selectedUser}
                                            inputValue={userSearch}
                                            onInputChange={(value) => {
                                                setUserSearch(value);
                                                if (!value) setSelectedUser("");
                                            }}
                                            onSelectionChange={(key) => {
                                                if (key) {
                                                    const found = users.find((u) => String(u.userID) === String(key));
                                                    if (found) {
                                                        setSelectedUser(String(key));
                                                        setUserSearch(found.userName);
                                                    }
                                                }
                                            }}
                                        >
                                            {filteredUsers.sort((a, b) => a.userName.localeCompare(b.userName)).map((u) => (
                                                <AutocompleteItem key={String(u.userID)} textValue={u.userName}>
                                                    {u.userName}
                                                </AutocompleteItem>
                                            ))}
                                        </Autocomplete>
                                    </DropdownItem>

                                    <DropdownItem key="entry-type-filter" className="!bg-transparent hover:!bg-transparent">
                                        <Autocomplete
                                            aria-label="filter by Entry Type"
                                            placeholder="Filter by Entry Type"
                                            className="max-w-xs"
                                            selectedKey={entryTypeFilter}
                                            onSelectionChange={(key) => {
                                                setEntryTypeFilter(key as string || "");
                                            }}
                                        >
                                            <AutocompleteItem key="Task" value="Task">Task</AutocompleteItem>
                                            <AutocompleteItem key="Target" value="Target">Target</AutocompleteItem>
                                            <AutocompleteItem key="Goal" value="Goal">Goal</AutocompleteItem>
                                        </Autocomplete>
                                    </DropdownItem>

                                    <DropdownItem key="close-btn" textValue="Close" className="!bg-transparent hover:!bg-transparent">
                                        <div className="flex justify-end">
                                            <Button color="danger" size="sm" onPress={() => setIsFilterOpen(false)}>
                                                Close
                                            </Button>
                                        </div>
                                    </DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        </>
                    )}
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden p-6">
                {selectedRows.length > 0 && user.userRole !== 2 && (
                    <div className="flex justify-between items-center bg-gray-100 p-3 rounded mb-3 shadow">
                        <span className="font-semibold">
                            {selectedRows.length} item(s) selected
                        </span>

                        <div className="flex gap-3">
                            {selectedRows.length == 1 && (
                                <Button
                                    color="danger"
                                    variant="flat"
                                    onPress={() => {
                                        setRejectModalOpen(true);
                                    }}
                                >
                                    Reject
                                </Button>
                            )}

                            <Button
                                color="success"
                                variant="flat"
                                onPress={async () => {
                                    try {

                                        const taskEntryIDs = selectedRows
                                            .filter(
                                                (row) =>
                                                    row.entryType === "Task" ||
                                                    row.entryType === "Target"
                                            )
                                            .map((row) => row.dailyTaskLogID);

                                        const goalEntryIDs = selectedRows
                                            .filter(
                                                (row) =>
                                                    row.entryType === "Goal"
                                            )
                                            .map((row) => row.userGoalDataID);


                                        debugger

                                        await axios.post(
                                            "/t2.0/authentificationUtilization/combined/approve",
                                            {
                                                departmentID: filterStatus
                                                    ? Number(filterStatus)
                                                    : null,

                                                taskEntryIDs,

                                                goalEntryIDs,
                                            },
                                            {
                                                headers: {
                                                    Authorization: `Bearer ${token}`,
                                                },
                                            }
                                        );

                                        addToast({
                                            title: "Approved",
                                            description: `${selectedRows.length} item(s) approved`,
                                            color: "success",
                                        });

                                        setSelectedRows([]);

                                        getCombinedApprovalList({
                                            page: pageNumber,
                                            size: pageSize,
                                            userID: selectedUser
                                                ? Number(selectedUser)
                                                : null,
                                            departmentID: filterStatus
                                                ? Number(filterStatus)
                                                : null,
                                            startDate: dateRange?.startDate || null,
                                            endDate: dateRange?.endDate || null,
                                            entryType: entryTypeFilter || null,
                                        });

                                    } catch (err) {

                                        console.error(err);

                                        addToast({
                                            title: "Error",
                                            description: "Approval failed",
                                            color: "danger",
                                        });
                                    }
                                }}
                            >
                                Approve
                            </Button>
                        </div>
                    </div>
                )}
                <ReusableTable
                    data={tableData}
                    columns={approvalColumns}
                    totalRecords={totalRecords}
                    searchable={false}
                    searchPlaceholder="Search approvals..."
                    searchKeys={[
                        "userName",
                        "departmentName",
                        "taskName",
                    ]}
                    selectable={true}
                    sortable={true}
                    paginated={true}
                    emptyContent="No approval entries found"
                    onRowsPerPageChange={(value) => {
                        setPageSize(value);
                    }}
                    onPageChange={(page) => {
                        setPageNumber(page);
                    }}
                    onSearchChangeProp={(value) => {
                        setSearchValue(value);
                    }}
                    getRowId={(item) => item.id}
                    onSelectionChange={(rows) => setSelectedRows(rows)}

                />

            </div>
            <Drawer isOpen={isUpdateOpen} onOpenChange={setIsUpdateOpen} size="full">
                <DrawerContent>
                    {(onClose) => (
                        <>
                            <DrawerHeader className="flex flex-col gap-1">Drawer Title</DrawerHeader>
                            <DrawerBody>
                                <UpdateForm task={selectedUpdateItem} DeptId={selectedDepartmentId} taskOptions={taskOptionsForUpdate}   // ← ADD THIS
                                    onSuccess={() => {
                                        setIsUpdateOpen(false);

                                        //  getCombinedApprovalList(...)
                                    }} />
                            </DrawerBody>
                            <DrawerFooter>
                                <Button color="danger" variant="light" onPress={onClose}>
                                    Close
                                </Button>

                            </DrawerFooter>
                        </>
                    )}
                </DrawerContent>
            </Drawer>
        </div>
    );
}