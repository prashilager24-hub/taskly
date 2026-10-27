import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { parseZonedDateTime, parseAbsoluteToLocal } from "@internationalized/date";
import { Input } from "@/components/ui";
import WeeklyPulse from "./WeeklyPulse";
import { useLocation } from "react-router-dom";
import { Select, SelectItem, addToast, DatePicker, Autocomplete, Modal, ModalHeader, ModalContent, ModalBody, ModalFooter, AutocompleteItem, Switch, Checkbox, DateRangePicker, user, RadioGroup, Radio, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@/components/ui";
import { CalendarDate, parseDate } from "@internationalized/date";
import { today } from "@internationalized/date";
import CustomDatePicker from "../components/customDatePicker"
import { Textarea } from "@/components/ui";
import { Divider } from "@heroui/divider";
import axios from "axios";
import EmptyContainer from "./EmptyContainer";
import { de } from "date-fns/locale";
import ReusableTable, { TableColumn, TableAction } from "@/components/table"
import { Tabs, Tab } from "@/components/ui";
import EfficiencyTable from "@/components/table2";
import { deprecationHandler } from "moment";
interface ActivityEntry {
    id: string;
    task: string;
    taskName: string;
    customTask: string;
    timeType: string;
    customTime: string;
    setup: string;
    workDate: string;
    timeTaken?: string;
    remark?: string;

    // Target-related
    targetName?: string;
    targetID?: string;
    unit?: string | number;
    frequency?: string;
    achievedUnit?: string;

    // Goal-related
    goalID?: string;
    goalName?: string;
    expectedUnit?: string;
    isGoal?: boolean;

    // Metadata for conditional rendering
    isDynamic?: boolean;
    isForTarget?: boolean;

    // Department-specific
    miscallenous?: string;
    NoOfPlayer?: string;
    dailyTaskLogID?: string;
    userGoalDataID?: string;
    remarks?: string;
}





interface PREntry {
    id: string;
    PRID: string;
    UserID: string;
    DepartmentID: string;
    TaskID: string;
    WorkDate: string;
    ReceivedTDate: string;
    DueDate: string;
    CompletionDate: string;
    AllocatedHours: string;
    TimeTaken: string;
    TATPercent: string;
    Remarks: string;
}
interface User {
    userID: number;
    userName: string;
    roleID: number;
}
interface TableColumn {
    key: string;
    label: string;
    sortable?: boolean;
    width?: string;
    renderCell?: (item: any) => React.ReactNode;
}


interface GoalEntry {
    goalID: string;
    goalName: string;
    unit: string;
    expectedUnit: string;
    achievedUnit: string;
    frequency: string;
}

type EntryStep = "TASK" | "TARGET" | "GOAL";

const setupOptions = [
    { key: "1", label: "1" },
    { key: "2", label: "2" },
    { key: "3", label: "3" },
    { key: "4", label: "4" },
    { key: "5", label: "5" },
    { key: "6", label: "6" },
    { key: "7", label: "7" },
    { key: "8", label: "8" },
    { key: "9", label: "9" },
    { key: "10", label: "10" },

];
const SwitchIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
    >
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0020.49 15" />
    </svg>
);


const parseWorkDate = (dateString: string): CalendarDate | null => {
    try {
        const [year, month, day] = dateString.split('-').map(Number);

        // Validate parsed values
        if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
            console.error("Invalid date values:", { year, month, day });
            return null;
        }

        return new CalendarDate(year, month, day);
    } catch (error) {
        console.error("Error parsing work date:", error);
        return null;
    }
};
export default function UpdateForm({ task, DeptId, taskOptions = [], onSuccess }) {


    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [goalEntry, setGoalEntry] = useState<GoalEntry>({
        goalID: "",
        goalName: "",
        unit: "",
        expectedUnit: "",
        achievedUnit: "",
        frequency: "",
    });
    const [goals, setGoals] = useState<GoalEntry[]>([]);
    const [open, setOpen] = useState(false);

    const formatDatetime = (d: CalendarDate) =>
        `${String(d.day).padStart(2, "0")}-${String(d.month).padStart(2, "0")}-${d.year}`;

    const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
    const [isTAModalOpen, setIsTAModalOpen] = useState(false);
    const [selectedtask, setSelectedTask] = useState({})
    const [targetEntry, setTargetEntry] = useState(true);
    const [showMessage, setShowMessage] = useState(false);
    const [entryStep, setEntryStep] = useState<EntryStep>("TASK");
    const [activities, setActivities] = useState<ActivityEntry[]>([]);
    const [errors, setErrors] = useState({
        user: "",
        publisher: "",
        duration: "",
        schedule: ""
    });
    const [showDateConfirm, setShowDateConfirm] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState("");
    const [confirmTitle, setConfirmTitle] = useState("");
    const confirmResolveRef = useRef<(value: boolean) => void>();


    const [salesUser, setSalesUser] = useState<User[]>([]);
    const [selectedSalesPerson, setSelectedSalesPerson] = useState("")
    const [publisher, setPublisher] = useState("")
    const [scheduleType, setScheduleType] = useState("")
    const today = new Date();
    const iso = `${today.getFullYear()}-` +
        `${String(today.getMonth() + 1).padStart(2, "0")}-` +
        `${String(today.getDate()).padStart(2, "0")}T` +
        `${String(today.getHours()).padStart(2, "0")}:` +
        `${String(today.getMinutes()).padStart(2, "0")}[UTC]`;
    const [duration, setDuration] = useState(parseZonedDateTime(iso));
    const [isHalf, setIsHalf] = useState(false)
    const [tat, setTat] = useState(false)
    const [targetAchieved, setTargetAchieved] = useState(false)
    const [isshow, setIsShow] = useState(false)
    const [target, setTarget] = useState<Task[]>([

    ]);
    const Maxtoday = convertToCalendarDate(new Date());
    const [workDate, setWorkDate] = useState(
        new CalendarDate(today.getFullYear(), today.getMonth() + 1, today.getDate())
    );
    const [leaveType, setLeaveType] = useState<"NONE" | "HALF_DAY" | "FULL_DAY">("NONE");

    const [prEntries, setPREntries] = useState<PREntry[]>([]);
    const [currentActivity, setCurrentActivity] = useState<ActivityEntry>({
        id: "",
        task: "",
        taskName: "",
        customTask: "",
        timeType: "",
        customTime: "0",
        timeTaken: "",
        NoOfPlayer: "",
        remark: "",
        setup: "1",
        targetName: "",
        miscallenous: "",
        targetID: "",
        unit: "",
        frequency: "",
        achievedUnit: "",
    });
    const [jobId, setJobId] = useState([])
    const [totalPages, setTotalPages] = useState(0)
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [pageNumberJd, setPageNumberJd] = useState(1)
    const [pageSizeJd, setPageSizeJd] = useState(10)
    const [searchValue, setSearchValue] = useState("")

    const [selectedRows, setSelectedRows] = useState<Task[]>([]);

    const [pageNumberCall, setPageNumberCall] = useState(1)

    const [totalRecordsJd, settotalRecordsJd] = useState(0)
    const [jobData, setJobData] = useState([]);
    const [isEditingJD, setIsEditingJD] = useState(false);
    const [currentPR, setCurrentPR] = useState<PREntry>({
        id: "",
        PRID: "",
        UserID: "",
        DepartmentID: "",
        TaskID: "",
        WorkDate: "",
        ReceivedTDate: "",
        DueDate: "",
        CompletionDate: "",
        AllocatedHours: "",
        TimeTaken: "",
        TATPercent: "",
        Remarks: ""
    });
    const [notes] = useState("");
    const authUserLD = localStorage.getItem("authUserLD");
    const authUser = JSON.parse(authUserLD)
    const [jdForm, setJdForm] = useState({
        positionName: "",
        jdDetails: "",
        status: "OPEN",
        positionID: null,
        userID: authUser.userID,
    });
    const [adminGoal, setAdminGoal] = useState({
        goalID: "",
        goalName: "",
        description: "",
        openDate: "",

    })
    const [admingoalList, setAdminGoalList] = useState([])


    const schedule = [
        { name: "SCHEDULED", value: "SCHEDULED" },
        { name: "COMPLETED", value: "COMPLETED" },
        { name: "NO SHOW", value: "NO_SHOW" },
        { name: "RESCHEDULED", value: "RESCHEDULED" },
        { name: "CANCELLED BY PUBLISHER", value: "CANCELLED_BY_PUBLISHER" },
        { name: "CANCELLED BY INTERNAL", value: "CANCELLED_BY_INTERNAL" }
    ];

    const JDColumns: TableColumn[] = [
        { key: 'positionID', label: 'positionID', sortable: true },
        { key: 'positionName', label: 'positionName', sortable: true },
        { key: 'jdDetails', label: 'jdDetails', sortable: true },
        { key: 'status', label: 'status', sortable: true },
        { key: 'createdAt', label: 'createdAt' },
        {
            key: "Action",
            label: "Action",
            renderCell: (row) => (
                <Button
                    variant="flat"
                    size="sm"
                // onPress={() => openEditJDModal(row)}
                >
                    Edit
                </Button>
            )
        }


    ];
    const formatCalendarDate = (date: CalendarDate) => {
        const y = date.year;
        const m = String(date.month).padStart(2, "0");
        const d = String(date.day).padStart(2, "0");
        return `${d}-${m}-${y}`;
    };
    const formatCalendarDate2 = (date: CalendarDate) => {
        const y = date.year;
        const m = String(date.month).padStart(2, "0");
        const d = String(date.day).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };
    function convertToCalendarDate(date) {
        return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
    }

    const validateForm = () => {
        let valid = true;
        let newErrors = { user: "", publisher: "", duration: "", schedule: "" };

        if (!selectedSalesPerson) {
            newErrors.user = "Please select a user";
            valid = false;
        }

        if (!publisher.trim()) {
            newErrors.publisher = "Publisher name is required";
            valid = false;
        }

        if (!duration) {
            newErrors.duration = "Date range is required";
            valid = false;
        }



        if (!scheduleType) {
            newErrors.schedule = "Please select a schedule type";
            valid = false;
        }

        setErrors(newErrors);
        return valid;
    };
    const handleEditTicket = (ticket) => {
        setSelectedTicket(ticket);
        setIsEditOpen(true);
    };

    // useEffect(() => {

    //     if (task.taskID) {
    //         setEntryStep("TASK");

    //     }
    //     else if (
    //         task.targetID
    //     ) {
    //         setEntryStep("TARGET")

    //     }
    //     else {
    //         setEntryStep("GOAL")
    //     }

    //     if (!task) return;

    //     const matchedTask = taskOptions.find(
    //         (t) =>
    //             String(t.taskID) ===
    //             String(task.taskID)
    //     );

    //     setSelectedTask(matchedTask || {});

    //     if (task.taskID) {
    //         setEntryStep("TASK");


    //     }
    //     else if (
    //         task.targetID
    //     ) {
    //         setEntryStep("TARGET")

    //     }
    //     else {
    //         setEntryStep("GOAL")
    //         setGoalEntry({

    //             goalID:
    //                 String(task.goalID || ""),

    //             goalName:
    //                 task.goalName || "",

    //             unit:
    //                 String(task.fixedGoal || ""),

    //             expectedUnit:
    //                 task.expectedUnit || "",

    //             achievedUnit:
    //                 String(task.achievedGoal || ""),

    //             frequency:
    //                 task.frequency || "",
    //         });
    //     }


    // }, [task]);



    // useEffect(() => {

    //     if (!task) return;

    //     // =========================================
    //     // TASK
    //     // =========================================

    //     if (task.taskID) {

    //         setEntryStep("TASK");

    //         const matchedTask = taskOptions.find(
    //             (t) =>
    //                 String(t.taskID) ===
    //                 String(task.taskID)
    //         );

    //         setSelectedTask(matchedTask || {});

    //         setCurrentActivity({

    //             id:
    //                 task.dailyTaskLogID || "",

    //             dailyTaskLogID:
    //                 task.dailyTaskLogID || "",

    //             task:
    //                 String(task.taskID || ""),

    //             taskName:
    //                 task.taskName || "",

    //             customTask: "",

    //             setup:
    //                 String(task.setUp || "1"),

    //             customTime:
    //                 String(task.allocatedTime || "0"),

    //             timeTaken:
    //                 String(
    //                     task.timeTakenToWork || "0"
    //                 ),

    //             remark:
    //                 task.remarks || "",

    //             targetID: "",

    //             targetName: "",

    //             unit:
    //                 String(task.units || ""),

    //             achievedUnit:
    //                 String(
    //                     task.achievedUnits || ""
    //                 ),

    //             frequency:
    //                 task.frequency || "",

    //             isDynamic:
    //                 matchedTask?.isDynamic || false,

    //             isForTarget:
    //                 false,

    //             miscallenous:
    //                 String(
    //                     task.miscallenous || ""
    //                 ),

    //             NoOfPlayer:
    //                 String(
    //                     task.NoOfPlayer || ""
    //                 ),
    //         });
    //     }

    //     // =========================================
    //     // TARGET
    //     // =========================================

    //     else if (task.targetID) {

    //         setEntryStep("TARGET");

    //         setCurrentActivity({

    //             id:
    //                 task.dailyTaskLogID || "",

    //             dailyTaskLogID:
    //                 task.dailyTaskLogID || "",

    //             task: "",

    //             taskName: "",

    //             customTask: "",

    //             setup:
    //                 String(task.setUp || "1"),

    //             customTime:
    //                 String(task.allocatedTime || "0"),

    //             timeTaken:
    //                 String(
    //                     task.timeTakenToWork || "0"
    //                 ),

    //             remark:
    //                 task.remarks || "",

    //             targetID:
    //                 String(task.targetID || ""),

    //             targetName:
    //                 task.targetName || "",

    //             unit:
    //                 String(task.units || ""),

    //             achievedUnit:
    //                 String(
    //                     task.achievedUnits || ""
    //                 ),

    //             frequency:
    //                 task.frequency || "",

    //             isDynamic: false,

    //             isForTarget: true,

    //             miscallenous:
    //                 String(
    //                     task.miscallenous || ""
    //                 ),

    //             NoOfPlayer:
    //                 String(
    //                     task.NoOfPlayer || ""
    //                 ),
    //         });
    //     }

    //     // =========================================
    //     // GOAL
    //     // =========================================

    //     else if (task.goalID) {

    //         setEntryStep("GOAL");

    //         setGoalEntry({

    //             goalID:
    //                 String(task.goalID || ""),

    //             goalName:
    //                 task.goalName || "",

    //             unit:
    //                 String(task.fixedGoal || ""),

    //             expectedUnit:
    //                 task.expectedUnit || "",

    //             achievedUnit:
    //                 String(task.achievedGoal || ""),

    //             frequency:
    //                 task.frequency || "",
    //         });
    //     }

    // }, [
    //     task,

    // ]);

    useEffect(() => {
        if (!task) return;

        console.log("UPDATE TASK DATA", task);

        if (task.taskID !== null && task.taskID !== undefined) {
            setEntryStep("TASK");

            const matchedTask = taskOptions.find(
                (t) => String(t.taskID) === String(task.taskID)
            );

            console.log("taskOptions", taskOptions);
            console.log("matchedTask", matchedTask);

            setSelectedTask(matchedTask || null);

            setCurrentActivity({
                id: String(task.dailyTaskLogID || ""),
                dailyTaskLogID: String(task.dailyTaskLogID || ""),
                task: String(task.taskID || ""),
                taskName: task.taskName || task.Name || "",
                customTask: "",
                setup: String(task.setUp || "1"),
                customTime: String(task.allocatedTime || "0"),
                // API returns workedTime OR timeTakenToWork — handle both
                timeTaken: String(task.timeTakenToWork || task.workedTime || "0"),
                remark: task.remarks || "",
                targetID: "",
                targetName: "",
                unit: String(task.units || ""),
                achievedUnit: String(task.achievedUnits || ""),
                frequency: task.frequency || "",
                timingType: matchedTask?.timingType || "",
                isDynamic: matchedTask?.isDynamic || false,
                miscallenous: String(task.miscallenous || ""),
                NoOfPlayer: String(task.NoOfPlayer || ""),
            });
        }

        else if (task.targetID !== null && task.targetID !== undefined) {
            setEntryStep("TARGET");
            setSelectedTask({ isForTarget: true });

            setCurrentActivity({
                id: String(task.dailyTaskLogID || ""),
                dailyTaskLogID: String(task.dailyTaskLogID || ""),
                task: "",
                taskName: "",
                customTask: "",
                setup: String(task.setUp || "1"),
                customTime: String(task.allocatedTime || "0"),
                timeTaken: String(task.timeTakenToWork || task.workedTime || "0"),
                remark: task.remarks || "",
                targetID: String(task.targetID || ""),
                targetName: task.targetName || "",
                unit: String(task.units || ""),
                achievedUnit: String(task.achievedUnits || ""),
                frequency: task.frequency || "",
                isDynamic: false,
                isForTarget: true,
                miscallenous: String(task.miscallenous || ""),
                NoOfPlayer: String(task.NoOfPlayer || ""),
            });
        }

        else if (task.goalID !== null && task.goalID !== undefined) {
            setEntryStep("GOAL");

            setGoalEntry({
                goalID: String(task.goalID || ""),
                goalName: task.goalName || "",
                unit: String(task.fixedGoal || ""),
                frequency: task.goalType || "",
                achievedUnit: String(task.achievedGoal || ""),
                expectedUnit: task.expectedUnit || "",
            });
        }

    }, [task, taskOptions]);  // ← add taskOptions to deps


    useEffect(() => {
        const fetchTarget = async () => {
            try {
                //CASE: SPECIAL DEPARTMENTS
                if (DeptId == 14 || DeptId == 32 || DeptId == 31) {

                    const bodyData = {
                        openDate: formatCalendarDate2(workDate)
                    };

                    const todayRes = await axios.post(
                        `/t2.0/authentificationUtilization/monthly-targets/today/${DeptId}`,
                        bodyData,
                        { headers: { "Content-Type": "application/json" } }
                    );


                    //  SUCCESS → STOP HERE
                    if (todayRes.data.length > 0) {
                        setIsShow(true);
                        setTarget(todayRes.data);
                        setShowMessage(false);
                        return; //  VERY IMPORTANT
                    }
                    else {
                        setIsShow(false)
                        setTarget([])
                        setShowMessage(true)
                    }




                } else {
                    //  NORMAL FLOW (ONLY ONE API)
                    const fallbackRes = await axios.post(
                        `/t2.0/authentificationUtilization/departmentTargets/getTargetsByDepartment`,
                        { departmentId: DeptId },
                        { headers: { "Content-Type": "application/json" } }
                    );

                    if (fallbackRes.data?.result?.length > 0) {
                        setIsShow(true);
                        setTarget(fallbackRes.data.result);
                        setShowMessage(false);
                    } else {
                        setIsShow(false);
                        setTarget([]);
                        setShowMessage(true);
                    }
                }

            } catch (err) {
                console.error("Error fetching target:", err);
                setTarget([]);
                setIsShow(false);
                setShowMessage(true);
            }
        };
        fetchTarget();
        setShowMessage(false)

    }, [DeptId, workDate])


    useEffect(() => {
        if (entryStep !== "GOAL") return;
        if (!DeptId) return;

        const fetchGoals = async () => {
            try {
                const bodyData = {
                    departmentId: DeptId,
                };

                const result = await axios.post(
                    "/t2.0/authentificationUtilization/departmentGoals/getGoalsByDepartment",
                    bodyData,
                    { headers: { "Content-Type": "application/json" } }
                );

                if (result) {
                    const goalList = result.data.result;
                    console.log("Fetched goals:", goalList);
                    setGoals(
                        goalList.map((g: any) => ({
                            goalID: String(g.goalID),
                            goalName: g.goalName,
                            unit: g.unit,
                            frequency: g.frequency,
                            achievedUnit: "",
                        }))
                    );

                } else {
                    setGoals([]);
                }
            } catch (err) {
                console.error("Error fetching goals:", err);
                setGoals([]);
            }
        };

        fetchGoals();
    }, [entryStep, DeptId]);




    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const body = {
                    filter: "",
                    searchText: "",
                    departmentID: 21,
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
                console.log("----- formatted -----", formatted);
                setSalesUser(formatted)



            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };
        if ((DeptId == 5 || DeptId == 6 || DeptId == 9 || DeptId == 36)) {

            fetchUsers();

        }

    }, [DeptId]);


    const handleAddActivity = () => {
        const formatCalendarDate = (date: CalendarDate) => {
            const year = date.year;
            const month = String(date.month).padStart(2, "0");
            const day = String(date.day).padStart(2, "0");
            return `${year}-${month}-${day}`; // YYYY-MM-DD
        };

        if (tat) {
            setTat(false)
        }
        const hasValidTask =
            currentActivity.task && (currentActivity.task !== "custom" || currentActivity.customTask);

        const isTargetTask = selectedtask?.isForTarget;
        const isDynamicTask = selectedtask?.isDynamic;

        const hasValidTime = !isTargetTask && (currentActivity.customTime || currentActivity.timeType);
        const hasValidTarget = isTargetTask && currentActivity.percentage;

        // if (!hasValidTask) return;
        // if (!isTargetTask && !hasValidTime) return;
        // if (isTargetTask && !hasValidTarget) return;
        if (!hasValidTask) return;

        if (isTargetTask) {
            if (!hasValidTarget) return;
        } else {
            if (!hasValidTime) return;
            if (!currentActivity.timeTaken) return; // ⬅ mandatory time taken for all non-target tasks
        }


        const timePerSetup =
            Number(currentActivity.customTime) ||
            (currentActivity.timeType === "15min" ? 0.25 :
                currentActivity.timeType === "30min" ? 0.5 :
                    currentActivity.timeType === "45min" ? 0.75 :
                        currentActivity.timeType === "1hour" ? 1 :
                            currentActivity.timeType === "1.5hour" ? 1.5 :
                                currentActivity.timeType === "2hour" ? 2 : 0);

        const totalTime = isTargetTask ? 0 : timePerSetup * Number(currentActivity.setup || 1);

        const newActivity = {
            ...currentActivity,
            id: Date.now().toString(),
            workDate: formatCalendarDate(workDate),

            taskName: currentActivity.task === "custom"
                ? currentActivity.customTask
                : currentActivity.taskName,

            totalTimePerSetup: timePerSetup,
            actualTimeOfWork: isTargetTask ? 0 : totalTime,

            // store them here
            isDynamic: isDynamicTask || false,
            isForTarget: isTargetTask || false,
            timeTaken: currentActivity.timeTaken,
            remark: currentActivity.remark
        };

        setActivities([...activities, newActivity]);

        setCurrentActivity({
            id: "",
            task: "",
            taskName: "",
            customTask: "",
            timeType: "",
            customTime: "0",
            timeTaken: "",
            remark: "",
            setup: "1",
            targetName: "",
            targetID: "",
            unit: "",
            frequency: "",
            achievedUnit: "",
        });

    };


    const handleRemoveActivity = (id: string) => {
        setActivities(activities.filter(activity => activity.id !== id));
    };

    const handleAddPR = () => {
        if (currentPR.PRID && currentPR.UserID && currentPR.TaskID) {
            const newPR = {
                ...currentPR,
                id: Date.now().toString(),
            };
            setPREntries([...prEntries, newPR]);
            setCurrentPR({
                id: "",
                PRID: "",
                UserID: "",
                DepartmentID: "",
                TaskID: "",
                WorkDate: "",
                ReceivedTDate: "",
                DueDate: "",
                CompletionDate: "",
                AllocatedHours: "",
                TimeTaken: "",
                TATPercent: "",
                Remarks: ""
            });
        }
    };

    const handleRemovePR = (id: string) => {
        setPREntries(prEntries.filter(pr => pr.id !== id));
    };

    const calculateTotalTime = () => {
        let totalMinutes = 0;
        activities.forEach(activity => {
            if (activity.customTime) {
                totalMinutes += parseInt(activity.customTime) || 0;
            } else if (activity.timeType) {
                switch (activity.timeType) {
                    case "15min": totalMinutes += 15; break;
                    case "30min": totalMinutes += 30; break;
                    case "45min": totalMinutes += 45; break;
                    case "1hour": totalMinutes += 60; break;
                    case "1.5hour": totalMinutes += 90; break;
                    case "2hour": totalMinutes += 120; break;
                }
            }
        });

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h ${minutes}m`;
    };

    const getCurrentDate = () => {
        const today = new Date();
        return today.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // const salesCheck = (n) => {
    //     if ((n == 5) || (n == 6) || (n == 9) || (n == 36)) {
    //         return true
    //     }
    //     else {
    //         return false
    //     }
    // }

    // const TACheck = (n) => {
    //     if ((n == 22)) {
    //         return true
    //     }
    //     else {
    //         return false
    //     }
    // }

    const handleSubmitActivityLog = async () => {
        try {
            const authUserLD = localStorage.getItem("authUserLD");
            const authUser = JSON.parse(authUserLD)
            const token = authUserLD ? JSON.parse(authUserLD).token : "";

            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            };


            const formatCalendarDate = (date: CalendarDate) => {
                const year = date.year;
                const month = String(date.month).padStart(2, "0");
                const day = String(date.day).padStart(2, "0");
                return `${year}-${month}-${day}`; // YYYY-MM-DD
            };



            const allocatedTimeHrs = activities.reduce((sum, a) => {
                if (a.targetValue || a.percentage) return sum; // target/percentage task → 0 mins
                return sum + (Number(a.customTime || 0) * Number(a.setup || 1));
            }, 0);
            const takenTimeHrs = activities.reduce((sum, a) => {
                return sum + Number(a.timeTaken || 0)
            }, 0);

            const payloadformat = () => {
                const activitiesPayload = [];
                const goalsPayload = [];
                if (leaveType === "FULL_DAY") {
                    return {
                        leaveType: "FULL_DAY",
                        workDate: formatCalendarDate(workDate),
                        userID: Number(authUser.userID),
                        departmentID: Number(DeptId || authUser.departmentID || 0),
                        activities: [],
                        goals: [],
                    };
                }

                activities.forEach((activity) => {
                    let unit = Number(activity.unit || 0);

                    // Department specific calculation
                    if (DeptId == 19) {
                        unit = Math.round((8 - Number(activity.miscallenous || 0)) * 7.5);
                    }

                    if (DeptId == 20) {
                        unit = Math.round((8 - Number(activity.miscallenous || 0)) * 60);
                    }

                    if (DeptId == 25) {
                        unit = Math.round((8 - Number(activity.miscallenous || 0)) * 2);
                    }

                    if (DeptId == 26) {
                        unit = activity.miscallenous
                            ? Math.round(
                                (
                                    (8 - Number(activity.miscallenous || 0)) -
                                    ((Number(activity.NoOfPlayer || 0) * 30) / 60)
                                ) / (10 / 60)
                            )
                            : 0;
                    }
                    const achievedUnit = DeptId == 18
                        ? activity.achievedUnit
                        : Number(activity.achievedUnit || 0);

                    const totalUnitValues =
                        unit > 0
                            ? DeptId === 18
                                ? activity.achievedUnit
                                : Number(((achievedUnit / unit) * 100).toFixed(2))
                            : 0;

                    if (activity.isGoal) {
                        goalsPayload.push({
                            userGoalDataID: task.id ? task.id : "",
                            goalID: Number(activity.goalID),
                            userID: Number(authUser.userID),
                            departmentID: Number(DeptId || authUser.departmentID || 0),
                            workDate: formatCalendarDate(workDate),
                            achievedGoal: DeptId == 18 ? 0 : achievedUnit,
                            fixedGoal: unit,
                            frequency: activity.frequency,
                            totalUnitValues,

                            ...(DeptId === 18 && {
                                updates: [
                                    {
                                        expectedTime: activity.expectedUnit || null,
                                        actualTime: achievedUnit || 0
                                    }
                                ]
                            })
                        });
                        return;
                    }

                    activitiesPayload.push({
                        dailyTaskLogID: activity.dailyTaskLogID,
                        taskID: Number(activity.task),
                        targetID: activity.targetID ? Number(activity.targetID) : null,
                        userID: Number(authUser.userID),
                        workDate: formatCalendarDate(workDate),

                        setUp: Number(activity.setup || 1),
                        allocatedTime: Number(activity.customTime || 0),
                        timeTakenToWork: Number(activity.timeTaken || 0),

                        isForTarget: !!activity.targetID,
                        totalTimePerSetup: activity.isDynamic
                            ? Number(activity.timeTaken || 0)
                            : Number(activity.actualTimeOfWork || 0),

                        remarks: activity.remark || "",
                        units: unit,
                        achivedUnits: achievedUnit,
                        leaveType,
                        departmentID: Number(DeptId || authUser.departmentID || 0),
                        totalUnitValues,
                    });
                });

                return {
                    activities: activitiesPayload,
                    goals: goalsPayload,
                };
            };


            const payload = payloadformat();
            console.log(payload, "payload")


            const departmentId = DeptId; // make dynamic later
            let result;

            result = await axios.patch(
                `/t2.0/authentificationUtilization/form/bulkUpdate`,
                payload,
                { headers }
            );





            addToast({
                title: "Success",
                description: "Activity log submitted successfully!",
                color: "success",

            });

            setActivities([]);

        } catch (error) {
            console.error(error);

            addToast({
                title: "Error",
                description: "Failed to submit activity log.",
                color: "danger",

            });
        }
    };

    const handleEmpty = () => {
        setDuration(parseZonedDateTime(formattedToday))
        setScheduleType("")
        setPublisher("")
        setSelectedSalesPerson("")
    }

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    const getToday = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await axios.get(
                    `/t2.0/authentificationUtilization/positions/list?page=${pageNumberJd}&size=${pageSizeJd}&userId=${authUser.userID}&status=${statusFilter}`,
                    { headers: { "Content-Type": "application/json" } }
                );

                setJobData(result.data.data);
                settotalRecordsJd(result.data.totalItems);

                const jobIdOptions = result.data.data.map((ele) => ({
                    positionID: ele.positionID,
                    positionName: ele.positionName
                }));
                setJobId(jobIdOptions);
                setTotalPages(result.data.totalPages);

            } catch (err) {
                console.error("Error fetching positions:", err);
            }
        };

        fetchData();
    }, [pageNumberJd, pageSizeJd, statusFilter]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await axios.get(
                    `/t2.0/authentificationUtilization/adminTickets/list`,
                    { headers: { "Content-Type": "application/json" } }
                );


                setAdminGoalList(result.data.data)


            } catch (err) {
                console.error("Error fetching sales calls:", err);
            }
        };
        if (entryStep === "GOAL" && DeptId == 42) {
            fetchData();
        }
    }, [entryStep, DeptId,]);







    const handleSubmitSalesData = async () => {
        try {
            const authUserLD = localStorage.getItem("authUserLD");
            const authUser = JSON.parse(authUserLD)
            const token = authUserLD ? JSON.parse(authUserLD).token : "";

            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            };
            const payload = {
                createrUserID: authUser.userID,
                publisherName: publisher,
                salesUserID: Number(selectedSalesPerson),
                scheduledDatetime: duration.toDate().toISOString()

            }
            const result = await axios.post(
                `/t2.0/authentificationUtilization/sales/calls/create`,
                payload,
                { headers }
            );
            if (result.status == 401) {
                localStorage.removeItem("authUserLD");
                window.location.href = "/";
            }

            // addToast({
            //     title: "Success",
            //     description: "submitted successfully!",
            //     color: "success",

            // });
            handleEmpty()
        }
        catch (error) {
            console.error(error);

            // addToast({
            //     title: "Error",
            //     description: "Failed to submit",
            //     color: "danger",

            // });
            handleEmpty()
        }
    }

    const totalPercentages = activities
        .filter((a) => a.targetName && a.unit > 0)
        .reduce((sum, a) => sum + (a.achievedUnit / a.unit) * 100, 0);

    const targetCount = activities.filter((a) => a.targetName && a.unit > 0).length;

    const averagePercentage =
        targetCount > 0 ? (totalPercentages / targetCount).toFixed(2) : 0;

    useEffect(() => {
        if (targetAchieved) {
            setCurrentActivity(prev => ({
                ...prev,
                achievedUnit: "",
                unit: targetAchieved ? "100" : prev.unit,        // or whatever unit you want
                frequency: targetAchieved ? "Daily" : prev.frequency,
            }));
        }
        else {
            setCurrentActivity(prev => ({
                ...prev,
                achievedUnit: "",
                unit: "",        // or whatever unit you want
                frequency: "",
            }));
        }
    }, [targetAchieved]);


    const validateActivityDatesBeforeSubmit = (): Promise<boolean> => {
        if (!activities.length) {
            return Promise.resolve(false);
        }

        const uniqueDates = [
            ...new Set(
                activities
                    .map(a => a.workDate)
                    .filter(Boolean)
            ),
        ];

        const today = getToday();

        //  SAME DATE
        if (uniqueDates.length === 1) {
            const activityDate = uniqueDates[0];

            setConfirmTitle("Confirm Submission");
            setConfirmMessage(
                activityDate === today
                    ? `You are about to submit activities for today (${formatDate(activityDate)}).`
                    : `You are about to submit activities for a previous date (${formatDate(activityDate)}).`
            );

            setShowDateConfirm(true);

            return new Promise(resolve => {
                confirmResolveRef.current = resolve;
            });
        }

        //  MULTIPLE DATES
        setConfirmTitle("Multiple Dates Detected");
        setConfirmMessage(
            "Your activity list contains tasks from multiple dates. Are you sure you want to submit them together?"
        );

        setShowDateConfirm(true);

        return new Promise(resolve => {
            confirmResolveRef.current = resolve;
        });
    };

    let timeSlots;

    if (DeptId == 18 && goalEntry.goalID == 30) {
        timeSlots = [
            { label: "11:30", value: "11:30" },
            { label: "15:00", value: "15:00" },
            { label: "17:00", value: "17:00" },
            { label: "19:00", value: "19:00" }
        ];
    } else if (DeptId == 18 && goalEntry.goalID == 31 && new Date(workDate).getDay() == 1) {
        timeSlots = [
            { label: "16:00", value: "16:00" },
            { label: "19:30", value: "19:30" },
            { label: "15:30", value: "15:30" },
            { label: "16:30", value: "16:30" }
        ];
    } else if (DeptId == 18 && goalEntry.goalID == 32 && new Date(workDate).getDay() == 1) {
        timeSlots = [
            { label: "16:00", value: "16:00" },
            { label: "19:30", value: "19:30" },
            { label: "14:30", value: "14:30" },
            { label: "18:30", value: "18:30" }
        ];
    } else {
        timeSlots = [
            { label: "16:00", value: "16:00" },
            { label: "19:30", value: "19:30" },
        ];
    }

    const validateJD = () => {
        if (!jdForm.positionName.trim()) {
            addToast({ title: "Error", color: "danger", description: "Position Name is required" });
            return false;
        }

        if (!jdForm.jdDetails.trim()) {
            addToast({ title: "Error", color: "danger", description: "JD Details are required" });
            return false;
        }

        return true;
    };


    const handleSaveJD = async () => {
        if (!validateJD()) return;

        try {
            let response;

            if (isEditingJD) {
                const payload = {
                    ...jdForm,
                    openDate: formatCalendarDate(workDate)

                };
                response = await axios.put(
                    "/t2.0/authentificationUtilization/positions/update",
                    payload
                );

                addToast({
                    title: "Updated Successfully",
                    color: "success",
                    description: "Job position updated successfully"
                });

                setJobData(prev =>
                    prev.map(item =>
                        item.positionID === jdForm.positionID
                            ? response.data
                            : item
                    )
                );

            } else {
                const payload = {
                    ...jdForm,
                    openDate: formatCalendarDate(workDate)
                };
                response = await axios.post(
                    "/t2.0/authentificationUtilization/positions/create",
                    payload
                );

                addToast({
                    title: "Created Successfully",
                    color: "success",
                    description: "Job position added successfully"
                });

                setJobData(prev => [...prev, response.data]);
            }

            //  RESET FORM
            setJdForm({
                positionName: "",
                jdDetails: "",
                status: "OPEN",
                positionID: null,
                userID: authUser.userID
            });

        } catch (error) {
            console.error(error);
            addToast({
                title: "Error",
                description: "Something went wrong",
                color: "danger"
            });
        }
    };
    const openEditJDModal = (job) => {
        setIsEditingJD(true);

        setJdForm({
            positionName: job.positionName,
            jdDetails: job.jdDetails,
            status: job.status,
            positionID: job.positionID,
            userID: job.createdByUserID, // optional if needed
        });
    };
    //  format date (YYYY-MM-DD)
    const formatDateAdmin = (date) => {
        const d = new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${day}-${m}-${y}`;
    };
    const handleAddGoal = async () => {
        try {
            const authUserLD = localStorage.getItem("authUserLD");
            const authUser = authUserLD ? JSON.parse(authUserLD) : null;
            const token = authUser?.token;

            //  validation
            if (!adminGoal.goalName || !adminGoal.description || !adminGoal.openDate) {
                addToast({
                    title: "Error",
                    description: "All fields are required",
                    color: "danger",
                });
                return;
            }



            const payload = {
                title: adminGoal.goalName,
                goalID: adminGoal.goalID ? Number(adminGoal.goalID) : null,
                description: adminGoal.description,
                userID: authUser?.userID,
                openDate: formatDateAdmin(adminGoal.openDate),
            };

            const res = await axios.post(
                "/t2.0/authentificationUtilization/adminTickets/create",
                payload,
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            //  success toast
            addToast({
                title: "Success",
                description: "Goal added successfully",
                color: "success",
            });

            //  reset form
            setAdminGoal({
                goalName: "",
                description: "",
                openDate: "",
            });

        } catch (err) {
            console.error(err);
            setAdminGoal({
                goalName: "",
                description: "",
                openDate: "",
            });
            addToast({
                title: "Error",
                description: "Failed to add goal",
                color: "danger",
            });
        }
    };
    const handleUpdateTicket = async () => {
        try {
            const payload = {
                ticketID: selectedTicket.ticketID,
                title: selectedTicket.title,
                description: selectedTicket.description,
                status: selectedTicket.status,

                //  REQUIRED FOR BACKEND
                userID: Number(localStorage.getItem("userID")) || selectedTicket.createdByUserID,
                goalID: selectedTicket.goalID, // fallback
                openDate: formatDateAdmin(selectedTicket.openDate)
            };

            console.log("UPDATE PAYLOAD ", payload);

            const response = await axios.put(
                "/t2.0/authentificationUtilization/adminTickets/update",
                payload
            );

            //  success
            setIsEditOpen(false);
            addToast({
                title: "Updated Successfully",
                color: "success",
                description: "Goal updated successfully"
            });
            // update UI instantly
            setAdminGoalList((prev) =>
                prev.map((t) =>
                    t.ticketID === selectedTicket.ticketID
                        ? {
                            ...t,
                            achievedPerct: response.data.achievedPerct,
                            status: response.data.status,
                        }
                        : t
                )
            );

        } catch (err) {
            console.error(err);
            addToast({
                title: "Error",
                description: "Something went wrong",
                color: "danger"
            });
        }
    };
    return (
        <div className={`${DeptId == 24 ? "" : "grid grid-cols-1 xl:grid-cols-3 lg:grid-cols-1 md:grid-cols-1 gap-6"}`}>
            <Modal
                isOpen={showDateConfirm}
                onOpenChange={setShowDateConfirm}
                size="md"
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{confirmTitle}</ModalHeader>

                            <ModalBody>
                                <p className="text-sm text-gray-600">
                                    {confirmMessage}
                                </p>
                            </ModalBody>

                            <ModalFooter>
                                <Button
                                    variant="light"
                                    onPress={() => {
                                        setShowDateConfirm(false);
                                        confirmResolveRef.current?.(false);
                                        onClose();
                                    }}
                                >
                                    Cancel
                                </Button>

                                <Button
                                    color="primary"
                                    onPress={() => {
                                        setShowDateConfirm(false);
                                        confirmResolveRef.current?.(true);
                                        onClose();
                                    }}
                                >
                                    Confirm & Submit
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {DeptId == 24 ? (<><WeeklyPulse /></>) : (<>
                <Card className="w-full" style={{ minHeight: "40pc" }}>
                    <CardHeader className="pb-4">
                        <div className="flex flex-col space-y-2">

                            <div className="flex items-center gap-4">

                                {/* Title */}
                                <p className="text-gray-900 dark:text-white text-sm font-medium">
                                    Daily Activity {authUser.departmentID ? "" : "Log"}
                                </p>

                                {/* Half-Day Switch */}


                                {/* Sales Call Button */}
                                {/* {(salesCheck(DeptId) || salesCheck(authUser.departmentID)) && (
                                    <Button
                                        color="primary"
                                        variant="flat"
                                        size="sm"
                                        onPress={() => setIsSalesModalOpen(true)}
                                    >
                                        Add Sales Call
                                    </Button>
                                )}
                                {(TACheck(DeptId) || TACheck(authUser.departmentID)) && (
                                    <Button
                                        color="primary"
                                        variant="flat"
                                        size="sm"
                                        startContent={<SwitchIcon />}
                                        onPress={() => setIsTAModalOpen(!isTAModalOpen)}
                                    >
                                        {isTAModalOpen ? "close" : " Switch to TA"}
                                    </Button>
                                )} */}

                            </div>

                        </div>

                    </CardHeader>

                    <CardBody className="space-y-6">

                        {
                            isTAModalOpen ? <>
                                <div className="flex flex-col gap-4">
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault(); //  prevent reload
                                            handleSaveJD();
                                        }}
                                    >
                                        <div className="flex flex-col gap-4">

                                            <Input
                                                label="Position Name"
                                                value={jdForm.positionName}
                                                onChange={(e) =>
                                                    setJdForm({ ...jdForm, positionName: e.target.value })
                                                }
                                                isRequired
                                            />

                                            <Textarea
                                                label="JD Details"
                                                value={jdForm.jdDetails}
                                                onChange={(e) =>
                                                    setJdForm({ ...jdForm, jdDetails: e.target.value })
                                                }
                                                isRequired
                                            />

                                            <Select
                                                label="Status"
                                                selectedKeys={[jdForm.status]}
                                                onSelectionChange={(keys) =>
                                                    setJdForm({ ...jdForm, status: Array.from(keys)[0] })
                                                }
                                            >
                                                <SelectItem key="OPEN">OPEN</SelectItem>
                                                <SelectItem key="CLOSED">CLOSED</SelectItem>
                                                <SelectItem key="PAUSED">PAUSED</SelectItem>
                                            </Select>

                                            {/* DATE */}
                                            <label>Job opening Date</label>
                                            <Dropdown
                                                isOpen={open}
                                                onOpenChange={setOpen}
                                                closeOnSelect={false}
                                            >
                                                <DropdownTrigger>
                                                    <Button variant="bordered" className="w-full justify-between">
                                                        {formatDatetime(workDate)}
                                                    </Button>
                                                </DropdownTrigger>

                                                <DropdownMenu
                                                    aria-label="Date Picker"
                                                    className="p-0"
                                                    itemClasses={{ base: "p-0 cursor-default" }}
                                                >
                                                    <DropdownItem key="calendar">
                                                        <CustomDatePicker
                                                            value={workDate}
                                                            onChange={(d) => {
                                                                setWorkDate(d);
                                                                setOpen(false);
                                                            }}
                                                        />
                                                    </DropdownItem>
                                                </DropdownMenu>
                                            </Dropdown>

                                            <Button color="primary" type="submit">
                                                {isEditingJD ? "Update" : "Submit"}
                                            </Button>

                                        </div>
                                    </form>
                                </div>
                            </> : <>

                                {entryStep === "TASK" && (
                                    <div className="flex flex-col gap-4">


                                        <div className="flex items-center">
                                            {/* <Switch
                                    checked={isHalf}
                                    onChange={(e) => setIsHalf(e.target.checked)}
                                    size="sm"
                                >
                                    Half Day
                                </Switch> */}

                                            <RadioGroup
                                                label="Leave Type"
                                                orientation="horizontal"
                                                value={leaveType}
                                                onValueChange={(val) => setLeaveType(val)}
                                                color="warning"
                                            >
                                                <Radio value="NONE">None</Radio>
                                                <Radio value="HALF_DAY">Half Day</Radio>
                                                <Radio value="FULL_DAY">Full Day</Radio>
                                            </RadioGroup>

                                        </div>

                                        {/* <DatePicker
                                label="Date of Work"
                                value={workDate}
                                onChange={setWorkDate}
                                maxValue={Maxtoday}

                            /> */}
                                        <h3 className=" text-gray-900 dark:text-white" style={{ size: "12px" }}>
                                            Date
                                        </h3>
                                        <Dropdown
                                            isOpen={open}
                                            onOpenChange={setOpen}
                                            closeOnSelect={false} // ⬅ VERY IMPORTANT
                                        >
                                            <DropdownTrigger>
                                                <Button
                                                    variant="bordered"
                                                    className="w-full justify-between"

                                                >
                                                    {formatDatetime(workDate)}
                                                </Button>
                                            </DropdownTrigger>

                                            <DropdownMenu
                                                aria-label="Date Picker"
                                                className="p-0"
                                                itemClasses={{
                                                    base: "p-0 cursor-default",
                                                }}
                                            >
                                                <DropdownItem key="calendar">
                                                    <CustomDatePicker
                                                        value={workDate}
                                                        onChange={(d) => {
                                                            setWorkDate(d)
                                                            setOpen(false); // close after select
                                                        }}
                                                    />
                                                </DropdownItem>
                                            </DropdownMenu>
                                        </Dropdown>
                                        <h3 className=" text-gray-900 dark:text-white" style={{ size: "12px" }}>
                                            Add Task Entry
                                        </h3>
                                        <div className="">
                                            {/* Task Dropdown or Custom Input */}
                                            {currentActivity.task === "custom" ? (
                                                <Input
                                                    label="Custom Task"
                                                    placeholder="Enter custom task name"
                                                    value={currentActivity.customTask}
                                                    onChange={(e) => setCurrentActivity({
                                                        ...currentActivity,
                                                        customTask: e.target.value
                                                    })}
                                                    variant="bordered"
                                                    isRequired
                                                    endContent={
                                                        <Button
                                                            size="sm"
                                                            variant="light"
                                                            onClick={() => setCurrentActivity({
                                                                ...currentActivity,
                                                                task: "",
                                                                customTask: ""
                                                            })}
                                                        >
                                                            Back
                                                        </Button>
                                                    }
                                                />
                                            ) : (
                                                <Select
                                                    label="Task Type"
                                                    placeholder="Select task type"
                                                    selectedKeys={currentActivity.task ? [currentActivity.task] : []}
                                                    onSelectionChange={(keys) => {
                                                        const selectedKey = Array.from(keys)[0] as string;
                                                        const selectedTask = taskOptions.find(t => String(t.taskID) === selectedKey);

                                                        setSelectedTask(selectedTask);

                                                        const isDynamic = selectedTask?.isDynamic;
                                                        const isForTarget = selectedTask?.isForTarget;

                                                        setCurrentActivity(prev => ({
                                                            ...prev,
                                                            task: selectedKey,
                                                            taskName: selectedTask?.taskName || "",
                                                            customTask: selectedKey === "custom" ? "" : prev.customTask,

                                                            // If isDynamic → setup = empty, time = empty
                                                            // If forTarget → both empty (UI will show target % fields)
                                                            setup: isDynamic || isForTarget ? "" : "1",

                                                            // If forTarget → empty
                                                            // Else → use standardTimeMins if exists
                                                            customTime: isForTarget ? "0" :
                                                                (isDynamic ? "0" : String(selectedTask?.standardTimeMins || 0)),

                                                            // Create new attributes for target entry
                                                            targetValue: selectedTask?.isForTarget ? selectedTask?.targetNumber || "" : "",
                                                            percentage: isForTarget ? "" : prev.percentage,
                                                            timingType: selectedTask?.timingType
                                                        }));
                                                    }}



                                                    variant="bordered"
                                                    isRequired
                                                >
                                                    {taskOptions.map((task) => (
                                                        <SelectItem key={task.taskID}>
                                                            {task.taskName}
                                                        </SelectItem>
                                                    ))}
                                                </Select>
                                            )}




                                        </div>


                                        {selectedtask?.isForTarget ? (
                                            // Target Mode
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Input
                                                    label="Target"
                                                    placeholder="Enter target value"
                                                    isRequired
                                                    value={currentActivity.targetValue ?? ""}
                                                    onChange={(e) =>
                                                        setCurrentActivity({ ...currentActivity, targetValue: e.target.value })
                                                    }
                                                    variant="bordered"
                                                />
                                                <Input
                                                    label="Percentage (%)"
                                                    placeholder="Enter %"
                                                    isRequired
                                                    type="number"
                                                    value={currentActivity.percentage}
                                                    onChange={(e) =>
                                                        setCurrentActivity({ ...currentActivity, percentage: e.target.value })
                                                    }
                                                    variant="bordered"
                                                />
                                            </div>
                                        ) : (
                                            // Normal or Dynamic Mode
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* <Select
                                            label="Setup"
                                            placeholder="Select setup"
                                            isDisabled={currentActivity.timingType === "Fixed"}
                                            selectedKeys={currentActivity.setup ? [currentActivity.setup] : ["1"]} // default to 1
                                            onSelectionChange={(keys) => {
                                                const selectedKey = Array.from(keys)[0] as string;
                                                setCurrentActivity({ ...currentActivity, setup: selectedKey });
                                            }}
                                            variant="bordered"
                                        >
                                            {setupOptions.map((setup) => (
                                                <SelectItem key={setup.key}>{setup.label}</SelectItem>
                                            ))}
                                        </Select> */}

                                                <Input
                                                    label="Task Count"
                                                    type="number"
                                                    min="1"
                                                    max="150"
                                                    placeholder="1"
                                                    value={currentActivity.setup || ""}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        setCurrentActivity({
                                                            ...currentActivity,
                                                            setup: value === "" ? "" : Math.max(1, parseInt(value) || 0).toString(),
                                                        });
                                                    }}
                                                    isDisabled={currentActivity.timingType === "Fixed"}

                                                    variant="bordered"
                                                    className="w-full"
                                                />


                                                <Input
                                                    label=" Std time/count (mins)"
                                                    placeholder="Enter time"
                                                    type="number"
                                                    value={currentActivity.customTime}
                                                    onChange={(e) =>
                                                        setCurrentActivity({ ...currentActivity, customTime: e.target.value })
                                                    }
                                                    isRequired
                                                    variant="bordered"
                                                    isDisabled={true}
                                                />
                                            </div>
                                        )}
                                        {
                                            selectedtask?.isDynamic ? (<div>
                                                <Input
                                                    label="Task Description"
                                                    placeholder="Enter details"
                                                    type="text"
                                                    isRequired
                                                    value={currentActivity.remark}
                                                    onChange={(e) =>
                                                        setCurrentActivity({ ...currentActivity, remark: e.target.value })
                                                    }

                                                    variant="bordered"
                                                />
                                            </div>) : (<div>
                                                {/* <Input
                                            label="Task Description"
                                            placeholder="Enter details"
                                            type="text"

                                            value={currentActivity.remark}
                                            onChange={(e) =>
                                                setCurrentActivity({ ...currentActivity, remark: e.target.value })
                                            }

                                            variant="bordered"
                                        /> */}
                                                <Input
                                                    label="Task Description"
                                                    placeholder="Enter details"
                                                    type="text"
                                                    isRequired
                                                    value={currentActivity.remark}
                                                    onChange={(e) =>
                                                        setCurrentActivity({ ...currentActivity, remark: e.target.value })
                                                    }

                                                    variant="bordered"
                                                />
                                            </div>)
                                        }
                                        {!selectedtask?.isForTarget && (
                                            <div>
                                                <Input
                                                    label="Time Taken (mins)"
                                                    placeholder="Enter time"
                                                    type="number"
                                                    min="0"
                                                    step="0.001"
                                                    isRequired
                                                    value={currentActivity.timeTaken}
                                                    onChange={(e) =>
                                                        setCurrentActivity({
                                                            ...currentActivity,
                                                            timeTaken: e.target.value,
                                                        })
                                                    }
                                                    variant="bordered"
                                                />
                                            </div>
                                        )}




                                        <div className="flex justify-end space-x-2">
                                            {/* <Button
                                        variant="flat"
                                        color="danger"
                                        onClick={() => setShowForm(false)}
                                    >
                                        Cancel
                                    </Button> */}
                                            <Button
                                                color="primary"
                                                onClick={handleAddActivity}
                                                size="sm"

                                                isDisabled={


                                                    // If custom task selected → name required
                                                    // (currentActivity.task === "custom" && !currentActivity.customTask) ||

                                                    // For Target tasks → require both target value & percentage (timeTaken optional)
                                                    // (selectedtask?.isForTarget && (
                                                    //     !currentActivity.targetValue ||
                                                    //     !currentActivity.percentage
                                                    // )) ||


                                                    !currentActivity.task ||

                                                    // For Non-target tasks
                                                    (
                                                        !selectedtask?.isForTarget &&
                                                        (
                                                            selectedtask?.isDynamic
                                                                ? (
                                                                    // When it's "Unscheduled Tasks" → remark required too
                                                                    !currentActivity.customTime ||
                                                                    // !currentActivity.setup ||
                                                                    !currentActivity.timeTaken ||
                                                                    !currentActivity.remark
                                                                )
                                                                : (
                                                                    // Otherwise → only customTime, setup, and timeTaken are required
                                                                    !currentActivity.customTime ||
                                                                    // !currentActivity.setup ||
                                                                    !currentActivity.remark ||

                                                                    !currentActivity.timeTaken
                                                                )
                                                        )
                                                    )


                                                }


                                            >
                                                Add Activity
                                            </Button>

                                        </div>

                                    </div>
                                )}

                                {entryStep === "TARGET" && (
                                    <div
                                    >

                                        <h3 className="text-gray-900 dark:text-white mb-4 text-sm">
                                            Add Target Entry
                                            {showMessage && (

                                                <span className="ml-2 inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                    Note: if your target is not present, it will be calculated automatically.Check your target achievement in performance insights report
                                                </span>


                                            )}
                                        </h3>



                                        {/* Autocomplete for Target Name */}
                                        <Autocomplete
                                            label="Target Name"
                                            placeholder="Select target name..."
                                            allowsCustomValue={false}
                                            selectedKey={String(currentActivity.targetID || "")}
                                            onSelectionChange={(key) => {
                                                if (!key) return;
                                                if (DeptId == 14 || DeptId == 32 || DeptId == 31) {
                                                    setTargetAchieved(true)

                                                }
                                                const selectedTarget = target.find(
                                                    (t) => String(t.targetID) === String(key)
                                                );

                                                if (!selectedTarget) return;

                                                // Example conditional logic: handle "TAT" targets specially
                                                if (selectedTarget.targetName.includes("TAT")) {
                                                    setTat(!tat)
                                                    // Calculate total hours (excluding target-based tasks)
                                                    const totalHours = activities.reduce((sum, a) => {
                                                        if (a.targetValue || a.percentage) return sum;
                                                        if (a.isDynamic) return sum + Number(a.timeTaken || 0);
                                                        return sum + Number(a.customTime || 0) * Number(a.setup || 1);
                                                    }, 0);

                                                    // Calculate total time taken
                                                    const totalTimeTaken = activities.reduce(
                                                        (sum, a) => sum + Number(a.timeTaken || 0),
                                                        0
                                                    );

                                                    // Compute percentage (as achieved unit)
                                                    const achievedUnit =
                                                        totalTimeTaken > 0 ? ((totalTimeTaken / totalHours) * 100).toFixed(2) : 0;

                                                    setCurrentActivity((prev) => ({
                                                        ...prev,
                                                        achievedUnit: achievedUnit,
                                                    }));
                                                }

                                                //  Always update selected target details
                                                setCurrentActivity((prev) => ({
                                                    ...prev,
                                                    targetID: selectedTarget.targetID,
                                                    targetName: selectedTarget.targetName,
                                                    frequency: selectedTarget.frequency,
                                                    unit: selectedTarget.unit,
                                                }));
                                            }}
                                            className="mb-4"
                                        >
                                            {target.map((t) => (
                                                <AutocompleteItem key={String(t.targetID)} value={t.targetName}>
                                                    {t.targetName}
                                                </AutocompleteItem>
                                            ))}
                                        </Autocomplete>

                                        {/* {currentActivity.targetID && currentActivity.targetName && isshow && (

                                    <Checkbox className="my-2" checked={targetAchieved}
                                        onChange={(e) => setTargetAchieved(e.target.checked)}> is Target achieved?{targetAchieved}</Checkbox>
                                )} */}


                                        {(DeptId == 19 || DeptId == 20 || DeptId == 25 || DeptId == 26) && (
                                            <Input
                                                label="enter miscallenous time taken (hrs)"
                                                value={currentActivity.miscallenous}
                                                className="mb-4"
                                                onChange={(e) => {
                                                    const value = e.target.value;

                                                    setCurrentActivity(prev => ({
                                                        ...prev,
                                                        miscallenous: value,
                                                    }))
                                                }}
                                                variant="bordered"
                                            />

                                        )}
                                        {DeptId == 26 && (
                                            <Input
                                                type="number"
                                                label="Number of player worked"
                                                placeholder="Enter number of players"
                                                className="mb-4"
                                                variant="bordered"
                                                isRequired
                                                value={currentActivity.NoOfPlayer || ""}
                                                onChange={(e) => {
                                                    setCurrentActivity((prev) => ({
                                                        ...prev,
                                                        NoOfPlayer: e.target.value,
                                                    }));
                                                }}
                                            />
                                        )}
                                        {/* Unit - auto-filled, disabled */}
                                        <Input
                                            label="Unit"
                                            value={
                                                targetAchieved
                                                    ? "100"
                                                    : DeptId == 19
                                                        ? Math.round((8 - currentActivity.miscallenous) * 7.5)
                                                        : DeptId == 20
                                                            ? Math.round((8 - currentActivity.miscallenous) * 60)
                                                            : DeptId == 25
                                                                ? Math.round((8 - currentActivity.miscallenous) * 2)
                                                                : DeptId == 26
                                                                    ? currentActivity.miscallenous
                                                                        ? Math.round(
                                                                            (
                                                                                (8 - currentActivity.miscallenous) -
                                                                                ((Number(currentActivity.NoOfPlayer || 0) * 30) / 60)
                                                                            ) / (10 / 60)
                                                                        )
                                                                        : 0
                                                                    : currentActivity.unit || ""
                                            }
                                            disabled
                                            placeholder="Unit will populate automatically"
                                            className="mb-4"
                                            variant="bordered"
                                        />


                                        {/* Frequency - auto-filled, disabled */}
                                        <Input
                                            label="Frequency"
                                            value={targetAchieved ? "Daily" : currentActivity.frequency || ""}
                                            disabled
                                            placeholder="Frequency will populate automatically"
                                            className="mb-4"
                                            variant="bordered"

                                        />

                                        {/* Achieved Unit - editable */}
                                        <Input
                                            label={DeptId == 26 ? "Achieved VAST Unit" : "Achieved Unit"}
                                            type="number"
                                            min="0"
                                            step="0.001"   // allow decimals like 0.004
                                            placeholder="Enter achieved Target"
                                            value={currentActivity.achievedUnit}
                                            onChange={(e) => {
                                                const value = e.target.value;

                                                // Do not allow negative numbers
                                                if (Number(value) < 0) return;

                                                setCurrentActivity({
                                                    ...currentActivity,
                                                    achievedUnit: value,
                                                });
                                            }}
                                            className="mb-4"
                                            isDisabled={tat}
                                            variant="bordered"
                                            isRequired
                                        />


                                        <div className="flex justify-end gap-3" style={{ marginBottom: "100px" }}>


                                            {/* Add Target button */}
                                            <Button
                                                color="primary"
                                                size="sm"
                                                onClick={() => {
                                                    if (!currentActivity.targetName || !currentActivity.achievedUnit) {
                                                        addToast({
                                                            title: "Error",
                                                            description: "Please select a target and enter achieved unit.",
                                                            color: "danger",
                                                        });
                                                        return;
                                                    }
                                                    if (targetAchieved) {
                                                        if (Number(currentActivity.achievedUnit) !== 100 && Number(currentActivity.achievedUnit) !== 0) {
                                                            addToast({
                                                                title: "Error",
                                                                description: "Please enter Achieved Unit 100 or 0 ",
                                                                color: "danger",
                                                            });
                                                            return;
                                                        }
                                                    }

                                                    let calculatedUnit = currentActivity.unit;

                                                    // Department specific calculation
                                                    if (DeptId == 19) {
                                                        calculatedUnit = Math.round(
                                                            (8 - Number(currentActivity.miscallenous || 0)) * 7.5
                                                        );
                                                    }

                                                    if (DeptId == 20) {
                                                        calculatedUnit = Math.round(
                                                            (8 - Number(currentActivity.miscallenous || 0)) * 60
                                                        );
                                                    }

                                                    if (DeptId == 25) {
                                                        calculatedUnit = Math.round(
                                                            (8 - Number(currentActivity.miscallenous || 0)) * 2
                                                        );
                                                    }

                                                    if (DeptId == 26) {
                                                        calculatedUnit = currentActivity.miscallenous
                                                            ? Math.round(
                                                                (
                                                                    (8 - Number(currentActivity.miscallenous || 0)) -
                                                                    ((Number(currentActivity.NoOfPlayer || 0) * 30) / 60)
                                                                ) / (10 / 60)
                                                            )
                                                            : 0;
                                                    }

                                                    const newEntry = {
                                                        ...currentActivity,
                                                        id: Date.now().toString(),
                                                        unit: calculatedUnit, // IMPORTANT
                                                    };

                                                    setTargetAchieved(false)

                                                    setActivities((prev) => [...prev, newEntry]);



                                                    setCurrentActivity({
                                                        id: "",
                                                        task: "",
                                                        taskName: "",
                                                        customTask: "",
                                                        timeType: "",
                                                        customTime: "0",
                                                        timeTaken: "",
                                                        remark: "",
                                                        setup: "1",
                                                        targetName: "",
                                                        targetID: "",
                                                        unit: "",
                                                        frequency: "",
                                                        achievedUnit: "",
                                                    });
                                                }}
                                            >
                                                Add Target
                                            </Button>
                                        </div>



                                    </div>
                                )}
                                {entryStep === "GOAL" && (
                                    DeptId == 42 ? (<>
                                        <div className="flex flex-col gap-4">
                                            <h3 className="text-gray-900 dark:text-white text-sm">
                                                Add Goal Entry
                                            </h3>


                                            <Autocomplete
                                                label={DeptId == 18 ? "Sub department" : "Goal Name"}
                                                placeholder={DeptId == 18 ? "Select department" : "Select Goal"}
                                                selectedKey={adminGoal.goalID}
                                                onSelectionChange={(key) => {
                                                    const g = goals.find(goal => goal.goalID === String(key));
                                                    if (!g) return;

                                                    setAdminGoal(prev => ({
                                                        ...prev,
                                                        goalID: g.goalID,
                                                        goalName: g.goalName
                                                    }));
                                                }}
                                            >
                                                {goals.map((g) => (
                                                    <AutocompleteItem key={g.goalID}>
                                                        {g.goalName}
                                                    </AutocompleteItem>
                                                ))}
                                            </Autocomplete>

                                            <Textarea
                                                label="Description"
                                                value={adminGoal.description}
                                                onChange={(e) =>
                                                    setAdminGoal(prev => ({
                                                        ...prev,
                                                        description: e.target.value
                                                    }))
                                                }
                                                isRequired
                                            />
                                            <Dropdown
                                                isOpen={open}
                                                onOpenChange={setOpen}
                                                closeOnSelect={false}
                                            >
                                                <DropdownTrigger>
                                                    <Button variant="bordered" className="w-full justify-between">
                                                        {adminGoal.openDate || "Select Open Date"}
                                                    </Button>
                                                </DropdownTrigger>

                                                <DropdownMenu
                                                    aria-label="Date Picker"
                                                    className="p-0"
                                                    itemClasses={{ base: "p-0 cursor-default" }}
                                                >
                                                    <DropdownItem key="calendar">
                                                        <CustomDatePicker
                                                            value={workDate}
                                                            onChange={(d) => {
                                                                setWorkDate(d);

                                                                setAdminGoal(prev => ({
                                                                    ...prev,
                                                                    openDate: d.toString()
                                                                }));

                                                                setOpen(false);
                                                            }}
                                                        />
                                                    </DropdownItem>
                                                </DropdownMenu>
                                            </Dropdown>

                                            <Button
                                                color="primary"
                                                size="sm"
                                                onClick={() => {
                                                    handleAddGoal()
                                                }}
                                            >
                                                Add Goal
                                            </Button>

                                        </div>
                                    </>) : (
                                        <div className="flex flex-col gap-4">
                                            <h3 className="text-gray-900 dark:text-white text-sm">
                                                Add Goal Entry
                                            </h3>
                                            {(DeptId == 14 || DeptId == 32 || DeptId == 31) && (<span className="ml-2 inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                Note: finance, finance-AP, finance-AR auto calculated
                                            </span>)

                                            }

                                            <Autocomplete
                                                label={DeptId == 18 ? "Sub department" : "Goal Name"}
                                                placeholder={DeptId == 18 ? "Select department" : "Select Goal"}
                                                selectedKey={goalEntry.goalID}
                                                isDisabled={(DeptId == 14 || DeptId == 32 || DeptId == 31)}
                                                onSelectionChange={(key) => {

                                                    const g = goals.find(goal => goal.goalID === String(key));
                                                    if (!g) return;

                                                    setGoalEntry({
                                                        goalID: g.goalID,
                                                        goalName: g.goalName,
                                                        unit: g.unit,
                                                        frequency: g.frequency,
                                                        achievedUnit: "",
                                                    });
                                                }}
                                            >
                                                {goals.map((g) => (
                                                    <AutocompleteItem key={g.goalID} value={g.goalName}>
                                                        {g.goalName}
                                                    </AutocompleteItem>
                                                ))}
                                            </Autocomplete>


                                            <Input
                                                label="Unit"
                                                value={goalEntry.unit}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setGoalEntry(prev => ({
                                                        ...prev,
                                                        unit: value,
                                                    }))
                                                }}
                                                isDisabled={DeptId != 16}
                                                variant="bordered"
                                            />

                                            <Input
                                                label="Frequency"
                                                value={goalEntry.frequency}
                                                isDisabled
                                                variant="bordered"
                                            />
                                            {DeptId == 18 && (
                                                <Autocomplete
                                                    label="Expected Time (24hr)"
                                                    selectedKey={goalEntry.expectedUnit}
                                                    onSelectionChange={(key) =>
                                                        setGoalEntry(prev => ({
                                                            ...prev,
                                                            expectedUnit: key
                                                        }))
                                                    }
                                                >
                                                    {timeSlots.map((slot) => (
                                                        <AutocompleteItem key={slot.value}>
                                                            {slot.label}
                                                        </AutocompleteItem>
                                                    ))}
                                                </Autocomplete>
                                            )}

                                            <Input
                                                label={DeptId == 18 ? "Achieved time (24hr)" : "Achieved Unit"}
                                                type={DeptId == 18 ? "time" : "number"}
                                                value={goalEntry.achievedUnit}
                                                onChange={(e) => {
                                                    const value = e.target.value;

                                                    setGoalEntry(prev => ({
                                                        ...prev,
                                                        achievedUnit: value,

                                                    }));
                                                }}
                                                isRequired
                                                variant="bordered"
                                            />
                                            {
                                                DeptId == 5 || DeptId == 36 && (
                                                    <span className="ml-2 inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                                        Note: please enter .5 if it is a shared call
                                                    </span>
                                                )
                                            }

                                            <Button
                                                color="primary"
                                                size="sm"
                                                className="w-30 self-end"
                                                onClick={() => {
                                                    if (DeptId == 18 && !goalEntry.expectedUnit) {
                                                        addToast({
                                                            title: "Error",
                                                            description: "Please select a expected time ",
                                                            color: "danger",
                                                        });
                                                        return;
                                                    }
                                                    if (!goalEntry.goalID || !goalEntry.achievedUnit) {


                                                        addToast({
                                                            title: "Error",
                                                            description: "Please select a goal and enter achieved unit",
                                                            color: "danger",
                                                        });
                                                        return;
                                                    }

                                                    const newGoalActivity: ActivityEntry = {
                                                        id: Date.now().toString(),
                                                        task: "",
                                                        taskName: "",
                                                        customTask: "",
                                                        timeType: "",
                                                        customTime: "0",
                                                        setup: "1",
                                                        workDate: workDate.toString(),

                                                        goalID: goalEntry.goalID,
                                                        goalName: goalEntry.goalName,
                                                        unit: goalEntry.unit,
                                                        frequency: goalEntry.frequency,
                                                        achievedUnit: goalEntry.achievedUnit,
                                                        expectedUnit: goalEntry.expectedUnit,
                                                        isGoal: true,
                                                    };

                                                    setActivities((prev) => [...prev, newGoalActivity]);

                                                    // reset goal entry
                                                    setGoalEntry({
                                                        goalID: "",
                                                        goalName: "",
                                                        unit: "",
                                                        frequency: "",
                                                        achievedUnit: "",
                                                        expectedUnit: "",
                                                    });


                                                }}
                                            >
                                                Add Goal
                                            </Button>

                                        </div>
                                    )
                                )}








                                <Divider />

                                {/* Footer */}
                                <div className="flex justify-between items-center">
                                    <div className="text-lg font-semibold space-y-1">

                                        <div>
                                            <span className="text-gray-600 dark:text-gray-400">
                                                Total Logged
                                            </span>
                                            <span className="text-blue-600 dark:text-blue-400 mx-2">
                                                {(() => {
                                                    const totalHours = activities.reduce((sum, a) => {
                                                        // Skip target-based tasks
                                                        if (a.targetValue || a.percentage) return sum;

                                                        // For Unscheduled Tasks → add only customTime
                                                        if (a.isDynamic) {
                                                            return sum + Number(a.timeTaken || 0);
                                                        }

                                                        // For all other tasks → customTime * setup
                                                        return sum + (Number(a.customTime || 0) * Number(a.setup || 1));
                                                    }, 0);

                                                    return `${totalHours.toFixed(2)} mins`;
                                                })()}
                                            </span>

                                        </div>

                                        <div>
                                            <span className="text-gray-600 dark:text-gray-400">
                                                Total Time Taken
                                            </span>
                                            <span className="text-green-600 dark:text-green-400 mx-2">
                                                {(() => {
                                                    const totalTimeTaken = activities.reduce((sum, a) => {
                                                        return sum + Number(a.timeTaken || 0);
                                                    }, 0);
                                                    return `${totalTimeTaken.toFixed(2)} mins`;
                                                })()}
                                            </span>
                                        </div>
                                    </div>


                                    <Button
                                        color="primary"
                                        size="sm"
                                        onClick={() => {
                                            if (entryStep === "TASK") {
                                                setEntryStep("TARGET");
                                            } else if (entryStep === "TARGET") {
                                                setEntryStep("GOAL");
                                            } else {
                                                setEntryStep("TASK");
                                            }
                                        }}
                                    >
                                        {entryStep === "TASK" && "Next"}
                                        {entryStep === "TARGET" && "Next"}
                                        {entryStep === "GOAL" && "Back"}
                                    </Button>


                                </div>
                            </>
                        }

                    </CardBody>
                </Card >
                {/* Activities/PR List */}

                <Card className="lg:col-span-2 w-full shadow-md border border-gray-200 dark:border-gray-700 rounded-2xl overflow-x/y-auto;">
                    <CardBody className="px-6 pb-6" style={{ minHeight: "40pc", maxHeight: "40pc" }}>
                        {isTAModalOpen ? <>

                            {/* Filter Dropdown */}
                            <div
                                className="
        sticky
        top-[-12px]
        z-20
        flex
        items-center
        gap-3
        mb-5
        p-3
        px-2
        bg-white
        justify-between
        dark:bg-black
        
    "
                            >
                                <div className="flex">
                                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                        Status:
                                    </label>

                                    <Select
                                        aria-label="Status Filter"
                                        selectedKeys={
                                            new Set([statusFilter])
                                        }
                                        onSelectionChange={(keys) => {

                                            const value =
                                                Array.from(keys)[0];

                                            setStatusFilter(value);

                                            setPageNumberJd(1);
                                        }}
                                        size="sm"
                                        radius="lg"
                                        className="w-44"
                                        classNames={{
                                            trigger:
                                                "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700",
                                        }}
                                    >
                                        {[
                                            "ALL",
                                            "OPEN",
                                            "CLOSED",
                                            "PAUSED",
                                        ].map((status) => (

                                            <SelectItem
                                                key={status}
                                                value={status}
                                            >
                                                {status}
                                            </SelectItem>
                                        ))}
                                    </Select>
                                </div>

                                {/* Pagination */}
                                <div className="flex justify-end my-6 gap-2">
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        isDisabled={pageNumberJd === 1}
                                        onPress={() => setPageNumberJd((p) => p - 1)}
                                    >
                                        Prev
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        isDisabled={pageNumberJd === totalPages}
                                        onPress={() => setPageNumberJd((p) => p + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>

                            </div>

                            {/* Job Cards */}
                            {jobData.length > 0 ? (
                                <div className="flex flex-col justify-between h-full">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 p-3">
                                        {jobData.map((job) => (
                                            <div
                                                key={job.positionID}
                                                className="bg-white flex flex-col justify-between dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-5 hover:shadow-md transition"
                                            >
                                                <div>
                                                    {/* Header */}
                                                    <div className="flex justify-between items-start mb-3">
                                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                            {job.positionName}
                                                        </h3>
                                                        <span
                                                            className={`text-xs px-2 py-1 rounded-full font-medium
                  ${job.status === "OPEN"
                                                                    ? "bg-green-100 text-green-700"
                                                                    : job.status === "CLOSED"
                                                                        ? "bg-red-100 text-red-700"
                                                                        : "bg-yellow-100 text-yellow-700"
                                                                }`}
                                                        >
                                                            {job.status}
                                                        </span>
                                                    </div>

                                                    {/* JD Details */}
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                                                        {job.jdDetails || "No description available"}
                                                    </p>

                                                    {/* Meta */}
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-4">
                                                        <div><strong>ID:</strong> {job.positionID}</div>
                                                        <div><strong>Created:</strong> {job.openDate || "—"}</div>
                                                        {job.updatedAt && (
                                                            <div><strong>Updated:</strong> {job.updatedAt}</div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Footer */}
                                                <div className="flex justify-between items-center">
                                                    <Button
                                                        size="sm"
                                                        variant="flat"
                                                        color="primary"
                                                        onPress={() => openEditJDModal(job)}
                                                    >
                                                        Edit
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>


                                </div>
                            ) : (
                                <div className="flex flex-col h-full justify-between">
                                    <div className="text-center text-gray-500 py-10">No JD records found</div>
                                    {/* <div className="flex justify-end mt-6 gap-2">
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            isDisabled={pageNumberJd === 1}
                                            onPress={() => setPageNumberJd((p) => p - 1)}
                                        >
                                            Prev
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="flat"
                                            isDisabled={pageNumberJd === totalPages}
                                            onPress={() => setPageNumberJd((p) => p + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div> */}
                                </div>
                            )}
                        </> :
                            entryStep === "GOAL" && DeptId == 42 ? (<>
                                <EfficiencyTable
                                    data={admingoalList}
                                    type="admin"
                                    onEdit={handleEditTicket}
                                />
                            </>) : (
                                <> <div className="space-y-4 "  >
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <h3 className="  text-gray-900 dark:text-white" style={{ size: "12px" }}>
                                            Today's Activities
                                        </h3>
                                        <Button
                                            color="secondary"
                                            size="sm"

                                            className="px-8"
                                            onClick={async () => {

                                                //  FULL DAY → submit directly (no activities required)
                                                if (leaveType === "FULL_DAY") {
                                                    handleSubmitActivityLog();
                                                    return;
                                                }

                                                // ❌ No activities & not full day
                                                if (activities.length === 0) {
                                                    addToast({
                                                        title: "No Activities",
                                                        description: "Please add at least one activity or select Full Day leave.",
                                                        color: "warning",
                                                    });
                                                    return;
                                                }

                                                // ✅ Normal validation
                                                const canSubmit = await validateActivityDatesBeforeSubmit();
                                                if (canSubmit) {
                                                    handleSubmitActivityLog();
                                                }
                                            }}

                                        >
                                            update Log
                                        </Button>

                                    </div>

                                    {/* Modern Table */}
                                    <div className="overflow-x-auto overflow-y-auto max-h-[34rem] rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                                        <table className="min-w-full text-sm text-gray-800 dark:text-gray-200">
                                            <thead className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900" style={{ position: "sticky", top: 0, }}>
                                                <tr className="text-left">
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-gray-600 dark:text-gray-300">
                                                        No
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-gray-600 dark:text-gray-300">
                                                        Name
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-gray-600 dark:text-gray-300">
                                                        Type
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-gray-600 dark:text-gray-300">
                                                        Frequency / Count
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-gray-600 dark:text-gray-300">
                                                        Unit / Time
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-gray-600 dark:text-gray-300">
                                                        Achieved / Time Taken
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-gray-600 dark:text-gray-300">
                                                        Percentage / TAT
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-center text-gray-600 dark:text-gray-300">
                                                        Action
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {activities.length > 0 ? (<>{activities.map((activity, index) => (
                                                    <tr
                                                        key={activity.id}
                                                        className={`transition-all duration-150 ${activity.targetName
                                                            ? "bg-blue-50/60 dark:bg-blue-900/30"
                                                            : "bg-white dark:bg-gray-950"
                                                            } `}
                                                    >
                                                        <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-100">
                                                            {index + 1}.
                                                        </td>

                                                        <td className="px-4 py-3 font-medium">
                                                            {activity.goalName ||
                                                                activity.targetName ||
                                                                activity.taskName || "—"}
                                                        </td>


                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex px-2 py-1 text-xs rounded-md ${activity.isGoal
                                                                ? "bg-purple-100 text-purple-700"
                                                                : activity.targetName
                                                                    ? "bg-blue-100 text-blue-700"
                                                                    : "bg-gray-100 text-gray-700"
                                                                }`}>
                                                                {activity.isGoal ? "Goal" : activity.targetName ? "Target" : "Task"}
                                                            </span>

                                                        </td>

                                                        <td className="px-4 py-3">
                                                            {activity.targetName
                                                                ? activity.frequency || "-"
                                                                : activity.setup || 1}
                                                        </td>

                                                        <td className="px-4 py-3">

                                                            {(activity.targetName
                                                                ? activity.unit || "-"
                                                                : activity.goalID ? activity.expectedUnit || 0 : (() => {


                                                                    const base = activity.isDynamic
                                                                        ? Number(activity.timeTaken || 0)
                                                                        : Number(activity.customTime || 0);



                                                                    const setup = Number(activity.setup || 1);


                                                                    const total = base * setup;




                                                                    return total.toFixed(2) + " mins";
                                                                })())}
                                                        </td>



                                                        <td className="px-4 py-3">
                                                            {activity.targetName
                                                                ? activity.achievedUnit || 0
                                                                : activity.goalID ? activity.achievedUnit || 0 : `${Number(activity.timeTaken || 0).toFixed(2)} mins`}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {activity.targetName
                                                                ? `${((activity.achievedUnit / activity.unit) * 100).toFixed(2)} %`
                                                                : "N/A"}
                                                        </td>


                                                        <td className="px-4 py-3 text-center">
                                                            <Button
                                                                color="danger"
                                                                variant="light"
                                                                size="sm"
                                                                className="!p-0 w-7 h-7 rounded-full flex items-center justify-center font-bold "
                                                                onClick={() => handleRemoveActivity(activity.id)}
                                                            >
                                                                <svg fill="#ff0000" height="20px" width="20px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 457.503 457.503" xml:space="preserve" stroke="#ff0000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <g> <path d="M381.575,57.067h-90.231C288.404,25.111,261.461,0,228.752,0C196.043,0,169.1,25.111,166.16,57.067H75.929 c-26.667,0-48.362,21.695-48.362,48.362c0,26.018,20.655,47.292,46.427,48.313v246.694c0,31.467,25.6,57.067,57.067,57.067 h195.381c31.467,0,57.067-25.6,57.067-57.067V153.741c25.772-1.02,46.427-22.294,46.427-48.313 C429.936,78.761,408.242,57.067,381.575,57.067z M165.841,376.817c0,8.013-6.496,14.509-14.508,14.509 c-8.013,0-14.508-6.496-14.508-14.509V186.113c0-8.013,6.496-14.508,14.508-14.508c8.013,0,14.508,6.496,14.508,14.508V376.817z M243.26,376.817c0,8.013-6.496,14.509-14.508,14.509c-8.013,0-14.508-6.496-14.508-14.509V186.113 c0-8.013,6.496-14.508,14.508-14.508c8.013,0,14.508,6.496,14.508,14.508V376.817z M320.679,376.817 c0,8.013-6.496,14.509-14.508,14.509c-8.013,0-14.509-6.496-14.509-14.509V186.113c0-8.013,6.496-14.508,14.509-14.508 s14.508,6.496,14.508,14.508V376.817z"></path> </g> </g> </g></svg>
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}</>) : (<tr>
                                                    <td colSpan={8} className="py-10">
                                                        <div className="flex justify-center items-center">
                                                            <EmptyContainer
                                                                title="No Activities"
                                                                description="Select the filters to see the results"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>)}

                                            </tbody>
                                            <tfoot className="sticky bottom-0 bg-gray-50 dark:bg-gray-900  font-semibold">
                                                {/* <tr>
                                        <td colSpan="6" className="px-4 py-3 text-right">
                                            Average Percentage:
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {averagePercentage} %
                                        </td>
                                        <td></td>
                                    </tr> */}
                                                <tr className="text-left">
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-white-600 opcaity-0">

                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-white-600 ">
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-white-600 ">

                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-white-600 ">
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-white-600 ">
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-gray-600 dark:text-gray-300">

                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-gray-600 dark:text-gray-300 flex justify-center ">
                                                        Average Percentage: {averagePercentage} %
                                                    </th>
                                                    <th className="px-4 py-3 font-semibold tracking-wide text-center text-white-600 ">
                                                    </th>
                                                </tr>
                                            </tfoot>

                                        </table>
                                    </div>
                                </div></>)
                        }

                    </CardBody>
                </Card>
            </>)}

            {/* SALES CALL MODAL */}
            <Modal isOpen={isSalesModalOpen} onOpenChange={setIsSalesModalOpen} size="lg">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader> Add Sales Call</ModalHeader>

                            <ModalBody>

                                {/* USER SELECT */}
                                <Autocomplete
                                    label="User"
                                    placeholder="Select User..."
                                    selectedKey={selectedSalesPerson}
                                    onSelectionChange={(key) => {
                                        setSelectedSalesPerson(key);
                                        setErrors(prev => ({ ...prev, user: "" }));
                                    }}
                                    isInvalid={!!errors.user}
                                    errorMessage={errors.user}
                                    className="mb-4"
                                >
                                    {console.log("----- salesUser -----", salesUser)}
                                    {salesUser.map((u) => (
                                        <AutocompleteItem key={`${u.userID}`} value={u.userName}>
                                            {u.userName}
                                        </AutocompleteItem>
                                    ))}
                                </Autocomplete>

                                {/* PUBLISHER NAME */}
                                <Input
                                    aria-label="Publisher Name"
                                    label="Publisher Name"
                                    placeholder="Enter Publisher Name"
                                    type="text"
                                    className="mb-4"
                                    value={publisher}
                                    onChange={(e) => {
                                        setPublisher(e.target.value);
                                        setErrors(prev => ({ ...prev, publisher: "" }));
                                    }}
                                    isInvalid={!!errors.publisher}
                                    errorMessage={errors.publisher}
                                    variant="bordered"
                                />

                                {/* DATE PICKER */}
                                <DatePicker
                                    label="Event Date"
                                    aria-label="Event Date"
                                    value={duration}
                                    onChange={setDuration}
                                    className="max-w-xs mb-4"
                                    hideTimeZone
                                    isInvalid={!!errors.duration}
                                    errorMessage={errors.duration}
                                />

                                {/* SCHEDULE SELECT */}
                                <Autocomplete
                                    label="Schedule"
                                    placeholder="Select Schedule"
                                    selectedKey={scheduleType}
                                    onSelectionChange={(value) => {
                                        setScheduleType(value);
                                        setErrors(prev => ({ ...prev, schedule: "" }));
                                    }}
                                    isInvalid={!!errors.schedule}
                                    errorMessage={errors.schedule}
                                    className="mb-4"
                                >
                                    {schedule.map((t) => (
                                        <AutocompleteItem key={t.value} value={t.value}>
                                            {t.name}
                                        </AutocompleteItem>
                                    ))}
                                </Autocomplete>

                            </ModalBody>

                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>

                                <Button
                                    color="primary"
                                    onPress={() => {
                                        if (validateForm()) {
                                            handleSubmitSalesData();
                                            onClose();
                                        }
                                    }}
                                >
                                    Submit
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={isEditOpen} onOpenChange={setIsEditOpen}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Edit Ticket</ModalHeader>

                            <ModalBody>
                                <Input
                                    label="Title"
                                    value={selectedTicket?.title || ""}
                                    onChange={(e) =>
                                        setSelectedTicket({
                                            ...selectedTicket,
                                            title: e.target.value,
                                        })
                                    }
                                />

                                <Textarea
                                    label="Description"
                                    value={selectedTicket?.description || ""}
                                    onChange={(e) =>
                                        setSelectedTicket({
                                            ...selectedTicket,
                                            description: e.target.value,
                                        })
                                    }
                                />

                                <Select
                                    label="Status"
                                    selectedKeys={
                                        selectedTicket?.status ? [selectedTicket.status] : []
                                    }
                                    onSelectionChange={(keys) =>
                                        setSelectedTicket({
                                            ...selectedTicket,
                                            status: Array.from(keys)[0],
                                        })
                                    }
                                >
                                    <SelectItem key="OPEN">OPEN</SelectItem>
                                    <SelectItem key="CLOSED">CLOSED</SelectItem>
                                    <SelectItem key="PAUSED">PAUSED</SelectItem>
                                </Select>

                                {/* Optional: show openDate */}
                                <Input
                                    label="Open Date"
                                    value={selectedTicket?.openDate || ""}
                                    isDisabled
                                />
                            </ModalBody>

                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    Cancel
                                </Button>

                                <Button color="primary" onPress={handleUpdateTicket}>
                                    Update
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

        </div >
    );
}