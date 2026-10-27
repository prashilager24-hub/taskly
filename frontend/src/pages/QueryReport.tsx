import { useEffect, useState } from "react";
import { Select, SelectItem } from "@/components/ui";
import { DateRangePicker, Autocomplete, addToast, Input, Spinner, AutocompleteItem, Dropdown, DropdownTrigger, Button, DropdownMenu, Card, CardBody, CardHeader, Tabs, Tab, DropdownItem, } from "@/components/ui";
import { today, getLocalTimeZone } from "@internationalized/date";

import { title } from "@/components/primitives";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import axios from "axios";
import EfficiencyTable from "@/components/table2";
import CustomDateRangePicker from "../components/CustomDateRangePicker"
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
const FilterIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        {...props}
    >
        <path
            d="M4 5h16M7 12h10M10 19h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export default function QueryReport() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [dateSelect, setDateSelect] = useState(7)
    const [filters, setFilters] = useState([
        {
            field: "",
            operator: "=",
            value: "",
        },
    ]);
    const filterFields = [

        "Target Achieved",
        "Goal Achieved",
        "Efficiency",
        "Utilization",
    ];
    const textOperators = [
        "=",
        "contains",
    ];
    const numericOperators = [
        "=",
        ">",
        "<",
        ">=",
        "<=",
    ];
    const [departmentList, setDepartmentList] = useState<Department[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [pageNumber, setPageNumber] = useState(1)
    const [totalRecords, settotalRecords] = useState(0)
    const [pageSize, setPageSize] = useState(10)
    const [searchValue, setSearchValue] = useState("")
    const [average, setAverage] = useState<any[]>([])
    const [ELUserSummary, setELUserSummary] = useState([])
    const [dashboard, setDashboard] = useState([])
    const authUserLD = localStorage.getItem("authUserLD");
    // safely parse stored user
    const user = authUserLD ? JSON.parse(authUserLD) : null;
    // determine if user is ELO / R user
    const isELORUSER = user && (user.userRole === 2 || user.userRole === 3 || user.userRole === 4);

    const [selectedUser, setSelectedUser] = useState(
        isELORUSER ? String(user?.userID) : ""
    );
    const [loading, setLoading] = useState(false);
    const [dateRange, setDateRange] = useState(() => {
        const today = new Date();

        const endDate = selectedUser ? "" : today.toISOString().split("T")[0];

        const start = new Date();
        start.setDate(start.getDate() - 7);
        const startDate = selectedUser ? "" : start.toISOString().split("T")[0];

        return { startDate, endDate };
    });
    const [reportData, setReportData] = useState<DailyTaskLog[]>([
    ]);
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    // initial state values
    const [filterStatus, setFilterStatus] = useState(
        user?.departments ? 0 : ""
    );
    const efficiencyLevels = ["High", "At Par", "Low"];
    const [efficiencyFilter, setEfficiencyFilter] = useState("");

    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const selectRange = (days: number) => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        setDateRange({
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0]
        });
    };
    const [userSearch, setUserSearch] = useState("");

    const filteredUsers = users.filter((u) =>
        u.userName.toLowerCase().includes(userSearch.toLowerCase())
    );
    const handleDateSelect = (value: string) => {
        setDateSelect(value);

        if (value === "7") selectRange(7);
        if (value === "30") selectRange(30);
    };
    // Table configuration
    const reportColumns: TableColumn[] = [
        { key: 'WorkDate', label: 'Work Date', sortable: true },
        { key: 'DailyTaskLogID', label: 'Log ID', sortable: true, width: '100px' },
        { key: 'TaskID', label: 'Task ID', sortable: true, width: '100px' },
        { key: 'CreatedAt', label: 'Created At', sortable: true },
        { key: 'TaskName', label: 'Task Name', sortable: true },
        { key: 'UserName', label: 'User', sortable: true },
        { key: 'actualTimeOfWork', label: 'Time (mins)/Percentage', sortable: true },
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
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
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
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={log.TaskName}>
                            {log.TaskName}
                        </p>
                    </div>
                );
            case 'UserName':
                return (
                    <div className="flex flex-col">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{log.UserName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">ID: {log.UserID}</p>
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
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate" title={log.Remarks}>
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
        const dashboard = async () => {
            try {
                const bodyData =
                {
                    departmentID: filterStatus,
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                    userID: selectedUser,
                    groupBy: "day",
                    query: true,
                    isHeExecutiveLeader: user.isHeExecutiveLeader || false,
                    efficiencyLevel: efficiencyFilter,
                    filters: filters
                        .filter(f => f.field && f.value)
                        .map(f => ({
                            field: f.field,
                            operator: f.operator,
                            value: f.value
                        }))

                }
                setLoading(true);

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

                const actualdata = data.data

                const departmentSummary = Object.values(
                    actualdata.reduce((acc: any, item: any) => {
                        const deptId = item.DepartmentID;

                        if (!acc[deptId]) {
                            acc[deptId] = {
                                DepartmentID: item.DepartmentID,
                                DepartmentName: item.DepartmentName,

                                targetSum: 0,
                                allocatedSum: 0,
                                utilizationSum: 0,
                                totalWorkSum: 0,
                                goalSum: 0,
                                count: 0,

                                Data: [],
                            };
                        }

                        acc[deptId].targetSum += Number(item.TargetAchievedPercent || 0);
                        acc[deptId].allocatedSum += Number(item.AllocatedTimeHrs || 0);
                        acc[deptId].utilizationSum += Number(item.UtilizationPercent || 0);
                        acc[deptId].totalWorkSum += Number(item.TotalTimeOfWork || 0);
                        acc[deptId].goalSum += Number(item.GoalPercent || 0);
                        acc[deptId].count += 1;

                        acc[deptId].Data.push(item);

                        return acc;
                    }, {})
                ).map((dept: any) => {
                    const AvgTargetPercent = +(dept.targetSum / dept.count).toFixed(2);
                    const AvgAllocatedHrs = +(dept.allocatedSum / dept.count).toFixed(2);
                    const AvgUtilizationPercent = +(dept.utilizationSum / dept.count).toFixed(2);
                    const AvgTotalWork = +(dept.totalWorkSum / dept.count).toFixed(2);
                    const AvgGoalPercent = +(dept.goalSum / dept.count).toFixed(2);

                    let EfficiencyLevel = "Low";

                    if (
                        AvgTargetPercent >= 100 &&
                        AvgUtilizationPercent >= 80 &&
                        AvgTotalWork <= AvgAllocatedHrs
                    ) {
                        EfficiencyLevel = "High";
                    } else if (
                        AvgTargetPercent >= 80 &&
                        AvgUtilizationPercent >= 50 &&
                        AvgTotalWork <= AvgAllocatedHrs
                    ) {
                        EfficiencyLevel = "At Par";
                    }

                    return {
                        DepartmentID: dept.DepartmentID,
                        DepartmentName: dept.DepartmentName,

                        AvgTargetPercent,
                        AvgAllocatedHrs,
                        AvgUtilizationPercent,
                        AvgTotalWork,
                        AvgGoalPercent,
                        EfficiencyLevel,

                        Data: dept.Data,
                    };
                });
                if (selectedUser) {
                    console.log("Department Summary:", departmentSummary);
                    setAverage(departmentSummary)

                }
                else {
                    setAverage([])
                }

                setDashboard(actualdata)
                setLoading(false);
                if (user.userRole == 3) {

                    setELUserSummary(data.departments)
                }
            } catch (err) {
                console.error("Error fetching department list:", err);
            }
        };

        dashboard();
    }, [filterStatus, dateRange, selectedUser, efficiencyFilter, filters])


    const handleDownload = async () => {
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
    };
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
                    <h1 className={title({ size: "20px" })}>
                        Query Report
                    </h1>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Analyze and filter performance data across departments and users.
                    </p>
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
                    </div>
                    {
                        user.userRole !== 2 ? (<Dropdown isOpen={isFilterOpen} onOpenChange={setIsFilterOpen} >
                            <DropdownTrigger>
                                <Button
                                    variant="flat"
                                    size="sm"
                                    color="primary"                     // bigger button
                                    className="px-6 gap-2"        // wider + space between icon & text
                                    startContent={<FilterIcon className="w-5 h-5" />} // filter svg
                                    onPress={() => setIsFilterOpen(true)}
                                >
                                    Filter
                                </Button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="Static Actions" closeOnSelect={false} >


                                <DropdownItem key="edit" className="!bg-transparent hover:!bg-transparent">

                                    <Autocomplete
                                        aria-label="filter by Department"
                                        placeholder="Filter by Department"
                                        className="max-w-xs"
                                        selectedKey={filterStatus}
                                        onSelectionChange={(key) => {
                                            const dep = key as string;
                                            setFilterStatus(dep);
                                            setUserSearch("");
                                            setEfficiencyFilter("")
                                            setSelectedUser(""); // reset user dropdown when department changes
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

                                <DropdownItem
                                    key="user-autocomplete"
                                    className="!bg-transparent hover:!bg-transparent"
                                >
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
                                                const found = users.find(
                                                    (u) => String(u.userID) === String(key)
                                                );

                                                if (found) {
                                                    setSelectedUser(String(key));
                                                    setUserSearch(found.userName);
                                                }
                                            }
                                        }}
                                    >
                                        {filteredUsers.sort((a, b) => a.userName.localeCompare(b.userName)).map((u) => (
                                            <AutocompleteItem
                                                key={String(u.userID)}
                                                textValue={u.userName}
                                            >
                                                {u.userName}
                                            </AutocompleteItem>
                                        ))}
                                    </Autocomplete>
                                </DropdownItem>


                                <DropdownItem key="user-filter" className="!bg-transparent hover:!bg-transparent">
                                    <div className="space-y-3">
                                        {filters.map((filter, index) => (
                                            <div key={index} className="grid grid-cols-12 gap-2">

                                                {/* Field */}
                                                <Select
                                                    className="col-span-4"
                                                    selectedKeys={filter.field ? [filter.field] : []}
                                                    onSelectionChange={(keys) => {
                                                        const field = Array.from(keys)[0] as string;

                                                        const updated = [...filters];
                                                        updated[index].field = field;

                                                        // reset operator when field changes
                                                        updated[index].operator = "=";

                                                        setFilters(updated);
                                                    }}
                                                >
                                                    {filterFields.map((field) => (
                                                        <SelectItem key={field}>
                                                            {field}
                                                        </SelectItem>
                                                    ))}
                                                </Select>

                                                {/* Operator */}
                                                <Select
                                                    className="col-span-3"
                                                    selectedKeys={[filter.operator]}
                                                    onSelectionChange={(keys) => {
                                                        const operator = Array.from(keys)[0] as string;

                                                        const updated = [...filters];
                                                        updated[index].operator = operator;
                                                        setFilters(updated);
                                                    }}
                                                >
                                                    {(filter.field === "Target Achieved" ||
                                                        filter.field === "Goal Achieved" ||
                                                        filter.field === "Utilization")
                                                        ? numericOperators.map((op) => (
                                                            <SelectItem key={op}>
                                                                {op}
                                                            </SelectItem>
                                                        ))
                                                        : textOperators.map((op) => (
                                                            <SelectItem key={op}>
                                                                {op}
                                                            </SelectItem>
                                                        ))}
                                                </Select>

                                                {/* Value */}
                                                <Input
                                                    className="col-span-4"
                                                    value={filter.value}
                                                    placeholder="Enter value"
                                                    onValueChange={(value) => {
                                                        const updated = [...filters];
                                                        updated[index].value = value;
                                                        setFilters(updated);
                                                    }}
                                                />

                                                {/* Remove */}
                                                <Button
                                                    isIconOnly
                                                    color="danger"
                                                    variant="flat"
                                                    className="col-span-1"
                                                    onPress={() => {
                                                        setFilters(filters.filter((_, i) => i !== index));
                                                    }}
                                                >
                                                    ×
                                                </Button>
                                            </div>
                                        ))}

                                        {/* Add Filter */}
                                        <Button
                                            size="sm"
                                            color="primary"
                                            variant="flat"
                                            onPress={() =>
                                                setFilters([
                                                    ...filters,
                                                    {
                                                        field: "",
                                                        operator: "=",
                                                        value: "",
                                                    },
                                                ])
                                            }
                                        >
                                            + Add Filter
                                        </Button>
                                    </div>
                                </DropdownItem>




                                <DropdownItem key="close-btn" textValue="Close" className="!bg-transparent hover:!bg-transparent">
                                    <div className="flex justify-end">
                                        <Button color="danger" size="sm" onPress={() => setIsFilterOpen(false)}>
                                            Close
                                        </Button>
                                    </div>
                                </DropdownItem>

                            </DropdownMenu>
                        </Dropdown>) : null
                    }

                    {/* <Button size="lg" color="primary" className="mr-4">Download</Button> */}
                </div>
            </div>



            {/* Reports Table */}
            {
                user.userRole !== 3 && (
                    <>
                        {loading ? (
                            <div className="flex items-center justify-center py-10 h-[100vh]">
                                <Spinner />
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden p-6">
                                <EfficiencyTable data={dashboard} type="user" />
                            </div>
                        )}
                    </>
                )
            }
            {user.isHeExecutiveLeader && (
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
            )}


        </div>
    );
}