import { useEffect, useState } from "react";
import { Select, SelectItem } from "@/components/ui";
import { DateRangePicker, Autocomplete, AutocompleteItem } from "@/components/ui";
import { title } from "@/components/primitives";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import axios from "axios";
import ReusableTable, { TableColumn, TableAction } from "@/components/table";

interface DailyTaskLog {
    DailyTaskLogID: number;
    TaskID: number;
    TaskName: string;
    UserID: number;
    UserName: string;
    WorkDate: string;
    actualTimeOfWork: number;
    Remarks: string;
    CreatedAt: string;
    UpdatedAt: string;
}

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


export default function ReportsPage() {
    const authUserLD = localStorage.getItem("authUserLD");
    const user = JSON.parse(authUserLD)
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [departmentList, setDepartmentList] = useState<Department[]>([]);
    const [filterStatus, setFilterStatus] = useState(
        user?.departmentID ? String(user.departmentID) : ""
    );
    const [selectedUser, setSelectedUser] = useState(
        user?.userID ? String(user.userID) : ""
    );
    const [users, setUsers] = useState<User[]>([]);
    const [pageNumber, setPageNumber] = useState(1)
    const [totalRecords, settotalRecords] = useState(0)
    const [pageSize, setPageSize] = useState(10)
    const [searchValue, setSearchValue] = useState("")
    const [dateRange, setDateRange] = useState(() => {
        const today = new Date();

        const endDate = today.toISOString().split("T")[0];

        const start = new Date();
        start.setDate(start.getDate() - 7);
        const startDate = start.toISOString().split("T")[0];

        return { startDate, endDate };
    });

    const [reportData, setReportData] = useState<DailyTaskLog[]>([

    ]);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    // const authUserLD = localStorage.getItem("authUserLD");

    // Table configuration
    const reportColumns: TableColumn[] = [
        { key: 'WorkDate', label: 'Work Date', sortable: true },
        { key: 'DailyTaskLogID', label: 'Log ID', sortable: true, width: '100px' },
        { key: 'TaskID', label: 'Task ID', sortable: true, width: '100px' },
        { key: 'CreatedAt', label: 'Created At', sortable: true },
        { key: 'TaskName', label: 'Task Name', sortable: true },
        { key: 'UserName', label: 'User', sortable: true },
        { key: 'actualTimeOfWork', label: 'Time (Hrs)/Percentage', sortable: true },
        { key: 'Remarks', label: 'Remarks', sortable: false },
    ];

    const reportActions: TableAction[] = [
        {
            key: 'view',
            label: 'View Details',
            color: 'primary',
            onAction: (log) => {
                console.log('View log details:', log);
                // Add view functionality here
            }
        },
        {
            key: 'edit',
            label: 'Edit',
            color: 'warning',
            onAction: (log) => {
                console.log('Edit log:', log);
                // Add edit functionality here
            }
        }
    ];

    // Custom cell renderer for better formatting
    const renderReportCell = (log: DailyTaskLog, columnKey: string) => {
        switch (columnKey) {
            case 'DailyTaskLogID':
                return (
                    <span className="text-sm font-medium text-ink-900 dark:text-white">
                        #{log.DailyTaskLogID}
                    </span>
                );
            case 'TaskID':
                return (
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        T-{log.TaskID}
                    </span>
                );
            case 'TaskName':
                return (
                    <div className="max-w-xs">
                        <p className="text-sm font-medium text-ink-900 dark:text-white truncate" title={log.TaskName}>
                            {log.TaskName}
                        </p>
                    </div>
                );
            case 'UserName':
                return (
                    <div className="flex flex-col">
                        <p className="text-sm font-medium text-ink-900 dark:text-white">{log.UserName}</p>
                        <p className="text-xs text-ink-500 dark:text-ink-400">ID: {log.UserID}</p>
                    </div>
                );
            case 'WorkDate':
                return new Date(log.WorkDate).toLocaleDateString();
            case 'actualTimeOfWork':
                return (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {log.actualTimeOfWork} mins
                    </span>
                );
            case 'Remarks':
                return (
                    <div className="max-w-xs">
                        <p className="text-sm text-ink-600 dark:text-ink-400 truncate" title={log.Remarks}>
                            {log.Remarks || 'No remarks'}
                        </p>
                    </div>
                );
            case 'CreatedAt':
                return new Date(log.CreatedAt).toLocaleDateString();
            default:
                return String(log[columnKey as keyof DailyTaskLog] || '');
        }
    };

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const bodyData = {
                    searchText: "",
                    filter: "",
                    startDate: "",
                    endDate: "",
                };

                const res = await fetch("/t2.0/authentificationUtilization/Department/list?page=0&size=", {
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
                console.log("departmentlist", formatted);
            } catch (err) {
                console.error("Error fetching department list:", err);
            }
        };

        fetchDepartments();
    }, []);
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
                console.log("Users formatted:", formatted);
            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };

        fetchUsers();


    }, [filterStatus]);

    useEffect(() => {
        // if (!filterStatus || !selectedUser || !dateRange.startDate || !dateRange.endDate) return;

        const fetchLogs = async () => {
            try {
                const body = {
                    departmentId: filterStatus ? Number(filterStatus) : 28,
                    userId: Number(selectedUser),
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,

                };

                const res = await fetch(`/t2.0/authentificationUtilization/dailyTaskLog/list?page=${pageNumber}&size=${pageSize}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
                    },
                    body: JSON.stringify(body)
                });

                const resData = await res.json();
                const formattedLogs = resData.response.logs.map((log: any) => ({
                    DailyTaskLogID: log.dailyTaskLogID,
                    TaskID: log.taskID,
                    TaskName: log.taskName,
                    UserID: log.userID,
                    UserName: log.userName,
                    WorkDate: log.workDate,
                    actualTimeOfWork: log.actualTimeOfWork ? Number(log.actualTimeOfWork) : "N/A",
                    Remarks: log.remarks,
                    CreatedAt: log.createdAt,
                    UpdatedAt: log.updatedAt
                }));

                setReportData(formattedLogs);
                settotalRecords(resData.response.totalRecords);

                console.log("Report logs:", resData.response.logs);
            } catch (err) {
                console.error("Error fetching logs:", err);
            }
        };

        fetchLogs();
    }, [filterStatus, selectedUser, dateRange, authUserLD, pageNumber, pageSize]);


    return (
        <div>
            <div className="mb-8">
                <h1 className={title({ size: "sm" })}>Reports & Analytics</h1>
                <p className="text-default-500 mt-2">Generate and manage business reports</p>
            </div>
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-end">

                {
                    user.departmentID ? null : (
                        <Autocomplete
                            aria-label="filter by Department"
                            placeholder="Filter by Department"
                            className="max-w-xs"
                            selectedKey={filterStatus}
                            onSelectionChange={(key) => {
                                const dep = key as string;
                                setFilterStatus(dep);
                                setSelectedUser(""); // reset user dropdown when department changes
                            }}
                        >
                            {departmentList
                                .filter((ele) => ele.status === "Active")
                                .map((ele) => (
                                    <AutocompleteItem key={ele.key} value={ele.name}>
                                        {ele.name.replace(/([A-Z])/g, " $1").trim()}
                                    </AutocompleteItem>
                                ))}
                        </Autocomplete>
                    )
                }

                {
                    user.departmentID ? null : (
                        <Autocomplete
                            aria-label="filter by User"
                            placeholder="Filter by User"
                            className="max-w-xs"
                            selectedKey={selectedUser}
                            onSelectionChange={(key) => setSelectedUser(key as string)}
                        >
                            {users.map((ele: User) => (
                                <AutocompleteItem key={String(ele.userID)} value={ele.userName}>
                                    {ele.userName}
                                </AutocompleteItem>
                            ))}
                        </Autocomplete>
                    )
                }


                <DateRangePicker
                    className="max-w-xs"
                    label="Date Range"
                    onChange={(range) => {
                        if (range) {
                            setDateRange({
                                startDate: range.start?.toString() || "",
                                endDate: range.end?.toString() || ""
                            });
                        }
                    }}
                />

            </div>

            {/* Reports Table */}
            <div className="bg-white dark:bg-ink-800 rounded-lg shadow overflow-hidden p-6">
                <ReusableTable
                    data={reportData}
                    columns={reportColumns}
                    // actions={reportActions}
                    searchable={true}
                    searchPlaceholder="Search reports..."
                    searchKeys={['TaskName', 'UserName', 'Remarks']}
                    filterable={true}
                    filterOptions={[

                    ]}
                    totalRecords={totalRecords}
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
                    selectable={true}
                    sortable={true}
                    paginated={true}
                    emptyContent="No reports found"
                    title="Daily Task Reports"
                    getRowId={(item) => item.DailyTaskLogID}
                // renderCell={renderReportCell}
                />
            </div>


        </div>
    );
}