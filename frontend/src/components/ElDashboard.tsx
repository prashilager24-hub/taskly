import { useState } from "react";
import { Accordion, AccordionItem } from "@/components/ui";
import EfficiencyTable from "./table2";
const getBadgeColor = (level) => {
    if (level === "High") return "bg-emerald-100 text-emerald-700";
    if (level === "At Par") return "bg-amber-100 text-amber-700";
    return "bg-rose-100 text-rose-700";
};

const CircularProgress = ({ value, size = 40, stroke = 4 }) => {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    const progress = value;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div style={{ width: size, height: size }}>
            <svg width={size} height={size}>
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#e5e7eb"
                    strokeWidth={stroke}
                    fill="transparent"
                />

                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#059669"
                    strokeWidth={stroke}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />

                {/* Center text */}
                <text
                    x="50%"
                    y="50%"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#111827"
                >
                    {(progress)}%
                </text>
            </svg>
        </div>
    );
};
const getEfficiencyLevel = ({
    targetPercent,
    goalPercent,
    timeTaken,
    allocatedTime,
}) => {
    if (
        targetPercent >= 100 &&
        goalPercent >= 80 &&
        timeTaken <= allocatedTime
    ) {
        return "High";
    }

    if (
        targetPercent >= 80 &&
        goalPercent >= 50 &&
        timeTaken <= allocatedTime
    ) {
        return "At Par";
    }

    return "Low";
};
export default function ELDashboard({ data }) {
    const [openEL, setOpenEL] = useState(null);
    const [openDept, setOpenDept] = useState({});


    return (
        <div className="p-6 space-y-4 bg-ink-100 dark:bg-ink-800 overflow-x-auto">

            <Accordion variant="splitted" selectionMode="single" openItems={openEL} onOpenChange={setOpenEL}>
                {data.map((el) => (
                    <AccordionItem
                        key={el.ELID}
                        aria-label={el.ELName}
                        className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900 px-4"
                        title={
                            // Fix 2 — min-w-0 + overflow-x-auto on the row
                            <div className="flex items-center justify-between w-full min-w-0 overflow-x-auto">

                                {/* LEFT — Fix 4: reduced min-w + shrink-0 */}
                                <div className="flex items-center gap-4 min-w-[160px] shrink-0">
                                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-bold">
                                        {el.ELName?.[0]}
                                    </div>
                                    <div>
                                        <h2 className="font-semibold whitespace-pre-line">
                                            {el.ELName?.replace(/ /g, "\n")}
                                        </h2>                                        <p className="text-xs text-ink-500 dark:text-ink-400">Executive Leader</p>
                                    </div>
                                </div>

                                {/* CENTER — Fix 2: flex-wrap + reduced gap */}
                                <div className="flex items-center gap-6 flex-1 justify-center text-sm flex-wrap">
                                    <div className="text-center">
                                        <p className="text-ink-400 text-xs">Target</p>
                                        <p className="font-semibold">{el.AvgTargetPercent}%</p>
                                    </div>
                                    {/* <div className="text-center">
                                        <p className="text-ink-400 text-xs">Utilization</p>
                                        <p className="font-semibold">{el.AvgUtilizationPercent}%</p>
                                    </div> */}
                                    <div className="text-center">
                                        <p className="text-ink-400 text-xs">Allocated</p>
                                        <p className="font-semibold">{el.AvgAllocatedHrs}h</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-ink-400 text-xs">Work</p>
                                        <p className="font-semibold">{el.AvgTotalWork}h</p>
                                    </div>
                                    <div className="text-center" style={{ marginLeft: "120px" }}>
                                        <p className="text-ink-400 text-xs">Monthly Goal</p>
                                        <p className="font-semibold">{el.AvgGoalEfficiency}</p>
                                    </div>
                                </div>

                            </div>
                        }
                    >

                        {/* DEPARTMENTS */}
                        <Accordion variant="light" selectionMode="single">
                            {el.departments.map((dept) => {
                                const deptEfficiency = getEfficiencyLevel({
                                    targetPercent: Number(dept.AvgTargetPercent),
                                    goalPercent: Number(dept.AvgGoalEfficiency || 0),
                                    timeTaken: Number(dept.AvgTotalWork),
                                    allocatedTime: Number(dept.AvgAllocatedHrs),
                                });
                                return (
                                    <AccordionItem
                                        key={dept.DepartmentID}
                                        aria-label={dept.DepartmentName}
                                        className="bg-ink-50 dark:bg-ink-950 rounded-xl px-3"
                                        title={
                                            // Fix 3 — min-w-0 + overflow-x-auto + gap-2
                                            <div className="flex items-center justify-between w-full min-w-0 gap-2 overflow-x-auto">

                                                {/* LEFT */}
                                                <div className="min-w-[160px] shrink-0">
                                                    <h3 className="font-medium whitespace-pre-line">
                                                        {dept.DepartmentName.replace(/ /g, "\n")}
                                                    </h3>                                                    <p className="text-xs text-ink-400">
                                                        {dept.users.length} team members
                                                    </p>
                                                </div>

                                                {/* CENTER — Fix 3: flex-wrap + reduced gap */}
                                                <div className="flex items-center justify-center gap-4 flex-1 flex-wrap">

                                                    <div className="flex flex-col items-center w-[100px]">
                                                        <span className="text-ink-400 text-xs mb-1">Avg Target</span>
                                                        <CircularProgress value={dept.AvgTargetPercent} />
                                                    </div>

                                                    {/* <div className="flex flex-col items-center w-[100px]">
                                                        <span className="text-ink-400 text-xs mb-1">Avg Utilization</span>
                                                        <CircularProgress value={dept.AvgUtilizationPercent} />
                                                    </div>

                                                    <div className="flex flex-col items-center w-[120px]">
                                                        <span className="text-ink-400 text-xs mb-1">Efficiency</span>
                                                        <span className={`px-3 py-1 text-xs rounded-full ${getBadgeColor(dept.EfficiencyLevel)}`}>
                                                            {dept.EfficiencyLevel}
                                                        </span>
                                                    </div> */}

                                                    <div className="flex flex-col items-center w-[120px]">
                                                        <span className="text-ink-400 text-xs mb-1">Goal</span>
                                                        <span className="px-3 py-1 text-xs">
                                                            {dept.AvgGoalEfficiency}
                                                        </span>
                                                    </div>

                                                </div>

                                            </div>
                                        }
                                    >
                                        <div className="mt-2">
                                            <EfficiencyTable
                                                data={dept.users}
                                                type="ELU"
                                                dashboard={true}
                                            />
                                        </div>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>

                    </AccordionItem>
                ))}
            </Accordion>

        </div>
    );
}