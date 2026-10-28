import { PageTitle } from "@/components/page";
import { SummaryBar } from "@/components/page";
import { useEffect, useState } from "react";
import { Autocomplete, AutocompleteItem, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip } from "@/components/ui";
import { title } from "@/components/primitives";
import { Sidebar } from "@/components/sidebar";
import { today, getLocalTimeZone } from "@internationalized/date";

import { Topbar } from "@/components/topbar";
import axios from "axios";
import ReusableTable, { TableColumn, TableAction } from "@/components/table";
import CustomDateRangePicker from "../components/CustomDateRangePicker"
import DailyLogsFilterDropdown from "@/components/DailyLogsFilterDropdown";
import { format } from "date-fns";

interface DailyTaskLog {
    dailyTaskLogID: number;
    taskID: number;
    taskName: string;
    userID: number;
    userName: string;
    workDate: string;
    actualTimeOfWork: number;
    remarks: string;
    createdAt: string;
    updatedAt: string;
}


interface User {
    userID: number;
    userName: string;
    roleID?: number;
    reportingManagerID?: number;
    executiveLeaderID?: number;
    functionalLeaderID?: number;
}

interface Department {
    key: number;
    name: string;
    description: string;
    status: string;
}

export default function DailyLogs() {
    const authUserLD = localStorage.getItem("authUserLD");
    const user = JSON.parse(authUserLD)
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [departmentList, setDepartmentList] = useState<Department[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState(
        user?.userRole != 1 && user?.departmentID ? String(user.departmentID) : "" // admins start on all departments
    );
    const [selectedUser, setSelectedUser] = useState(
        user?.userRole != 1 && user?.userID ? String(user.userID) : ""
    );
    const [users, setUsers] = useState<User[]>([]);
    const [dateSelect, setDateSelect] = useState(7)
    const [pageNumber, setPageNumber] = useState(1)
    const [totalRecords, settotalRecords] = useState(0)
    const [average, setAverage] = useState({})
    const [pageSize, setPageSize] = useState(10)

    const [searchValue, setSearchValue] = useState("")
    const [isTarget, setIsTarget] = useState<true | false | null>(null);
    const [dateRange, setDateRange] = useState(() => {
        const today = new Date();

        const endDate = today.toISOString().split("T")[0];

        const start = new Date();
        start.setDate(start.getDate() - 7);
        const startDate = start.toISOString().split("T")[0];

        return { startDate, endDate };
    });
    const [taskIDFilter, setTaskIDFilter] = useState(0)
    const [reportData, setReportData] = useState<DailyTaskLog[]>([
    ]);
    const [ELList, setELList] = useState<User[]>([]);
    const [elFilter, setELfilter] = useState(user.isHeExecutiveLeader ? Number(user.userID) : 0)
    const [taskTargetList, setTaskTargetList] = useState([]);


    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    const Task = { key: "TASK", name: "Task", status: "Active" };
    const Target = { key: "TARGET", name: "Target", status: "Active" };
    // const authUserLD = localStorage.getItem("authUserLD");


    const renderCell = (row: any, columnKey: string) => {
        switch (columnKey) {
            case "workDate":
            case "WorkDate":
                return row[columnKey]
                    ? format(new Date(row[columnKey]), "dd MMM yyyy")
                    : "-";
            case "taskName":
                if (row.taskName === "FULL DAY LEAVE") {
                    return (
                        <Chip
                            size="sm"
                            color="danger"
                            variant="flat"
                            className="font-medium"
                        >
                            FULL DAY LEAVE
                        </Chip>
                    );
                }

                return <span>{row.taskName}</span>;

            default:
                return row[columnKey] ?? "-";
        }
    };

    const selectRange = (days: number) => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        setDateRange({
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0]
        });
    };

    const handleDateSelect = (value: string) => {
        setDateSelect(value);

        if (value === "7") selectRange(7);
        if (value === "30") selectRange(30);
    };

    // Table configuration
    const reportColumns: TableColumn[] = [

        { key: 'workDate', label: 'Work Date', sortable: true },
        { key: 'dailyTaskLogID', label: 'Log ID', sortable: true },
        { key: 'taskID', label: 'Task ID', sortable: true },
        {
            key: "taskName",
            label: <span>{isTarget ? "Target Name" : "Task Type"}</span>,
            sortable: true
        },
        { key: 'userName', label: 'User', sortable: true },
        { key: 'setUp', label: 'Task Count', sortable: true },
        ...(!isTarget ? [{ key: 'allocatedTime', label: 'Allocated Time (mins)', sortable: true },
        { key: 'timeTakenToWork', label: 'User Time Taken (mins)', sortable: true },
            // { key: 'TotalTime', label: 'Total Allocated Time', sortable: true }
        ]
            : []),
        ...(isTarget
            ? [
                {
                    key: 'units',
                    label: 'Target Units',
                    sortable: true,
                },
                {
                    key: 'achivedUnits',
                    label: 'Achieved Units',
                    sortable: true,
                },
                {
                    key: 'totalUnitValues',
                    label: 'Target Percentage',
                    sortable: true,
                },
            ]
            : []),
        { key: 'remarks', label: 'Task Description', sortable: false },
    ];


    const reportActions: TableAction[] = [
        {
            key: 'view',
            label: 'View Details',
            color: 'primary',
            onAction: (log) => {
                // Add view functionality here
            }
        },
        {
            key: 'edit',
            label: 'Edit',
            color: 'warning',
            onAction: (log) => {
                // Add edit functionality here
            }
        }
    ];



    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const bodyData = {
                    searchText: "",
                    filter: "",
                    startDate: "",
                    endDate: "",
                    roleID: 3,
                    userID: user.isHeExecutiveLeader ? Number(user.userID) : Number(elFilter),


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
                    executiveLeaderID: dept.executiveLeaderID,
                    functionalLeaderID: dept.functionalLeaderID
                })) || [];

                setDepartmentList(formatted);
            } catch (err) {
                console.error("Error fetching department list:", err);
            }
        };

        fetchDepartments();
    }, [elFilter]);

    useEffect(() => {
        const fetchDepartmentTask = async () => {
            try {
                const res = await fetch(
                    `/t2.0/authentificationUtilization/Department/taskTarget/${filterStatus}`,
                    {
                        method: "GET",
                        headers: { "Content-Type": "application/json" }
                    }
                );

                const resData = await res.json();
                const data = resData?.result ?? { targets: [], tasks: [] };

                // Merge Target + Task in one list
                const combinedList = [
                    ...(data.targets ?? []).map(t => ({
                        id: t.targetID,
                        name: t.targetName,
                        type: "TARGET"
                    })),
                    ...(data.tasks ?? []).map(t => ({
                        id: t.taskID,
                        name: t.taskName,
                        type: "TASK"
                    }))
                ];

                setTaskTargetList(combinedList);

            } catch (err) {
                console.error("Error fetching task/target list:", err);
            }
        };

        if (filterStatus) fetchDepartmentTask();
        else setTaskTargetList([]); // clear list when filter changed to empty

    }, [filterStatus]);

    // useEffect(() => {
    //     const fetchUsers = async () => {
    //         try {
    //             const body = {
    //                 filter: "",
    //                 searchText: "",
    //                 departmentID: filterStatus ? Number(filterStatus) : 0,
    //                 ...(filterStatus ? {} : {})  // only add roleID if no department
    //             };

    //             const res = await axios.post(
    //                 "/t2.0/authentificationUtilization/users/read?page=0&size=0",
    //                 body,
    //                 {
    //                     headers: {
    //                         "Content-Type": "application/json",
    //                         Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""
    //                             }`,
    //                     },
    //                 }
    //             );

    //             const usersData = res.data.response.users || [];

    //             const formatted: User[] = usersData.map((u: any) => ({
    //                 userID: u.userID,
    //                 userName: u.userName,
    //                 roleID: u.roleID,
    //             }));

    //             filterStatus ? setUsers(formatted) : setELList(formatted);
    //             setUsers(formatted)
    //         } catch (err) {
    //             console.error("Error fetching users:", err);
    //         }
    //     };

    //     fetchUsers();

    // }, [filterStatus]);

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
                            Authorization: `Bearer ${authUserLD
                                ? JSON.parse(authUserLD).token
                                : ""
                                }`,
                        },
                    }
                );

                const usersData = res.data.response.users || [];

                const formatted: User[] = usersData.map((u: any) => ({
                    userID: u.userID,
                    userName: u.userName,
                    roleID: u.roleID,
                    reportingManagerID: u.reportingManagerId,
                    executiveLeaderID: u.elManagerId,
                    functionalLeaderID: u.functionalLeaderID,
                }));

                let filteredUsers = formatted;

                // EL (role 3)
                if (user.userRole === 3) {
                    filteredUsers = formatted.filter(
                        (u: any) =>
                            u.userID === user.userID ||
                            u.executiveLeaderID === user.userID ||
                            u.reportingManagerID === user.userID
                    );
                }

                // Reporting Manager (role 7)
                else if (user.userRole === 7) {
                    filteredUsers = formatted.filter(
                        (u: any) =>
                            u.userID === user.userID ||
                            u.reportingManagerID === user.userID
                    );
                }

                // FL (role 4)
                else if (user.userRole === 4) {
                    filteredUsers = formatted.filter(
                        (u: any) =>
                            u.userID === user.userID ||
                            u.functionalLeaderID === user.userID
                    );
                }

                setUsers(filteredUsers);
                setELList(formatted);


            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };

        fetchUsers();
    }, [filterStatus]);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const body = {
                    departmentID: user.userRole == 7 ? null : filterStatus ? Number(filterStatus) : null,
                    userID: Number(selectedUser) || (user.userRole == 1 ? null : user.userID), // admins see everyone
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                    isForTarget: isTarget,
                    searchText: searchValue,
                    taskID: taskIDFilter,
                    // roleID: user.userRole,
                    eLID: user.isHeExecutiveLeader ? user.userID : Number(elFilter),
                    isHeExecutiveLeader: user.isHeExecutiveLeader


                };

                const res = await fetch(`/t2.0/authentificationUtilization/form/list?page=${pageNumber}&size=${pageSize}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
                    },
                    body: JSON.stringify(body)
                });

                const resData = await res.json();





                const formattedLogs = resData.response.userWorkDataList.map((log: any) => {
                    const setUpVal = Number(log.setUp ?? 0);
                    const allocVal = Number(log.allocatedTime ?? 0);
                    const totalTimeValue = setUpVal * allocVal;

                    return {
                        dailyTaskLogID: log.dailyTaskLogID,
                        taskID: String(log.taskID ?? 0),
                        userID: log.userID,
                        workDate: log.workDate,
                        setUp: String(setUpVal),
                        taskName: log.taskName || "N/A",
                        totalUnitValues: log.totalUnitValues,
                        userName: log.userName,
                        allocatedTime: String(allocVal),
                        TotalTime: totalTimeValue === 0 ? "0" : totalTimeValue,
                        timeTakenToWork: String(log.timeTakenToWork ?? 0),
                        isForTarget: log.isForTarget,
                        totalTimePerSetup: log.totalTimePerSetup ?? 0,
                        remarks: log.remarks || "N/A",
                        units: log.units,
                        departmentID: log.departmentID,
                        achivedUnits: log.achivedUnits,
                        createdAt: log.createdAt.split("T")[0],
                        updatedAt: log.updatedAt
                    };
                });
                const data = resData.response
                setAverage(data)

                setReportData(formattedLogs);
                settotalRecords(resData.response.totalRecords);

            } catch (err) {
                console.error("Error fetching logs:", err);
            }
        };

        fetchLogs();
    }, [filterStatus, selectedUser, dateRange, authUserLD, pageNumber, pageSize, isTarget, searchValue, taskIDFilter, elFilter]);





    return (
        <div>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <PageTitle title={user?.departmentID ? "My Data" : "User Data"} subtitle={user?.departmentID ? "View insights and reports for your department’s daily activities." : "Access detailed insights into users’ performance and daily activity records."} />

                <div className="flex gap-3 items-center">
                    <div className="flex gap-3 items-center">
                        {/* <Button variant="flat"
                            size="sm"
                            color="primary"
                            className={`px-4 h-8 w-fit ${!user?.departmentID
                                ? ""
                                : "opacity-0 pointer-events-none select-none"
                                }`}
                            isDisabled={loading || !!user?.departmentID} >
                            Download All
                        </Button> */}

                        <CustomDateRangePicker value={dateRange} onChange={(range) => setDateRange(range)} />
                    </div>

                    <DailyLogsFilterDropdown
                        user={user}
                        departmentList={departmentList}
                        users={users}
                        ELList={ELList}
                        taskTargetList={taskTargetList}
                        filterStatus={filterStatus}
                        selectedUser={selectedUser}
                        isTarget={isTarget}
                        elFilter={elFilter}
                        taskIDFilter={taskIDFilter}
                        onFilterStatusChange={(dep) => {
                            setFilterStatus(dep);
                            setSelectedUser("");
                        }}
                        onSelectedUserChange={(key) => setSelectedUser(key)}
                        onIsTargetChange={(val) => setIsTarget(val)}
                        onElFilterChange={(key) => setELfilter(key)}
                        onTaskIDFilterChange={(key) => setTaskIDFilter(key)}
                    />


                    {/* <Button size="lg" color="primary" className="mr-4">Download</Button> */}
                </div>
            </div>
            {average && (
                <SummaryBar
                    className="lg:grid-cols-2"
                    items={[
                        { label: "Average working hours", value: average.avgTotalWork },
                        { label: "Average allocated hours", value: average.avgAllocatedHrs },
                    ]}
                />
            )}

            {/* Reports Table */}
            <div className="border border-ink-200 bg-white p-5 dark:border-white/10 dark:bg-ink-900">
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
                    }}
                    selectable={false}
                    sortable={true}
                    paginated={true}
                    emptyContent="No reports found"
                    title={user?.departmentID ? "My Data Report" : "Daily Task Report"}
                    getRowId={(item) => item.dailyTaskLogID}
                    renderCell={renderCell}
                />
            </div>


        </div>
    );
}