

import { PageTitle } from "@/components/page";
import React, { useEffect, useState, useMemo, useCallback, memo, lazy, Suspense } from "react";
import { useDashboardStore } from "./../store/commonStore";
import { Card, CardBody } from "@/components/ui";
import { Switch } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";
const ReactApexChart = React.lazy(() => import("react-apexcharts"));
import { format } from "date-fns";
import CustomDateRangePicker from "../components/CustomDateRangePicker";
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

const STAT_DEFS = [
    // { label: "TapMind at a glance", key: -1, icon: "", color: "indigo" },
    { label: "Target Achieved (Overall)", key: 0, icon: "target", color: "red" },
    // { label: "Utilization % (Average)", key: 1, icon: "pulse", color: "green" },
    { label: "Allocated hours per day (Average)", key: 2, icon: "clock", color: "yellow" },
    { label: "Working hours per day (Average)", key: 3, icon: "briefcase", color: "purple" },
    // { label: "Overall Efficiency", key: "subtitle", icon: "brain", color: "primary" },
    { label: "Overall Goal", key: 4, icon: "clock", color: "secondary" }
] as const;

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

// Static – never changes, no props needed
const EfficiencyRules = memo(() => (
    <div className="bg-white dark:bg-ink-900 rounded-xl p-4  flex flex-col gap-4 text-[12px]">
        <h2 className="text-sm font-semibold text-ink-800 dark:text-white flex items-center gap-2">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                <path d="M3 17L9 11L13 15L21 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Efficiency &amp; Utilization Rules
        </h2>
        <div className="bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-400 p-3 rounded leading-tight">
            <strong>Note:</strong> Regular workday = 8 Hours. Half Day leave = 4 Hours.
        </div>
        <div className="bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-400 p-3 rounded leading-tight">
            <strong>Efficiency Calculation</strong>
            <ul className="list-disc pl-4 mt-1">
                <li>
                    <span className="text-emerald-600 font-semibold">High:</span>&nbsp;
                    Target Achieved ≥ <b>100%</b> AND Goal Achieved ≥ <b>80%</b> AND Time Taken ≤ Allocated Time
                </li>

                <li>
                    <span className="text-amber-600 font-semibold">At Par:</span>&nbsp;
                    Target Achieved ≥ <b>80%</b> AND Goal Achieved ≥ <b>50%</b> AND Time Taken ≤ Allocated Time
                </li>

                <li>
                    <span className="text-rose-600 font-semibold">Low:</span>&nbsp;
                    All other conditions
                </li>
            </ul>
        </div>
        <div className="bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-400 p-3 rounded leading-tight">
            <strong>Utilization Calculation</strong>
            <ul className="list-disc pl-4 mt-1">
                <li>
                    <b>If Efficiency is High or At Par:</b>&nbsp;Time Taken / Standard Time × 100
                </li>
                <li>
                    <b>If Efficiency is Low:</b>&nbsp;Time Taken / Standard Time × 100 (capped to <b>100%</b>)
                </li>
            </ul>
        </div>
    </div>
));

// Radial chart + stat card column pair


// Skeleton loader for charts
const RadialBarSkeleton = () => (
    <div className="flex justify-center items-center h-[230px]">
        <div className="w-40 h-40 rounded-full border-8 border-ink-200 dark:border-white/10 animate-pulse" />
    </div>
);

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
    const [ELUserSummaryGraph, setELUserSummaryGraph] = useState<SummaryItem[] | null>(null);
    const [FLUserSummary, setFLUserSummary] = useState<any[]>([]);
    const [FLUserSummaryGraph, setFLUserSummaryGraph] = useState<SummaryItem[] | null>(null);
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
        if (user.userRole === 2) return base;
        if (user.isHeExecutiveLeader) return { ...base, departmentID: null, elID: user.userID };
        if (user.isHeFunctionalLeader) return { ...base, departmentID: null, flID: user.userID };
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
                            Number(u.AvgTargetPercent),
                            Number(u.AvgUtilizationPercent),
                            Number(u.AvgAllocatedHrs),
                            Number(u.AvgTotalWork),
                        ],
                    }))
                );

                if (user.userRole === 2) setUserSummaryData(data.userSummary?.[0]?.DailyData ?? []);

                if (user.userRole === 3) {
                    const flat = data.elUsersSummary?.flatMap((el: any) =>
                        el.departments?.flatMap((d: any) => d.users ?? []) ?? []
                    ) ?? [];
                    setAllUser(flat);
                    const efficiency = data.elGoalSummary.find(
                        ele => ele.ELID === user.userID
                    )?.AvgGoalEfficiency;

                    setELUserSummary(data.elUsersSummary.map((ele) => {
                        return {
                            ...ele,
                            avgGoalEfficiency: efficiency
                        }
                    }));
                    setELUserSummaryGraph(
                        (data.elUsersSummary ?? []).map((el: any) => {
                            const matched = data.elGoalSummary.find(
                                (item: any) => item.ELID === el.ELID
                            )
                            return {

                                title: el.ELName,
                                subtitle: el.EfficiencyLevel,
                                values: [el.AvgTargetPercent, el.AvgUtilizationPercent, el.AvgAllocatedHrs, el.AvgTotalWork, matched?.AvgGoalEfficiency || 0],
                            }
                        })
                    );
                }

                if (user.userRole === 4) {
                    const flat = data.flUsersSummary?.flatMap((fl: any) =>
                        fl.departments?.flatMap((d: any) => d.users ?? []) ?? []
                    ) ?? [];
                    setAllUser(flat);
                    const efficiency = data.flGoalSummary.find(
                        ele => ele.FLID === user.userID
                    )?.AvgGoalEfficiency;

                    setFLUserSummary(data.flUsersSummary.map((ele) => {
                        return {
                            ...ele,
                            avgGoalEfficiency: efficiency
                        }
                    }));
                    setFLUserSummaryGraph(
                        (data.flUsersSummary ?? []).map((fl: any) => {
                            const matched = data.flGoalSummary.find(
                                (item: any) => item.FLID === fl.FLID
                            )
                            return {

                                title: fl.FLName,
                                subtitle: fl.EfficiencyLevel,
                                values: [fl.AvgTargetPercent, fl.AvgUtilizationPercent, fl.AvgAllocatedHrs, fl.AvgTotalWork, matched?.AvgGoalEfficiency || 0],
                            }
                        })
                    );
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
                });
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
        ELUserSummary, ELUserSummaryGraph,
        FLUserSummary, FLUserSummaryGraph,
        allUser,
        elData,
    };
}


const MultiRingChart = ({ values = [], colors = [], size = 200, stroke = 12 }) => {
    const center = size / 2;

    return (
        <div className="flex flex-col items-center gap-3">
            <svg width={size} height={size}>

                {values.map((val, i) => {
                    const radius = (size / 2) - (i * (stroke + 6)) - stroke;
                    const circumference = 2 * Math.PI * radius;

                    const progress = Math.min(val, 100);
                    const offset = circumference - (progress / 100) * circumference;

                    return (
                        <circle
                            key={i}
                            cx={center}
                            cy={center}
                            r={radius}
                            stroke={colors[i]}
                            strokeWidth={stroke}
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            transform={`rotate(-90 ${center} ${center})`}
                            className="transition-all duration-700 ease-out"
                        />
                    );
                })}

            </svg>
        </div>
    );
};

const RADIAL_LEGEND_COLORS = ["#ff6a1f", "#059669", "#52525b", "#ffa06b", "#d97706"];
const RADIAL_METRIC_LABELS = ["Target %", "Allocated Hrs", "Work Hrs", "Avg Goal"];

const RadialSummaryCard = memo(({
    title,
    values,
    subtitle,
    loading,
}: {
    title: string;
    values: number[];
    subtitle?: string;
    loading: boolean;
}) => {
    const isEmpty = !values || values.every((v) => !v);
    const safeValues = isEmpty ? [0, 0, 0, 0, 0] : values;

    return (
        <div className="bg-white dark:bg-ink-900 rounded-2xl p-6 flex flex-col items-center w-full relative">
            {loading ? (
                <RadialBarSkeleton />
            ) : (
                <>
                    <h2 className="text-xs tracking-widest text-ink-400 mb-4">
                        {title}
                    </h2>

                    <div className="relative">
                        <MultiRingChart
                            values={safeValues}
                            colors={RADIAL_LEGEND_COLORS}
                            size={220}
                            stroke={12}
                        />
                        {isEmpty && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs text-ink-400 bg-white/80 dark:bg-ink-900/80 px-2 py-1 rounded-full">
                                    No data
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                        {RADIAL_METRIC_LABELS.map((label, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ background: RADIAL_LEGEND_COLORS[i] }}
                                />
                                <span className="text-ink-600 dark:text-ink-300">
                                    {label}{!isEmpty ? ` - ${safeValues[i]}%` : ""}
                                </span>
                            </div>
                        ))}
                    </div>

                    {!isEmpty && subtitle && (
                        <p className="text-xs text-ink-400 mt-4 text-center">{subtitle}</p>
                    )}
                </>
            )}
        </div>
    );
});

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
        return raw ? JSON.parse(raw) : null;
    }, []);
    const dateModification = useDashboardStore((state) => state.dateModification);
    const toggleDateModification = useDashboardStore((state) => state.toggleDateModification);
    const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);
    const [logUsers, setLogUsers] = useState<any[]>([]);
    const [refresh, setRefresh] = useState(false);
    const [dateRange, setDateRange] = useState<DateRange>(() => getTodayRange(7));
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
        ELUserSummary, ELUserSummaryGraph,
        FLUserSummary, FLUserSummaryGraph,
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

    const stats = useMemo(
        () =>
            STAT_DEFS.map((def) => ({
                ...def,
                value:
                    def.key === "subtitle"
                        ? companySummary?.subtitle
                        : def.key >= 0
                            ? companySummary?.values?.[def.key as number]
                            : undefined,
            })),
        [companySummary]
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
    const handleRunReport = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get("/t2.0/authentificationUtilization/calculateAll", {
                headers: { "Content-Type": "application/json" },
            });
            if (res.status === 200) {
                setRefresh((r) => !r);
                addToast({ title: "Success", description: "Report Successfully Executed", color: "success" });
            }
        } catch (err) {
            addToast({ title: "Error", description: String(err), color: "danger" });
        } finally {
            setLoading(false);
        }
    }, []);

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
            <Dropdown placement="bottom-start">
                <DropdownTrigger>
                    <Button variant="flat" size="sm" className="w-[260px] justify-between border border-ink-300 bg-white dark:border-white/15 dark:bg-ink-900">
                        {value.startDate && value.endDate
                            ? `${format(new Date(value.startDate), "dd MMM yyyy")} → ${format(new Date(value.endDate), "dd MMM yyyy")}`
                            : "Select Date Range"}
                    </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Date range" closeOnSelect={false} className="p-0">
                    <DropdownItem key="calendar" className="p-0">
                        <CustomDateRangePicker value={value} onChange={onChange} />
                    </DropdownItem>
                </DropdownMenu>
            </Dropdown>
        ),
        []
    );

    // ── Render helpers ────────────────────────────────────────────────────────
    const isAdmin = user?.userRole === 1;
    const isEmployee =
        user?.userRole === 2 ||
        user?.userRole === 5 ||
        user?.userRole === 6 ||
        user?.userRole === 7 ||
        user?.userRole === 23;
    const isEL = user?.isHeExecutiveLeader;
    const isFL = user?.isHeFunctionalLeader;
    const hasDepartment = !!user?.departmentID;

    const currentUserSummary = userSummary[0] ?? DEFAULT_USER_SUMMARY;


    const LeaderSummaryGrid = memo(({
        data,
        loading
    }: {
        data: SummaryItem[],
        loading: boolean
    }) => {
        const displayData = (!data || data.length === 0)
            ? [{ title: "Executive Leader", subtitle: "-", values: [0, 0, 0, 0, 0] }]
            : data;

        return (

            <div className="flex flex-col xl:flex-row gap-6 items-stretch">

                {/* LEFT SECTION */}
                <div className="flex-1 flex">

                    <div className="flex flex-wrap gap-6 w-full content-start">

                        {displayData.map((item, i) => (

                            <div
                                key={i}
                                className="
                                bg-white dark:bg-ink-900
                                rounded-2xl
                                p-5
                                flex-1
                                min-w-[350px]
                                flex
                                flex-col
                            "
                            >

                                {/* HEADER */}
                                <div className="
    flex
    flex-col
    xl:flex-row
    gap-8
    items-start
    w-full
">
                                    <div className="
    flex
    flex-col
    items-center
    justify-start
    min-w-[320px]
">                                        <div>

                                            <h2 className="text-sm font-semibold text-ink-800 dark:text-white text-center">
                                                {item.title}
                                            </h2>

                                            <p className="text-xs text-ink-400 mt-1">
                                                Efficiency Overview
                                            </p>

                                        </div>
                                        <div className="
    bg-white dark:bg-ink-900
    rounded-2xl
    p-6
    flex
    flex-col
    items-center
">

                                            <h2 className="
        text-xs
        tracking-widest
        text-ink-400
        mb-4
    ">
                                                {item.title?.toUpperCase()}
                                            </h2>



                                            <>
                                                <MultiRingChart
                                                    values={item.values}
                                                    colors={[
                                                        "#ff6a1f",
                                                        "#059669",
                                                        "#52525b",
                                                        "#ffa06b",
                                                        "#d97706",
                                                    ]}
                                                    size={220}
                                                    stroke={12}
                                                />

                                                {/* LEGEND */}
                                                <div className="
                grid
                grid-cols-2
                gap-3
                mt-5
                text-xs
                w-full
            ">

                                                    {[
                                                        "Target %",
                                                        // "Utilization %",
                                                        "Allocated Hrs",
                                                        "Work Hrs",
                                                        "Avg Goal"
                                                    ].map((label, i) => (

                                                        <div
                                                            key={i}
                                                            className="flex items-center gap-2"
                                                        >

                                                            <span
                                                                className="w-3 h-3 rounded-full"
                                                                style={{
                                                                    background: [
                                                                        "#ff6a1f",
                                                                        "#059669",
                                                                        "#52525b",
                                                                        "#ffa06b",
                                                                        "#d97706",
                                                                    ][i],
                                                                }}
                                                            />

                                                            <span className="text-ink-600 dark:text-ink-300">
                                                                {label}
                                                            </span>

                                                        </div>
                                                    ))}

                                                </div>

                                                {/* EFFICIENCY */}
                                                <div className="
                mt-5
                px-4
                py-2
                rounded-xl
                bg-brand-50
                text-center
                w-full
            ">

                                                    <p className="
                    text-[11px]
                    uppercase
                    tracking-widest
                    text-brand-400
                ">
                                                        Efficiency
                                                    </p>

                                                    <h3 className="
                    text-2xl
                    font-bold
                    text-brand-700
                    mt-1
                ">
                                                        {item.subtitle}
                                                    </h3>

                                                </div>
                                            </>


                                        </div>
                                    </div>
                                    {/* METRICS */}
                                    <div className="
    grid
    grid-cols-1
    sm:grid-cols-2
    xl:grid-cols-3
    gap-4
    flex-1
    w-full
">
                                        {[
                                            {
                                                label: "Target %",
                                                value: item.values[0],
                                                color: "red",
                                                icon: "target",
                                            },
                                            // {
                                            //     label: "Utilization %",
                                            //     value: item.values[1],
                                            //     color: "green",
                                            //     icon: "pulse",
                                            // },
                                            {
                                                label: "Allocated Hrs",
                                                value: item.values[2],
                                                color: "yellow",
                                                icon: "clock",
                                            },
                                            {
                                                label: "Work Hrs",
                                                value: item.values[3],
                                                color: "purple",
                                                icon: "briefcase",
                                            },
                                            {
                                                label: "Avg Goal",
                                                value: item.values[4],
                                                color: "indigo",
                                                icon: "target",
                                            },
                                            {
                                                label: "Efficiency",
                                                value: item.subtitle,
                                                color: "blue",
                                                icon: "brain",
                                            },
                                        ].map((metric, idx) => {

                                            const value = metric.value;

                                            return (

                                                <div
                                                    key={idx}
                                                    className="
    bg-ink-50 dark:bg-ink-950
    rounded-xl
    p-4
    min-h-[120px]
    flex
    flex-col
    justify-between
"
                                                >

                                                    {/* TOP */}
                                                    <div className="flex items-center justify-between">

                                                        <span className="
                                                    text-[10px]
                                                    font-semibold
                                                    tracking-wide
                                                    text-ink-500 dark:text-ink-400
                                                    uppercase
                                                ">
                                                            {metric.label}
                                                        </span>

                                                        <div className="opacity-60">

                                                            <IconSet
                                                                type={metric.icon}
                                                                stroke="#6b7280"
                                                            />

                                                        </div>

                                                    </div>

                                                    {/* VALUE */}
                                                    <div className="mt-2">

                                                        <h3 className="
                                                    text-lg
                                                    font-semibold
                                                    text-ink-900 dark:text-white
                                                ">

                                                            {typeof value === "number"
                                                                ? metric.label.includes("%")
                                                                    ? `${value}%`
                                                                    : value
                                                                : value ?? "—"}

                                                        </h3>

                                                    </div>

                                                    {/* MINI GRAPH */}
                                                    {typeof value === "number" && (

                                                        <div className="
                                                    mt-3
                                                    flex
                                                    items-end
                                                    gap-1
                                                    h-7
                                                ">

                                                            {[20, 40, 60, 80, 100].map((v, barIndex) => {

                                                                const height = Math.max(
                                                                    10,
                                                                    (value / 100) * v
                                                                );

                                                                const color =
                                                                    metric.color === "red"
                                                                        ? ["#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ff4b2b"]
                                                                        : metric.color === "green"
                                                                            ? ["#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#059669"]
                                                                            : metric.color === "yellow"
                                                                                ? ["#fef9c3", "#fef08a", "#fde047", "#facc15", "#d97706"]
                                                                                : metric.color === "purple"
                                                                                    ? ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"]
                                                                                    : metric.color === "indigo"
                                                                                        ? ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"]
                                                                                        : ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"];

                                                                return (
                                                                    <div
                                                                        key={barIndex}
                                                                        className="flex-1 rounded-sm"
                                                                        style={{
                                                                            height: `${height}%`,
                                                                            background: color[barIndex],
                                                                        }}
                                                                    />
                                                                );
                                                            })}

                                                        </div>
                                                    )}

                                                </div>
                                            );
                                        })}

                                    </div>

                                </div>






                            </div>
                        ))}

                    </div>

                </div>

                {/* RIGHT SECTION */}
                <div className="
                w-full
                xl:w-[360px]
                shrink-0
                self-stretch
            ">

                    <div className="h-full">
                        <EfficiencyRules />
                    </div>

                </div>

            </div>
        );

    });


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
            <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <PageTitle title="Dashboard" subtitle="View detailed insights into your department's daily work" />

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

                    <DateRangeDropdown
                        value={dateRange}
                        onChange={setDateRange}
                    />
                </div>
            </div>



            {/*  Main Grid  */}
            {isAdmin ? (
                <Tabs
                    aria-label="Admin tabs"
                    variant="full"
                    onSelectionChange={(selected) => {
                        const typeMap: { [key: string]: "all" | "business" | "support" } = {
                            "Overview": "all",
                            "Business": "business",
                            "Support": "support"
                        };
                        setDepartmentType(typeMap[selected as string] || "all");
                    }}
                >                    <Tab key="Overview" title="Overview" className="flex flex-col items-end">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <Card className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10 rounded-xl shadow-sm col-span-3">
                                <CardBody>

                                    {/* Admin / Employee top section */}
                                    {(isAdmin || isEmployee) && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                            {/* Col 1 – actions + chart */}
                                            <div className="flex flex-col gap-3">
                                                {/* Run Report & Missing Logs only for admin */}

                                                {isAdmin && !hasDepartment && (
                                                    <>
                                                        <Button
                                                            variant="flat" size="sm" color="primary"
                                                            className="px-4 h-8 w-fit"
                                                            isDisabled={loading}
                                                            onClick={handleRunReport}
                                                        >
                                                            {loading ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                                                    Processing...
                                                                </div>
                                                            ) : (
                                                                "Run Report"
                                                            )}
                                                        </Button>

                                                        {/* <Switch isSelected={dateModification} size="sm" onValueChange={toggleDateModification}>
                                                Toggle Date selection
                                            </Switch> */}
                                                        <Button
                                                            variant="flat" size="sm" color="primary"
                                                            className="px-4 h-8 w-fit"
                                                            onClick={() => setIsLogDrawerOpen(true)}
                                                        >
                                                            View Missing Logs
                                                        </Button>
                                                    </>
                                                )}

                                                {/* Employee radial chart */}
                                                {isEmployee && (
                                                    <RadialSummaryCard
                                                        title={currentUserSummary.title || "EMPLOYEE SUMMARY"}
                                                        values={currentUserSummary.values}
                                                        subtitle={currentUserSummary.subtitle}
                                                        loading={loading}
                                                    />
                                                )}

                                                {/* Company radial chart */}
                                                {!hasDepartment && (
                                                    <RadialSummaryCard
                                                        title="GLOBAL SUMMARY"
                                                        values={stats.map((s) => Number(s.value) || 0)}
                                                        loading={loading}
                                                    />
                                                )}
                                            </div>

                                            {/* Col 2 – Stats panel (admin, no department) */}
                                            {!hasDepartment && companySummary && (
                                                <div className="flex p-1 text-[12px]">
                                                    <div className="w-full">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {stats.map((item, i) => {
                                                                const value = item.value;

                                                                return (
                                                                    <div
                                                                        key={i}
                                                                        className="flex min-h-[112px] flex-col justify-between border border-ink-200 bg-white p-4 transition-colors hover:border-brand-300 dark:border-white/10 dark:bg-ink-900 dark:hover:border-brand-500/50"
                                                                    >

                                                                        {/* TOP ROW */}
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="pr-2 font-secondary text-[10px] font-medium uppercase leading-snug tracking-wider text-ink-500 dark:text-ink-400">
                                                                                {item.label}
                                                                            </span>

                                                                            <div className="opacity-60">
                                                                                <IconSet type={item.icon} stroke="#6b7280" />
                                                                            </div>
                                                                        </div>

                                                                        {/* VALUE */}
                                                                        <div className="mt-2">
                                                                            <h2 className="text-[26px] font-semibold leading-none text-ink-900 dark:text-white">
                                                                                {typeof value === "number"
                                                                                    ? item.label.includes("%")
                                                                                        ? `${value}%`
                                                                                        : value
                                                                                    : value ?? "—"}
                                                                            </h2>
                                                                        </div>

                                                                        {/* MINI BAR GRAPH */}
                                                                        {typeof value === "number" && (
                                                                            <div className="mt-3 flex items-end gap-1 h-8">
                                                                                {[20, 40, 60, 80, 100].map((v, idx) => {
                                                                                    const height = Math.max(10, (value / 100) * v);

                                                                                    const color =
                                                                                        item.color === "red"
                                                                                            ? ["#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ff4b2b"]
                                                                                            : item.color === "green"
                                                                                                ? ["#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#059669"]
                                                                                                : item.color === "yellow"
                                                                                                    ? ["#fef9c3", "#fef08a", "#fde047", "#facc15", "#d97706"]
                                                                                                    : item.color === "purple"
                                                                                                        ? ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"]
                                                                                                        : ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"];

                                                                                    return (
                                                                                        <div
                                                                                            key={idx}
                                                                                            className="flex-1 rounded-sm"
                                                                                            style={{
                                                                                                height: `${height}%`,
                                                                                                background: color[idx],
                                                                                            }}
                                                                                        />
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}

                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Col 2 – Employee stat card (with department) */}
                                            {hasDepartment && isEmployee && (
                                                <div className="bg-white dark:bg-ink-900 rounded-xl p-4 text-[12px] flex w-full">

                                                    <div className="w-full">

                                                        <div className="grid grid-cols-2 gap-3">

                                                            {[
                                                                {
                                                                    label: "Target %",
                                                                    value: currentUserSummary.values[0],
                                                                    color: "red",
                                                                    icon: "target",
                                                                },
                                                                // {
                                                                //     label: "Utilization %",
                                                                //     value: currentUserSummary.values[1],
                                                                //     color: "green",
                                                                //     icon: "pulse",
                                                                // },
                                                                {
                                                                    label: "Allocated Hrs",
                                                                    value: currentUserSummary.values[2],
                                                                    color: "yellow",
                                                                    icon: "clock",
                                                                },
                                                                {
                                                                    label: "Work Hrs",
                                                                    value: currentUserSummary.values[3],
                                                                    color: "purple",
                                                                    icon: "briefcase",
                                                                },
                                                                {
                                                                    label: "Efficiency",
                                                                    value: currentUserSummary.subtitle,
                                                                    color: "blue",
                                                                    icon: "brain",
                                                                },
                                                            ].map((item, i) => {

                                                                const value = item.value;

                                                                return (
                                                                    <div
                                                                        key={i}
                                                                        className="flex min-h-[112px] flex-col justify-between border border-ink-200 bg-white p-4 transition-colors hover:border-brand-300 dark:border-white/10 dark:bg-ink-900 dark:hover:border-brand-500/50"
                                                                    >

                                                                        {/* TOP ROW */}
                                                                        <div className="flex items-center justify-between">

                                                                            <span className="pr-2 font-secondary text-[10px] font-medium uppercase leading-snug tracking-wider text-ink-500 dark:text-ink-400">
                                                                                {item.label}
                                                                            </span>

                                                                            <div className="opacity-60">
                                                                                <IconSet
                                                                                    type={item.icon}
                                                                                    stroke="#6b7280"
                                                                                />
                                                                            </div>

                                                                        </div>

                                                                        {/* VALUE */}
                                                                        <div className="mt-2">

                                                                            <h2 className="text-[26px] font-semibold leading-none text-ink-900 dark:text-white">

                                                                                {typeof value === "number"
                                                                                    ? item.label.includes("%")
                                                                                        ? `${value}%`
                                                                                        : value
                                                                                    : value ?? "—"}

                                                                            </h2>

                                                                        </div>

                                                                        {/* MINI BAR GRAPH */}
                                                                        {typeof value === "number" && (

                                                                            <div className="mt-3 flex items-end gap-1 h-8">

                                                                                {[20, 40, 60, 80, 100].map((v, idx) => {

                                                                                    const height = Math.max(
                                                                                        10,
                                                                                        (value / 100) * v
                                                                                    );

                                                                                    const color =
                                                                                        item.color === "red"
                                                                                            ? ["#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ff4b2b"]
                                                                                            : item.color === "green"
                                                                                                ? ["#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#059669"]
                                                                                                : item.color === "yellow"
                                                                                                    ? ["#fef9c3", "#fef08a", "#fde047", "#facc15", "#d97706"]
                                                                                                    : item.color === "purple"
                                                                                                        ? ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"]
                                                                                                        : ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"];

                                                                                    return (
                                                                                        <div
                                                                                            key={idx}
                                                                                            className="flex-1 rounded-sm"
                                                                                            style={{
                                                                                                height: `${height}%`,
                                                                                                background: color[idx],
                                                                                            }}
                                                                                        />
                                                                                    );
                                                                                })}

                                                                            </div>
                                                                        )}

                                                                    </div>
                                                                );
                                                            })}

                                                        </div>

                                                    </div>

                                                </div>
                                            )}

                                            {/* Col 3 – Rules (always visible in admin/employee view) */}
                                            <EfficiencyRules />
                                        </div>
                                    )}

                                    {/* EL Summary Grid */}
                                    {isEL && ELUserSummaryGraph && (
                                        <LeaderSummaryGrid data={ELUserSummaryGraph} loading={loading} />
                                    )}

                                    {/* FL Summary Grid */}
                                    {isFL && FLUserSummaryGraph && (
                                        <LeaderSummaryGrid data={FLUserSummaryGraph} loading={loading} />
                                    )}
                                </CardBody>
                            </Card>

                            {/* ── EL Department Tabs ─────────────────────────────────────────── */}
                            {/* {isEL && (
                    <div className="col-span-3 flex justify-center mt-4">
                        <Card className="w-full">
                            <CardBody>
                                <Tabs aria-label="EL departments" variant="full">
                                    {ELUserSummary?.[0]?.departments?.map((ele: any) => (
                                        <Tab key={ele.DepartmentName} title={ele.DepartmentName} className="flex flex-col items-start">
                                            <EfficiencyTable data={ele.users} type="ELU" />
                                        </Tab>
                                    ))}
                                    <Tab key="ALL_DEPARTMENTS" title="All Departments" className="flex flex-col items-start">
                                        <EfficiencyTable data={allUser} type="ELU" />
                                    </Tab>
                                </Tabs>
                            </CardBody>
                        </Card>
                    </div>
                )} */}

                            {/* {isEL && (
                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>

                                            <div className="flex flex-col w-full justify-between gap-4">

                                                <Card>
                                                    <CardBody>
                                                        <ColumnChart
                                                            dept={false}
                                                            labels={
                                                                ELUserSummary?.[0]?.departments?.map(
                                                                    (ele: any) => ele.DepartmentName
                                                                ) || []
                                                            }
                                                            values={
                                                                ELUserSummary?.[0]?.departments?.map(
                                                                    (ele: any) => Number(ele.AvgTargetPercent || 0)
                                                                ) || []
                                                            }
                                                            goals={
                                                                ELUserSummary?.[0]?.departments?.map(
                                                                    (ele: any) => Number(ele.AvgGoalEfficiency || 0)
                                                                ) || []
                                                            }
                                                        />
                                                    </CardBody>
                                                </Card>

                                                <ELDashboard data={ELUserSummary || []} />

                                            </div>

                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}

                            {/* ── FL Department Tabs ─────────────────────────────────────────── */}
                            {/* {isFL && (
                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>
                                            <Tabs aria-label="FL departments" variant="full">
                                                {FLUserSummary?.[0]?.departments?.map((ele: any) => (
                                                    <Tab key={ele.DepartmentName} title={ele.DepartmentName} className="flex flex-col items-start">
                                                        <EfficiencyTable data={ele.users} type="ELU" />
                                                    </Tab>
                                                ))}
                                                <Tab key="ALL_DEPARTMENTS" title="All Departments" className="flex flex-col items-start">
                                                    <EfficiencyTable data={allUser} type="ELU" />
                                                </Tab>
                                            </Tabs>
                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}

                            {/* ── Admin Tabs (Department / EL) ───────────────────────────────── */}
                            {/* {isAdmin && (

                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>
                                            <Tabs aria-label="Admin tabs" variant="full">
                                                <Tab key="EXECUTIVE LEADER" title="EXECUTIVE LEADER" className="flex flex-col items-end">
                                                    <div className="flex flex-col w-full justify-between gap-4">
                                                        
                                                        
                                                        {
                                                            isAdmin && (
                                                                <ELDashboard data={elData} />

                                                            )
                                                        }
                                                    </div>

                                                </Tab>
                                                <Tab key="DEPARTMENT" title="DEPARTMENT" className="flex flex-col items-end">
                                        {!hasDepartment && (
                                            <div className="flex flex-col w-full justify-between gap-4">
                                                <Autocomplete
                                                    aria-label="Filter by Department"
                                                    placeholder="Filter by Department"
                                                    className="max-w-xs mr-4"
                                                    selectedKey={selectedDepartment}
                                                    onSelectionChange={(key) => setSelectedDepartment(key as string)}
                                                >
                                                    {departmentList
                                                        .filter((d) => d.status === "Active")
                                                        .map((d) => (
                                                            <AutocompleteItem key={d.key} value={d.name}>
                                                                {d.name.replace(/([A-Z])/g, " $1").trim()}
                                                            </AutocompleteItem>
                                                        ))}
                                                </Autocomplete>
                                                <Card>
                                                    <CardBody>
                                                        <ColumnChart
                                                            dept={true}

                                                            labels={Object.values(departmentSummaryFiltered).map((ele: any) => ele.DepartmentName)}
                                                            values={Object.values(departmentSummaryFiltered).map((ele: any) => ele.AvgTargetPercent) as number[]}
                                                            goals={Object.values(departmentSummaryFiltered).map((ele: any) => ele.AvgGoalEfficiency) as number[]}

                                                        />
                                                    </CardBody>
                                                </Card>

                                            </div>

                                        )}

                                        <EfficiencyTable data={departmentSummaryFiltered} type="department" />
                                    </Tab>


                                            </Tabs>
                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}

                            {/* ── Employee daily data table ──────────────────────────────────── */}
                            {/* {isEmployee && (
                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>
                                            <EfficiencyTable data={userSummaryData} type="user" />
                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}
                        </div>
                    </Tab>
                    <Tab key="Business" title="Business" className="flex flex-col items-end">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <Card className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10 rounded-xl shadow-sm col-span-3">
                                <CardBody>

                                    {/* Admin / Employee top section */}
                                    {(isAdmin || isEmployee) && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                            {/* Col 1 – actions + chart */}
                                            <div className="flex flex-col gap-3">
                                                {/* Run Report & Missing Logs only for admin */}

                                                {isAdmin && !hasDepartment && (
                                                    <>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="flat" size="sm" color="primary"
                                                                className="px-4 h-8 w-fit"
                                                                isDisabled={loading}
                                                                onClick={handleRunReport}
                                                            >
                                                                {loading ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                                                        Processing...
                                                                    </div>
                                                                ) : (
                                                                    "Run Report"
                                                                )}
                                                            </Button>

                                                            {/* <Button
                                                                variant="flat"
                                                                size="sm"
                                                                color="primary"
                                                                className="px-4 h-8 w-fit"
                                                                isDisabled={loading || hasDepartment}
                                                                onClick={handleDownload}
                                                            >
                                                                Download
                                                            </Button> */}
                                                        </div>

                                                        {/* <Switch isSelected={dateModification} size="sm" onValueChange={toggleDateModification}>
                                                Toggle Date selection
                                            </Switch> */}
                                                        <Button
                                                            variant="flat" size="sm" color="primary"
                                                            className="px-4 h-8 w-fit"
                                                            onClick={() => setIsLogDrawerOpen(true)}
                                                        >
                                                            View Missing Logs
                                                        </Button>
                                                    </>
                                                )}

                                                {/* Employee radial chart */}
                                                {isEmployee && (
                                                    <RadialSummaryCard
                                                        title={currentUserSummary.title || "EMPLOYEE SUMMARY"}
                                                        values={currentUserSummary.values}
                                                        subtitle={currentUserSummary.subtitle}
                                                        loading={loading}
                                                    />
                                                )}

                                                {/* Company radial chart */}
                                                {!hasDepartment && (
                                                    <RadialSummaryCard
                                                        title="GLOBAL SUMMARY"
                                                        values={stats.map((s) => Number(s.value) || 0)}
                                                        loading={loading}
                                                    />
                                                )}
                                            </div>

                                            {/* Col 2 – Stats panel (admin, no department) */}
                                            {!hasDepartment && companySummary && (
                                                <div className="flex p-1 text-[12px]">
                                                    <div className="w-full">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {stats.map((item, i) => {
                                                                const value = item.value;

                                                                return (
                                                                    <div
                                                                        key={i}
                                                                        className="flex min-h-[112px] flex-col justify-between border border-ink-200 bg-white p-4 transition-colors hover:border-brand-300 dark:border-white/10 dark:bg-ink-900 dark:hover:border-brand-500/50"
                                                                    >

                                                                        {/* TOP ROW */}
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="pr-2 font-secondary text-[10px] font-medium uppercase leading-snug tracking-wider text-ink-500 dark:text-ink-400">
                                                                                {item.label}
                                                                            </span>

                                                                            <div className="opacity-60">
                                                                                <IconSet type={item.icon} stroke="#6b7280" />
                                                                            </div>
                                                                        </div>

                                                                        {/* VALUE */}
                                                                        <div className="mt-2">
                                                                            <h2 className="text-[26px] font-semibold leading-none text-ink-900 dark:text-white">
                                                                                {typeof value === "number"
                                                                                    ? item.label.includes("%")
                                                                                        ? `${value}%`
                                                                                        : value
                                                                                    : value ?? "—"}
                                                                            </h2>
                                                                        </div>

                                                                        {/* MINI BAR GRAPH */}
                                                                        {typeof value === "number" && (
                                                                            <div className="mt-3 flex items-end gap-1 h-8">
                                                                                {[20, 40, 60, 80, 100].map((v, idx) => {
                                                                                    const height = Math.max(10, (value / 100) * v);

                                                                                    const color =
                                                                                        item.color === "red"
                                                                                            ? ["#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ff4b2b"]
                                                                                            : item.color === "green"
                                                                                                ? ["#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#059669"]
                                                                                                : item.color === "yellow"
                                                                                                    ? ["#fef9c3", "#fef08a", "#fde047", "#facc15", "#d97706"]
                                                                                                    : item.color === "purple"
                                                                                                        ? ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"]
                                                                                                        : ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"];

                                                                                    return (
                                                                                        <div
                                                                                            key={idx}
                                                                                            className="flex-1 rounded-sm"
                                                                                            style={{
                                                                                                height: `${height}%`,
                                                                                                background: color[idx],
                                                                                            }}
                                                                                        />
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}

                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Col 2 – Employee stat card (with department) */}
                                            {hasDepartment && isEmployee && (
                                                <div className="bg-white dark:bg-ink-900 rounded-xl p-4 text-[12px] flex w-full">

                                                    <div className="w-full">

                                                        <div className="grid grid-cols-2 gap-3">

                                                            {[
                                                                {
                                                                    label: "Target %",
                                                                    value: currentUserSummary.values[0],
                                                                    color: "red",
                                                                    icon: "target",
                                                                },
                                                                // {
                                                                //     label: "Utilization %",
                                                                //     value: currentUserSummary.values[1],
                                                                //     color: "green",
                                                                //     icon: "pulse",
                                                                // },
                                                                {
                                                                    label: "Allocated Hrs",
                                                                    value: currentUserSummary.values[2],
                                                                    color: "yellow",
                                                                    icon: "clock",
                                                                },
                                                                {
                                                                    label: "Work Hrs",
                                                                    value: currentUserSummary.values[3],
                                                                    color: "purple",
                                                                    icon: "briefcase",
                                                                },
                                                                {
                                                                    label: "Efficiency",
                                                                    value: currentUserSummary.subtitle,
                                                                    color: "blue",
                                                                    icon: "brain",
                                                                },
                                                            ].map((item, i) => {

                                                                const value = item.value;

                                                                return (
                                                                    <div
                                                                        key={i}
                                                                        className="flex min-h-[112px] flex-col justify-between border border-ink-200 bg-white p-4 transition-colors hover:border-brand-300 dark:border-white/10 dark:bg-ink-900 dark:hover:border-brand-500/50"
                                                                    >

                                                                        {/* TOP ROW */}
                                                                        <div className="flex items-center justify-between">

                                                                            <span className="pr-2 font-secondary text-[10px] font-medium uppercase leading-snug tracking-wider text-ink-500 dark:text-ink-400">
                                                                                {item.label}
                                                                            </span>

                                                                            <div className="opacity-60">
                                                                                <IconSet
                                                                                    type={item.icon}
                                                                                    stroke="#6b7280"
                                                                                />
                                                                            </div>

                                                                        </div>

                                                                        {/* VALUE */}
                                                                        <div className="mt-2">

                                                                            <h2 className="text-[26px] font-semibold leading-none text-ink-900 dark:text-white">

                                                                                {typeof value === "number"
                                                                                    ? item.label.includes("%")
                                                                                        ? `${value}%`
                                                                                        : value
                                                                                    : value ?? "—"}

                                                                            </h2>

                                                                        </div>

                                                                        {/* MINI BAR GRAPH */}
                                                                        {typeof value === "number" && (

                                                                            <div className="mt-3 flex items-end gap-1 h-8">

                                                                                {[20, 40, 60, 80, 100].map((v, idx) => {

                                                                                    const height = Math.max(
                                                                                        10,
                                                                                        (value / 100) * v
                                                                                    );

                                                                                    const color =
                                                                                        item.color === "red"
                                                                                            ? ["#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ff4b2b"]
                                                                                            : item.color === "green"
                                                                                                ? ["#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#059669"]
                                                                                                : item.color === "yellow"
                                                                                                    ? ["#fef9c3", "#fef08a", "#fde047", "#facc15", "#d97706"]
                                                                                                    : item.color === "purple"
                                                                                                        ? ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"]
                                                                                                        : ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"];

                                                                                    return (
                                                                                        <div
                                                                                            key={idx}
                                                                                            className="flex-1 rounded-sm"
                                                                                            style={{
                                                                                                height: `${height}%`,
                                                                                                background: color[idx],
                                                                                            }}
                                                                                        />
                                                                                    );
                                                                                })}

                                                                            </div>
                                                                        )}

                                                                    </div>
                                                                );
                                                            })}

                                                        </div>

                                                    </div>

                                                </div>
                                            )}

                                            {/* Col 3 – Rules (always visible in admin/employee view) */}
                                            <EfficiencyRules />
                                        </div>
                                    )}

                                    {/* EL Summary Grid */}
                                    {isEL && ELUserSummaryGraph && (
                                        <LeaderSummaryGrid data={ELUserSummaryGraph} loading={loading} />
                                    )}

                                    {/* FL Summary Grid */}
                                    {isFL && FLUserSummaryGraph && (
                                        <LeaderSummaryGrid data={FLUserSummaryGraph} loading={loading} />
                                    )}
                                </CardBody>
                            </Card>

                            {/* ── EL Department Tabs ─────────────────────────────────────────── */}
                            {/* {isEL && (
                    <div className="col-span-3 flex justify-center mt-4">
                        <Card className="w-full">
                            <CardBody>
                                <Tabs aria-label="EL departments" variant="full">
                                    {ELUserSummary?.[0]?.departments?.map((ele: any) => (
                                        <Tab key={ele.DepartmentName} title={ele.DepartmentName} className="flex flex-col items-start">
                                            <EfficiencyTable data={ele.users} type="ELU" />
                                        </Tab>
                                    ))}
                                    <Tab key="ALL_DEPARTMENTS" title="All Departments" className="flex flex-col items-start">
                                        <EfficiencyTable data={allUser} type="ELU" />
                                    </Tab>
                                </Tabs>
                            </CardBody>
                        </Card>
                    </div>
                )} */}

                            {/* {isEL && (
                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>

                                            <div className="flex flex-col w-full justify-between gap-4">

                                                <Card>
                                                    <CardBody>
                                                        <ColumnChart
                                                            dept={false}
                                                            labels={
                                                                ELUserSummary?.[0]?.departments?.map(
                                                                    (ele: any) => ele.DepartmentName
                                                                ) || []
                                                            }
                                                            values={
                                                                ELUserSummary?.[0]?.departments?.map(
                                                                    (ele: any) => Number(ele.AvgTargetPercent || 0)
                                                                ) || []
                                                            }
                                                            goals={
                                                                ELUserSummary?.[0]?.departments?.map(
                                                                    (ele: any) => Number(ele.AvgGoalEfficiency || 0)
                                                                ) || []
                                                            }
                                                        />
                                                    </CardBody>
                                                </Card>

                                                <ELDashboard data={ELUserSummary || []} />

                                            </div>

                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}

                            {/* ── FL Department Tabs ─────────────────────────────────────────── */}
                            {/* {isFL && (
                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>
                                            <Tabs aria-label="FL departments" variant="full">
                                                {FLUserSummary?.[0]?.departments?.map((ele: any) => (
                                                    <Tab key={ele.DepartmentName} title={ele.DepartmentName} className="flex flex-col items-start">
                                                        <EfficiencyTable data={ele.users} type="ELU" />
                                                    </Tab>
                                                ))}
                                                <Tab key="ALL_DEPARTMENTS" title="All Departments" className="flex flex-col items-start">
                                                    <EfficiencyTable data={allUser} type="ELU" />
                                                </Tab>
                                            </Tabs>
                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}

                            {/* ── Admin Tabs (Department / EL) ───────────────────────────────── */}
                            {/* {isAdmin && (

                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>
                                            <Tabs aria-label="Admin tabs" variant="full">
                                                <Tab key="EXECUTIVE LEADER" title="EXECUTIVE LEADER" className="flex flex-col items-end">
                                                    <div className="flex flex-col w-full justify-between gap-4">
                                                        
                                                        
                                                        {
                                                            isAdmin && (
                                                                <ELDashboard data={elData} />

                                                            )
                                                        }
                                                    </div>

                                                </Tab>
                                                <Tab key="DEPARTMENT" title="DEPARTMENT" className="flex flex-col items-end">
                                        {!hasDepartment && (
                                            <div className="flex flex-col w-full justify-between gap-4">
                                                <Autocomplete
                                                    aria-label="Filter by Department"
                                                    placeholder="Filter by Department"
                                                    className="max-w-xs mr-4"
                                                    selectedKey={selectedDepartment}
                                                    onSelectionChange={(key) => setSelectedDepartment(key as string)}
                                                >
                                                    {departmentList
                                                        .filter((d) => d.status === "Active")
                                                        .map((d) => (
                                                            <AutocompleteItem key={d.key} value={d.name}>
                                                                {d.name.replace(/([A-Z])/g, " $1").trim()}
                                                            </AutocompleteItem>
                                                        ))}
                                                </Autocomplete>
                                                <Card>
                                                    <CardBody>
                                                        <ColumnChart
                                                            dept={true}

                                                            labels={Object.values(departmentSummaryFiltered).map((ele: any) => ele.DepartmentName)}
                                                            values={Object.values(departmentSummaryFiltered).map((ele: any) => ele.AvgTargetPercent) as number[]}
                                                            goals={Object.values(departmentSummaryFiltered).map((ele: any) => ele.AvgGoalEfficiency) as number[]}

                                                        />
                                                    </CardBody>
                                                </Card>

                                            </div>

                                        )}

                                        <EfficiencyTable data={departmentSummaryFiltered} type="department" />
                                    </Tab>


                                            </Tabs>
                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}

                            {/* ── Employee daily data table ──────────────────────────────────── */}
                            {/* {isEmployee && (
                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>
                                            <EfficiencyTable data={userSummaryData} type="user" />
                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}
                        </div>
                    </Tab>
                    <Tab key="Support" title="Support Functions" className="flex flex-col items-end">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <Card className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10 rounded-xl shadow-sm col-span-3">
                                <CardBody>

                                    {/* Admin / Employee top section */}
                                    {(isAdmin || isEmployee) && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                            {/* Col 1 – actions + chart */}
                                            <div className="flex flex-col gap-3">
                                                {/* Run Report & Missing Logs only for admin */}

                                                {isAdmin && !hasDepartment && (
                                                    <>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="flat" size="sm" color="primary"
                                                                className="px-4 h-8 w-fit"
                                                                isDisabled={loading}
                                                                onClick={handleRunReport}
                                                            >
                                                                {loading ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                                                        Processing...
                                                                    </div>
                                                                ) : (
                                                                    "Run Report"
                                                                )}
                                                            </Button>

                                                            {/* <Button
                                                                variant="flat"
                                                                size="sm"
                                                                color="primary"
                                                                className="px-4 h-8 w-fit"
                                                                isDisabled={loading || hasDepartment}
                                                                onClick={handleDownload}
                                                            >
                                                                Download
                                                            </Button> */}
                                                        </div>

                                                        {/* <Switch isSelected={dateModification} size="sm" onValueChange={toggleDateModification}>
                                                Toggle Date selection
                                            </Switch> */}
                                                        <Button
                                                            variant="flat" size="sm" color="primary"
                                                            className="px-4 h-8 w-fit"
                                                            onClick={() => setIsLogDrawerOpen(true)}
                                                        >
                                                            View Missing Logs
                                                        </Button>
                                                    </>
                                                )}

                                                {/* Employee radial chart */}
                                                {isEmployee && (
                                                    <RadialSummaryCard
                                                        title={currentUserSummary.title || "EMPLOYEE SUMMARY"}
                                                        values={currentUserSummary.values}
                                                        subtitle={currentUserSummary.subtitle}
                                                        loading={loading}
                                                    />
                                                )}

                                                {/* Company radial chart */}
                                                {!hasDepartment && (
                                                    <RadialSummaryCard
                                                        title="GLOBAL SUMMARY"
                                                        values={stats.map((s) => Number(s.value) || 0)}
                                                        loading={loading}
                                                    />
                                                )}
                                            </div>

                                            {/* Col 2 – Stats panel (admin, no department) */}
                                            {!hasDepartment && companySummary && (
                                                <div className="flex p-1 text-[12px]">
                                                    <div className="w-full">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {stats.map((item, i) => {
                                                                const value = item.value;

                                                                return (
                                                                    <div
                                                                        key={i}
                                                                        className="flex min-h-[112px] flex-col justify-between border border-ink-200 bg-white p-4 transition-colors hover:border-brand-300 dark:border-white/10 dark:bg-ink-900 dark:hover:border-brand-500/50"
                                                                    >

                                                                        {/* TOP ROW */}
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="pr-2 font-secondary text-[10px] font-medium uppercase leading-snug tracking-wider text-ink-500 dark:text-ink-400">
                                                                                {item.label}
                                                                            </span>

                                                                            <div className="opacity-60">
                                                                                <IconSet type={item.icon} stroke="#6b7280" />
                                                                            </div>
                                                                        </div>

                                                                        {/* VALUE */}
                                                                        <div className="mt-2">
                                                                            <h2 className="text-[26px] font-semibold leading-none text-ink-900 dark:text-white">
                                                                                {typeof value === "number"
                                                                                    ? item.label.includes("%")
                                                                                        ? `${value}%`
                                                                                        : value
                                                                                    : value ?? "—"}
                                                                            </h2>
                                                                        </div>

                                                                        {/* MINI BAR GRAPH */}
                                                                        {typeof value === "number" && (
                                                                            <div className="mt-3 flex items-end gap-1 h-8">
                                                                                {[20, 40, 60, 80, 100].map((v, idx) => {
                                                                                    const height = Math.max(10, (value / 100) * v);

                                                                                    const color =
                                                                                        item.color === "red"
                                                                                            ? ["#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ff4b2b"]
                                                                                            : item.color === "green"
                                                                                                ? ["#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#059669"]
                                                                                                : item.color === "yellow"
                                                                                                    ? ["#fef9c3", "#fef08a", "#fde047", "#facc15", "#d97706"]
                                                                                                    : item.color === "purple"
                                                                                                        ? ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"]
                                                                                                        : ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"];

                                                                                    return (
                                                                                        <div
                                                                                            key={idx}
                                                                                            className="flex-1 rounded-sm"
                                                                                            style={{
                                                                                                height: `${height}%`,
                                                                                                background: color[idx],
                                                                                            }}
                                                                                        />
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}

                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Col 2 – Employee stat card (with department) */}
                                            {hasDepartment && isEmployee && (
                                                <div className="bg-white dark:bg-ink-900 rounded-xl p-4 text-[12px] flex w-full">

                                                    <div className="w-full">

                                                        <div className="grid grid-cols-2 gap-3">

                                                            {[
                                                                {
                                                                    label: "Target %",
                                                                    value: currentUserSummary.values[0],
                                                                    color: "red",
                                                                    icon: "target",
                                                                },
                                                                // {
                                                                //     label: "Utilization %",
                                                                //     value: currentUserSummary.values[1],
                                                                //     color: "green",
                                                                //     icon: "pulse",
                                                                // },
                                                                {
                                                                    label: "Allocated Hrs",
                                                                    value: currentUserSummary.values[2],
                                                                    color: "yellow",
                                                                    icon: "clock",
                                                                },
                                                                {
                                                                    label: "Work Hrs",
                                                                    value: currentUserSummary.values[3],
                                                                    color: "purple",
                                                                    icon: "briefcase",
                                                                },
                                                                {
                                                                    label: "Efficiency",
                                                                    value: currentUserSummary.subtitle,
                                                                    color: "blue",
                                                                    icon: "brain",
                                                                },
                                                            ].map((item, i) => {

                                                                const value = item.value;

                                                                return (
                                                                    <div
                                                                        key={i}
                                                                        className="flex min-h-[112px] flex-col justify-between border border-ink-200 bg-white p-4 transition-colors hover:border-brand-300 dark:border-white/10 dark:bg-ink-900 dark:hover:border-brand-500/50"
                                                                    >

                                                                        {/* TOP ROW */}
                                                                        <div className="flex items-center justify-between">

                                                                            <span className="pr-2 font-secondary text-[10px] font-medium uppercase leading-snug tracking-wider text-ink-500 dark:text-ink-400">
                                                                                {item.label}
                                                                            </span>

                                                                            <div className="opacity-60">
                                                                                <IconSet
                                                                                    type={item.icon}
                                                                                    stroke="#6b7280"
                                                                                />
                                                                            </div>

                                                                        </div>

                                                                        {/* VALUE */}
                                                                        <div className="mt-2">

                                                                            <h2 className="text-[26px] font-semibold leading-none text-ink-900 dark:text-white">

                                                                                {typeof value === "number"
                                                                                    ? item.label.includes("%")
                                                                                        ? `${value}%`
                                                                                        : value
                                                                                    : value ?? "—"}

                                                                            </h2>

                                                                        </div>

                                                                        {/* MINI BAR GRAPH */}
                                                                        {typeof value === "number" && (

                                                                            <div className="mt-3 flex items-end gap-1 h-8">

                                                                                {[20, 40, 60, 80, 100].map((v, idx) => {

                                                                                    const height = Math.max(
                                                                                        10,
                                                                                        (value / 100) * v
                                                                                    );

                                                                                    const color =
                                                                                        item.color === "red"
                                                                                            ? ["#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ff4b2b"]
                                                                                            : item.color === "green"
                                                                                                ? ["#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#059669"]
                                                                                                : item.color === "yellow"
                                                                                                    ? ["#fef9c3", "#fef08a", "#fde047", "#facc15", "#d97706"]
                                                                                                    : item.color === "purple"
                                                                                                        ? ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"]
                                                                                                        : ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"];

                                                                                    return (
                                                                                        <div
                                                                                            key={idx}
                                                                                            className="flex-1 rounded-sm"
                                                                                            style={{
                                                                                                height: `${height}%`,
                                                                                                background: color[idx],
                                                                                            }}
                                                                                        />
                                                                                    );
                                                                                })}

                                                                            </div>
                                                                        )}

                                                                    </div>
                                                                );
                                                            })}

                                                        </div>

                                                    </div>

                                                </div>
                                            )}

                                            {/* Col 3 – Rules (always visible in admin/employee view) */}
                                            <EfficiencyRules />
                                        </div>
                                    )}

                                    {/* EL Summary Grid */}
                                    {isEL && ELUserSummaryGraph && (
                                        <LeaderSummaryGrid data={ELUserSummaryGraph} loading={loading} />
                                    )}

                                    {/* FL Summary Grid */}
                                    {isFL && FLUserSummaryGraph && (
                                        <LeaderSummaryGrid data={FLUserSummaryGraph} loading={loading} />
                                    )}
                                </CardBody>
                            </Card>

                            {/* ── EL Department Tabs ─────────────────────────────────────────── */}
                            {/* {isEL && (
                    <div className="col-span-3 flex justify-center mt-4">
                        <Card className="w-full">
                            <CardBody>
                                <Tabs aria-label="EL departments" variant="full">
                                    {ELUserSummary?.[0]?.departments?.map((ele: any) => (
                                        <Tab key={ele.DepartmentName} title={ele.DepartmentName} className="flex flex-col items-start">
                                            <EfficiencyTable data={ele.users} type="ELU" />
                                        </Tab>
                                    ))}
                                    <Tab key="ALL_DEPARTMENTS" title="All Departments" className="flex flex-col items-start">
                                        <EfficiencyTable data={allUser} type="ELU" />
                                    </Tab>
                                </Tabs>
                            </CardBody>
                        </Card>
                    </div>
                )} */}

                            {/* {isEL && (
                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>

                                            <div className="flex flex-col w-full justify-between gap-4">

                                                <Card>
                                                    <CardBody>
                                                        <ColumnChart
                                                            dept={false}
                                                            labels={
                                                                ELUserSummary?.[0]?.departments?.map(
                                                                    (ele: any) => ele.DepartmentName
                                                                ) || []
                                                            }
                                                            values={
                                                                ELUserSummary?.[0]?.departments?.map(
                                                                    (ele: any) => Number(ele.AvgTargetPercent || 0)
                                                                ) || []
                                                            }
                                                            goals={
                                                                ELUserSummary?.[0]?.departments?.map(
                                                                    (ele: any) => Number(ele.AvgGoalEfficiency || 0)
                                                                ) || []
                                                            }
                                                        />
                                                    </CardBody>
                                                </Card>

                                                <ELDashboard data={ELUserSummary || []} />

                                            </div>

                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}

                            {/* ── FL Department Tabs ─────────────────────────────────────────── */}
                            {/* {isFL && (
                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>
                                            <Tabs aria-label="FL departments" variant="full">
                                                {FLUserSummary?.[0]?.departments?.map((ele: any) => (
                                                    <Tab key={ele.DepartmentName} title={ele.DepartmentName} className="flex flex-col items-start">
                                                        <EfficiencyTable data={ele.users} type="ELU" />
                                                    </Tab>
                                                ))}
                                                <Tab key="ALL_DEPARTMENTS" title="All Departments" className="flex flex-col items-start">
                                                    <EfficiencyTable data={allUser} type="ELU" />
                                                </Tab>
                                            </Tabs>
                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}

                            {/* ── Admin Tabs (Department / EL) ───────────────────────────────── */}
                            {/* {isAdmin && (

                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>
                                            <Tabs aria-label="Admin tabs" variant="full">
                                                <Tab key="EXECUTIVE LEADER" title="EXECUTIVE LEADER" className="flex flex-col items-end">
                                                    <div className="flex flex-col w-full justify-between gap-4">
                                                        
                                                        
                                                        {
                                                            isAdmin && (
                                                                <ELDashboard data={elData} />

                                                            )
                                                        }
                                                    </div>

                                                </Tab>
                                                <Tab key="DEPARTMENT" title="DEPARTMENT" className="flex flex-col items-end">
                                        {!hasDepartment && (
                                            <div className="flex flex-col w-full justify-between gap-4">
                                                <Autocomplete
                                                    aria-label="Filter by Department"
                                                    placeholder="Filter by Department"
                                                    className="max-w-xs mr-4"
                                                    selectedKey={selectedDepartment}
                                                    onSelectionChange={(key) => setSelectedDepartment(key as string)}
                                                >
                                                    {departmentList
                                                        .filter((d) => d.status === "Active")
                                                        .map((d) => (
                                                            <AutocompleteItem key={d.key} value={d.name}>
                                                                {d.name.replace(/([A-Z])/g, " $1").trim()}
                                                            </AutocompleteItem>
                                                        ))}
                                                </Autocomplete>
                                                <Card>
                                                    <CardBody>
                                                        <ColumnChart
                                                            dept={true}

                                                            labels={Object.values(departmentSummaryFiltered).map((ele: any) => ele.DepartmentName)}
                                                            values={Object.values(departmentSummaryFiltered).map((ele: any) => ele.AvgTargetPercent) as number[]}
                                                            goals={Object.values(departmentSummaryFiltered).map((ele: any) => ele.AvgGoalEfficiency) as number[]}

                                                        />
                                                    </CardBody>
                                                </Card>

                                            </div>

                                        )}

                                        <EfficiencyTable data={departmentSummaryFiltered} type="department" />
                                    </Tab>


                                            </Tabs>
                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}

                            {/* ── Employee daily data table ──────────────────────────────────── */}
                            {/* {isEmployee && (
                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>
                                            <EfficiencyTable data={userSummaryData} type="user" />
                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}
                        </div>
                    </Tab>
                </Tabs>

            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-white/10 rounded-xl shadow-sm col-span-3">
                        <CardBody>

                            {/* Admin / Employee top section */}
                            {(isAdmin || isEmployee) && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                    {/* Col 1 – actions + chart */}
                                    <div className="flex flex-col gap-3">
                                        {/* Run Report & Missing Logs only for admin */}

                                        {isAdmin && !hasDepartment && (
                                            <>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="flat" size="sm" color="primary"
                                                        className="px-4 h-8 w-fit"
                                                        isDisabled={loading}
                                                        onClick={handleRunReport}
                                                    >
                                                        {loading ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                                                Processing...
                                                            </div>
                                                        ) : (
                                                            "Run Report"
                                                        )}
                                                    </Button>

                                                    <Button
                                                        variant="flat"
                                                        size="sm"
                                                        color="primary"
                                                        className="px-4 h-8 w-fit"
                                                        isDisabled={loading || hasDepartment}
                                                        onClick={handleDownload}
                                                    >
                                                        Download
                                                    </Button>
                                                </div>

                                                {/* <Switch isSelected={dateModification} size="sm" onValueChange={toggleDateModification}>
                                                Toggle Date selection
                                            </Switch> */}
                                                <Button
                                                    variant="flat" size="sm" color="primary"
                                                    className="px-4 h-8 w-fit"
                                                    onClick={() => setIsLogDrawerOpen(true)}
                                                >
                                                    View Missing Logs
                                                </Button>
                                            </>
                                        )}
                                        {/* Employee radial chart */}
                                        {isEmployee && (
                                            <RadialSummaryCard
                                                title={currentUserSummary.title || "EMPLOYEE SUMMARY"}
                                                values={currentUserSummary.values}
                                                subtitle={currentUserSummary.subtitle}
                                                loading={loading}
                                            />
                                        )}

                                        {/* Company radial chart */}
                                        {!hasDepartment && (
                                            <RadialSummaryCard
                                                title="GLOBAL SUMMARY"
                                                values={stats.map((s) => Number(s.value) || 0)}
                                                loading={loading}
                                            />
                                        )}
                                    </div>

                                    {/* Col 2 – Stats panel (admin, no department) */}
                                    {!hasDepartment && companySummary && (
                                        <div className="flex p-1 text-[12px]">
                                            <div className="w-full">
                                                <div className="grid grid-cols-2 gap-3">
                                                    {stats.map((item, i) => {
                                                        const value = item.value;

                                                        return (
                                                            <div
                                                                key={i}
                                                                className="flex min-h-[112px] flex-col justify-between border border-ink-200 bg-white p-4 transition-colors hover:border-brand-300 dark:border-white/10 dark:bg-ink-900 dark:hover:border-brand-500/50"
                                                            >

                                                                {/* TOP ROW */}
                                                                <div className="flex items-center justify-between">
                                                                    <span className="pr-2 font-secondary text-[10px] font-medium uppercase leading-snug tracking-wider text-ink-500 dark:text-ink-400">
                                                                        {item.label}
                                                                    </span>

                                                                    <div className="opacity-60">
                                                                        <IconSet type={item.icon} stroke="#6b7280" />
                                                                    </div>
                                                                </div>

                                                                {/* VALUE */}
                                                                <div className="mt-2">
                                                                    <h2 className="text-[26px] font-semibold leading-none text-ink-900 dark:text-white">
                                                                        {typeof value === "number"
                                                                            ? item.label.includes("%")
                                                                                ? `${value}%`
                                                                                : value
                                                                            : value ?? "—"}
                                                                    </h2>
                                                                </div>

                                                                {/* MINI BAR GRAPH */}
                                                                {typeof value === "number" && (
                                                                    <div className="mt-3 flex items-end gap-1 h-8">
                                                                        {[20, 40, 60, 80, 100].map((v, idx) => {
                                                                            const height = Math.max(10, (value / 100) * v);

                                                                            const color =
                                                                                item.color === "red"
                                                                                    ? ["#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ff4b2b"]
                                                                                    : item.color === "green"
                                                                                        ? ["#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#059669"]
                                                                                        : item.color === "yellow"
                                                                                            ? ["#fef9c3", "#fef08a", "#fde047", "#facc15", "#d97706"]
                                                                                            : item.color === "purple"
                                                                                                ? ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"]
                                                                                                : ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"];

                                                                            return (
                                                                                <div
                                                                                    key={idx}
                                                                                    className="flex-1 rounded-sm"
                                                                                    style={{
                                                                                        height: `${height}%`,
                                                                                        background: color[idx],
                                                                                    }}
                                                                                />
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}

                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Col 2 – Employee stat card (with department) */}
                                    {hasDepartment && isEmployee && (
                                        <div className="bg-white dark:bg-ink-900 rounded-xl p-4 text-[12px] flex w-full">

                                            <div className="w-full">

                                                <div className="grid grid-cols-2 gap-3">

                                                    {[
                                                        {
                                                            label: "Target %",
                                                            value: currentUserSummary.values[0],
                                                            color: "red",
                                                            icon: "target",
                                                        },
                                                        // {
                                                        //     label: "Utilization %",
                                                        //     value: currentUserSummary.values[1],
                                                        //     color: "green",
                                                        //     icon: "pulse",
                                                        // },
                                                        {
                                                            label: "Allocated Hrs",
                                                            value: currentUserSummary.values[2],
                                                            color: "yellow",
                                                            icon: "clock",
                                                        },
                                                        {
                                                            label: "Work Hrs",
                                                            value: currentUserSummary.values[3],
                                                            color: "purple",
                                                            icon: "briefcase",
                                                        },
                                                        {
                                                            label: "Efficiency",
                                                            value: currentUserSummary.subtitle,
                                                            color: "blue",
                                                            icon: "brain",
                                                        },
                                                    ].map((item, i) => {

                                                        const value = item.value;

                                                        return (
                                                            <div
                                                                key={i}
                                                                className="flex min-h-[112px] flex-col justify-between border border-ink-200 bg-white p-4 transition-colors hover:border-brand-300 dark:border-white/10 dark:bg-ink-900 dark:hover:border-brand-500/50"
                                                            >

                                                                {/* TOP ROW */}
                                                                <div className="flex items-center justify-between">

                                                                    <span className="pr-2 font-secondary text-[10px] font-medium uppercase leading-snug tracking-wider text-ink-500 dark:text-ink-400">
                                                                        {item.label}
                                                                    </span>

                                                                    <div className="opacity-60">
                                                                        <IconSet
                                                                            type={item.icon}
                                                                            stroke="#6b7280"
                                                                        />
                                                                    </div>

                                                                </div>

                                                                {/* VALUE */}
                                                                <div className="mt-2">

                                                                    <h2 className="text-[26px] font-semibold leading-none text-ink-900 dark:text-white">

                                                                        {typeof value === "number"
                                                                            ? item.label.includes("%")
                                                                                ? `${value}%`
                                                                                : value
                                                                            : value ?? "—"}

                                                                    </h2>

                                                                </div>

                                                                {/* MINI BAR GRAPH */}
                                                                {typeof value === "number" && (

                                                                    <div className="mt-3 flex items-end gap-1 h-8">

                                                                        {[20, 40, 60, 80, 100].map((v, idx) => {

                                                                            const height = Math.max(
                                                                                10,
                                                                                (value / 100) * v
                                                                            );

                                                                            const color =
                                                                                item.color === "red"
                                                                                    ? ["#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ff4b2b"]
                                                                                    : item.color === "green"
                                                                                        ? ["#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#059669"]
                                                                                        : item.color === "yellow"
                                                                                            ? ["#fef9c3", "#fef08a", "#fde047", "#facc15", "#d97706"]
                                                                                            : item.color === "purple"
                                                                                                ? ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"]
                                                                                                : ["#ffe3cf", "#ffc59c", "#ffa06b", "#ff8442", "#ff6a1f"];

                                                                            return (
                                                                                <div
                                                                                    key={idx}
                                                                                    className="flex-1 rounded-sm"
                                                                                    style={{
                                                                                        height: `${height}%`,
                                                                                        background: color[idx],
                                                                                    }}
                                                                                />
                                                                            );
                                                                        })}

                                                                    </div>
                                                                )}

                                                            </div>
                                                        );
                                                    })}

                                                </div>

                                            </div>

                                        </div>
                                    )}

                                    {/* Col 3 – Rules (always visible in admin/employee view) */}
                                    <EfficiencyRules />
                                </div>
                            )}

                            {/* EL Summary Grid */}
                            {isEL && ELUserSummaryGraph && (
                                <LeaderSummaryGrid data={ELUserSummaryGraph} loading={loading} />
                            )}

                            {/* FL Summary Grid */}
                            {isFL && FLUserSummaryGraph && (
                                <LeaderSummaryGrid data={FLUserSummaryGraph} loading={loading} />
                            )}
                        </CardBody>
                    </Card>

                    {/* ── EL Department Tabs ─────────────────────────────────────────── */}
                    {/* {isEL && (
                    <div className="col-span-3 flex justify-center mt-4">
                        <Card className="w-full">
                            <CardBody>
                                <Tabs aria-label="EL departments" variant="full">
                                    {ELUserSummary?.[0]?.departments?.map((ele: any) => (
                                        <Tab key={ele.DepartmentName} title={ele.DepartmentName} className="flex flex-col items-start">
                                            <EfficiencyTable data={ele.users} type="ELU" />
                                        </Tab>
                                    ))}
                                    <Tab key="ALL_DEPARTMENTS" title="All Departments" className="flex flex-col items-start">
                                        <EfficiencyTable data={allUser} type="ELU" />
                                    </Tab>
                                </Tabs>
                            </CardBody>
                        </Card>
                    </div>
                )} */}

                    {/* {isEL && (
                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>

                                            <div className="flex flex-col w-full justify-between gap-4">

                                                <Card>
                                                    <CardBody>
                                                        <ColumnChart
                                                            dept={false}
                                                            labels={
                                                                ELUserSummary?.[0]?.departments?.map(
                                                                    (ele: any) => ele.DepartmentName
                                                                ) || []
                                                            }
                                                            values={
                                                                ELUserSummary?.[0]?.departments?.map(
                                                                    (ele: any) => Number(ele.AvgTargetPercent || 0)
                                                                ) || []
                                                            }
                                                            goals={
                                                                ELUserSummary?.[0]?.departments?.map(
                                                                    (ele: any) => Number(ele.AvgGoalEfficiency || 0)
                                                                ) || []
                                                            }
                                                        />
                                                    </CardBody>
                                                </Card>

                                                <ELDashboard data={ELUserSummary || []} />

                                            </div>

                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}

                    {/* ── FL Department Tabs ─────────────────────────────────────────── */}
                    {/* {isFL && (
                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>
                                            <Tabs aria-label="FL departments" variant="full">
                                                {FLUserSummary?.[0]?.departments?.map((ele: any) => (
                                                    <Tab key={ele.DepartmentName} title={ele.DepartmentName} className="flex flex-col items-start">
                                                        <EfficiencyTable data={ele.users} type="ELU" />
                                                    </Tab>
                                                ))}
                                                <Tab key="ALL_DEPARTMENTS" title="All Departments" className="flex flex-col items-start">
                                                    <EfficiencyTable data={allUser} type="ELU" />
                                                </Tab>
                                            </Tabs>
                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}

                    {/* ── Admin Tabs (Department / EL) ───────────────────────────────── */}
                    {/* {isAdmin && (

                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>
                                            <Tabs aria-label="Admin tabs" variant="full">
                                                <Tab key="EXECUTIVE LEADER" title="EXECUTIVE LEADER" className="flex flex-col items-end">
                                                    <div className="flex flex-col w-full justify-between gap-4">
                                                        
                                                        
                                                        {
                                                            isAdmin && (
                                                                <ELDashboard data={elData} />

                                                            )
                                                        }
                                                    </div>

                                                </Tab>
                                                <Tab key="DEPARTMENT" title="DEPARTMENT" className="flex flex-col items-end">
                                        {!hasDepartment && (
                                            <div className="flex flex-col w-full justify-between gap-4">
                                                <Autocomplete
                                                    aria-label="Filter by Department"
                                                    placeholder="Filter by Department"
                                                    className="max-w-xs mr-4"
                                                    selectedKey={selectedDepartment}
                                                    onSelectionChange={(key) => setSelectedDepartment(key as string)}
                                                >
                                                    {departmentList
                                                        .filter((d) => d.status === "Active")
                                                        .map((d) => (
                                                            <AutocompleteItem key={d.key} value={d.name}>
                                                                {d.name.replace(/([A-Z])/g, " $1").trim()}
                                                            </AutocompleteItem>
                                                        ))}
                                                </Autocomplete>
                                                <Card>
                                                    <CardBody>
                                                        <ColumnChart
                                                            dept={true}

                                                            labels={Object.values(departmentSummaryFiltered).map((ele: any) => ele.DepartmentName)}
                                                            values={Object.values(departmentSummaryFiltered).map((ele: any) => ele.AvgTargetPercent) as number[]}
                                                            goals={Object.values(departmentSummaryFiltered).map((ele: any) => ele.AvgGoalEfficiency) as number[]}

                                                        />
                                                    </CardBody>
                                                </Card>

                                            </div>

                                        )}

                                        <EfficiencyTable data={departmentSummaryFiltered} type="department" />
                                    </Tab>


                                            </Tabs>
                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}

                    {/* ── Employee daily data table ──────────────────────────────────── */}
                    {/* {isEmployee && (
                                <div className="col-span-3 flex justify-center mt-4">
                                    <Card className="w-full">
                                        <CardBody>
                                            <EfficiencyTable data={userSummaryData} type="user" />
                                        </CardBody>
                                    </Card>
                                </div>
                            )} */}
                </div>
            )}

        </div>
    );
}