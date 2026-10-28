import { PageTitle } from "@/components/page";
import { useEffect, useState } from "react";
import { Select, SelectItem } from "@/components/ui";
import { DateRangePicker, Autocomplete, addToast, Spinner,  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell, Chip,AutocompleteItem, Dropdown, DropdownTrigger, Button, DropdownMenu, Card, CardBody, CardHeader, Tabs, Tab, DropdownItem, } from "@/components/ui";
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

export default function History() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [dateSelect, setDateSelect] = useState(7)
const [isModalOpen, setIsModalOpen] = useState(false);
const [selectedDept, setSelectedDept] = useState<any>(null);
const [targets, setTargets] = useState([]);
const [goals, setGoals] = useState([]);
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

        const endDate = today.toISOString().split("T")[0];

        const start = new Date();
        start.setDate(start.getDate() - 7);

        const startDate = start.toISOString().split("T")[0];

        return { startDate, endDate };
    });
    useEffect(() => {
        if (selectedUser) {
            setDateRange({
                startDate: "",
                endDate: "",
            });
        } else {
            const today = new Date();

            const endDate = today.toISOString().split("T")[0];

            const start = new Date();
            start.setDate(start.getDate() - 7);

            const startDate = start.toISOString().split("T")[0];

            setDateRange({
                startDate,
                endDate,
            });
        }
    }, [selectedUser]);
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
                    <span className="text-sm font-medium text-brand-600 dark:text-brand-400">
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
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-brand-100 text-brand-800">
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

    const handleViewDetails = async (dept: any) => {
    try {
        setSelectedDept(dept);

        const bodyData = {
            departmentId: dept.DepartmentID,
        };

        const targetRes = await axios.post(
            "/t2.0/authentificationUtilization/departmentTargets/getTargetsByDepartment",
            bodyData,
            { headers: { "Content-Type": "application/json" } }
        );

        setTargets(targetRes.data?.result || []);

        const goalRes = await axios.post(
            "/t2.0/authentificationUtilization/departmentGoals/getGoalsByDepartment",
            bodyData,
            { headers: { "Content-Type": "application/json" } }
        );

        setGoals(goalRes.data?.result || []);

        setIsModalOpen(true);
    } catch (err) {
        console.error(err);
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
                    history:true,
                    isHeExecutiveLeader: user.isHeExecutiveLeader || false,
                    efficiencyLevel: efficiencyFilter

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
                const keys= Object.keys(summarydata)

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
                    const AvgGoalPercent =  Number(summarydata[String(dept.DepartmentID)] || 0);
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
    }, [filterStatus, dateRange, selectedUser, efficiencyFilter])


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
            <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <PageTitle title="User Performance History" subtitle="Review historical performance, productivity, utilization, and target achievement trends." />

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

                        {/* <Dropdown placement="bottom-start">
                            <DropdownTrigger>
                                <Button
                                    variant="flat"
                                    size="sm"
                                    className="w-[260px] justify-between border border-ink-300 bg-white dark:border-white/15 dark:bg-ink-900"
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
                        </Dropdown> */}
                    </div>
                    {
                        user.userRole !== 2 ? (<Dropdown isOpen={isFilterOpen} onOpenChange={setIsFilterOpen} style={{ width: "400px" }}>
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


                                {/* <DropdownItem key="edit" className="!bg-transparent hover:!bg-transparent">

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
                                        {departmentList
                                            .filter((ele) => ele.status === "Active")
                                            .map((ele) => (
                                                <AutocompleteItem key={ele.key} value={ele.name}>
                                                    {ele.name.replace(/([A-Z])/g, " $1").trim()}
                                                </AutocompleteItem>
                                            ))}
                                    </Autocomplete>



                                </DropdownItem> */}




                                <DropdownItem key="user-filter" className="!bg-transparent hover:!bg-transparent">
                                    <Autocomplete
                                        aria-label="filter by User"
                                        placeholder="Filter by User"
                                        className="max-w-xs"
                                        selectedKey={selectedUser}
                                        inputValue={userSearch}
                                        onInputChange={(value) => {
                                            const dep = value as string;
                                            setUserSearch(dep);
                                            setEfficiencyFilter("")
                                            if (!dep) setSelectedUser("");
                                        }}
                                        onSelectionChange={(key) => {
                                            if (key) {
                                                const found = users.find((u) => String(u.userID) === String(key));
                                                if (found) {
                                                    setSelectedUser(String(key));
                                                    setUserSearch(found.userName); // show name in input after selection
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

                                {/* <DropdownItem key="edit" className="!bg-transparent hover:!bg-transparent">
                                    <Autocomplete
                                        aria-label="filter by Efficiency"
                                        placeholder="Filter by Efficiency"
                                        className="max-w-xs"
                                        selectedKey={efficiencyFilter}
                                        onSelectionChange={(value) => {
                                            setEfficiencyFilter(value);
                                        }}
                                    >
                                        {efficiencyLevels.map((ele) => (
                                            <AutocompleteItem key={ele}>
                                                {ele}
                                            </AutocompleteItem>
                                        ))}
                                    </Autocomplete>
                                </DropdownItem> */}



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

            {average?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
                    {average.map((dept: any) => (
                        <Card
                            key={dept.DepartmentID}
                            className="border border-default-200 shadow-sm"
                        >
                            <CardBody className="p-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-semibold text-base">
                                            {dept.DepartmentName}
                                        </h3>
                                        <span
                                            className={`px-2 py-1 rounded-full text-xs font-medium
        ${dept.EfficiencyLevel === "High"
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : dept.EfficiencyLevel === "At Par"
                                                        ? "bg-amber-100 text-amber-700"
                                                        : "bg-rose-100 text-rose-700"
                                                }`}
                                        >
                                            {dept.EfficiencyLevel}
                                        </span>
                                    </div>


                                </div>

                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    <div>
                                        <p className="text-xs text-default-500">Target</p>
                                        <p className="text-lg font-bold text-brand-500">
                                            {dept.AvgTargetPercent}%
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-default-500">Utilization</p>
                                        <p className="text-lg font-bold text-emerald-500">
                                            {dept.AvgUtilizationPercent}%
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-default-500">Goal</p>
                                        <p className="text-lg font-bold text-brand-500">
                                            {dept.AvgGoalPercent}%
                                        </p>
                                    </div>
                                </div>

                                <div className=" pt-3 flex justify-between text-sm align-bottom text-brand-600 cursor-pointer">
                                    <div>
                                        <p className="text-xs text-default-500">Period</p>
                                        <p className="font-medium">
                                            {dept.Data?.length
                                                ? `${new Date(
                                                    dept.Data[0].WorkDate
                                                ).toLocaleDateString()} - ${new Date(
                                                    dept.Data[dept.Data.length - 1].WorkDate
                                                ).toLocaleDateString()}`
                                                : "N/A"}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                       <p
    className="cursor-pointer text-brand-600"
    onClick={() => handleViewDetails(dept)}
>
    View Details
</p>
                                    </div>

  
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            {/* Reports Table */}
            {
                user.userRole !== 3 && (
                    <>
                        {loading ? (
                            <div className="flex items-center justify-center py-10 h-[100vh]">
                                <Spinner />
                            </div>
                        ) : (
                            <div className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900 overflow-hidden p-6">
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

<Modal
    isOpen={isModalOpen}
    onOpenChange={setIsModalOpen}
    size="5xl"
    scrollBehavior="inside"
>
    <ModalContent>
        <ModalHeader >
            <div>
                <h2 className="text-xl font-bold">
                    {selectedDept?.DepartmentName}
                </h2>
                <p className="text-sm text-default-500">
                    Department Targets & Goals
                </p>
            </div>
        </ModalHeader>

        <ModalBody className="py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Targets */}
                <Card shadow="sm">
                    <CardHeader className="pb-0">
                        <div>
                            <h3 className="text-lg font-semibold">
                                🎯 Targets
                            </h3>
                            <p className="text-xs text-default-500">
                                Department target metrics
                            </p>
                        </div>
                    </CardHeader>

                    <CardBody>
                        <div className="space-y-3">
                            {targets?.length > 0 ? (
                                targets.map((t: any) => (
                                    <div
                                        key={t.targetID}
                                        className="flex justify-between items-center p-3 rounded-lg  bg-default-50"
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {t.targetName}
                                            </p>
                                        </div>

                                        <Chip
                                            color="warning"
                                            variant="flat"
                                        >
                                            {t.unit}
                                        </Chip>
                                    </div>
                                ))
                            ) : (
                                <p className="text-default-500 text-sm">
                                    No targets found
                                </p>
                            )}
                        </div>
                    </CardBody>
                </Card>

                {/* Goals */}
                <Card shadow="sm">
                    <CardHeader className="pb-0">
                        <div>
                            <h3 className="text-lg font-semibold">
                                🚀 Goals
                            </h3>
                            <p className="text-xs text-default-500">
                                Department goal definitions
                            </p>
                        </div>
                    </CardHeader>

                    <CardBody>
                        <div className="space-y-3">
                            {goals?.length > 0 ? (
                                goals.map((g: any) => (
                                    <div
                                        key={g.goalID}
                                        className="p-3 rounded-lg  bg-default-50"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-medium">
                                                    {g.goalName}
                                                </p>

                                                <div className="flex gap-2 mt-2">
                                                    <Chip
                                                        size="sm"
                                                        color="primary"
                                                        variant="flat"
                                                    >
                                                        {g.frequency}
                                                    </Chip>

                                                    <Chip
                                                        size="sm"
                                                        color="secondary"
                                                        variant="flat"
                                                    >
                                                        {g.unit}
                                                    </Chip>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-default-500 text-sm">
                                    No goals found
                                </p>
                            )}
                        </div>
                    </CardBody>
                </Card>
            </div>
        </ModalBody>
    </ModalContent>
</Modal>
        </div>
    );
}


// const fallbackRes = await axios.post(
//                         `/t2.0/authentificationUtilization/departmentTargets/getTargetsByDepartment`,
//                         { departmentId: DeptId },
//                         { headers: { "Content-Type": "application/json" } }
//                     );

//                     if (fallbackRes.data?.result?.length > 0) {
                        
//                         setTarget(fallbackRes.data.result);
//                     } else {
//                         setTarget([]);
//                     }
//                 }

//                 const result = await axios.post(
//                                     "/t2.0/authentificationUtilization/departmentGoals/getGoalsByDepartment",
//                                     bodyData,
//                                     { headers: { "Content-Type": "application/json" } }
//                                 );
                
//                                 if (result) {
//                                     const goalList = result.data.result;
//                                     console.log("Fetched goals:", goalList);
//                                     setGoals(
//                                         goalList.map((g: any) => ({
//                                             goalID: String(g.goalID),
//                                             goalName: g.goalName,
//                                             unit: g.unit,
//                                             frequency: g.frequency,
//                                             achievedUnit: "",
//                                         }))
//                                     );
                
//                                 } else {
//                                     setGoals([]);
//                                 }
