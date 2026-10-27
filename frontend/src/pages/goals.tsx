import React, { useEffect, useState } from "react";
import {
    DateRangePicker,
    Autocomplete,
    AutocompleteItem,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    Button,
} from "@/components/ui";
import { today, getLocalTimeZone } from "@internationalized/date";
import axios from "axios";

import { title } from "@/components/primitives";
import ReusableTable, { TableColumn } from "@/components/table";

import { useMemo } from "react";
import CustomDateRangePicker from "../components/CustomDateRangePicker"
import { format } from "date-fns";

interface GoalLog {
    userGoalDataID: number;
    workDate: string;

    userID: number;
    userName: string;

    departmentID: number;

    goalID: number;
    goalName: string;

    fixedGoal: number;
    achievedGoal: number;

    goalEfficiencyPercent: number;
    recalculatedTarget: number | null;
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
/* ================= COMPONENT ================= */

export default function Goals() {
    const authUserLD = localStorage.getItem("authUserLD");
    const user = authUserLD ? JSON.parse(authUserLD) : null;

    /* ================= STATE ================= */
    const [isTarget, setIsTarget] = useState<true | false | null>(null);
    const [taskIDFilter, setTaskIDFilter] = useState(0)
    const [averageGoalAchieved, setaverageGoalAchieved] = useState(0);
    const [reportData, setReportData] = useState<GoalLog[]>([]);
    const [pageNumber, setPageNumber] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(false);
    const [departmentList, setDepartmentList] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [ELList, setELList] = useState<any[]>([]);

    const [filterStatus, setFilterStatus] = useState(
        user?.departmentID ? String(user.departmentID) : ""
    );

    const [selectedUser, setSelectedUser] = useState(
        user?.userID ? user.userID == 1 ? null : String(user.userID) : ""
    );

    const [elFilter, setELfilter] = useState(
        user?.isHeExecutiveLeader ? Number(user.userID) : 0
    );

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    const [dateSelect, setDateSelect] = useState("7");
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 7);
        return {
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
        };
    });
    const showRecalculatedTarget = Number(user?.departmentID) === 21;

    /* ================= DATE ================= */

    const selectRange = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);

        setDateRange({
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
        });
    };

    const handleDateSelect = (key: string) => {
        setDateSelect(key);
        if (key === "7") selectRange(7);
        if (key === "30") selectRange(30);
    };

    /* ================= TABLE COLUMNS ================= */

    const reportColumns: TableColumn[] = [
        {
            key: "userGoalDataID",
            label: "userGoalDataID",

        },

        ...(Number(filterStatus) !== 7
            ? [
                {
                    key: "userID",
                    label: "User ID",
                    sortable: true,
                },
            ]
            : []),

        {
            key: "workDate",
            label: "Work Date",
            sortable: true,
            renderCell: (item) =>
                item.workDate
                    ? format(new Date(item.workDate), "dd MMM yyyy")
                    : "—",
        },

        { key: "userName", label: "User Name", sortable: true },

        { key: "goalName", label: "Goal Name", sortable: true },

        {
            key: "fixedGoal",
            label: "Goals",
            sortable: true,
            renderCell: (item) => {
                if (item.departmentID === 21) {
                    return (
                        <span className="font-medium">
                            {item.fixedGoal ?? "—"}
                        </span>
                    );
                }

                if (item.departmentID === 37) {
                    return (
                        <span className="font-medium">
                            {/* {item.goalEfficiencyPercent ?? "—"} */}
                            {item.fixedGoal ?? "—"}

                        </span>
                    );
                }
                return (
                    <span className="font-medium">
                        {item.fixedGoal}
                    </span>
                );
            },
        },


        {
            key: "achievedGoal",
            label: "Achieved",
            sortable: true,
            renderCell: (item) =>
                item.achievedGoal === 0 ? (
                    <span className="text-red-500 font-medium">0</span>
                ) : (

                    <span className="font-medium">{item.achievedGoal}</span>
                ),
        },
        {
            key: "comments",
            label: "Comments",
            sortable: true,
            renderCell: (item) => (
                <span className="font-medium">{item.comment || "—"}</span>
            )
        }

        // {
        //     key: "goalEfficiencyPercent",
        //     label: "Goal Percentage",
        //     sortable: true,
        //     renderCell: (item) => {
        //         const value = Number(item.goalEfficiencyPercent || 0);

        //         const color =
        //             value >= 85
        //                 ? "bg-green-100 text-green-700"
        //                 : value >= 60
        //                     ? "bg-yellow-100 text-yellow-700"
        //                     : "bg-red-100 text-red-700";
        //         if (item.departmentID === 37) {
        //             return (
        //                 <span className="font-medium">
        //                     {item.goalEfficiencyPercent == 0 ? 0 : (item.achievedGoal / item.goalEfficiencyPercent * 100).toFixed(2)}
        //                 </span>
        //             );
        //         }


        //         return (
        //             <span
        //                 className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}
        //             >
        //                 {value.toFixed(2)}%
        //             </span>
        //         );
        //     },
        // },


    ];




    /* ================= FETCH GOALS ================= */
    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const bodyData = {
                    searchText: "",
                    filter: "",
                    startDate: "",
                    endDate: "",
                    roleID: 3,
                    userID: user?.isHeExecutiveLeader
                        ? Number(user.userID)
                        : Number(elFilter),
                };

                const res = await axios.post(
                    "/t2.0/authentificationUtilization/Department/list?page=0&size=",
                    bodyData,
                    {
                        headers: {
                            Authorization: `Bearer ${user?.token}`,
                            "Content-Type": "application/json",
                        },
                    }
                );

                const formatted =
                    res.data.response.departments?.map((dept: any) => ({
                        key: dept.departmentID,
                        name: dept.departmentName,
                        status: dept.newStatus,
                        executiveLeaderID: dept.executiveLeaderID,
                        functionalLeaderID: dept.functionalLeaderID
                    })) || [];

                setDepartmentList(formatted);
            } catch (err) {
                console.error(err);
            }
        };

        fetchDepartments();
    }, [elFilter]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const body = {
                    filter: "",
                    searchText: "",
                    departmentID: filterStatus ? Number(filterStatus) : 0,
                    ...(filterStatus ? {} : null)  // only add roleID if no department
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

                const formatted: User[] = usersData.map((u: any) => ({
                    userID: u.userID,
                    userName: u.userName,
                    roleID: u.roleID,
                }));

                filterStatus ? setUsers(formatted) : setELList(formatted);
                setUsers(formatted)
            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };

        fetchUsers();

    }, [filterStatus]);

    // useEffect(() => {
    //     const fetchGoals = async () => {
    //         try {
    //             setLoading(true);

    //             // const body = {
    //             //     departmentID: user?.departmentID ?? null,
    //             //     userID: user?.userID,
    //             //     startDate: dateRange.startDate,
    //             //     endDate: dateRange.endDate,
    //             //     roleID: user?.userRole,
    //             //     isHeExecutiveLeader: user?.isHeExecutiveLeader,
    //             // };
    //             const body = {
    //                 departmentID: filterStatus ? Number(filterStatus) : null,
    //                 userID:
    //                     filterStatus && selectedUser
    //                         ? Number(selectedUser)
    //                         : user?.userID,

    //                 startDate: dateRange.startDate,
    //                 endDate: dateRange.endDate,

    //                 roleID: user?.userRole,
    //                 eLID: user?.isHeExecutiveLeader
    //                     ? user.userID
    //                     : Number(elFilter),

    //                 isHeExecutiveLeader: user?.isHeExecutiveLeader,

    //                 searchText: searchValue,
    //             };


    //             const res = await axios.post(
    //                 `/t2.0/authentificationUtilization/userGoalData/list?page=${pageNumber}&size=${pageSize}`,
    //                 body,
    //                 {
    //                     headers: {
    //                         Authorization: `Bearer ${user?.token}`,
    //                         "Content-Type": "application/json",
    //                     },
    //                 }
    //             );

    //             const { userGoalDataList, totalRecords } = res.data.response;

    //             const formatted: GoalLog[] = userGoalDataList.map((item: any) => ({
    //                 userGoalDataID: item.userGoalDataID,
    //                 workDate: item.workDate,

    //                 userID: item.userID,
    //                 userName: item.userName,

    //                 departmentID: item.departmentID,

    //                 goalID: item.goalID,
    //                 goalName: item.goalName,

    //                 fixedGoal: Number(item.fixedGoal ?? 0),
    //                 achievedGoal: Number(item.achievedGoal ?? 0),

    //                 goalEfficiencyPercent: Number(item.goalEfficiencyPercent ?? 0),
    //                 recalculatedTarget: item.recalculatedTarget,
    //             }));

    //             setReportData(formatted);
    //             setTotalRecords(totalRecords);
    //         } catch (err) {
    //             console.error("Error fetching goal data:", err);
    //         } finally {
    //             setLoading(false);
    //         }
    //     };

    //     fetchGoals();
    // }, [dateRange, pageNumber, pageSize, filterStatus, selectedUser]);

    useEffect(() => {

        const fetchData = async () => {

            try {

                setLoading(true);

                // if (Number(filterStatus) === 7) {

                //     const bodyData = {
                //         departmentID: filterStatus,
                //         startDate: dateRange.startDate,
                //         endDate: dateRange.endDate,
                //         userID: selectedUser,
                //         groupBy: "day",
                //         isHeExecutiveLeader: user.isHeExecutiveLeader || false,
                //     };

                //     const goalBody = {
                //         departmentID: filterStatus ? Number(filterStatus) : null,
                //         userID:
                //             filterStatus && selectedUser
                //                 ? Number(selectedUser)
                //                 : user?.userID,

                //         startDate: dateRange.startDate,
                //         endDate: dateRange.endDate,

                //         roleID: user?.userRole,
                //         eLID: user?.isHeExecutiveLeader
                //             ? user.userID
                //             : Number(elFilter),

                //         isHeExecutiveLeader: user?.isHeExecutiveLeader,

                //         searchText: searchValue,
                //     };

                //     /* CALL BOTH APIs */
                //     const [effRes, goalRes] = await Promise.all([
                //         axios.post(
                //             "/t2.0/authentificationUtilization/list-efficiency-summary",
                //             bodyData,
                //             {
                //                 headers: {
                //                     "Content-Type": "application/json"
                //                 }
                //             }
                //         ),
                //         axios.post(
                //             `/t2.0/authentificationUtilization/userGoalData/list?page=${pageNumber}&size=${pageSize}`,
                //             goalBody,
                //             {
                //                 headers: {
                //                     Authorization: `Bearer ${user?.token}`,
                //                     "Content-Type": "application/json",
                //                 },
                //             }
                //         )
                //     ]);

                //     const efficiencyData = effRes.data.data || [];
                //     const goalData = goalRes.data.response.userGoalDataList || [];

                //     /* CREATE LOOKUP MAP FROM API1 */
                //     const efficiencyMap = new Map();

                //     efficiencyData.forEach((e: any) => {
                //         const key = `${e.UserID}_${e.WorkDate}`;
                //         efficiencyMap.set(key, e.TargetAchievedPercent);
                //     });
                //     const goalMap = new Map();

                //     goalData.forEach((g: any) => {
                //         const key = `${g.userID}_${g.workDate}`;
                //         goalMap.set(key, g);
                //     });

                //     /* MAP USING GOAL DATA (API2) */
                //     const formatted = efficiencyData.map((item: any, index: number) => {

                //         const key = `${item.UserID}_${item.WorkDate}`;
                //         const goalItem = goalMap.get(key);

                //         const achievedGoal = Number(item.TargetAchievedPercent ?? 0);
                //         const fixedGoal = 100;

                //         return {
                //             userGoalDataID: index + 1,

                //             workDate: item.WorkDate,

                //             userID: item.UserID,
                //             userName: item.UserName,

                //             departmentID: item.DepartmentID,

                //             goalID: goalItem?.goalID ?? 0,
                //             goalName: "TAT",

                //             fixedGoal: fixedGoal,

                //             /* efficiency percent */
                //             achievedGoal: achievedGoal,

                //             goalEfficiencyPercent: (achievedGoal / fixedGoal) * 100,

                //             recalculatedTarget: goalItem?.recalculatedTarget ?? null
                //         };
                //     });
                //     setaverageGoalAchieved(efficiencyData.response.AvgTargetPercent);

                //     setReportData(formatted);
                //     setTotalRecords(formatted.length);


                // }
                const CUTOFF_DATE = "2026-06-30";
                const isWithinCutoff =
                    dateRange.startDate <= CUTOFF_DATE && dateRange.endDate <= CUTOFF_DATE;

                const shouldCallEfficiency =
                    Number(filterStatus) === 7 &&
                    Number(selectedUser) === 90 &&
                    isWithinCutoff;

                if (shouldCallEfficiency) {
                    const bodyData = {
                        departmentID: filterStatus,
                        startDate: dateRange.startDate,
                        endDate: dateRange.endDate,
                        userID: selectedUser,
                        groupBy: "day",
                        isHeExecutiveLeader: user.isHeExecutiveLeader || false,
                    };

                    const effRes = await axios.post(
                        "/t2.0/authentificationUtilization/list-efficiency-summary",
                        bodyData,
                        {
                            headers: {
                                "Content-Type": "application/json",
                            },
                        }
                    );

                    const efficiencyData = effRes.data.data || [];
                    const summary = effRes.data.summary || {};

                    const formatted = efficiencyData.map((item: any, index: number) => {
                        const achievedGoal = Number(item.TargetAchievedPercent ?? 0);
                        const fixedGoal = 100;

                        return {
                            userGoalDataID: index + 1,

                            workDate: item.WorkDate,
                            userID: item.UserID,
                            userName: item.UserName,

                            departmentID: item.DepartmentID,

                            goalID: 0,
                            goalName: "TAT",

                            fixedGoal: fixedGoal,

                            achievedGoal: achievedGoal,

                            goalEfficiencyPercent: (achievedGoal / fixedGoal) * 100,

                            recalculatedTarget: null,
                        };
                    });

                    // ✅ Use summary directly
                    setaverageGoalAchieved(summary.AvgTargetPercent || 0);

                    setReportData(formatted);
                    setTotalRecords(formatted.length);
                }
                else {

                    const body = {
                        departmentID: filterStatus ? Number(filterStatus) : null,
                        userID:
                            selectedUser
                                ? Number(selectedUser)
                                : user?.userID == 1 ? null : user?.userID,

                        startDate: dateRange.startDate,
                        endDate: dateRange.endDate,
                        goalStartDate: dateRange.startDate,
                        goalEndDate: dateRange.endDate,

                        roleID: user?.userRole,
                        eLID: user?.isHeExecutiveLeader
                            ? user.userID
                            : Number(elFilter),

                        isHeExecutiveLeader: user?.isHeExecutiveLeader,
                        searchText: searchValue,
                    };

                    const res = await axios.post(
                        `/t2.0/authentificationUtilization/userGoalData/list?page=${pageNumber}&size=${pageSize}`,
                        body,
                        {
                            headers: {
                                Authorization: `Bearer ${user?.token}`,
                                "Content-Type": "application/json",
                            },
                        }
                    );

                    const { userGoalDataList, totalRecords } = res.data.response;

                    const formatted = userGoalDataList.map((item: any) => ({
                        userGoalDataID: item.userGoalDataID,
                        workDate: item.workDate,
                        userID: item.userID,
                        userName: item.userName,
                        departmentID: item.departmentID,
                        goalID: item.goalID,
                        goalName: item.goalName,
                        fixedGoal: Number(item.fixedGoal ?? 0),
                        achievedGoal: Number(item.achievedGoal ?? 0),
                        goalEfficiencyPercent: Number(item.goalEfficiencyPercent ?? 0),
                        recalculatedTarget: item.recalculatedTarget,
                        comment: item.comment || "",

                    }));

                    setReportData(formatted);
                    setTotalRecords(totalRecords);
                    setaverageGoalAchieved(res.data.response.avgPercent);

                }

            } catch (err) {
                console.error("Error fetching data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

    }, [filterStatus, dateRange, selectedUser, pageNumber, pageSize, elFilter]);




    return (
        <div>
            <div className="mb-8 flex justify-between">
                <div>
                    <h1 className={title({ size: "20px" })}>
                        Goals Report
                    </h1>

                    <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
                        Track goal progress and performance over time
                    </p>

                </div>

                <div className="flex gap-3 items-center">
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
                    {
                        user.userRole !== 2 &&
                            user.userRole !== 5 &&
                            user.userRole !== 6 &&
                            user.userRole !== 7 &&
                            user.userRole !== 23 ? (<Dropdown isOpen={isFilterOpen} onOpenChange={setIsFilterOpen} style={{ width: "400px" }}>
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
                                    {/* <DropdownItem key="new" className="!bg-transparent hover:!bg-transparent">
                                        <Autocomplete
                                            aria-label="Type"
                                            placeholder="Type"
                                            className="max-w-xs"
                                            selectedKey={
                                                isTarget === null      // value controlled by null
                                                    ? "ALL"            // UI text shown as ALL
                                                    : isTarget
                                                        ? "TARGET"
                                                        : "TASK"
                                            }
                                            defaultSelectedKey="ALL"
                                            onSelectionChange={(key) => {
                                                if (key === "ALL") return setIsTarget(null);     // ← All becomes null
                                                setIsTarget(key === "TARGET");
                                            }}
                                        >
                                            <AutocompleteItem key="ALL" value="null">All</AutocompleteItem>
                                            <AutocompleteItem key="TARGET" value="true">Target</AutocompleteItem>
                                            <AutocompleteItem key="TASK" value="false">Task</AutocompleteItem>
                                        </Autocomplete>

                                    </DropdownItem> */}
                                    {user.userRole !== 2 && user.userRole !== 3
                                        &&
                                        (<DropdownItem key="edi1t" className="!bg-transparent hover:!bg-transparent">
                                            <Autocomplete
                                                aria-label="EL select"
                                                placeholder="Select EL"
                                                className="max-w-xs"
                                                onSelectionChange={(key) => setELfilter(key)}   // key = roleID/userID
                                            >
                                                {ELList.sort((a, b) => a.userName.localeCompare(b.userName)).
                                                    filter((u) => {
                                                        if (user.userRole === 4) {
                                                            return u.userID === user.reportingManagerID;
                                                        }

                                                        return u.roleID === 3;
                                                    })
                                                    .map(user => (
                                                        <AutocompleteItem key={user.userID} value={user.roleID}>
                                                            {user.userName.replace(/([A-Z])/g, " $1").trim()}
                                                        </AutocompleteItem>
                                                    ))
                                                }
                                            </Autocomplete>
                                        </DropdownItem>)}
                                    <DropdownItem key="copy" className="!bg-transparent hover:!bg-transparent"> {
                                        user.departmentID ? null : (
                                            <Autocomplete
                                                aria-label="filter by sub department"
                                                placeholder="filter by sub department"
                                                className="max-w-xs"
                                                selectedKey={filterStatus}
                                                onSelectionChange={(key) => {
                                                    const dep = key as string;
                                                    setFilterStatus(dep);
                                                    setSelectedUser(""); // reset user dropdown when department changes
                                                }}
                                            >
                                                {departmentList
                                                    .sort((a, b) => a.name.localeCompare(b.name)).filter((ele) => {
                                                        if (user.userRole == 4 && ele.status === "Active") {
                                                            return ele.functionalLeaderID == user.userID
                                                        }
                                                        else {
                                                            return ele.status === "Active"
                                                        }
                                                    })
                                                    .map((ele) => (
                                                        <AutocompleteItem key={ele.key} value={ele.name}>
                                                            {ele.name.replace(/([A-Z])/g, " $1").trim()}
                                                        </AutocompleteItem>
                                                    ))}
                                            </Autocomplete>
                                        )
                                    }</DropdownItem>

                                    {/* <DropdownItem key="edit" className="!bg-transparent hover:!bg-transparent">
                                    <Autocomplete
                                        aria-label="Task/Target"
                                        placeholder="Task / Target"
                                        className="max-w-xs"
                                        isDisabled={!filterStatus}
                                        selectedKey={taskIDFilter}
                                        onSelectionChange={(key) => setTaskIDFilter(key)}   // returns single ID (taskID or targetID)
                                    >
                                        {taskTargetList.map((item) => (
                                            <AutocompleteItem key={item.id} value={item.id}>
                                                {item.name.replace(/([A-Z])/g, " $1").trim()}

                                            </AutocompleteItem>
                                        ))}
                                    </Autocomplete>
                                </DropdownItem> */}




                                    <DropdownItem key="delete" className="text-danger !bg-transparent hover:!bg-transparent">

                                        <Autocomplete
                                            aria-label="filter by User"
                                            placeholder="Filter by User"
                                            className="max-w-xs"
                                            selectedKey={selectedUser}
                                            onSelectionChange={(key) => setSelectedUser(key as string)}
                                        >
                                            {users.sort((a, b) => a.userName.localeCompare(b.userName)).map((ele: User) => (
                                                <AutocompleteItem key={String(ele.userID)} value={ele.userName}>
                                                    {ele.userName}
                                                </AutocompleteItem>
                                            ))}
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
                            </Dropdown>) : null
                    }
                </div>
            </div>
            <div
                className="flex flex-col gap-4 p-4 bg-white dark:bg-ink-900 rounded-xl  my-2 border border-ink-100 dark:border-white/10"

            >
                {/* Card Title */}
                <h2 className="text-base font-semibold text-ink-700 dark:text-ink-200 tracking-wide">
                    Summary
                </h2>
                <div className="flex">
                    {/* Avg Total Hours */}
                    <div className="flex items-center justify-between rounded-lg p-2">
                        <span className="text-sm text-ink-600 dark:text-ink-300 font-medium">
                            Average Goal Achieved
                        </span>

                        <span className="px-3 py-1 mx-2 text-sm font-semibold text-green-700 bg-green-100 rounded-full">
                            {Number(averageGoalAchieved || 0).toFixed(2)}%
                        </span>
                    </div>


                </div>

            </div>
            <div className="bg-white dark:bg-ink-800 rounded-lg shadow p-6">
                <ReusableTable
                    data={reportData}
                    columns={reportColumns}
                    loading={loading}
                    paginated
                    totalRecords={totalRecords}
                    onPageChange={setPageNumber}
                    onRowsPerPageChange={setPageSize}
                    sortable
                    selectable={false}
                    emptyContent="No goal data found"
                    getRowId={(row) => row.userGoalDataID}
                />

            </div>
        </div>
    );
}
