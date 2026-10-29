

import { PageTitle } from "@/components/page";
import React, { useEffect, useState, useMemo, useCallback, useRef, memo, lazy, Suspense } from "react";
import { useDashboardStore } from "./../store/commonStore";
import { Switch } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";
const ReactApexChart = React.lazy(() => import("react-apexcharts"));
import { format } from "date-fns";
import CustomDateRangePicker from "../components/customDateRangePicker";
import {
    Autocomplete,
    AutocompleteItem,
    addToast,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    Tabs,
    Tab,
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerBody,
    DrawerFooter,
    Button,
    Select, SelectItem
} from "@/components/ui";

import { title } from "@/components/primitives";
import axios from "axios";
import { EmptyContainer } from "@/components";
import EfficiencyTable from "@/components/table2";
import ELDashboard from "@/components/ElDashboard";
import AdminOverview from "@/components/overview/AdminOverview";
import { PersonalOverview, TeamOverview } from "@/components/overview/RoleOverviews";
import { dateMatchModifiers } from "react-day-picker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
    userID: number;
    userName: string;
    roleID?: number;
}

interface DateRange {
    startDate: string;
    endDate: string;
}

interface SummaryItem {
    title: string;
    subtitle: string;
    values: number[];
}

interface Props {
    labels: string[];
    values: number[];
    title?: string;
    dept: boolean;
    subtitle?: string;
    goals?: Number[];

}
const ColumnChart = ({
    labels,
    values,
    title = "Weekly overview",
    subtitle,
    dept,
    goals
}: Props) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const safeValues = values || [];

    const maxValue = Math.max(...safeValues, 1);
    const avgValue =
        safeValues.length > 0
            ? Math.round(
                safeValues.reduce((a, b) => a + b, 0) / safeValues.length
            )
            : 0;

    const totalValue = safeValues.reduce((a, b) => a + b, 0);
    // const avgValue = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    // const totalValue = values.reduce((a, b) => a + b, 0);
    const peakIndex = values.indexOf(maxValue);

    const trend = "+12.4%";

    return (
        <div className="bg-white dark:bg-ink-900 ">
            {/* Header */}
            {/* <div className="flex items-start justify-between mb-6">
                <div>
                    <p className="text-sm text-ink-500 dark:text-ink-400 mb-1">{title}</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-medium text-ink-900 dark:text-white">{totalValue}</span>
                        <span className="text-sm text-emerald-500 font-medium">↑ {trend}</span>
                    </div>
                </div>
                {subtitle && (
                    <span className="text-xs text-ink-400 bg-ink-50 dark:bg-ink-950 px-3 py-1 rounded-full">
                        {subtitle}
                    </span>
                )}
            </div> */}

            {/* Chart */}
            {totalValue === 0 && (
                <p className="text-xs text-ink-400 text-center -mt-2 mb-2">No data</p>
            )}
            <div className="relative flex items-end justify-around gap-3 h-48 mb-2">
                {/* Grid lines */}
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between pb-0">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="w-full border-t border-dashed border-ink-100 dark:border-white/10"
                            style={{ marginTop: i === 0 ? 0 : "auto" }}
                        />
                    ))}
                </div>

                {values.map((val, i) => {
                    const heightPct = (val / maxValue) * 85;
                    const isMax = i === peakIndex;
                    const isHovered = hoveredIndex === i;

                    return (
                        <div
                            key={i}
                            className="flex-none flex flex-col items-center justify-end h-full relative  "
                            style={{ width: !dept ? "90px" : "32px" }}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            {/* Tooltip */}
                            <AnimatePresence>
                                {isHovered && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                                        transition={{ duration: 0.12 }}
                                        className="absolute -top-3 left-1/2 -translate-x-1/2 bg-ink-900 text-white text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap z-10"
                                    >
                                        <div className="flex flex-col items-center text-xs leading-tight">
                                            <span className="font-semibold">{labels[i]}</span>
                                            <span className="text-brand-300">Utilization: {values[i]}</span>
                                            <span className="text-ink-300">Goal: {goals[i]}</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Bar */}
                            <motion.div
                                className="w-full relative overflow-hidden"
                                style={{
                                    borderRadius: "6px 6px 2px 2px",
                                    background: isHovered
                                        ? "#185FA5"
                                        : isMax
                                            ? "#3266ad"
                                            : "#B5D4F4",
                                    cursor: "pointer",
                                }}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{
                                    height: `${heightPct}%`,
                                    opacity: 1,
                                    background: isHovered ? "#185FA5" : isMax ? "#3266ad" : "#B5D4F4",
                                }}
                                transition={{
                                    height: {
                                        type: "spring",
                                        stiffness: 120,
                                        damping: 18,
                                        delay: i * 0.07,
                                    },
                                    opacity: { duration: 0.3, delay: i * 0.07 },
                                    background: { duration: 0.15 },
                                }}
                            >

                                {isMax && (
                                    <div
                                        className="absolute top-0 left-0 right-0"
                                        style={{
                                            height: "40%",
                                            background: "rgba(255,255,255,0.12)",
                                            borderRadius: "6px 6px 0 0",
                                        }}
                                    />
                                )}
                            </motion.div>

                            {/* Label */}
                            <span className="text-xs text-ink-500 dark:text-ink-400 mt-2 font-medium">{val}</span>
                        </div>
                    );
                })}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-ink-100 dark:border-white/10">
                {
                    // [
                    //     { label: "Peak", value: `${maxValue} (${labels[peakIndex]})` },
                    //     { label: "Avg", value: avgValue },
                    //     { label: "Total", value: totalValue },
                    // ]
                    [
                        { label: "TOP TARGET", value: `${maxValue} (${labels[peakIndex]})` },
                        { label: "TOP GOAL", value: labels[peakIndex] },
                        // { label: "Total", value: totalValue },
                    ]
                        .map(({ label, value }) => (
                            <div key={label} className="bg-brand-50 rounded-xl px-3 py-2.5">
                                <p className="text-xs text-ink-400 uppercase tracking-wide mb-0.5">{label}</p>
                                <p className="text-sm font-medium text-ink-900 dark:text-white">{value}</p>
                            </div>
                        ))}
            </div>
        </div>
    );
}

// ─── Constants (defined outside component – never re-created) ─────────────────
// const getEfficiencyLevel = ({
//     targetPercent,
//     goalPercent,
//     timeTaken,
//     allocatedTime,
// }) => {
//     if (
//         targetPercent >= 100 &&
//         goalPercent >= 80 &&
//         timeTaken <= allocatedTime
//     ) {
//         return "High";
//     }

//     if (
//         targetPercent >= 80 &&
//         goalPercent >= 50 &&
//         timeTaken <= allocatedTime
//     ) {
//         return "At Par";
//     }

//     return "Low";
// };
const DEFAULT_USER_SUMMARY: SummaryItem = {
    title: "User",
    subtitle: "0",
    values: [0, 0, 0, 0],
};


const RADIAL_CHART_LABELS = [
    "Target %",
    //  "Utilization %",
    "Allocated Hrs",
    "Work Hrs",
    "average Goal"];
const RADIAL_CHART_COLORS = ["#EF4444", "#10B981", "#F59E0B", "#ff8442", "#30328f"];

const RADIAL_CHART_OPTIONS_BASE = {
    labels: RADIAL_CHART_LABELS,
    colors: RADIAL_CHART_COLORS,
    plotOptions: {
        radialBar: {
            track: { background: "#E5E7EB" },
            dataLabels: {
                name: { fontSize: "12px" },
                value: { fontSize: "12px" },
            },
        },
    },
    legend: { show: true, position: "bottom" as const, fontSize: "11px" },
};

const buildChartOptions = (label: string, formatter: () => string) => ({
    ...RADIAL_CHART_OPTIONS_BASE,
    plotOptions: {
        radialBar: {
            ...RADIAL_CHART_OPTIONS_BASE.plotOptions.radialBar,
            dataLabels: {
                ...RADIAL_CHART_OPTIONS_BASE.plotOptions.radialBar.dataLabels,
                total: { show: true, label, formatter },
            },
        },
    },
});

const getTodayRange = (days = 7): DateRange => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
    };
};

// ─── Memoized Sub-components ─────────────────────────────────────────────────

const IconSet = memo(({ type, stroke }: { type: string; stroke: string }) => {
    switch (type) {
        case "brain":
            return (
                <svg width="22" height="22" fill="none" stroke={stroke} strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M6 8a3 3 0 1 1 3-3h6a3 3 0 1 1 3 3v4a3 3 0 1 1-3 3H9a3 3 0 1 1-3-3V8z" />
                </svg>
            );
        case "target":
            return (
                <svg width="22" height="22" fill="none" stroke={stroke} strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="4" />
                </svg>
            );
        case "pulse":
            return (
                <svg width="22" height="22" fill="none" stroke={stroke} strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 12h3l2 4 3-8 2 4h6" />
                </svg>
            );
        case "clock":
            return (
                <svg width="22" height="22" fill="none" stroke={stroke} strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                </svg>
            );
        case "briefcase":
            return (
                <svg width="22" height="22" fill="none" stroke={stroke} strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M8 7V5h8v2" />
                </svg>
            );
        default:
            return null;
    }
});

const StatRow = memo(
    ({
        label,
        value,
        color,
        iconType,
    }: {
        label: string;
        value: string | number;
        color: string;
        iconType: string;
    }) => (
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-950 transition">
            <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg bg-${color}-100 text-${color}-600`}>
                    <IconSet type={iconType} stroke="#101828" />
                </div>
                <h3 className="font-medium text-ink-800 dark:text-white text-xs">{label}</h3>
            </div>
            <span className={`font-bold text-${color}-600`}>{value}</span>
        </div>
    )
);


// Radial chart + stat card column pair


// ─── Custom Hook ──────────────────────────────────────────────────────────────

function useDashboardData(
    user: any,
    dateRange: DateRange,
    goalDateRange: DateRange,
    refresh: boolean,
    departmentType: "all" | "business" | "support"
) {
    const [companySummary, setCompanySummary] = useState<SummaryItem | null>(null);
    const [departmentSummary, setDepartmentSummary] = useState<any[]>([]);
    const [ELSummary, setELSummary] = useState<any[]>([]);
    const [FLSummary, setFLSummary] = useState<any[]>([]);
    const [elData, setElData] = useState<any[]>([]);
    const [userSummary, setUserSummary] = useState<SummaryItem[]>([]);
    const [userSummaryData, setUserSummaryData] = useState<any[]>([]);
    const [ELUserSummary, setELUserSummary] = useState<any[]>([]);
    const [FLUserSummary, setFLUserSummary] = useState<any[]>([]);
    const [allUser, setAllUser] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const payload = useMemo(() => {
        if (!user) return null;
        const base = {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,

            goalStartDate: dateRange.startDate,
            goalEndDate: dateRange.endDate,
            departmentType,
            roleID: user.userRole,
            userID: user?.departmentID ? user.userID : null,
            isHeExecutiveLeader: user.isHeExecutiveLeader,
            isHeFunctionalLeader: user.isHeFunctionalLeader,
        };
        if (user.isHeExecutiveLeader) return { ...base, userID: null, departmentID: null, elID: user.userID };
        if (user.isHeFunctionalLeader) return { ...base, userID: null, departmentID: null, flID: user.userID };
        if (user.userRole !== 1) return { ...base, userID: user.userID }; // anyone else: their own numbers
        return base;
    }, [user, dateRange, goalDateRange, departmentType]);

    useEffect(() => {
        if (!payload) return;
        const controller = new AbortController();

        const fetch = async () => {
            setLoading(true);
            try {
                const res = await axios.post(
                    "/t2.0/authentificationUtilization/DashBoardAll",
                    payload,
                    { headers: { "Content-Type": "application/json" }, signal: controller.signal }
                );
                const data = res.data;

                setELSummary(data.elSummary ?? []);
                setFLSummary(data.flSummary ?? []);
                if (user.userRole === 1) {
                    setElData(data.elSummaryAdmin.eldata ?? [])
                }

                setDepartmentSummary(data.departmentSummary ?? []);

                const rawUsers: any[] = data.userSummary ?? [];
                setUserSummary(
                    rawUsers.map((u) => ({
                        title: u.UserName,
                        subtitle: u.EfficiencyLevel,
                        values: [
                            Number(u.AvgTargetPercent) || 0,
                            Number(u.AvgUtilizationPercent) || 0,
                            Number(u.AvgAllocatedHrs) || 0,
                            Number(u.AvgTotalWork) || 0,
                        ],
                    }))
                );

                if (user.userRole !== 1 && !user.isHeExecutiveLeader && !user.isHeFunctionalLeader) setUserSummaryData(data.userSummary?.[0]?.DailyData ?? []);

                if (user.isHeExecutiveLeader) {
                    const flat = data.elUsersSummary?.flatMap((el: any) =>
                        el.departments?.flatMap((d: any) => d.users ?? []) ?? []
                    ) ?? [];
                    setAllUser(flat);
                    const efficiency = (data.elGoalSummary ?? []).find(
                        ele => ele.ELID === user.userID
                    )?.AvgGoalEfficiency;

                    setELUserSummary((data.elUsersSummary ?? []).map((ele) => {
                        return {
                            ...ele,
                            avgGoalEfficiency: efficiency
                        }
                    }));
                }

                if (user.isHeFunctionalLeader) {
                    const flat = data.flUsersSummary?.flatMap((fl: any) =>
                        fl.departments?.flatMap((d: any) => d.users ?? []) ?? []
                    ) ?? [];
                    setAllUser(flat);
                    const efficiency = (data.flGoalSummary ?? []).find(
                        ele => ele.FLID === user.userID
                    )?.AvgGoalEfficiency;

                    setFLUserSummary((data.flUsersSummary ?? []).map((ele) => {
                        return {
                            ...ele,
                            avgGoalEfficiency: efficiency
                        }
                    }));
                }

                setCompanySummary({
                    title: "Summary",
                    subtitle: data.companySummary?.EfficiencyLevel,
                    values: [
                        data.companySummary?.AvgTargetPercent,
                        data.companySummary?.AvgUtilizationPercent,
                        data.companySummary?.AvgAllocatedHrs,
                        data.companySummary?.AvgTotalWork,
                        data.companySummary?.AvgGoalEfficiency
                    ],
                    totalUsers: data.companySummary?.TotalUsers,
                    totalDepartments: data.companySummary?.TotalDepartments,
                } as SummaryItem);
            } catch (err: any) {
                if (!axios.isCancel(err))
                    console.error("Dashboard fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetch();
        return () => controller.abort();
    }, [payload, refresh]);

    return {
        loading, setLoading,
        payload,
        companySummary,
        departmentSummary,
        ELSummary, FLSummary,
        userSummary, userSummaryData,
        ELUserSummary,
        FLUserSummary,
        allUser,
        elData,
    };
}


const MonthYearPicker = memo(({ onChange }: { onChange: (r: DateRange) => void }) => {
    const currentDate = new Date();
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const years = useMemo(() => {
        const y = [];
        for (let i = currentDate.getFullYear() - 3; i <= currentDate.getFullYear(); i++) {
            y.push(i);
        }
        return y;
    }, []);

    const computeAndEmit = useCallback((month: number, year: number) => {
        const today = new Date();
        const isCurrentMonth =
            month === today.getMonth() + 1 && year === today.getFullYear();

        const formatDate = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, "0");
            const d = String(date.getDate()).padStart(2, "0");
            return `${y}-${m}-${d}`;
        };

        const startDate = formatDate(new Date(year, month - 1, 1));

        const endDate = isCurrentMonth
            ? formatDate(today)
            : formatDate(new Date(year, month, 0));

        onChange({ startDate, endDate });
    }, [onChange]);

    // Emit on mount with current month/year
    useEffect(() => {
        computeAndEmit(selectedMonth, selectedYear);
    }, []);

    const handleMonthChange = (month: number) => {
        setSelectedMonth(month);
        computeAndEmit(month, selectedYear);
    };

    const handleYearChange = (year: number) => {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        let month = selectedMonth;

        if (year === currentYear && month > currentMonth) {
            month = currentMonth;
            setSelectedMonth(month);
        }

        setSelectedYear(year);
        computeAndEmit(month, year);
    };
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const availableMonths = months.filter((_, i) => {
        const month = i + 1;

        // If current year, allow only current and past months
        if (selectedYear === currentYear) {
            return month <= currentMonth;
        }

        // Previous years: allow all months
        return true;
    });


    return (
        <div className="flex gap-2 items-center">
            <Select
                size="sm"
                className="w-36"
                selectedKeys={[String(selectedMonth)]}
                onSelectionChange={(keys) =>
                    handleMonthChange(Number(Array.from(keys)[0]))
                }
                aria-label="Month"
            >
                {availableMonths.map((m, i) => {
                    const monthNumber = months.indexOf(m) + 1;
                    return (
                        <SelectItem key={String(monthNumber)}>
                            {m}
                        </SelectItem>
                    );
                })}
            </Select>

            <Select
                size="sm"
                className="w-28"
                selectedKeys={[String(selectedYear)]}
                onSelectionChange={(keys) =>
                    handleYearChange(Number(Array.from(keys)[0]))
                }
                aria-label="Year"
            >
                {years.map((y) => (
                    <SelectItem key={String(y)}>
                        {String(y)}
                    </SelectItem>
                ))}
            </Select>
        </div>
    );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
    // Parse user once
    const user = useMemo<any>(() => {
        const raw = localStorage.getItem("authUserLD");
        const u = raw ? JSON.parse(raw) : null;
        if (!u) return u;
        // A person with an Executive / Functional Leader role who does not actually lead a department
        // sees the same personal dashboard as any employee: their own summary, in the admin layout
        const leads = (u.departments ?? []).some((d: any) => Number(d.executiveLeaderID) === Number(u.userID) || Number(d.functionalLeaderID) === Number(u.userID));
        if ((u.userRole === 3 || u.userRole === 4) && !leads) {
            const own = u.departmentID ?? u.departments?.[0]?.departmentID;
            const ownName = u.departmentName ?? u.departments?.[0]?.departmentName;
            return { ...u, userRole: 2, isHeExecutiveLeader: false, isHeFunctionalLeader: false, departmentID: own, departmentName: ownName };
        }
        return u;
    }, []);
    const dateModification = useDashboardStore((state) => state.dateModification);
    const toggleDateModification = useDashboardStore((state) => state.toggleDateModification);
    const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);
    const [logUsers, setLogUsers] = useState<any[]>([]);
    const [refresh, setRefresh] = useState(false);
    // Company view starts on a month so there is something to see; people see their last week
    const [dateRange, setDateRange] = useState<DateRange>(() => getTodayRange(user?.userRole === 1 ? 30 : 7));
    const [goalDateRange, setGoalDateRange] = useState<DateRange>(() => getTodayRange(7));
    const [dateRangeLog, setDateRangeLog] = useState<DateRange>(() => getTodayRange(7));
    const [selectedDepartment, setSelectedDepartment] = useState(
        user?.departmentID ? String(user.departmentID) : ""
    );
    const [elFilter, setELFilter] = useState<any>(0);
    const [flFilter, setFLFilter] = useState<any>(0);
    const [departmentList, setDepartmentList] = useState<any[]>([]);
    const [ELList, setELList] = useState<User[]>([]);
    const [FLList, setFLList] = useState<User[]>([]);
    const [departmentType, setDepartmentType] = useState<"all" | "business" | "support">("all");

    const {
        loading, setLoading,
        payload,
        companySummary,
        departmentSummary,
        ELSummary, FLSummary,
        userSummary, userSummaryData,
        ELUserSummary,
        FLUserSummary,
        allUser,
        elData,
    } = useDashboardData(
        user,
        dateRange,
        goalDateRange,
        refresh,
        departmentType
    );

    // ── Derived / filtered data (no useState + useEffect needed) ──────────────
    const ELSummaryFiltered = useMemo(
        () => (elFilter ? ELSummary.filter((e) => String(e.ELID) === String(elFilter)) : ELSummary),
        [elFilter, ELSummary]
    );
    const FLSummaryFiltered = useMemo(
        () => (flFilter ? FLSummary.filter((e) => String(e.FLID) === String(flFilter)) : FLSummary),
        [flFilter, FLSummary]
    );

    const departmentSummaryFiltered = useMemo(
        () =>
            selectedDepartment
                ? departmentSummary.filter((e) => String(e.DepartmentID) === String(selectedDepartment))
                : departmentSummary,
        [selectedDepartment, departmentSummary]
    );

    // ── Fetch departments ─────────────────────────────────────────────────────
    useEffect(() => {
        const controller = new AbortController();
        const fetchDepartments = async () => {
            try {
                const res = await axios.post(
                    "/t2.0/authentificationUtilization/Department/list?page=0&size=0",
                    {
                        searchText: "", filter: "", startDate: "", endDate: "",
                        roleID: user.userRole,
                        userID: user.isHeExecutiveLeader ? Number(user.userID) : user?.userID ?? null,
                    },
                    { headers: { "Content-Type": "application/json" }, signal: controller.signal }
                );
                const depts = res.data.response.departments ?? [];
                setDepartmentList(
                    depts.map((d: any) => ({
                        key: d.departmentID,
                        name: d.departmentName,
                        description: d.departmentDescription,
                        status: d.newStatus,
                    }))
                );
            } catch (err) {
                if (!axios.isCancel(err)) console.error("Dept fetch error:", err);
            }
        };
        fetchDepartments();
        return () => controller.abort();
    }, []);

    // ── Fetch EL / FL user lists ──────────────────────────────────────────────
    useEffect(() => {
        const controller = new AbortController();
        const fetchUsers = async () => {
            try {
                const body = {
                    filter: "", searchText: "",
                    departmentID: selectedDepartment ? Number(selectedDepartment) : 0,
                    ...(!selectedDepartment ? { roleID: 3 } : {}),
                };
                const res = await axios.post(
                    "/t2.0/authentificationUtilization/users/read?page=0&size=0",
                    body,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${user?.token ?? ""}`,
                        },
                        signal: controller.signal,
                    }
                );
                const formatted: User[] = (res.data.response.users ?? []).map((u: any) => ({
                    userID: u.userID,
                    userName: u.userName,
                    roleID: u.roleID,
                }));

                if (selectedDepartment) {
                    // no-op kept for future use
                } else {
                    setELList(formatted.filter((u) => u.roleID === 3));
                    setFLList(formatted.filter((u) => u.roleID === 4));
                }
            } catch (err) {
                if (!axios.isCancel(err)) console.error("Users fetch error:", err);
            }
        };
        fetchUsers();
        return () => controller.abort();
    }, [selectedDepartment]);

    // ── Actions ───────────────────────────────────────────────────────────────
    // Runs by itself when the admin opens the dashboard, so the numbers are always current
    const handleRunReport = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get("/t2.0/authentificationUtilization/calculateAll", {
                headers: { "Content-Type": "application/json" },
            });
            if (res.status === 200) setRefresh((r) => !r);
        } catch (err) {
            addToast({ title: "Could not refresh the report", description: String(err), color: "danger" });
        } finally {
            setLoading(false);
        }
    }, []);
    const autoRan = useRef(false);
    useEffect(() => {
        if (autoRan.current || user?.userRole !== 1 || user?.departmentID) return;
        autoRan.current = true;
        handleRunReport();
    }, [handleRunReport]);

    const handleLog = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `/t2.0/authentificationUtilization/MissingData?startDate=${dateRangeLog.startDate}&endDate=${dateRangeLog.endDate}`,
                { headers: { "Content-Type": "application/json" } }
            );
            setLogUsers(res.data ?? []);
            addToast({ title: "Success", description: "Log Successfully Generated", color: "success" });
        } catch {
            addToast({ title: "Error", description: "Failed to fetch log data", color: "danger" });
        } finally {
            setLoading(false);
        }
    }, [dateRangeLog]);

    const handleDownload = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.post(
                "/t2.0/authentificationUtilization/DashBoardAll/download/excel",
                payload,
                { responseType: "blob" }
            );
            const url = window.URL.createObjectURL(
                new Blob([res.data], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                })
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "Efficiency-Summary.xlsx";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            addToast({ title: "Success", description: "Report Successfully downloaded", color: "success" });
        } catch (err) {
            addToast({ title: "Error", description: String(err), color: "danger" });
        } finally {
            setLoading(false);
        }
    }, [payload]);

    // ── Date range picker dropdown (shared pattern) ───────────────────────────
    const DateRangeDropdown = useCallback(
        ({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) => (
            <CustomDateRangePicker value={value} onChange={onChange} />
        ),
        []
    );

    // ── Render helpers ────────────────────────────────────────────────────────
    const isAdmin = user?.userRole === 1;
    const isEL = user?.isHeExecutiveLeader;
    const isFL = user?.isHeFunctionalLeader;

    const currentUserSummary = userSummary[0] ?? DEFAULT_USER_SUMMARY;


    // ── JSX ───────────────────────────────────────────────────────────────────
    return (
        <div>
            {/* ── Missing Logs Drawer ─────────────────────────────────────────── */}
            <Drawer size="4xl" isOpen={isLogDrawerOpen} onOpenChange={setIsLogDrawerOpen}>
                <DrawerContent>
                    {(onClose) => (
                        <>
                            <DrawerHeader className="flex flex-col gap-1">Person not Logged</DrawerHeader>
                            <DrawerBody>
                                <div className="flex justify-center items-center gap-3">
                                    <DateRangeDropdown value={dateRangeLog} onChange={setDateRangeLog} />
                                    <Button color="primary" onPress={handleLog}>
                                        Run Log
                                    </Button>
                                </div>

                                {logUsers.length === 0 && !loading && (
                                    <EmptyContainer title="No Missing Logs" description="No users found for selected date range" />
                                )}

                                {logUsers.length > 0 && (
                                    <div className="divide-y rounded-lg border mt-4">
                                        {logUsers.map((u) => (
                                            <div key={u.userID} className="p-3 flex flex-col">
                                                <span className="font-medium text-sm">{u.userName}</span>
                                                <span className="text-xs text-ink-500 dark:text-ink-400">{u.userEmail}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
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

            {/* ── Page Header ─────────────────────────────────────────────────── */}
            <div className="mb-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <PageTitle title="Taskly overview" subtitle="View detailed insights into your department's daily work" />

                <div className="flex items-center gap-2 whitespace-nowrap">
                    <Button
                        size="sm"
                        variant="bordered"
                        onPress={() => {
                            window.open("https://docs.google.com/spreadsheets/d/1qoniokvvEugnYDyaISblNbrCoeH7cJrdt_HksaWT-Vs/edit?gid=1681648508#gid=1681648508");
                        }}
                    >
                        View goal & target
                    </Button>

                    {user?.userRole === 1 && !user?.departmentID && (
                        <Button size="sm" variant="bordered" onPress={() => setIsLogDrawerOpen(true)}>
                            Missing logs
                        </Button>
                    )}
                    <DateRangeDropdown
                        value={dateRange}
                        onChange={setDateRange}
                    />
                </div>
            </div>


            {/*  Main Grid  */}
            {isAdmin ? (
                <AdminOverview
                    company={companySummary ? {
                        target: Number(companySummary.values?.[0]) || 0,
                        utilization: Number(companySummary.values?.[1]) || 0,
                        allocated: Number(companySummary.values?.[2]) || 0,
                        worked: Number(companySummary.values?.[3]) || 0,
                        goal: Number(companySummary.values?.[4]) || null,
                        people: Number((companySummary as any).totalUsers) || 0,
                        departments: Number((companySummary as any).totalDepartments) || 0,
                    } : null}
                    departments={departmentSummary}
                    executiveLeaders={ELSummary}
                    functionalLeaders={FLSummary}
                    scope={departmentType}
                    onScope={setDepartmentType}
                    loading={loading}
                    onWiden={() => setDateRange(getTodayRange(90))}
                />
            ) : isEL ? (
                <TeamOverview leader={ELUserSummary?.[0] ?? null} loading={loading} onWiden={() => setDateRange(getTodayRange(90))} />
            ) : isFL ? (
                <TeamOverview leader={FLUserSummary?.[0] ?? null} loading={loading} onWiden={() => setDateRange(getTodayRange(90))} />
            ) : (
                <PersonalOverview summary={currentUserSummary} days={userSummaryData} loading={loading} onWiden={() => setDateRange(getTodayRange(90))} />
            )}

        </div>
    );
}