import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { parseZonedDateTime } from "@internationalized/date";
import { Input } from "@/components/ui";
import WeeklyPulse from "./WeeklyPulse";
import { useLocation } from "react-router-dom";
import { Select, SelectItem, addToast, DatePicker, Autocomplete, Chip, CheckboxGroup, Modal, ModalHeader, ModalContent, ModalBody, ModalFooter, AutocompleteItem, Checkbox, RadioGroup, Radio, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@/components/ui";
import { CalendarDate } from "@internationalized/date";
import CustomDatePicker from "../components/customDatePicker"
import { Textarea } from "@/components/ui";
import { Divider } from "@heroui/divider";
import axios from "axios";
import EmptyContainer from "./EmptyContainer";
import { generateExcelTemplate, parseUploadedExcel } from "../lib/excelUtils";
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
    comment?: string;

    // Metadata for conditional rendering
    isDynamic?: boolean;
    isForTarget?: boolean;

    // Department-specific
    miscallenous?: string;
    NoOfPlayer?: string;
    dailyTaskLogID?: string;
    userGoalDataID?: string;
    remarks?: string;

    // Dept 36 specific
    companyName?: string;
    networkType?: string;
    tier?: string;
    networkEntries?: { companyName: string; networkType: string; tier: string }[];
}



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
    comment: string;
    companyName?: string;
    networkType?: string;
    tier?: string;
    networkEntries?: { companyName: string; networkType: string; tier: string }[];
}

type EntryStep = "TASK" | "TARGET" | "GOAL";

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

const getPrimaryDepartmentId = (u) => {
    if (Array.isArray(u?.departments) && u.departments.length > 0) {
        return u.departments[0].departmentID;
    }
    return u?.departmentID ?? null;
};

const toDDMMYYYY = (date: CalendarDate): string => {
    const y = date.year;
    const m = String(date.month).padStart(2, "0");
    const d = String(date.day).padStart(2, "0");
    return `${d}-${m}-${y}`;
};

const toYYYYMMDD = (date: CalendarDate): string => {
    const y = date.year;
    const m = String(date.month).padStart(2, "0");
    const d = String(date.day).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const TASK_SUB_TASKS: Record<number, { id: number; name: string; time: number }[]> = {
    552: [
        { id: 1, name: "Asset Issuance", time: 30 },
        { id: 2, name: "Office Tour", time: 20 },
        { id: 3, name: "HR Session Meeting Arrangement", time: 20 },
        { id: 4, name: "Biometric Registration", time: 20 },
        { id: 5, name: "ID Card / Business Card", time: 10080 },
        { id: 6, name: "Insurance Card", time: 21600 },
    ],
    545: [
        { id: 7, name: "Gmail Configuration", time: 20 },
        { id: 8, name: "MS Office Activation", time: 30 },
        { id: 9, name: "Gmail Creation", time: 20 },
        { id: 10, name: "Apps Download (Teams, GChat, Surfshark, etc.)", time: 20 },
        { id: 11, name: "User Creation & Password Setup", time: 30 },
    ],
    547: [
        { id: 12, name: "Password Resetting", time: 15 },
        { id: 13, name: "Collection of all IT Assets", time: 30 },
        { id: 14, name: "Deletion of Apps/Gmail", time: 20 },
        { id: 15, name: "Deletion of Account & Email Forwarding", time: 30 },
        { id: 16, name: "Biometric Registration Deletion", time: 20 },
        { id: 17, name: "Deletion of Insurance Card", time: 30 },
    ],
    544: [
        { id: 18, name: "Office Administration & Facility Management", time: 60 },
    ],
    546: [
        { id: 19, name: "IT Support & Issue Resolution", time: 2880 },
    ],
    548: [
        { id: 20, name: "Vendor Management & Procurement", time: 0 },
    ],
    549: [
        { id: 21, name: "Compliance & Documentation", time: 15 },
    ],
    550: [
        { id: 22, name: "HR Event Support & Coordination", time: 180 },
    ],
    551: [
        { id: 23, name: "Travel Booking & Coordination", time: 30 },
    ],
};

const SCHEDULE_OPTIONS = [
    { name: "SCHEDULED", value: "SCHEDULED" },
    { name: "COMPLETED", value: "COMPLETED" },
    { name: "NO SHOW", value: "NO_SHOW" },
    { name: "RESCHEDULED", value: "RESCHEDULED" },
    { name: "CANCELLED BY PUBLISHER", value: "CANCELLED_BY_PUBLISHER" },
    { name: "CANCELLED BY INTERNAL", value: "CANCELLED_BY_INTERNAL" },
];

const isTADept = (n: number) => n === 22;
const isTAMDept = (n: number) => n === 23;
const isSalesDept = (n: number) => [5, 6, 9, 36].includes(n);
export default function DailyActivityLog({ task, DeptId, selectedUserId, selectedUserRole }) {
    const location = useLocation();
    const updateData = location.state?.entryData;
    const [isHistoryEdit, setIsHistoryEdit] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [goalEntry, setGoalEntry] = useState<GoalEntry>({
        goalID: "",
        goalName: "",
        unit: "",
        expectedUnit: "",
        achievedUnit: "",
        frequency: "",
        comment: "",
        companyName: "",
        networkType: "",
        tier: "",
        networkEntries: [],
    });

    const [goals, setGoals] = useState<GoalEntry[]>([]);
    const [open, setOpen] = useState(false);
    const [selectedSubTasks, setSelectedSubTasks] = useState([]);

    const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
    const [isTAModalOpen, setIsTAModalOpen] = useState(false);
    const [isTAMModalOpen, setIsTAMModalOpen] = useState(false);
    const [selectedtask, setSelectedTask] = useState({})
    const [showMessage, setShowMessage] = useState(false);
    const [entryStep, setEntryStep] = useState<EntryStep>("TASK");
    const [activities, setActivities] = useState<ActivityEntry[]>([]);

    useEffect(() => {
        const authUserLD = localStorage.getItem("authUserLD");
        if (authUserLD) {
            const parsed = JSON.parse(authUserLD);
            if (parsed.userRole === 1) {
                setEntryStep("GOAL");
            }
        }
    }, []);

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
    const [average, setAverage] = useState({})
    const [reportData, setReportData] = useState<DailyTaskLog[]>([
    ]);
    const [totalRecords, settotalRecords] = useState(0)
    const [pageNumber, setPageNumber] = useState(1)

    const [pageSize, setPageSize] = useState(10)
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const [isTarget, setIsTarget] = useState<true | false | null>(null);
    const [selectedRows, setSelectedRows] = useState<Task[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

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
    const authUserLD = localStorage.getItem("authUserLD");
    const authUser = JSON.parse(authUserLD)
    const isSkipGoalStep =
        authUser.userRole !== 1 ||
        ([14, 31, 32].includes(DeptId) && ![1, 141].includes(authUser.userID));

    const isSkipTargetStep = [19, 20, 35].includes(DeptId) && authUser.userRole !== 1;

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
    const [tamForm, setTamForm] = useState({
        accountId: null,
        publisherName: "",
        status: "NOT_LIVE",
        userID: authUser.userID,
    });

    const [tamData, setTamData] = useState([]);
    const [isEditingTAM, setIsEditingTAM] = useState(false);
    const [admingoalList, setAdminGoalList] = useState([])
    const taskOptions = useMemo(
        () => (Array.isArray(task) && task.length > 0) ? [...task] : [],
        [task]
    );

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
                >
                    Edit
                </Button>
            )
        }


    ];
    const [frequencyValidation, setFrequencyValidation] = useState({
        isValid: true,
        message: "",
        targetFrequency: ""
    });
    const TAMColumns = [
        {
            key: "accountId",
            label: "ID"
        },
        {
            key: "publisherName",
            label: "Publisher"
        },
        {
            key: "status",
            label: "Status"
        },
        {
            key: "entryDate",
            label: "Entry Date"
        },
        {
            key: "liveDate",
            label: "Live Date"
        },
        {
            key: "action",
            label: "Action",
            renderCell: (row) => (
                <Button
                    size="sm"
                    onPress={() => openEditTAMModal(row)}
                >
                    Edit
                </Button>
            )
        }
    ];
    // Date validation helpers
    const isLastDayOfMonth = (date: CalendarDate): boolean => {
        const current = new Date(date.year, date.month - 1, date.day);
        const lastDay = new Date(date.year, date.month, 0); // last day of the month
        const end = new Date(lastDay);
        end.setDate(end.getDate() + 5); // allow 5 days after last day
        return current >= lastDay && current <= end;
    };

    const isWeeklyAllowed = (date: CalendarDate): boolean => {
        const d = new Date(date.year, date.month - 1, date.day);
        const dayOfWeek = d.getDay();
        // 1 = Monday, 5 = Friday
        return dayOfWeek === 1 || dayOfWeek === 5;
    };

    const isQuarterlyAllowed = (date: CalendarDate): boolean => {
        const current = new Date(date.year, date.month - 1, date.day);

        const quarterEnds = [
            new Date(date.year, 2, 31),  // Mar 31
            new Date(date.year, 5, 30),  // Jun 30
            new Date(date.year, 8, 30),  // Sep 30
            new Date(date.year, 11, 31), // Dec 31
        ];

        return quarterEnds.some((quarterEnd) => {
            const end = new Date(quarterEnd);
            end.setDate(end.getDate() + 5); // Allow 5 days after quarter end

            return current >= quarterEnd && current <= end;
        });
    };

    const validateTargetFrequency = (
        frequency: string,
        date: CalendarDate
    ): { isValid: boolean; message: string } => {
        switch (frequency.toUpperCase()) {
            case "DAILY":
                return { isValid: true, message: "" };

            case "WEEKLY":
                const isWeeklyValid = isWeeklyAllowed(date);
                return {
                    isValid: isWeeklyValid,
                    message: isWeeklyValid
                        ? ""
                        : "This Weekly target can only be added on Mondays or Fridays"
                };

            case "MONTHLY":
                const isMonthlyValid = isLastDayOfMonth(date);
                return {
                    isValid: isMonthlyValid,
                    message: isMonthlyValid
                        ? ""
                        : "This Monthly target can only be added within 5 days of the last day of the month"
                };

            case "QUARTERLY":
                const isQuarterlyValid = isQuarterlyAllowed(date);
                return {
                    isValid: isQuarterlyValid,
                    message: isQuarterlyValid
                        ? ""
                        : "This Quarterly target can only be added on quarter-end dates (Mar 31, Jun 30, Sep 30, Dec 31)"
                };

            default:
                return { isValid: true, message: "" };
        }
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




    useEffect(() => {
        const fetchTarget = async () => {
            try {
                const fallbackRes = await axios.post(
                    `/t2.0/authentificationUtilization/departmentTargets/getTargetsByDepartment`,
                    { departmentId: DeptId, roleId: selectedUserRole },
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


            catch (err) {
                console.error("Error fetching target:", err);
                setTarget([]);
                setIsShow(false);
                setShowMessage(true);
            }
        };
        fetchTarget();
        setShowMessage(false)

    }, [DeptId, workDate, selectedUserRole])

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const body = {
                    departmentID: DeptId || getPrimaryDepartmentId(authUser),
                    userID: authUser.userID,
                    startDate: null,
                    endDate: null,
                    isForTarget: null,
                    searchText: searchValue,
                    taskID: 0,
                    roleID: authUser.userRole,
                    eLID: 142,
                    isHeExecutiveLeader: authUser.isHeExecutiveLeader


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
                        updatedAt: log.updatedAt,
                        taskMeta: log.taskMeta ? log.taskMeta : [],
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
    }, [authUserLD, pageNumber, pageSize, isTarget, searchValue]);

    useEffect(() => {
        const fetchTAMData = async () => {
            try {
                const result = await axios.get(
                    `/t2.0/authentificationUtilization/tam/list?page=${pageNumberJd}&size=${pageSizeJd}&status=${statusFilter}`
                );

                setTamData(result.data.data);
                settotalRecordsJd(result.data.totalItems);
                setTotalPages(result.data.totalPages);

            } catch (err) {
                console.error(err);
            }
        };

        if (isTAMModalOpen) {
            fetchTAMData();
        }
    }, [pageNumberJd, pageSizeJd, statusFilter, isTAMModalOpen]);

    useEffect(() => {
        if (entryStep !== "GOAL") return;
        if (!DeptId) return;

        const fetchGoals = async () => {
            try {
                const bodyData = {
                    departmentId: DeptId,
                    roleId: selectedUserRole
                };

                const result = await axios.post(
                    "/t2.0/authentificationUtilization/departmentGoals/getGoalsByDepartment",
                    bodyData,
                    { headers: { "Content-Type": "application/json" } }
                );

                if (result) {
                    const goalList = result.data.result;

                    const filteredGoals =
                        (authUser.userRole === 3 && (DeptId === 19 || DeptId === 20))
                            ? goalList.filter((g: any) => Number(g.goalID) === 71 || Number(g.goalID) === 72)
                            : goalList.filter((g: any) => Number(g.goalID) !== 71 && Number(g.goalID) !== 72);

                    setGoals(
                        filteredGoals.map((g: any) => ({
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
    }, [entryStep, DeptId, selectedUserRole]);




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

                setSalesUser(formatted)



            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };
        if ((DeptId == 5 || DeptId == 6 || DeptId == 9 || DeptId == 36)) {

            fetchUsers();

        }

    }, [DeptId]);


    const handleAddActivity = useCallback(() => {
        if (tat) {
            setTat(false)
        }
        const hasValidTask =
            currentActivity.task && (currentActivity.task !== "custom" || currentActivity.customTask);

        const isTargetTask = selectedtask?.isForTarget;
        const isDynamicTask = selectedtask?.isDynamic;

        const hasValidTime = !isTargetTask && (currentActivity.customTime || currentActivity.timeType);
        const hasValidTarget = isTargetTask && currentActivity.percentage;

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
            workDate: toYYYYMMDD(workDate),

            taskName: currentActivity.task === "custom"
                ? currentActivity.customTask
                : currentActivity.taskName,

            totalTimePerSetup: timePerSetup,
            actualTimeOfWork: isTargetTask ? 0 : totalTime,

            // store them here
            isDynamic: isDynamicTask || false,
            isForTarget: isTargetTask || false,
            timeTaken: currentActivity.timeTaken,
            remark: currentActivity.remark,
            taskMeta: DeptId === 42 ? selectedSubTasks : null,

        };

        if (isHistoryEdit) {
            setActivities([
                {
                    ...newActivity,
                    dailyTaskLogID: currentActivity.dailyTaskLogID,
                },
            ]);
        } else {
            setActivities(prev => [...prev, newActivity]);
        }

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
        setSelectedSubTasks([]);

    }, [currentActivity, selectedtask, workDate, tat, isHistoryEdit, DeptId, selectedSubTasks]);

    const handleDownloadTemplate = async () => {
        const dateStr = toDDMMYYYY(workDate);

        await generateExcelTemplate(taskOptions, target, DeptId, dateStr);
        addToast({
            title: "Template Downloaded",
            description: `Activity log template for ${dateStr} has been downloaded.`,
            color: "success",
        });
    };

    const handleUploadExcel = useCallback(async (e) => {

        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { activities: parsedActivities, errors } = await parseUploadedExcel(
                file,
                taskOptions,
                target,
                DeptId
            );



            if (errors.length > 0) {
                addToast({
                    title: "Validation Errors",
                    description: `${errors.length} error(s) found. Please check the Reference sheet for valid values.`,
                    color: "warning",
                });
            }

            // Filter out rows with errors and convert to ActivityEntry format
            const validActivities = parsedActivities
                .filter((a) => !a.errors || a.errors.length === 0)
                .map((a) => {
                    // Use workDate from Excel if available, otherwise fall back to selected date
                    const entryDate = a.workDate || toYYYYMMDD(workDate);

                    if (a.type === "task") {
                        return {
                            id: Date.now().toString() + Math.random(),
                            task: a.taskID || "",
                            taskName: a.taskName || "",
                            customTask: "",
                            timeType: "",
                            customTime: String(a.customTime || 0),
                            timeTaken: String(a.timeTaken || 0),
                            remark: a.remark || "",
                            setup: String(a.setup || 1),
                            targetName: "",
                            targetID: "",
                            unit: "",
                            frequency: "",
                            achievedUnit: "",
                            workDate: entryDate,
                            isDynamic: false,
                            isForTarget: false,
                        };
                    } else {
                        return {
                            id: Date.now().toString() + Math.random(),
                            task: "",
                            taskName: "",
                            customTask: "",
                            timeType: "",
                            customTime: "0",
                            timeTaken: "0",
                            remark: a.remark || "",
                            setup: "1",
                            targetName: a.targetName || "",
                            targetID: a.targetID || "",
                            unit: String(a.unit || 0),
                            frequency: a.frequency || "",
                            achievedUnit: String(a.achievedUnit || 0),
                            workDate: entryDate,
                            isDynamic: false,
                            isForTarget: true,
                        };
                    }
                });

            if (validActivities.length === 0) {
                addToast({
                    title: "No Valid Activities",
                    description: "No valid activities found in the uploaded file.",
                    color: "warning",
                });
            } else {
                setActivities(validActivities);
                addToast({
                    title: "Upload Successful",
                    description: `${validActivities.length} activities imported. Review and submit.`,
                    color: "success",
                });
            }
        } catch (err) {
            console.error("Upload error:", err);
            addToast({
                title: "Upload Failed",
                description: "Failed to parse the uploaded file.",
                color: "danger",
            });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    }, [taskOptions, target, DeptId, workDate]);

    const handleSaveTAM = async () => {
        try {

            let response;

            if (isEditingTAM) {

                response = await axios.put(
                    "/t2.0/authentificationUtilization/tam/update",

                    tamForm,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""
                                }`,
                        },
                    }
                );

                addToast({
                    title: "Updated Successfully",
                    color: "success"
                });

            } else {

                response = await axios.post(
                    "/t2.0/authentificationUtilization/tam/create",
                    {
                        publisherName: tamForm.publisherName,
                        status: tamForm.status,
                        entryDate: `${workDate.year}-${String(workDate.month).padStart(2, "0")}-${String(workDate.day).padStart(2, "0")}`,
                        userID: authUser.userID
                    },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""
                                }`,
                        },
                    }
                );

                addToast({
                    title: "Created Successfully",
                    color: "success"
                });
            }

            setTamForm({
                accountId: null,
                publisherName: "",
                status: "NOT_LIVE",
                userID: authUser.userID
            });

            setIsEditingTAM(false);

        } catch (err) {
            console.error(err);
        }
    };
    const openEditTAMModal = (row) => {

        setIsEditingTAM(true);

        setTamForm({
            accountId: row.accountId,
            publisherName: row.publisherName,
            status: row.status,
            userID: authUser.userID
        });
    };
    const handleRemoveActivity = useCallback((id) => {
        setActivities(prev => prev.filter(a => a.id !== id));
    }, []);


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


    const handleSubmitActivityLog = async () => {
        try {
            const authUserLD = localStorage.getItem("authUserLD");
            const authUser = JSON.parse(authUserLD)
            const token = authUserLD ? JSON.parse(authUserLD).token : "";

            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
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
                        workDate: toYYYYMMDD(workDate),
                        userID: authUser.userRole == 1 ? Number(selectedUserId) : Number(authUser.userID),
                        departmentID: Number(DeptId || getPrimaryDepartmentId(authUser) || 0),
                        activities: [],
                        goals: [],
                    };
                }

                activities.forEach((activity) => {
                    let unit = Number(activity.unit || 0);

                    const achievedUnit = Number(activity.achievedUnit || 0);

                    const totalUnitValues =
                        unit > 0
                            ? Number(((achievedUnit / unit) * 100).toFixed(2))
                            : 0;

                    if (activity.isGoal) {
                        const goalPayload: any = {
                            goalID: Number(activity.goalID),
                            userID: authUser.userRole === 1
                                ?
                                Number(selectedUserId || authUser.userID) : Number(authUser.userID),
                            departmentID: Number(DeptId || getPrimaryDepartmentId(authUser) || 0),
                            workDate: activity.workDate || toYYYYMMDD(workDate),
                            achievedGoal: achievedUnit,
                            fixedGoal: unit,
                            frequency: activity.frequency,
                            totalUnitValues,
                            comment: activity.comment,
                        };

                        if (DeptId === 36) {
                            const entries = activity.networkEntries?.length
                                ? activity.networkEntries
                                : [{ companyName: activity.companyName || "", networkType: activity.networkType || "", tier: activity.tier || "" }];
                            goalPayload.metaData = entries;
                        }

                        goalsPayload.push(goalPayload);



                        return;
                    }

                    activitiesPayload.push({
                        dailyTaskLogID: activity.dailyTaskLogID,
                        taskID: Number(activity.task),
                        targetID: activity.targetID ? Number(activity.targetID) : null,
                        userID: authUser.userRole == 2 ? authUser.userID : Number(selectedUserId || authUser.userID),
                        workDate: activity.workDate || toYYYYMMDD(workDate),
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
                        departmentID: Number(DeptId || getPrimaryDepartmentId(authUser) || 0),
                        totalUnitValues,
                        taskMeta: DeptId === 42 ? activity.taskMeta : null,

                    });
                });

                return {
                    activities: activitiesPayload,
                    goals: goalsPayload,
                };
            };


            const payload = payloadformat();

            const departmentId = DeptId; // make dynamic later
            let result;
            const url = isHistoryEdit
                ? "/t2.0/authentificationUtilization/form/bulkUpdate"
                : "/t2.0/authentificationUtilization/form/bulkWork";

            const method = isHistoryEdit ? "patch" : "post";

            result = await axios({
                url,
                method,
                data: payload,
                headers,
            });





            addToast({
                title: "Success",
                description: "Activity log submitted successfully!",
                color: "success",

            });

            setLeaveType("NONE")
            setActivities([]);
            setIsHistoryEdit(false);

        } catch (error) {
            console.error(error);

            addToast({
                title: "Error",
                description: "Failed to submit activity log.",
                color: "danger",

            });
        }
    };

    const handleAppendGoal = async (
        goalID: number,
        userID: number,
        achievedGoal: number | string,
        comment: string
    ) => {
        try {
            const token = authUserLD ? JSON.parse(authUserLD).token : "";

            await axios.put(
                `/t2.0/authentificationUtilization/form/goal/update`,
                {
                    goalId: goalID,
                    userId: userID,
                    achievedGoal: Number(achievedGoal),
                    workDate: toYYYYMMDD(workDate),
                    comment: comment,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            addToast({
                title: "Success",
                description: "Goal updated successfully.",
                color: "success",
            });
        } catch (err) {
            console.error(err);

            addToast({
                title: "Error",
                description: "Failed to update goal.",
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

    const { totalPercentages, targetCount, averagePercentage } = useMemo(() => {
        const filtered = activities.filter((a) => a.targetName && Number(a.unit) > 0);
        const total = filtered.reduce((sum, a) => {
            const achieved = Number(a.achievedUnit || 0);
            const unit = Number(a.unit || 0);

            if (String(a.targetID) === "92") {
                const raw = Math.round((achieved / unit) * 100);
                return sum + Math.max(raw >= 90 ? 100 : 100 - (90 - raw), 0);
            }
            if (String(a.targetID) === "93") {
                const raw = Math.round((achieved / unit) * 100);
                return sum + Math.max(100 - raw, 0);
            }
            return sum + (achieved / unit) * 100;
        }, 0);
        const count = filtered.length;
        return {
            totalPercentages: total,
            targetCount: count,
            averagePercentage: count > 0 ? (total / count).toFixed(2) : 0,
        };
    }, [activities]);

    useEffect(() => {
        if (!targetAchieved) {
            setCurrentActivity(prev => ({
                ...prev,
                achievedUnit: "",
                unit: "",
                frequency: "",
            }));
        }
    }, [targetAchieved]);

    // Add a useEffect to re-validate when workDate changes
    useEffect(() => {
        if (currentActivity.targetID && currentActivity.targetName) {
            const selectedTarget = target.find(
                t => String(t.targetID) === String(currentActivity.targetID)
            );

            if (selectedTarget) {
                const validation = validateTargetFrequency(
                    selectedTarget.frequency,
                    workDate
                );

                setFrequencyValidation({
                    isValid: validation.isValid,
                    message: validation.message,
                    targetFrequency: selectedTarget.frequency
                });
            }
        }
    }, [workDate, currentActivity.targetID]);

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
                    openDate: toDDMMYYYY(workDate)

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
                    openDate: toDDMMYYYY(workDate)
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


    const getUnitValue = () => {
        // const targetActivity = activities.find(
        //     (a) => String(a.targetID) === "68"
        // );

        // const targetUnit = Number(
        //     targetActivity?.achievedUnit || 0
        // );


        // if (String(currentActivity.targetID) === "78") {

        //     const selectedTarget = target.find(
        //         t => String(t.targetID) === "78"
        //     );

        //     const calculated = Number(selectedTarget?.unit || 0);

        //     return String(calculated);
        // }


        return currentActivity.unit;
    };

    // useEffect(() => {

    //     if (String(currentActivity.targetID) === "78") {

    //         const targetActivity = activities.find(
    //             (a) => String(a.targetID) === "68"
    //         );

    //         const targetUnit = Number(
    //             targetActivity?.achievedUnit || 0
    //         );

    //         const selectedTarget = target.find(
    //             t => String(t.targetID) === "78"
    //         );

    //         const maxUnit = Number(selectedTarget?.unit || 0);

    //         const calculated =
    //             maxUnit - (targetUnit * 2);

    //         setCurrentActivity(prev => ({
    //             ...prev,
    //             unit: String(calculated),
    //         }));
    //     }

    // }, [
    //     currentActivity.targetID,
    //     activities,
    //     target
    // ]);

    const markAsLive = async (accountId) => {
        try {
            await axios.put(
                "/t2.0/authentificationUtilization/tam/update",
                {
                    accountId,
                    status: "LIVE",
                    userID: authUser.userID
                }
            );

            addToast({
                title: "Success",
                description: "Account marked as LIVE",
                color: "success"
            });

            // fetchTAMData();

        } catch (err) {
            console.error(err);
        }
    };



    const isFirstDept13Target =
        DeptId == 13 &&
        activities.filter(a => a.targetID).length === 0;


    const handleEditHistory = (activity) => {
        const selectedTask = taskOptions.find(
            t => String(t.taskID) === String(activity.taskID)
        );

        setSelectedTask(selectedTask);

        setEntryStep("TASK");

        setWorkDate(parseWorkDate(activity.workDate));
        const subTasks = TASK_SUB_TASKS[Number(activity.taskID)] || [];



        const checked = subTasks
            .filter(st => activity.taskMeta.includes(st.id))
            .map(st => st.id);



        setSelectedSubTasks(checked);
        setCurrentActivity({
            dailyTaskLogID: activity.dailyTaskLogID,
            task: String(activity.taskID),
            taskName: activity.taskName,
            customTime: String(activity.allocatedTime),
            timeTaken: String(activity.timeTakenToWork),
            setup: String(activity.setUp || 1),
            remark: activity.remarks,
            achievedUnit: String(activity.achievedUnits || ""),
            unit: String(activity.units || ""),
            targetID: activity.targetID ? String(activity.targetID) : "",
        });


        setIsHistoryEdit(true);
        setShowForm(true);
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
                                <p className="text-sm text-ink-600 dark:text-ink-300">
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
                                <p className="text-ink-900 dark:text-white text-sm font-medium">
                                    Daily Activity {getPrimaryDepartmentId(authUser) ? "" : "Log"}
                                </p>

                                {/* Half-Day Switch */}


                                {/* Sales Call Button */}
                                {/* {(isSalesDept(DeptId) || isSalesDept(getPrimaryDepartmentId(authUser))) && (
                                    <Button
                                        color="primary"
                                        variant="flat"
                                        size="sm"
                                        onPress={() => setIsSalesModalOpen(true)}
                                    >
                                        Add Sales Call
                                    </Button>
                                )} */}
                                {/* {(isTADept(DeptId) || isTADept(getPrimaryDepartmentId(authUser))) && (
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
                                {(isTAMDept(DeptId) || isTAMDept(getPrimaryDepartmentId(authUser))) && (
                                    <Button
                                        color="primary"
                                        variant="flat"
                                        size="sm"
                                        startContent={<SwitchIcon />}
                                        onPress={() => setIsTAMModalOpen(!isTAMModalOpen)}
                                    >
                                        {isTAMModalOpen ? "close" : " Switch to TAM Target"}
                                    </Button>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                    onChange={handleUploadExcel}
                                />
                                <Button
                                    color="success"
                                    variant="flat"
                                    size="sm"
                                    isLoading={isUploading}
                                    onPress={() => fileInputRef.current?.click()}
                                >
                                    {isUploading ? "Uploading..." : "import"}
                                </Button>
                                <Button
                                    color="secondary"
                                    variant="flat"
                                    size="sm"
                                    onPress={handleDownloadTemplate}
                                >
                                    export template
                                </Button>


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
                                                        {toDDMMYYYY(workDate)}
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
                            </> : isTAMModalOpen ? <> <div className="flex flex-col gap-4">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault(); //  prevent reload
                                        handleSaveTAM();
                                    }}
                                >
                                    <div className="flex flex-col gap-4">

                                        <Input
                                            label="Publisher Name"
                                            value={tamForm.publisherName}
                                            onChange={(e) =>
                                                setTamForm({
                                                    ...tamForm,
                                                    publisherName: e.target.value
                                                })
                                            }
                                        />

                                        <Select
                                            label="Status"
                                            selectedKeys={[tamForm.status]}
                                            onSelectionChange={(keys) =>
                                                setTamForm({
                                                    ...tamForm,
                                                    status: Array.from(keys)[0]
                                                })
                                            }
                                        >
                                            <SelectItem key="NOT_LIVE">NOT LIVE</SelectItem>
                                            <SelectItem key="LIVE">LIVE</SelectItem>
                                        </Select>

                                        {/* DATE */}
                                        <label>Opening Date</label>
                                        <Dropdown
                                            isOpen={open}
                                            onOpenChange={setOpen}
                                            closeOnSelect={false}
                                        >
                                            <DropdownTrigger>
                                                <Button variant="bordered" className="w-full justify-between">
                                                    {toDDMMYYYY(workDate)}
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
                            </div></> : <>

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
                                        <h3 className=" text-ink-900 dark:text-white" style={{ size: "12px" }}>
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
                                                    {toDDMMYYYY(workDate)}
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
                                        <h3 className=" text-ink-900 dark:text-white" style={{ size: "12px" }}>
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

                                                {DeptId != 42 && (<>
                                                    <Input
                                                        label="Task Count"
                                                        type="number"
                                                        min="1"
                                                        max="150"
                                                        placeholder="1"
                                                        onWheel={(e) => e.target.blur()}
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
                                                </>)}

                                            </div>
                                        )}
                                        {DeptId && (<>

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
                                                        onWheel={(e) => e.target.blur()}

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
                                        </>)}
                                        {DeptId === 42 && TASK_SUB_TASKS[currentActivity?.task] && (
                                            <>
                                                <CheckboxGroup
                                                    label="Complete the sub tasks"
                                                    value={selectedSubTasks}
                                                    onValueChange={(values) => {
                                                        setSelectedSubTasks(values);

                                                        // Total completed time (checked subtasks)
                                                        const selectedTime = TASK_SUB_TASKS[currentActivity.task]
                                                            .filter((st) => values.includes(st.id))
                                                            .reduce((sum, st) => sum + (Number(st.time) || 0), 0);

                                                        // Total standard time (all subtasks)
                                                        const standardTime = TASK_SUB_TASKS[currentActivity.task]
                                                            .reduce((sum, st) => sum + (Number(st.time) || 0), 0);
                                                        var remarkValue = ""
                                                        if (selectedTime == standardTime) {
                                                            remarkValue = "complete"

                                                        }
                                                        else {
                                                            remarkValue = "pending"
                                                        }

                                                        setCurrentActivity((prev) => ({
                                                            ...prev,
                                                            achievedUnit: String(selectedTime), // Completed time
                                                            timeTaken: String(selectedTime),    // Completed time
                                                            customTime: String(standardTime),   // Total standard time
                                                            remark: remarkValue,          // Optional: save completed subtasks
                                                        }));
                                                    }}
                                                >
                                                    {TASK_SUB_TASKS[currentActivity.task].map((subTask) => (
                                                        <Checkbox key={subTask.id} value={subTask.id}>
                                                            <div className="flex justify-between items-center w-full">
                                                                <span>{subTask.name}</span>
                                                                <span className="text-default-500 text-sm ml-4">
                                                                    {typeof subTask.time === "number"
                                                                        ? `${subTask.time} mins`
                                                                        : subTask.time}
                                                                </span>
                                                            </div>
                                                        </Checkbox>
                                                    ))}
                                                </CheckboxGroup>
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


                                                {!selectedtask?.isForTarget && (
                                                    <div>
                                                        <Input
                                                            label="Time Taken (mins)"
                                                            placeholder="Enter time"
                                                            type="number"
                                                            min="0"
                                                            step="0.001"
                                                            onWheel={(e) => e.target.blur()}

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
                                            </>
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


                                                    DeptId === 42
                                                        ? !currentActivity.task
                                                        : (!currentActivity.task ||


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
                                                            ))


                                                }


                                            >
                                                Add Activity
                                            </Button>

                                        </div>

                                    </div>
                                )}

                                {entryStep === "TARGET" && !isSkipTargetStep && (
                                    <div
                                    >

                                        <h3 className="text-ink-900 dark:text-white mb-4 text-sm">
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

                                                const selectedTarget = target.find(
                                                    (t) => String(t.targetID) === String(key)
                                                );

                                                if (!selectedTarget) return;

                                                const isTargetAchievedDept = (DeptId == 14 || DeptId == 32 || DeptId == 31) && (authUser.userRole != 2);

                                                let newAchievedUnit = "";
                                                let newUnit = selectedTarget.unit;
                                                let newFrequency = selectedTarget.frequency;

                                                if (isTargetAchievedDept) {
                                                    setTargetAchieved(true);
                                                    newUnit = "100";
                                                    newFrequency = "Daily";
                                                }

                                                setCurrentActivity(prev => ({
                                                    ...prev,
                                                    targetID: selectedTarget.targetID,
                                                    targetName: selectedTarget.targetName,
                                                    frequency: newFrequency,
                                                    unit: newUnit,
                                                    achievedUnit: newAchievedUnit,
                                                }));
                                            }}
                                            className="mb-4"
                                        >
                                            {
                                                DeptId == 13
                                                    ? target
                                                        .filter(
                                                            (t) =>
                                                                !activities.some(
                                                                    (a) =>
                                                                        String(a.targetID) === String(t.targetID)
                                                                )
                                                        )
                                                        .map((t) => (
                                                            <AutocompleteItem
                                                                key={String(t.targetID)}
                                                                value={t.targetName}
                                                            >
                                                                {t.targetName}
                                                            </AutocompleteItem>
                                                        ))
                                                    : target.map((t) => (
                                                        <AutocompleteItem
                                                            key={String(t.targetID)}
                                                            value={t.targetName}
                                                        >
                                                            {t.targetName}
                                                        </AutocompleteItem>
                                                    ))
                                            }

                                        </Autocomplete>

                                        <div className="mb-3">
                                            {currentActivity.targetName && frequencyValidation.message && (
                                                <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700">
                                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                                        {frequencyValidation.message}
                                                    </p>
                                                </div>
                                            )}

                                            {currentActivity.targetName && frequencyValidation.isValid && (
                                                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700">
                                                    <p className="text-sm text-green-800 dark:text-green-200">
                                                        ✓ {frequencyValidation.targetFrequency} target - Date is valid for adding data
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        {/* {currentActivity.targetID && currentActivity.targetName && isshow && (

                                    <Checkbox className="my-2" checked={targetAchieved}
                                        onChange={(e) => setTargetAchieved(e.target.checked)}> is Target achieved?{targetAchieved}</Checkbox>
                                )} */}


                                        {/* {(DeptId == 19 || DeptId == 20 || DeptId == 25 || DeptId == 26) && (
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

                                        )} */}


                                        {/* {DeptId == 26 && (
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
                                        )} */}
                                        {/* Unit - auto-filled, disabled */}
                                        <Input
                                            label={DeptId == 23 ? "live account count" : "unit"}

                                            value={getUnitValue()}

                                            disabled={(DeptId == 20 || DeptId == 35 || DeptId == 19) ? false : true}
                                            onChange={(e) => {

                                                const value = e.target.value;

                                                // prevent negative
                                                if (Number(value) < 0) return;

                                                setCurrentActivity(prev => ({
                                                    ...prev,
                                                    unit: value,
                                                }));

                                            }}

                                            placeholder={
                                                String(currentActivity.targetID) === "78"
                                                    ? "Unit auto calculated"
                                                    : DeptId == 19
                                                        ? "Enter the # tag requests received"
                                                        : "Enter unit"
                                            }

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
                                            label={DeptId == 19 ? "Tag Request Worked With" : "Achieved Unit"}
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            placeholder={DeptId == 19 ? "Tag Request Worked With" : "Achieved Unit"}
                                            value={currentActivity.achievedUnit}
                                            onChange={(e) => {
                                                const value = e.target.value;

                                                if (Number(value) < 0) return;

                                                setCurrentActivity(prev => ({
                                                    ...prev,
                                                    achievedUnit: value,
                                                }));
                                            }}
                                            className="mb-4"
                                            onWheel={(e) => e.currentTarget.blur()}
                                            variant="bordered"
                                            isRequired
                                        />

                                        <Input
                                            label="Remarks"
                                            placeholder="Enter details"
                                            type="text"
                                            isRequired
                                            className="mb-4"
                                            value={currentActivity.remark}
                                            onChange={(e) =>
                                                setCurrentActivity({ ...currentActivity, remark: e.target.value })
                                            }

                                            variant="bordered"
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
                                                    if (DeptId == 19 || DeptId == 20 || DeptId == 25 || DeptId == 26) {
                                                        if (!currentActivity.remark?.trim()) {
                                                            addToast({
                                                                title: "Error",
                                                                description: "Please enter remark",
                                                                color: "danger",
                                                            });
                                                            return;
                                                        }
                                                    }
                                                    if (!frequencyValidation.isValid) {
                                                        addToast({
                                                            title: "Date Restriction",
                                                            description: frequencyValidation.message,
                                                            color: "warning",
                                                        });
                                                        return;
                                                    }
                                                    let calculatedUnit =
                                                        String(currentActivity.targetID) === "78"
                                                            ? getUnitValue()
                                                            : currentActivity.unit;

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
                                                isDisabled={DeptId == 42 || (currentActivity.targetName && currentActivity.frequency ? !validateTargetFrequency(currentActivity.frequency, workDate).isValid : false)}
                                            >
                                                Add Target
                                            </Button>
                                        </div>



                                    </div>
                                )}
                                {entryStep === "GOAL" && (


                                    <div className="flex flex-col gap-4">
                                        <h3 className="text-ink-900 dark:text-white text-sm">
                                            Add Goal Entry
                                        </h3>


                                        <Autocomplete
                                            label="Goal Name"
                                            placeholder="Select Goal"
                                            selectedKey={goalEntry.goalID}
                                            onSelectionChange={(key) => {
                                                const g = goals.find(
                                                    goal => goal.goalID === String(key)
                                                );

                                                if (!g) return;

                                                const totalAchievedUnit = activities
                                                    .filter(a => a.targetID)
                                                    .reduce(
                                                        (sum, a) => sum + Number(a.achievedUnit || 0),
                                                        0
                                                    );

                                                if (
                                                    DeptId == 43 ||
                                                    DeptId == 44 ||
                                                    DeptId == 49 ||
                                                    DeptId == 25 ||
                                                    DeptId == 26
                                                ) {
                                                    setGoalEntry(prev => ({
                                                        ...prev,
                                                        goalID: g.goalID,
                                                        goalName: g.goalName,
                                                        frequency: g.frequency,
                                                        achievedUnit: "",
                                                        unit: g.unit,
                                                    }));
                                                } else {
                                                    setGoalEntry(prev => ({
                                                        ...prev,
                                                        goalID: g.goalID,
                                                        goalName: g.goalName,
                                                        unit: g.unit,
                                                        frequency: g.frequency,
                                                        achievedUnit: "",
                                                    }));
                                                }
                                            }}
                                        >
                                            {goals.map((g) => (
                                                <AutocompleteItem key={g.goalID} value={g.goalName}>
                                                    {g.goalName}
                                                </AutocompleteItem>
                                            ))}
                                        </Autocomplete>

                                        {DeptId == 43 || DeptId == 44 || DeptId == 49 || DeptId == 25 || DeptId == 26 ? (<Input
                                            label="revenue generated previous week"
                                            value={goalEntry.unit}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setGoalEntry(prev => ({
                                                    ...prev,
                                                    unit: value,
                                                }))
                                            }}

                                            variant="bordered"
                                        />) : DeptId == 13 ? (<Input
                                            label={"Unit"}
                                            value={goalEntry.unit}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setGoalEntry(prev => ({
                                                    ...prev,
                                                    unit: value,
                                                }))
                                            }}
                                            isDisabled={![16, 1].includes(DeptId)}
                                            variant="bordered"
                                        />) : (
                                            <Input
                                                label={DeptId == 1 ? "Daily Budget" : "Unit"}
                                                value={goalEntry.unit}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setGoalEntry(prev => ({
                                                        ...prev,
                                                        unit: value,
                                                    }))
                                                }}
                                                isDisabled={![16, 1].includes(DeptId)}
                                                variant="bordered"
                                            />
                                        )}


                                        <Input
                                            label="Frequency"
                                            value={goalEntry.frequency}
                                            isDisabled
                                            variant="bordered"
                                        />

                                        {/* {DeptId == 59 || DeptId == 60  && (
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
                                            )} */}

                                        <Input
                                            label={DeptId == 43 || DeptId == 44 || DeptId == 49 || DeptId == 25 || DeptId == 26 ? "revenue achieved" : "Achieved Unit"} type={"number"}
                                            value={goalEntry.achievedUnit}
                                            onChange={(e) => {
                                                const value = e.target.value;

                                                setGoalEntry(prev => ({
                                                    ...prev,
                                                    achievedUnit: value,

                                                }));
                                            }}
                                            isRequired
                                            onWheel={(e) => e.target.blur()}

                                            variant="bordered"
                                        />

                                        <Textarea
                                            label="Comment"
                                            placeholder="Enter comment"
                                            value={goalEntry.comment}
                                            onChange={(e) =>
                                                setGoalEntry({
                                                    ...goalEntry,
                                                    comment: e.target.value,
                                                })
                                            }
                                        />

                                        {DeptId == 36 && (
                                            <>
                                                {(goalEntry.networkEntries || []).length > 0 && (
                                                    <div className="flex flex-col gap-2 w-full">
                                                        <p className="text-xs font-semibold text-default-700">Added Entries</p>
                                                        {goalEntry.networkEntries!.map((entry, idx) => (
                                                            <div key={idx} className="flex items-center gap-2 bg-default-100 border border-divider rounded-lg px-3 py-2">
                                                                <span className="text-sm font-medium truncate flex-1">
                                                                    {entry.companyName || "—"} · {entry.networkType || "—"} · {entry.tier || "—"}
                                                                </span>
                                                                <Button
                                                                    isIconOnly
                                                                    size="sm"
                                                                    color="danger"
                                                                    variant="light"
                                                                    onPress={() => {
                                                                        setGoalEntry({
                                                                            ...goalEntry,
                                                                            networkEntries: goalEntry.networkEntries!.filter((_, i) => i !== idx),
                                                                        });
                                                                    }}
                                                                >
                                                                    ✕
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <Input
                                                    label="Company Name"
                                                    placeholder="Enter company name"
                                                    value={goalEntry.companyName}
                                                    onChange={(e) =>
                                                        setGoalEntry({
                                                            ...goalEntry,
                                                            companyName: e.target.value,
                                                        })
                                                    }
                                                    variant="bordered"
                                                />

                                                <RadioGroup
                                                    label="Network Type"
                                                    orientation="horizontal"
                                                    value={goalEntry.networkType}
                                                    onValueChange={(val) =>
                                                        setGoalEntry({
                                                            ...goalEntry,
                                                            networkType: val,
                                                        })
                                                    }
                                                >
                                                    <Radio value="network">Network</Radio>
                                                    <Radio value="publisher">Publisher</Radio>
                                                </RadioGroup>

                                                <Select
                                                    label="Tier"
                                                    placeholder="Select Tier"
                                                    selectedKeys={goalEntry.tier ? [goalEntry.tier] : []}
                                                    onSelectionChange={(keys) => {
                                                        const selected = Array.from(keys)[0] as string;
                                                        setGoalEntry({
                                                            ...goalEntry,
                                                            tier: selected,
                                                        });
                                                    }}
                                                    variant="bordered"
                                                >
                                                    <SelectItem key="tier1">Tier 1</SelectItem>
                                                    <SelectItem key="tier2">Tier 2</SelectItem>
                                                    <SelectItem key="tier3">Tier 3</SelectItem>
                                                    <SelectItem key="tier4">Tier 4</SelectItem>
                                                    <SelectItem key="tier5">Tier 5</SelectItem>
                                                </Select>

                                                <Button
                                                    size="sm"
                                                    color="secondary"
                                                    variant="flat"
                                                    onPress={() => {
                                                        if (!goalEntry.companyName || !goalEntry.networkType || !goalEntry.tier) {
                                                            addToast({
                                                                title: "Error",
                                                                description: "Please fill company name, network type and tier before adding",
                                                                color: "danger",
                                                            });
                                                            return;
                                                        }
                                                        setGoalEntry({
                                                            ...goalEntry,
                                                            networkEntries: [
                                                                ...(goalEntry.networkEntries || []),
                                                                {
                                                                    companyName: goalEntry.companyName,
                                                                    networkType: goalEntry.networkType,
                                                                    tier: goalEntry.tier,
                                                                },
                                                            ],
                                                            companyName: "",
                                                            networkType: "",
                                                            tier: "",
                                                        });
                                                    }}
                                                >
                                                    + Add Entry
                                                </Button>
                                            </>
                                        )}

                                        <Button
                                            color="primary"
                                            size="sm"
                                            className="w-30 self-end"
                                            onClick={() => {

                                                if (!goalEntry.goalID || !goalEntry.achievedUnit) {


                                                    addToast({
                                                        title: "Error",
                                                        description: "Please select a goal and enter achieved unit",
                                                        color: "danger",
                                                    });
                                                    return;
                                                }
                                                const totalAchievedUnit = activities
                                                    .filter(a => a.targetID)
                                                    .reduce(
                                                        (sum, a) => sum + Number(a.achievedUnit || 0),
                                                        0
                                                    );

                                                const calculatedGoalUnit = (
                                                    totalAchievedUnit * 0.7
                                                ).toFixed(2);

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
                                                    comment: goalEntry.comment,
                                                    companyName: goalEntry.companyName,
                                                    networkType: goalEntry.networkType,
                                                    tier: goalEntry.tier,
                                                    networkEntries: goalEntry.networkEntries || [],

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
                                                    companyName: "",
                                                    networkType: "",
                                                    tier: "",
                                                    networkEntries: [] as { companyName: string; networkType: string; tier: string }[],
                                                });


                                            }}
                                        >
                                            Add Goal
                                        </Button>

                                    </div>
                                )
                                }








                                <Divider />

                                {/* Footer */}
                                <div className="flex justify-between items-center">
                                    <div className="text-lg font-semibold space-y-1">

                                        <div>
                                            <span className="text-ink-600 dark:text-ink-400">
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
                                            <span className="text-ink-600 dark:text-ink-400">
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


                                    <div className="flex gap-2">

                                        {entryStep !== "TASK" && (
                                            <Button
                                                color="default"
                                                size="sm"
                                                onClick={() => {

                                                    if (entryStep === "TARGET") {
                                                        setEntryStep("TASK");
                                                    } else if (entryStep === "GOAL") {
                                                        setEntryStep(isSkipTargetStep ? "TASK" : "TARGET");
                                                    }

                                                }}
                                            >
                                                Back
                                            </Button>
                                        )}

                                        {entryStep !== "GOAL" &&
                                            !(entryStep === "TARGET" && isSkipGoalStep) && (
                                                <Button
                                                    color="primary"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (entryStep === "TASK") {
                                                            setEntryStep(isSkipTargetStep ? "GOAL" : "TARGET");
                                                        } else if (entryStep === "TARGET") {
                                                            setEntryStep("GOAL");
                                                        }
                                                    }}
                                                >
                                                    Next
                                                </Button>
                                            )}

                                    </div>


                                </div>
                            </>
                        }

                    </CardBody>
                </Card >
                {/* Activities/PR List */}

                <Card className="lg:col-span-2 w-full shadow-md border border-ink-200 dark:border-ink-700 rounded-2xl overflow-x/y-auto;">
                    <CardBody className="px-6 pb-6" style={{ minHeight: "40pc", maxHeight: "40pc" }}>
                        <>
                            <div className="flex items-center justify-between">
                                <h3 className="  text-ink-900 dark:text-white" style={{ size: "12px" }}>
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

                                            let allTargetsMapped = true;
                                            let allGoalgetsMapped = true;

                                            if (!allGoalgetsMapped) {

                                                addToast({
                                                    title: "Goal Mismatch",
                                                    description: "All goals must be added in activities.",
                                                    color: "warning"
                                                });

                                                return;
                                            }


                                            if (!allTargetsMapped) {

                                                addToast({
                                                    title: "Target Mismatch",
                                                    description: "All targets must be added in activities.",
                                                    color: "warning"
                                                });

                                                return;
                                            }

                                            handleSubmitActivityLog();
                                        }
                                    }}

                                >
                                    {authUser.userID == 141 ? "Append Goals" : "Submit Log"}
                                </Button>

                            </div>

                            {/* Modern Table */}
                            <div className="overflow-x-auto overflow-y-auto max-h-[34rem] rounded-xl border border-ink-100 dark:border-ink-800 shadow-sm">
                                <table className="min-w-full text-sm text-ink-800 dark:text-ink-200">
                                    <thead className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900" style={{ position: "sticky", top: 0, }}>
                                        <tr className="text-left">
                                            <th className="px-4 py-3 font-semibold tracking-wide text-ink-600 dark:text-ink-300">
                                                No
                                            </th>
                                            <th className="px-4 py-3 font-semibold tracking-wide text-ink-600 dark:text-ink-300">
                                                Date
                                            </th>
                                            <th className="px-4 py-3 font-semibold tracking-wide text-ink-600 dark:text-ink-300">
                                                Name
                                            </th>
                                            <th className="px-4 py-3 font-semibold tracking-wide text-ink-600 dark:text-ink-300">
                                                Type
                                            </th>
                                            <th className="px-4 py-3 font-semibold tracking-wide text-ink-600 dark:text-ink-300">
                                                Frequency / Count
                                            </th>
                                            <th className="px-4 py-3 font-semibold tracking-wide text-ink-600 dark:text-ink-300">
                                                Unit / Time
                                            </th>
                                            <th className="px-4 py-3 font-semibold tracking-wide text-ink-600 dark:text-ink-300">
                                                Achieved / Time Taken
                                            </th>
                                            <th className="px-4 py-3 font-semibold tracking-wide text-ink-600 dark:text-ink-300">
                                                Percentage / TAT
                                            </th>
                                            <th className="px-4 py-3 font-semibold tracking-wide text-center text-ink-600 dark:text-ink-300">
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
                                                    : "bg-white dark:bg-ink-950"
                                                    } `}
                                            >
                                                <td className="px-4 py-3 font-semibold text-ink-700 dark:text-ink-100">
                                                    {index + 1}.
                                                </td>

                                                <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500 dark:text-ink-400">
                                                    {activity.workDate ? formatDate(activity.workDate) : "—"}
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
                                                            : "bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200"
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
                                                        : activity.goalID
                                                            ? activity.unit || activity.expectedUnit || 0   // ✅ show unit first
                                                            : (() => {
                                                                const base = activity.isDynamic
                                                                    ? Number(activity.timeTaken || 0)
                                                                    : Number(activity.customTime || 0);
                                                                const setup = Number(activity.setup || 1);
                                                                return (base * setup).toFixed(2) + " mins";
                                                            })()
                                                    )}
                                                </td>



                                                <td className="px-4 py-3">
                                                    {activity.targetName
                                                        ? activity.achievedUnit || 0
                                                        : activity.goalID ? activity.achievedUnit || 0 : `${Number(activity.timeTaken || 0).toFixed(2)} mins`}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {activity.targetName ? (() => {
                                                        const achieved = Number(activity.achievedUnit || 0);
                                                        const unit = Number(activity.unit || 0);

                                                        // Target 92: accuracy-based → penalize if below 90%
                                                        if (String(activity.targetID) === "92") {
                                                            if (unit <= 0) return "N/A";
                                                            const rawPct = Math.round((achieved / unit) * 100);
                                                            const score = rawPct >= 90 ? 100 : 100 - (90 - rawPct);
                                                            return `${Math.max(score, 0)} %`;
                                                        }

                                                        // Target 93: error-based → inverted (fewer errors = better)
                                                        if (String(activity.targetID) === "93") {
                                                            if (unit <= 0) return "N/A";
                                                            const rawPct = Math.round((achieved / unit) * 100);
                                                            const score = 100 - rawPct;
                                                            return `${Math.max(score, 0)} %`;
                                                        }

                                                        // All other targets: standard percentage
                                                        if (unit <= 0) return "N/A";
                                                        return `${((achieved / unit) * 100).toFixed(2)} %`;
                                                    })() : "N/A"}
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
                                            <td colSpan={9} className="py-10">
                                                <div className="flex justify-center items-center">
                                                    <EmptyContainer
                                                        title="No Activities"
                                                        description="Select the filters to see the results"
                                                    />
                                                </div>
                                            </td>
                                        </tr>)}

                                    </tbody>
                                    <tfoot className="sticky bottom-0 bg-ink-50 dark:bg-ink-900  font-semibold">
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
                                            <th className="px-4 py-3 font-semibold tracking-wide text-white-600 ">
                                            </th>
                                            <th className="px-4 py-3 font-semibold tracking-wide text-ink-600 dark:text-ink-300">

                                            </th>
                                            <th className="px-4 py-3 font-semibold tracking-wide text-ink-600 dark:text-ink-300 flex justify-center ">
                                                Average Percentage: {averagePercentage} %
                                            </th>
                                            <th className="px-4 py-3 font-semibold tracking-wide text-center text-white-600 ">
                                            </th>
                                        </tr>
                                    </tfoot>

                                </table>
                            </div>
                        </>


                    </CardBody>
                </Card>
            </>)
            }

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
                                    {SCHEDULE_OPTIONS.map((t) => (
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