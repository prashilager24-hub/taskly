import { useEffect, useState, useMemo, useCallback } from "react";

import { addToast, Dropdown, DropdownTrigger, Button, DropdownMenu, DropdownItem } from "@/components/ui";


import { title } from "@/components/primitives";

import axios from "axios";
import EfficiencyTable from "@/components/table2";
import CustomDateRangePicker from "../components/CustomDateRangePicker"
import FilterDropdown from "@/components/FilterDropdown";
import { format } from "date-fns";

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
export default function Efficiency() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [dateSelect, setDateSelect] = useState(7)

    const [departmentList, setDepartmentList] = useState<Department[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [pageNumber, setPageNumber] = useState(1)
    const [totalRecords, settotalRecords] = useState(0)
    const [pageSize, setPageSize] = useState(10)
    const [searchValue, setSearchValue] = useState("")
    const [average, setAverage] = useState({})
    const [ELUserSummary, setELUserSummary] = useState([])
    const [dashboard, setDashboard] = useState([])
    const [loading, setLoading] = useState(false);
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
    const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
    const user = useMemo(() => {
        const raw = localStorage.getItem("authUserLD");
        return raw ? JSON.parse(raw) : null;
    }, []);
    // determine if user is ELO / R user
    const isELORUSER = [2, 3, 4, 5, 6, 7, 23].includes(user?.userRole);    // initial state values
    const [filterStatus, setFilterStatus] = useState(
        user?.departments ? 0 : ""
    );
    const efficiencyLevels = ["High", "At Par", "Low"];
    const [efficiencyFilter, setEfficiencyFilter] = useState("");
    const [selectedUser, setSelectedUser] = useState(
        isELORUSER ? String(user?.userID) : ""
    );

    const selectRange = useCallback((days: number) => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        setDateRange({
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0]
        });
    }, []);
    const [userSearch, setUserSearch] = useState("");

    const filteredUsers = useMemo(() => {
        return users.filter((u) =>
            u.userName.toLowerCase().includes(userSearch.toLowerCase())
        );
    }, [users, userSearch])
    const handleDateSelect = useCallback((value: string) => {
        setDateSelect(value);

        if (value === "7") selectRange(7);
        if (value === "30") selectRange(30);
    }, [selectRange]);
    // Table configuration
    // const reportColumns: TableColumn[] = [
    //     { key: 'WorkDate', label: 'Work Date', sortable: true },
    //     { key: 'DailyTaskLogID', label: 'Log ID', sortable: true, width: '100px' },
    //     { key: 'TaskID', label: 'Task ID', sortable: true, width: '100px' },
    //     { key: 'CreatedAt', label: 'Created At', sortable: true },
    //     { key: 'TaskName', label: 'Task Name', sortable: true },
    //     { key: 'UserName', label: 'User', sortable: true },
    //     { key: 'actualTimeOfWork', label: 'Time (mins)/Percentage', sortable: true },
    //     { key: 'Remarks', label: 'Remarks', sortable: false },
    // ];

    // const reportActions: TableAction[] = [
    //     {
    //         key: 'view',
    //         label: 'View Details',
    //         color: 'primary',
    //         onAction: (log) => {
    //             console.log('View log details:', log);
    //             // Add view functionality here
    //         }
    //     },
    //     {
    //         key: 'edit',
    //         label: 'Edit',
    //         color: 'warning',
    //         onAction: (log) => {
    //             console.log('Edit log:', log);
    //             // Add edit functionality here
    //         }
    //     }
    // ];

    // Custom cell renderer for better formatting
    // const renderReportCell = (log: DailyTaskLog, columnKey: string) => {
    //     switch (columnKey) {
    //         case 'DailyTaskLogID':
    //             return (
    //                 <span className="text-sm font-medium text-ink-900 dark:text-white">
    //                     #{log.DailyTaskLogID}
    //                 </span>
    //             );
    //         case 'TaskID':
    //             return (
    //                 <span className="text-sm font-medium text-brand-600 dark:text-brand-400">
    //                     T-{log.TaskID}
    //                 </span>
    //             );
    //         case 'TaskName':
    //             return (
    //                 <div className="max-w-xs">
    //                     <p className="text-sm font-medium text-ink-900 dark:text-white truncate" title={log.TaskName}>
    //                         {log.TaskName}
    //                     </p>
    //                 </div>
    //             );
    //         case 'UserName':
    //             return (
    //                 <div className="flex flex-col">
    //                     <p className="text-sm font-medium text-ink-900 dark:text-white">{log.UserName}</p>
    //                     <p className="text-xs text-ink-500 dark:text-ink-400">ID: {log.UserID}</p>
    //                 </div>
    //             );
    //         case 'WorkDate':
    //             return new Date(log.WorkDate).toLocaleDateString();
    //         case 'actualTimeOfWork':
    //             return (
    //                 <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-brand-100 text-brand-800">
    //                     {log.actualTimeOfWork} mins
    //                 </span>
    //             );
    //         case 'Remarks':
    //             return (
    //                 <div className="max-w-xs">
    //                     <p className="text-sm text-ink-600 dark:text-ink-400 truncate" title={log.Remarks}>
    //                         {log.Remarks || 'No remarks'}
    //                     </p>
    //                 </div>
    //             );
    //         case 'CreatedAt':
    //             return new Date(log.CreatedAt).toLocaleDateString();
    //         default:
    //             return String(log[columnKey as keyof DailyTaskLog] || '');
    //     }
    // };

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

            } catch (err) {
                console.error("Error fetching department list:", err);
            }
        };

        fetchDepartments();
    }, []);

    // useEffect(() => {
    //     const fetchUsers = async () => {
    //         try {
    //             const body = {
    //                 filter: "",
    //                 searchText: "",
    //                 departmentID: filterStatus ? Number(filterStatus) : 0
    //             };

    //             const res = await axios.post(
    //                 "/t2.0/authentificationUtilization/users/read?page=0&size=0",
    //                 body,
    //                 {
    //                     headers: {
    //                         "Content-Type": "application/json",
    //                         Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
    //                     },
    //                 }
    //             );

    //             const usersData = res.data.response.users || [];

    //             const formatted: User[] = usersData.map((u: any) => ({
    //                 userID: u.userID,
    //                 userName: u.userName,
    //                 // departmentName: u.departmentName || "N/A",
    //                 // departmentID: u.departmentID,

    //             }));

    //             setUsers(formatted);
    //             console.log("Users formatted:", formatted);
    //         } catch (err) {
    //             console.error("Error fetching users:", err);
    //         }
    //     };

    //     fetchUsers();


    // }, [filterStatus]);

    // useEffect(() => {
    //     // if (!filterStatus || !selectedUser || !dateRange.startDate || !dateRange.endDate) return;

    //     const fetchLogs = async () => {
    //         try {
    //             const body = {
    //                 departmentId: filterStatus ? Number(filterStatus) : 28,
    //                 userId: Number(selectedUser),
    //                 startDate: dateRange.startDate,
    //                 endDate: dateRange.endDate,

    //             };

    //             const res = await fetch(`/t2.0/authentificationUtilization/dailyTaskLog/list?page=${pageNumber}&size=${pageSize}`, {
    //                 method: "POST",
    //                 headers: {
    //                     "Content-Type": "application/json",
    //                     Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
    //                 },
    //                 body: JSON.stringify(body)
    //             });

    //             const resData = await res.json();
    //             const formattedLogs = resData.response.logs.map((log: any) => ({
    //                 DailyTaskLogID: log.dailyTaskLogID,
    //                 TaskID: log.taskID,
    //                 TaskName: log.taskName,
    //                 UserID: log.userID,
    //                 UserName: log.userName,
    //                 WorkDate: log.workDate,
    //                 actualTimeOfWork: log.actualTimeOfWork ? Number(log.actualTimeOfWork) : "N/A",
    //                 Remarks: log.remarks,
    //                 CreatedAt: log.createdAt,
    //                 UpdatedAt: log.updatedAt
    //             }));

    //             setReportData(formattedLogs);
    //             settotalRecords(resData.response.totalRecords);

    //             console.log("Report logs:", resData.response.logs);
    //         } catch (err) {
    //             console.error("Error fetching logs:", err);
    //         }
    //     };

    //     fetchLogs();
    // }, [filterStatus, selectedUser, dateRange, authUserLD, pageNumber, pageSize]);

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
                            Authorization: `Bearer ${user?.token || ""}`,
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
                // setELList(formatted);
                console.log("Logged-in user:", user);
                console.log("All users:", formatted);
                console.log("Filtered users:", filteredUsers);

            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };

        fetchUsers();
    }, [filterStatus]);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const bodyData =
                {
                    departmentID: filterStatus,
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                    userID: selectedUser,
                    groupBy: "day",
                    isHeExecutiveLeader: user.isHeExecutiveLeader || false,
                    efficiencyLevel: efficiencyFilter

                }


                const res = await axios.post(
                    "/t2.0/authentificationUtilization/list-efficiency-summary", bodyData,
                    {

                        headers: {
                            "Content-Type": "application/json"
                        },

                    }
                );

                const data = await res.data;

                // map data to {key,name} format
                const summarydata = data.summary
                setAverage(summarydata)
                const actualdata = data.data
                setDashboard(actualdata)
                if (user.userRole == 3) {
                    console.log(data.departments, "hey")
                    setELUserSummary(data.departments)
                }
            } catch (err) {
                console.error("Error fetching department list:", err);
            }
        };

        fetchDashboard();
    }, [filterStatus, dateRange, selectedUser, efficiencyFilter])


    const handleDownload = useCallback(async () => {
        try {
            setLoading(true);
            const bodyData =
            {
                departmentID: filterStatus,
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
                userID: selectedUser,
                groupBy: "day",
                isHeExecutiveLeader: user.isHeExecutiveLeader || false,
                efficiencyLevel: efficiencyFilter

            }
            const res = await axios.post(
                "/t2.0/authentificationUtilization/download-efficiency-summary",
                bodyData, // your actual body
                {
                    responseType: "blob",
                }
            );

            const blob = new Blob([res.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "Efficiency-Summary.xlsx";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            addToast({
                title: "Success",
                description: "Report Successfully downloaded",
                color: "success",
            });

        } catch (err) {
            addToast({
                title: "Error",
                description: String(err),
                color: "danger",
            });
        } finally {
            setLoading(false);
        }
    }, [filterStatus, dateRange, selectedUser, efficiencyFilter, user]);
    // const efficiencyLevel =
    //     average?.AvgTargetPercent >= 100 &&
    //         average?.AvgUtilizationPercent >= 80 &&
    //         average?.AvgTotalWork <= average?.AvgAllocatedHrs
    //         ? "High"
    //         : average?.AvgTargetPercent >= 80 &&
    //             average?.AvgUtilizationPercent >= 50 &&
    //             average?.AvgTotalWork <= average?.AvgAllocatedHrs
    //             ? "At Par"
    //             : "Low";

    return (
        < div>
            <div className="mb-8 flex justify-between">
                <div>
                    <h1 className={title({ size: "20px" })}>Performance Insights</h1>

                    <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
                        Track performance, productivity, and utilization insights                                    </p>
                </div>

                <div className="flex gap-3 items-center">
                    <div className="flex gap-3 items-center">
                        {/* <Button variant="flat"
                            onClick={handleDownload}
                            size="sm"
                            color="primary"
                            className={`px-4 h-8 w-fit ${!user?.departmentID
                                ? ""
                                : "opacity-0 pointer-events-none select-none"
                                }`}
                            isDisabled={loading || !!user?.departmentID} >
                            Download
                        </Button> */}

                        <Dropdown placement="bottom-start">
                            <DropdownTrigger>
                                <Button
                                    variant="flat"
                                    size="sm"
                                    className="w-[260px] justify-between bg-ink-200 dark:bg-ink-700"
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
                    </div>
                    {
                        user.userRole !== 2 &&
                            user.userRole !== 5 &&
                            user.userRole !== 6 &&
                            user.userRole !== 23 ? (
                            <FilterDropdown
                                departmentList={departmentList}
                                users={users.map(u => ({ key: u.userID, name: u.userName }))}
                                efficiencyLevels={efficiencyLevels}
                                filterStatus={filterStatus}
                                selectedUser={selectedUser}
                                userSearch={userSearch}
                                efficiencyFilter={efficiencyFilter}
                                filteredUsers={filteredUsers.map(u => ({ key: u.userID, name: u.userName }))}
                                onDepartmentChange={(dep) => {
                                    setFilterStatus(dep);
                                    setUserSearch("");
                                    setEfficiencyFilter("");
                                    setSelectedUser("");
                                }}
                                onUserChange={(key, userName) => {
                                    setSelectedUser(key);
                                    setUserSearch(userName);
                                }}
                                onUserSearchChange={(value) => {
                                    setUserSearch(value);
                                    setEfficiencyFilter("");
                                    if (!value) setSelectedUser("");
                                }}
                                onEfficiencyChange={(value) => {
                                    setEfficiencyFilter(value);
                                }}
                            />
                        ) : null
                    }

                    {/* <Button size="lg" color="primary" className="mr-4">Download</Button> */}
                </div>
            </div>

            {average && (
                <div
                    className="flex flex-col gap-4 p-4 bg-white dark:bg-ink-900 rounded-xl  my-2 border border-ink-100 dark:border-white/10"

                >
                    {/* Card Title */}
                    <h2 className="text-base font-semibold text-ink-700 dark:text-ink-200 tracking-wide">
                        Summary
                    </h2>

                    {/* 2x2 GRID */}
                    <div className="flex">

                        {/* Total Working Hours */}
                        <div className="flex justify-center items-center bg-ink-50 dark:bg-ink-950 p-3 rounded-lg">
                            <span className="text-xs text-ink-500 dark:text-ink-400 font-medium">
                                Average Working Hours
                            </span>
                            <span className="mt-1 px-2 py-1 mx-2  text-sm font-semibold text-emerald-700 bg-emerald-100 rounded-full w-fit">
                                {average.AvgTotalWork}
                            </span>
                        </div>

                        {/* Total Allocated Hours */}
                        <div className="flex justify-center items-center bg-ink-50 dark:bg-ink-950 p-3 rounded-lg">
                            <span className="text-xs text-ink-500 dark:text-ink-400 font-medium">
                                Average Allocated Hours
                            </span>
                            <span className="mt-1 px-2 py-1 mx-2  text-sm font-semibold text-amber-700 bg-amber-100 rounded-full w-fit">
                                {average.AvgAllocatedHrs}
                            </span>
                        </div>

                        {/* Avg Utilization % */}
                        {/* <div className="flex justify-center items-center bg-ink-50 dark:bg-ink-950 p-3 rounded-lg">
                            <span className="text-xs text-ink-500 dark:text-ink-400 font-medium">
                                Avg Utilization %
                            </span>
                            <span className="mt-1 px-2 py-1  mx-2 text-sm font-semibold text-brand-700 bg-brand-100 rounded-full w-fit">
                                {average.AvgUtilizationPercent}%
                            </span>
                        </div> */}
                        <div className="flex justify-center items-center bg-ink-50 dark:bg-ink-950 p-3 rounded-lg">
                            <span className="text-xs text-ink-500 dark:text-ink-400 font-medium">
                                Avg Target %
                            </span>
                            <span className="mt-1 px-2 py-1  mx-2 text-sm font-semibold text-brand-700 bg-brand-100 rounded-full w-fit">
                                {average.AvgTargetPercent}%
                            </span>
                        </div>

                        {/* Efficiency Level */}
                        {/* <div className="flex justify-center items-center bg-ink-50 dark:bg-ink-950 p-3 rounded-lg">
                            <span className="text-xs text-ink-500 dark:text-ink-400 font-medium">
                                Efficiency Level
                            </span>

                            <span
                                className={`mt-1 px-2 py-1 mx-2 text-sm font-semibold rounded-full w-fit ${average.EfficiencyLevel === "High"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : average.EfficiencyLevel === "At Par"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-rose-100 text-rose-700"
                                    }`}
                            >
                                {average.EfficiencyLevel}
                            </span>
                        </div> */}

                    </div>
                </div>
            )}

            {/* Reports Table */}
            {/* {
                user.userRole !== 3 && ( */}
            <div className="bg-white dark:bg-ink-800 rounded-lg shadow overflow-hidden p-6">
                <EfficiencyTable data={dashboard} type="user" />
            </div>
            {/* //     ) */}
            {/* // } */}
            {/* {user.isHeExecutiveLeader && (
                <div className="col-span-3 flex justify-center mt-4">
                    <Card className="w-full">
                        <CardBody>
                            <Tabs key="bordered" aria-label="Tabs variants" variant="full">
                                {ELUserSummary?.map((ele) => {
                                    return (
                                        <Tab
                                            key={ele.DepartmentName}
                                            title={ele.DepartmentName}
                                            className="flex flex-col items-start"
                                        >
                                            <EfficiencyTable data={ele.Users} type="ELU" />

                                        </Tab>
                                    );
                                })}
                            </Tabs>
                        </CardBody>
                    </Card>
                </div>
            )} */}


        </div>
    );
}