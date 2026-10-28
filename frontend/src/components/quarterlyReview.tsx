import { useEffect, useState, useMemo, useCallback, useRef, memo } from "react";
import axios from "axios";
import {
    Card, CardHeader, CardBody, CardFooter,
    Input, Select, SelectItem,
    Button, Chip, Avatar,
    Divider, Progress, Textarea,
    Tooltip,
    Autocomplete, AutocompleteItem,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    Badge,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
    addToast,
    Tabs, Tab
} from "@/components/ui";
import { format, isSameQuarter } from "date-fns";
import CustomDateRangePicker from "../components/CustomDateRangePicker";
import { finalGradeFromPercent, finalGradeLabelFromPercent } from "../lib/pmsGrade";

// ─── Constants ────────────────────────────────────────────────────────────────

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const currentYear = new Date().getFullYear();

const YEARS = Array.from(
    { length: 5 },
    (_, index) => currentYear - 2 + index
);
const FEEDBACK_CATS = ["Exceeds Expectations", "Meets Expectations", "Needs Improvement"];
const FEEDBACK_TYPES = ["Productivity", "Quality", "Ownership", "Communication"];
const STATUSES = ["On Track", "At Risk", "Delayed"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcScore = (g) => Math.round(g * 0.5);

const getBand = (s) => {
    if (s > 80) return { label: "Top Performer", color: "success", variant: "flat" };
    if (s >= 60) return { label: "Good Performer", color: "success", variant: "bordered" };
    if (s >= 50) return { label: "Average Performer", color: "warning", variant: "flat" };
    return { label: "PIP", color: "danger", variant: "flat" };
};

const getRAG = (s) => {
    if (s >= 60) return { label: "On Track", color: "success" };
    if (s >= 30) return { label: "At Risk", color: "warning" };
    return { label: "PIP Required", color: "danger" };
};

const barColor = (s) =>
    s > 80 ? "success" : s >= 60 ? "success" : s >= 50 ? "warning" : "danger";

const initials = (name) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

// ─── Default form ─────────────────────────────────────────────────────────────
const MANAGER_RATINGS = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10
];
const DEFAULT = {
    empId: "",
    quarter: "Q1",
    year: String(new Date().getFullYear()),
    target: "",
    goal: "",
    util: "",
    eff: "",
    effLabel: "",
    tasks: "",
    status: "On Track",
    starRating: 0,          // 0 = none, 1-3
    starDescription: "",
    managerRatings: {
        accountability: {
            assessor1: "",
            assessor2: "",
        },
        engagement: {
            assessor1: "",
            assessor2: "",
        },
        collaboration: {
            assessor1: "",
            assessor2: "",
        },
        innovation: {
            assessor1: "",
            assessor2: "",
        },
        communication: {
            assessor1: "",
            assessor2: "",
        },
        adaptability: {
            assessor1: "",
            assessor2: "",
        },
    },
    feedbacks: [
        {
            feedbackCat: "",
            feedbackType: "",
            feedback: "",
            assessor1Id: "",    // ✅
            assessor1Name: "",  // ✅
            assessor2Id: "",    // ✅
            assessor2Name: "",  // ✅
        },
    ],
};
const QUARTER_DATE_RANGES = {
    Q1: {
        startDate: "2026-01-01",
        endDate: "2026-03-31",
    },
    Q2: {
        startDate: "2026-04-01",
        endDate: "2026-06-30",
    },
    Q3: {
        startDate: "2026-07-01",
        endDate: "2026-09-30",
    },
    Q4: {
        startDate: "2026-10-01",
        endDate: "2026-12-31",
    },
};


// ─── AutoTag ─────────────────────────────────────────────────────────────────

function AutoTag() {
    return (
        <Chip size="sm" variant="flat" color="default"
            classNames={{ base: "h-4 px-1", content: "text-[9px] font-bold tracking-wider" }}>
            AUTO
        </Chip>
    );
}

function RevisedTag() {
    return (
        <Chip size="sm" variant="flat" color="warning"
            classNames={{ base: "h-4 px-1", content: "text-[9px] font-bold tracking-wider" }}>
            REVISED
        </Chip>
    );
}

//questions
const MANAGER_QUESTIONS = [
    {
        key: "accountability",
        title: "Accountability & Ownership",
        description:
            "To what extent do you take responsibility for your work, follow through on commitments, and require minimal follow-ups?"
    },
    {
        key: "engagement",
        title: "Engagement & Initiative",
        description:
            "How actively do you participate in company initiatives and engagement events, contribute beyond your immediate responsibilities, and show interest in organizational success?"
    },
    {
        key: "collaboration",
        title: "Collaboration & Teamwork",
        description:
            "How effectively do you collaborate with colleagues across teams and contribute to shared goals?"
    },
    {
        key: "innovation",
        title: "Innovation & Problem-Solving",
        description:
            "How frequently do you proactively identify improvements, suggest new ideas, or solve problems effectively?"
    },
    {
        key: "communication",
        title: "Communication & Professionalism",
        description:
            "How effectively do you communicate with colleagues and stakeholders in a clear, constructive, and professional manner?"
    },
    {
        key: "adaptability",
        title: "Adaptability & Learning",
        description:
            "How well do you adapt to changes, learn new skills, and actively seek improvement?"
    }
];


// const getSystemGrade = (
//     goalAchieved,
//     targetAchieved
// ) => {

//     // Grade 10
//     if (goalAchieved >= 100) {

//         if (targetAchieved >= 100) {
//             return 10;
//         }
//     }

//     // Grade 9
//     if (goalAchieved >= 90) {

//         if (targetAchieved >= 100) {
//             return 9;
//         }
//     }

//     // Grade 8
//     if (goalAchieved >= 80) {

//         if (targetAchieved >= 100) {
//             return 8;
//         }
//     }

//     // Grade 7
//     if (goalAchieved >= 70) {

//         if (targetAchieved >= 90) {
//             return 7;
//         }
//     }

//     // Grade 6
//     if (goalAchieved >= 60) {

//         if (targetAchieved >= 80) {
//             return 6;
//         }
//     }

//     // Grade 5
//     if (goalAchieved >= 50) {

//         if (targetAchieved >= 70) {
//             return 5;
//         }
//     }

//     // Grade 4
//     if (goalAchieved >= 40) {

//         if (targetAchieved >= 60) {
//             return 4;
//         }
//     }

//     // Grade 3
//     if (goalAchieved >= 30) {

//         if (targetAchieved >= 50) {
//             return 3;
//         }
//     }

//     // Grade 2
//     if (goalAchieved >= 20) {

//         if (targetAchieved >= 50) {
//             return 2;
//         }
//     }

//     return 1;
// };

// ─── LivePreview ──────────────────────────────────────────────────────────────
// System Grade = [(TargetWeight% × T) + (GoalWeight% × G)] / (TargetWeight% + GoalWeight%)
// TargetWeight/GoalWeight are set by the EL and should sum to 100.
// T = Target Achievement %, G = Goal Achievement %
const getSystemGrade = (targetWeight, goalWeight, T, G) => {
    const totalWeight = Number(targetWeight || 0) + Number(goalWeight || 0);

    if (totalWeight === 0) return 0;

    const weightedScore =
        (Number(targetWeight || 0) * Number(T || 0) +
            Number(goalWeight || 0) * Number(G || 0)) / totalWeight;

    // scale 0–100 → 0–10 to stay consistent with managerRating / finalScore math
    return Number((Math.min(weightedScore, 100) / 10).toFixed(2));
}
const LivePreview = memo(function LivePreview({ form, weightage }) {
    const weightedAchievement =
        (Number(form.goal || 0) * weightage.goalWeight +
            Number(form.target || 0) * weightage.targetWeight) / 100;

    const systemGrade =
        form.goal
            ? getSystemGrade(
                weightage.targetWeight,
                weightage.goalWeight,
                Number(form.target || 0),
                Number(form.goal || 0)
            )
            : 0;

    const managerRatings =
        Object.values(form.managerRatings || {});

    const managerRating =
        managerRatings.length > 0
            ? (
                managerRatings.reduce((sum, item) => {

                    const a1 =
                        Number(item?.assessor1 || 0);

                    const a2 =
                        Number(item?.assessor2 || 0);

                    let finalRating = 0;

                    if (a1 > 0 && a2 > 0) {
                        finalRating = (a1 + a2) / 2;
                    } else if (a1 > 0) {
                        finalRating = a1;
                    } else if (a2 > 0) {
                        finalRating = a2;
                    }

                    return sum + finalRating;

                }, 0) / managerRatings.length
            )
            : 0;

    const finalScore =
        ((systemGrade * 0.95) + (managerRating * 0.05));

    const score =
        finalScore > 0
            ? Number(finalScore.toFixed(1))
            : 0;

    const band = getBand(score * 10);

    const rag = getRAG(score * 10);

    const scoreColorMap = { success: "#17c964", warning: "#f5a524", danger: "#f31260" };
    const scoreColor = band ? scoreColorMap[band.color] : "#d4d4d8";
    const systemGradePercent = Math.min(systemGrade * 10, 100);
    const managerRatingPercent = Math.min(managerRating * 10, 100);
    const finalRatingPercent = Math.min(score * 10, 100);
    return (
        <Card className="sticky top-6 shadow-sm border border-divider" radius="lg">
            <CardHeader className="pb-0 pt-5 px-5 flex-col items-center gap-1">
                <p className="text-[10px] uppercase tracking-[.18em] text-default-700 ">Quarterly Score</p>
                {/* <span
                    className="text-6xl font-black leading-none tracking-tighter transition-colors duration-300"
                    style={{ color: scoreColor }}
                >
                    {score !== null ? `${finalRatingPercent.toFixed(1)}%` : "—"}                </span>
                <div className="mt-2 min-h-[26px] flex justify-center">
                    {band && (
                        <Chip color={band.color} variant={band.variant} size="sm" className="font-semibold">
                            {band.label}
                        </Chip>
                    )}
                </div> */}
            </CardHeader>

            <CardBody className="gap-3 pt-4 px-5 pb-5">
                <div className="bg-default-50 rounded-xl p-3 border border-divider">
                    <div className="flex justify-between text-xs mb-1">
                        <span>A) System Grade (Weighted Target + Goal)</span>
                        <span className="font-bold text-primary">
                            {systemGradePercent.toFixed(1)}%
                        </span>
                    </div>

                    <div className="flex justify-between text-xs mb-1">
                        <span>B) Manager Rating</span>
                        <span className="font-bold text-secondary">
                            {managerRatingPercent.toFixed(1)}%
                        </span>
                    </div>

                    <Divider className="my-2" />

                    <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold">
                            Final Rating
                            <br />
                            <span className="text-xs text-default-500">
                                (95% × A + 5% × B)
                            </span>
                        </span>

                        <span className="text-2xl font-black text-success">
                            {(finalRatingPercent)}
                        </span>
                    </div>
                </div>
                {/* Progress bar */}
                <Progress
                    value={score ?? 0}
                    color={band ? barColor(score) : "default"}
                    size="sm"
                    radius="sm"
                    className="mb-1"
                    aria-label="score-bar"
                />

                <Divider />

                {/* Metric rows */}
                {[
                    // ["Goal Ach.", form.goal ? `${form.goal}%` : "—"],
                    // ["Utilization", form.util ? `${form.util}%` : "—"],
                    // ["Efficiency", form.effLabel || "—"],

                ].map(([lbl, val]) => (
                    <div key={lbl} className="flex justify-between items-center py-1 border-b border-divider last:border-0">
                        <span className="text-[11px] text-default-700">{lbl}</span>
                        <span className="text-sm font-semibold text-default-900">{val}</span>
                    </div>
                ))}

                {/* RAG */}


                <div className="bg-default-50 border border-divider rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-[.15em] text-default-700 mb-3">
                        Final Grading Guide
                    </p>

                    <div className="flex flex-col gap-2 text-xs">

                        <div className="flex justify-between">
                            <span>Critical Concern (Final Rating &lt; 40%)</span>
                            <Chip size="sm" color="danger" variant="flat">
                                Grade 1
                            </Chip>
                        </div>

                        <div className="flex justify-between">
                            <span>Unsatisfactory (40% – 49%)</span>
                            <Chip size="sm" color="danger" variant="flat">
                                Grade 2
                            </Chip>
                        </div>

                        <div className="flex justify-between">
                            <span>Needs Significant Improvement (50% – 59%)</span>
                            <Chip size="sm" color="warning" variant="flat">
                                Grade 3
                            </Chip>
                        </div>

                        <div className="flex justify-between">
                            <span>Needs Improvement (60% – 69%)</span>
                            <Chip size="sm" color="warning" variant="flat">
                                Grade 4
                            </Chip>
                        </div>

                        <div className="flex justify-between">
                            <span>Partially Meets Expectations (70% – 79%)</span>
                            <Chip size="sm" color="primary" variant="flat">
                                Grade 5
                            </Chip>
                        </div>

                        <div className="flex justify-between">
                            <span>Approaching Expectations (80% – 89%)</span>
                            <Chip size="sm" color="primary" variant="flat">
                                Grade 6
                            </Chip>
                        </div>

                        <div className="flex justify-between">
                            <span>Meets Expectations (90% – 99%)</span>
                            <Chip size="sm" color="success" variant="flat">
                                Grade 7
                            </Chip>
                        </div>

                        <div className="flex justify-between">
                            <span>Exceeds Expectations (&gt;=100% + ⭐ 1 Star)</span>
                            <Chip size="sm" color="success" variant="flat">
                                Grade 8 ⭐
                            </Chip>
                        </div>

                        <div className="flex justify-between">
                            <span>Significantly Exceeds Expectations (&gt;=100% + ⭐⭐ 2 Stars)</span>
                            <Chip size="sm" color="secondary" variant="flat">
                                Grade 9 ⭐⭐
                            </Chip>
                        </div>

                        <div className="flex justify-between">
                            <span>Outstanding / Exceptional (&gt;=100% + ⭐⭐⭐ 3 Stars)</span>
                            <Chip size="sm" color="warning" variant="solid">
                                Grade 10 ⭐⭐⭐
                            </Chip>
                        </div>

                    </div>
                </div>
            </CardBody>
        </Card>
    );
});

// ─── ReviewCard ───────────────────────────────────────────────────────────────

function ReviewCard({ review, index, onDelete, usersAll }) {
    const emp = usersAll?.find(
        (u) => String(u.userID) === String(review.empId)
    ) || null;
    const score = calcScore(review.goal);
    const band = getBand(score);
    const rag = getRAG(score);

    return (
        <Card className="mb-3 shadow-sm border border-divider hover:border-default-400 transition-colors" radius="lg">
            <CardBody className="p-5">
                {/* Top row */}
                <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
                    <div className="flex items-center gap-3">
                        <Avatar
                            name={initials(emp?.userName || "NA")}
                            color="primary"
                            size="md"
                        />
                        <div>
                            <p className="font-bold text-default-800 text-sm leading-tight">
                                {emp?.userName || "Unknown User"}
                                <span className="ml-2 text-[11px] text-default-700">— {review.quarter}</span>
                            </p>
                            <p className="text-[11px] text-default-700 mt-0.5">
                                {review.empId} · {emp?.departmentName || "N/A"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Chip color={band.color} variant={band.variant} size="sm" className="font-semibold text-xs">
                            {band.label}
                        </Chip>
                        <Chip color={rag.color} variant="dot" size="sm" className="font-semibold text-xs">
                            {rag.label}
                        </Chip>
                        <Tooltip content="Delete review" color="danger" placement="top">
                            <Button
                                isIconOnly size="sm" variant="light" color="danger"
                                className="min-w-unit-6 w-6 h-6"
                                onPress={() => onDelete(index)}
                            >
                                <span className="text-xs">✕</span>
                            </Button>
                        </Tooltip>
                    </div>
                </div>

                {/* Metric grid */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                        ["Score", `${score}%`, band.color],
                        ["Goal", `${review.goal}%`, null],
                        ["Util", `${review.util}%`, null],
                        ["Eff.", `${review.eff}%`, null],
                    ].map(([lbl, val, color]) => (
                        <div key={lbl} className="bg-default-50 border border-divider rounded-xl p-2.5 text-center">
                            <p className="text-[9px] uppercase tracking-widest text-default-700 mb-1">{lbl}</p>
                            <p className={`text-lg font-black leading-none ${color ? `text-${color}` : "text-default-800"}`}>
                                {val}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Progress */}
                <Progress
                    value={score}
                    color={barColor(score)}
                    size="sm"
                    radius="sm"
                    aria-label="review-score-bar"
                    className="mb-3"
                />

                {/* Feedback */}
                {review.feedback ? (
                    <div className="bg-primary-50 border-l-[3px] border-primary-400 rounded-r-lg px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            {review.feedbackType && (
                                <Chip size="sm" color="primary" variant="flat"
                                    classNames={{ content: "text-[10px] font-semibold" }}>
                                    {review.feedbackType}
                                </Chip>
                            )}
                            <span className="text-[11px] font-semibold text-primary-600">{review.feedbackCat}</span>
                        </div>
                        <p className="text-sm text-default-600 leading-relaxed">{review.feedback}</p>
                    </div>
                ) : (
                    <p className="text-xs text-default-700 italic">
                        No comment · Category: {review.feedbackCat}
                    </p>
                )}
            </CardBody>
        </Card>
    );
}


function StarSelector({ value, onChange, isDisabled }) {
    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3].map((n) => (
                <button
                    key={n}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => onChange(value === n ? 0 : n)}
                    className="text-3xl leading-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                    <span className={value >= n ? "text-warning" : "text-default-300"}>
                        ★
                    </span>
                </button>
            ))}
        </div>
    );
}


// ─── Main Component ───────────────────────────────────────────────────────────

export default function QuarterlyReview() {
    const {
        isOpen: isDeleteOpen,
        onOpen: onDeleteOpen,
        onOpenChange: onDeleteOpenChange,
        onClose: onDeleteClose,
    } = useDisclosure();

    const {
        isOpen: isWeightOpen,
        onOpen: onWeightOpen,
        onOpenChange: onWeightOpenChange,
        onClose: onWeightClose,
    } = useDisclosure();

    const [selectedDeleteId, setSelectedDeleteId] = useState(null);
    const openDeleteConfirm = (id) => {
        setSelectedDeleteId(id);
        onDeleteOpen();
    };

    const [weightage, setWeightage] = useState({ goalWeight: 60, targetWeight: 40 });
    const [weightDraft, setWeightDraft] = useState({ goalWeight: "60", targetWeight: "40" });
    const lastWeightKeyRef = useRef(null);

    const [revisedGoals, setRevisedGoals] = useState<any>({});
    const [revisingMonth, setRevisingMonth] = useState<any>(null);
    const [revisedDraft, setRevisedDraft] = useState("");
    const [revisingGoalDataId, setRevisingGoalDataId] = useState<any>(null);
    const [reviseSaving, setReviseSaving] = useState(false);

    const {
        isOpen: isReviseOpen,
        onOpen: onReviseOpen,
        onOpenChange: onReviseOpenChange,
        onClose: onReviseClose,
    } = useDisclosure();

    const [revisingTargetMonth, setRevisingTargetMonth] = useState<any>(null);
    const [revisedTargetDraft, setRevisedTargetDraft] = useState("");
    const [revisingDailyTaskLogId, setRevisingDailyTaskLogId] = useState<any>(null);
    const [reviseTargetSaving, setReviseTargetSaving] = useState(false);

    const {
        isOpen: isReviseTargetOpen,
        onOpen: onReviseTargetOpen,
        onOpenChange: onReviseTargetOpenChange,
        onClose: onReviseTargetClose,
    } = useDisclosure();

    const openReviseGoal = (month: any) => {
        const currentGoal =
            month.revisedGoal?.value ?? month.goalAchievement ?? 0;
        setRevisedDraft(String(currentGoal));
        setRevisingMonth(month.MonthNumber);
        setRevisingGoalDataId(month.userGoalDataID ?? null);
        onReviseOpen();
    };

    const openReviseTarget = (month: any) => {
        const revisedTarget = month.revisedTarget ?? month.RevisedTarget ?? null;
        const currentTarget =
            revisedTarget?.value ?? month.AvgTargetPercent ?? 0;
        setRevisedTargetDraft(String(currentTarget));
        setRevisingTargetMonth(month.MonthNumber);
        setRevisingDailyTaskLogId(month.DailyTaskLogID ?? month.dailyTaskLogID ?? null);
        onReviseTargetOpen();
    };
    const authHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${authUser?.token ?? ""}`,
    });

    const patchMonthRevised = (monthNo: number, revisedGoal: any) =>
        setUserSummary((prev: any) =>
            prev
                ? {
                    ...prev,
                    monthlyBreakdown: prev.monthlyBreakdown.map((m: any) =>
                        m.MonthNumber === monthNo ? { ...m, revisedGoal } : m
                    ),
                }
                : prev
        );

    const handleApproveRevisedGoal = async (month: any) => {
        try {
            await axios.put(
                "/t2.0/authentificationUtilization/userGoalData/revised-goal",
                {
                    userGoalDataID: Number(month.userGoalDataID),
                    action: "APPROVE",
                    revisedGoal: { elApproved: true, comment: null },
                },
                { headers: authHeaders() }
            );
            patchMonthRevised(month.MonthNumber, {
                ...month.revisedGoal,
                elApproved: true,
                approvedBy: Number(user.userID),
                approvedAt: new Date().toISOString(),
            });
            addToast({
                title: "Success",
                description: `Revised goal approved for ${monthName(month.MonthNumber)}`,
                color: "success",
            });
        } catch (err: any) {
            addToast({
                title: "Error",
                description: err?.response?.data?.message || "Failed to approve revised goal",
                color: "danger",
            });
        }
    };
    const handleReviseGoalSave = async () => {
        if (reviseSaving) return;

        const val = Math.max(0, Math.min(100, Number(revisedDraft || 0)));

        if (revisingGoalDataId == null) {
            addToast({
                title: "Error",
                description: "No goal data found for this month to revise.",
                color: "danger",
            });
            return;
        }

        try {
            setReviseSaving(true);

            await axios.put(
                "/t2.0/authentificationUtilization/userGoalData/revised-goal",
                {
                    userGoalDataID: Number(revisingGoalDataId),
                    action: "ENTER",
                    revisedGoal: { value: Number(val.toFixed(2)), comment: null },
                },
                { headers: authHeaders() }
            );

            patchMonthRevised(revisingMonth, {
                value: Number(val.toFixed(2)),
                enteredBy: Number(user.userID),
                enteredAt: new Date().toISOString(),
                elApproved: false,
                approvedBy: null,
                approvedAt: null,
                comment: null,
            });

            addToast({
                title: "Success",
                description: `Goal revised for ${monthName(revisingMonth)}`,
                color: "success",
            });

            onReviseClose();
        } catch (err: any) {
            console.error("Revise Goal API Error:", err);
            addToast({
                title: "Error",
                description:
                    err?.response?.data?.message ||
                    "Failed to revise goal",
                color: "danger",
            });
        } finally {
            setReviseSaving(false);
        }
    };

    const patchMonthRevisedTarget = (monthNo: number, revisedTarget: any) =>
        setUserSummary((prev: any) =>
            prev
                ? {
                    ...prev,
                    monthlyBreakdown: prev.monthlyBreakdown.map((m: any) =>
                        m.MonthNumber === monthNo ? { ...m, revisedTarget } : m
                    ),
                }
                : prev
        );

    const handleApproveRevisedTarget = async (month: any) => {
        try {
            await axios.put(
                "/t2.0/authentificationUtilization/form/revised-target",
                {
                    dailyTaskLogID: Number(month.DailyTaskLogID ?? month.dailyTaskLogID),
                    action: "APPROVE",
                    revisedTarget: { elApproved: true, comment: null },
                },
                { headers: authHeaders() }
            );
            patchMonthRevisedTarget(month.MonthNumber, {
                ...(month.revisedTarget ?? month.RevisedTarget),
                elApproved: true,
                approvedBy: Number(user.userID),
                approvedAt: new Date().toISOString(),
            });
            addToast({
                title: "Success",
                description: `Revised target approved for ${monthName(month.MonthNumber)}`,
                color: "success",
            });
        } catch (err: any) {
            addToast({
                title: "Error",
                description: err?.response?.data?.message || "Failed to approve revised target",
                color: "danger",
            });
        }
    };

    const handleReviseTargetSave = async () => {
        if (reviseTargetSaving) return;

        const val = Math.max(0, Math.min(100, Number(revisedTargetDraft || 0)));

        if (revisingDailyTaskLogId == null) {
            addToast({
                title: "Error",
                description: "No target data found for this month to revise.",
                color: "danger",
            });
            return;
        }

        try {
            setReviseTargetSaving(true);

            await axios.put(
                "/t2.0/authentificationUtilization/form/revised-target",
                {
                    dailyTaskLogID: Number(revisingDailyTaskLogId),
                    action: "ENTER",
                    revisedTarget: { value: Number(val.toFixed(2)), comment: null },
                },
                { headers: authHeaders() }
            );

            patchMonthRevisedTarget(revisingTargetMonth, {
                value: Number(val.toFixed(2)),
                enteredBy: Number(user.userID),
                enteredAt: new Date().toISOString(),
                elApproved: false,
                approvedBy: null,
                approvedAt: null,
                comment: null,
            });

            addToast({
                title: "Success",
                description: `Target revised for ${monthName(revisingTargetMonth)}`,
                color: "success",
            });

            onReviseTargetClose();
        } catch (err: any) {
            console.error("Revise Target API Error:", err);
            addToast({
                title: "Error",
                description:
                    err?.response?.data?.message ||
                    "Failed to revise target",
                color: "danger",
            });
        } finally {
            setReviseTargetSaving(false);
        }
    };

    const [form, setForm] = useState(DEFAULT);
    const [loading, setLoading] = useState(false);
    const [dashboardData, setDashboardData] = useState(null);
    const [userSummary, setUserSummary] = useState(null);
    const monthlyData = userSummary?.monthlyBreakdown || [];

    const monthName = (monthNo) =>
        new Date(2026, monthNo - 1).toLocaleString("default", {
            month: "long",
        });
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0], // Jan 1
        endDate: new Date().toISOString().split("T")[0], // today
    });
    const [reviews, setReviews] = useState([]);
    const [existingQuarterReview, setExistingQuarterReview] =
        useState(null);
    const [errors, setErrors] = useState({});
    const [saved, setSaved] = useState(false);
    const authUserLD = localStorage.getItem("authUserLD");
    const authUser = authUserLD ? JSON.parse(authUserLD) : null;
    const user = authUser;

    const [filterStatus, setFilterStatus] = useState("");
    const [selectedFilterUser, setSelectedFilterUser] = useState("");
    const [userSearch, setUserSearch] = useState("");
    const [efficiencyFilter, setEfficiencyFilter] = useState("");

    const efficiencyLevels = ["High", "At Par", "Low"];

    const [departmentList, setDepartmentList] = useState([]);
    const [usersAll, setUsersAll] = useState([]);
    let filteredUsers = usersAll;

    if (authUser?.userRole !== 1) {
        if (authUser?.userID) {
            filteredUsers = usersAll.filter(
                u =>
                    Number(u.reportingManagerId) === Number(authUser.userID) ||
                    Number(u.elManagerId) === Number(authUser.userID)
            );
        } else {
            filteredUsers = [];
        }
    }

    // finalRatingPercent: the Final Rating expressed as a percent (0-100+).
    // starRating: 0 (none), 1, 2, or 3 — only meaningful when the Final Rating
    // exceeds 100%, where it unlocks Grades 8, 9 and 10.
    // const getFinalGrade = (
    //     finalRatingPercent: number,
    //     starRating = 0
    // ) => {
    //     const grade = finalGradeFromPercent(
    //         finalRatingPercent,
    //         starRating
    //     );

    //     const fraction = (Math.round(finalRatingPercent) % 10) / 10;

    //     return {
    //         grade,
    //         display: (grade + fraction).toFixed(1),
    //         label: finalGradeLabelFromPercent(
    //             finalRatingPercent,
    //             starRating
    //         ),
    //     };
    // };

    const getFinalGrade = (
        finalRatingPercent: number,
        starRating = 0
    ) => {
        const roundedPercent = Math.round(finalRatingPercent);

        const grade = finalGradeFromPercent(
            roundedPercent,
            starRating
        );

        return {
            grade,
            display: grade.toFixed(1),
            label: finalGradeLabelFromPercent(
                roundedPercent,
                starRating
            ),
        };
    };

    const gradeColor = (g) => {
        if (g <= 2) return "danger";
        if (g <= 4) return "warning";
        if (g <= 6) return "primary";
        return "success";
    };

    const set = (field) => (val) =>
        setForm((prev) => ({ ...prev, [field]: val }));

    const setE = (field) => (e) =>
        setForm((prev) => ({ ...prev, [field]: e.target.value }));


    const g = parseFloat(form.goal) || 0;
    const u = parseFloat(form.util) || 0;
    const ev = parseFloat(form.eff) || 0;
    // const systemGrade =
    //     getSystemGrade(
    //         Number(form.goal || 0),
    //         Number(form.target || 0)
    //     );
    const weightedAchievement =
        (Number(form.goal || 0) * weightage.goalWeight +
            Number(form.target || 0) * weightage.targetWeight) / 100;

    const systemGrade = getSystemGrade(
        weightage.targetWeight,
        weightage.goalWeight,
        Number(form.target || 0),
        Number(form.goal || 0)
    );
    const managerRatings =
        Object.values(form.managerRatings || {});

    const managerRating =
        managerRatings.length > 0
            ? (
                managerRatings.reduce((sum, item) => {

                    const a1 =
                        Number(item?.assessor1 || 0);

                    const a2 =
                        Number(item?.assessor2 || 0);

                    let finalRating = 0;

                    // Assessor 2 priority
                    if (a1 > 0 && a2 > 0) {
                        finalRating = (a1 + a2) / 2;
                    } else if (a1 > 0) {
                        finalRating = a1;
                    } else if (a2 > 0) {
                        finalRating = a2;
                    }

                    return sum + finalRating;

                }, 0) / managerRatings.length
            )
            : 0;
    const finalScore =
        ((systemGrade * 0.95) + (managerRating * 0.05));

    const score =
        finalScore > 0
            ? Number(finalScore.toFixed(2))
            : null;

    // Round the percentage, not the 0–10 score
    const finalRatingPercent =
        finalScore > 0
            ? Math.round(finalScore * 10)
            : 0;

    const finalGrade = getFinalGrade(
        finalRatingPercent,
        form.starRating
    );

    const updateFeedback = (index, field, value) => {
        setForm((prev) => {
            const updated = [...prev.feedbacks];

            updated[index] = {
                ...updated[index],
                [field]: value,
            };

            return {
                ...prev,
                feedbacks: updated,
            };
        });
    };

    const addFeedbackRow = () => {
        setForm((prev) => ({
            ...prev,
            feedbacks: [
                ...prev.feedbacks,
                {
                    feedbackCat: "",
                    feedbackType: "",
                    feedback: "",
                    assessor1Id: assessorInfo.assessor1?.userID || "",      // ✅
                    assessor1Name: assessorInfo.assessor1?.userName || "",  // ✅
                    assessor2Id: assessorInfo.assessor2?.userID || "",      // ✅
                    assessor2Name: assessorInfo.assessor2?.userName || "",  // ✅
                },
            ],
        }));
    };

    const removeFeedbackRow = (index) => {
        setForm((prev) => ({
            ...prev,
            feedbacks: prev.feedbacks.filter((_, i) => i !== index),
        }));
    };

    useEffect(() => {
        if (!selectedFilterUser) return;

        setWeightDraft({
            goalWeight: String(weightage.goalWeight),
            targetWeight: String(weightage.targetWeight),
        });

        onWeightOpen();
    }, [selectedFilterUser]);
    // Add year to the quarter date range effect
    useEffect(() => {
        const range = QUARTER_DATE_RANGES[form.quarter];
        if (range && form.year) {
            setDateRange({
                startDate: range.startDate.replace("2026", form.year),
                endDate: range.endDate.replace("2026", form.year),
            });
        }
    }, [form.quarter, form.year]); // ✅ add form.year here


    function getEfficiencyLevel(target, goal, timeTaken, allocatedTime) {
        if (
            target >= 100 &&
            goal >= 80 &&
            timeTaken <= allocatedTime
        ) {
            return "High";
        }

        if (
            target >= 80 &&
            goal >= 50 &&
            timeTaken <= allocatedTime
        ) {
            return "At Par";
        }

        return "Low";
    }

    const selectedUser = useMemo(() => {
        if (!form.empId || usersAll.length === 0) return null;
        return usersAll.find(
            (u) => String(u.userID) === String(form.empId)
        );
    }, [form.empId, usersAll]);

    const assessorInfo = useMemo(() => {
        if (!selectedUser) return { assessor1: null, assessor2: null };

        const assessor1 = usersAll.find(
            (u) => u.userID === selectedUser.reportingManagerId
        ) || null;

        const assessor2 = usersAll.find(
            (u) => u.userID === selectedUser.elManagerId
        ) || null;
        return { assessor1, assessor2 };
    }, [selectedUser, usersAll]);

    useEffect(() => {
        if (!assessorInfo.assessor1 && !assessorInfo.assessor2) return;

        setForm((prev) => ({
            ...prev,
            feedbacks: prev.feedbacks.map((f) => ({
                ...f,
                assessor1Id: assessorInfo.assessor1?.userID || "",
                assessor1Name: assessorInfo.assessor1?.userName || "",
                assessor2Id: assessorInfo.assessor2?.userID || "",
                assessor2Name: assessorInfo.assessor2?.userName || "",
            })),
        }));
    }, [assessorInfo]);

    const selectedGoalSummary = useMemo(() => {
        if (!dashboardData?.userGoalSummary || !form.empId) return null;
        return dashboardData.userGoalSummary.find(
            (u) => String(u.UserID) === String(form.empId)
        );
    }, [dashboardData, form.empId]);

    const selectedSummary = useMemo(() => {
        if (!dashboardData?.userSummary || !form.empId) return null;
        return dashboardData.userSummary.find(
            (u) => String(u.UserID) === String(form.empId)
        );
    }, [dashboardData, form.empId]);

    const goalVal = selectedGoalSummary?.AvgGoalEfficiency?.toFixed(2) || "";
    const utilVal = selectedSummary?.AvgUtilizationPercent?.toFixed(2) || "";
    const targetVal = userSummary?.AvgTargetPercent?.toFixed(2) || selectedSummary?.AvgTargetPercent?.toFixed(2) || "";
    const effPercent =
        selectedSummary?.AvgAllocatedHrs
            ? (
                (selectedSummary.AvgTotalWork /
                    selectedSummary.AvgAllocatedHrs) * 100
            ).toFixed(2)
            : "";

    const effLabel =
        selectedSummary?.AvgAllocatedHrs
            ? getEfficiencyLevel(
                targetVal,
                goalVal,
                selectedSummary?.AvgTotalWork || 0,
                selectedSummary?.AvgAllocatedHrs || 0
            )
            : "";

    // ─── QUARTERLY DASHBOARD API CALL ───
    useEffect(() => {
        const controller = new AbortController();
        const fetchQuarterlyDashboard = async () => {
            setLoading(true);
            setUserSummary(null);

            try {
                // ─────────────────────────────────────
                // QUARTERLY EFFICIENCY SUMMARY API
                // ─────────────────────────────────────

                const bodyData = {
                    departmentID: "",
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                    userID: selectedFilterUser ? Number(selectedFilterUser) : null,
                    groupBy: "quarter",
                    isHeExecutiveLeader: false,
                    efficiencyLevel: efficiencyFilter || null,
                    isQuarterly: true,
                };

                const res = await axios.post(
                    "/t2.0/authentificationUtilization/list-efficiency-summary",
                    bodyData,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${authUser?.token ?? ""}`,
                        },
                        signal: controller.signal,
                    }
                );

                // ─────────────────────────────────────
                // QUARTERLY GOAL API
                // ─────────────────────────────────────

                const goalBody = {
                    departmentID: filterStatus ? Number(filterStatus) : null,
                    userID: selectedFilterUser ? Number(selectedFilterUser) : null,
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                    roleID: user?.userRole,
                    goalEndDate: dateRange.endDate,
                    goalStartDate: dateRange.startDate,
                    elID: user?.isHeExecutiveLeader ? user.userID : null,
                    isHeExecutiveLeader: user?.isHeExecutiveLeader || false,
                    searchText: "",
                };

                const goalRes = await axios.post(
                    `/t2.0/authentificationUtilization/userGoalData/list?page=1&size=100`,
                    goalBody,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${authUser?.token ?? ""}`,
                        },
                        signal: controller.signal,
                    }
                );

                // ─────────────────────────────────────
                // QUARTERLY GOAL VALUE
                // ─────────────────────────────────────

                const avgGoal =
                    goalRes?.data?.response?.avgPercent
                        ? Number(goalRes.data.response.avgPercent).toFixed(2)
                        : "0";


                // ─────────────────────────────────────
                // SUMMARY
                // ─────────────────────────────────────

                const summary = res.data.summary;
                const monthlyGoal =
                    goalRes?.data?.response?.monthlyAvgBreakdown || [];
                const goalDataList =
                    goalRes?.data?.response?.userGoalDataList || [];

                // Latest userGoalDataID per month (records are sorted
                // newest-first, so the first hit per month wins).
                const goalIdByMonth: any = {};
                goalDataList.forEach((rec: any) => {
                    if (!rec?.workDate || rec.userGoalDataID == null) return;
                    const m = Number(rec.workDate.split("-")[1]);
                    if (m && goalIdByMonth[m] == null) {
                        goalIdByMonth[m] = {
                            userGoalDataID: rec.userGoalDataID,
                            workDate: rec.workDate,
                            revisedGoal: rec.revisedGoal ?? null,
                        };
                    }
                });

                // Union both sources by MonthNumber so a month present in
                // only one of the two APIs (e.g. goal data exists but
                // efficiency summary has a data gap, or vice versa) still
                // shows up as a tab.
                const monthMap = new Map();

                (summary?.monthlyBreakdown || []).forEach((ele) => {
                    monthMap.set(ele.MonthNumber, {
                        ...ele,
                        ...(goalIdByMonth[ele.MonthNumber] || {}),
                    });
                });

                monthlyGoal.forEach((g) => {
                    const existing = monthMap.get(g.MonthNumber) || {
                        MonthNumber: g.MonthNumber,
                        Year: g.Year,
                    };
                    monthMap.set(g.MonthNumber, {
                        ...existing,
                        goalAchievement: g.AvgPercent || 0,
                        ...(goalIdByMonth[g.MonthNumber] || {}),
                    });
                });

                const mergedMonthlyBreakdown = Array.from(monthMap.values())
                    .sort((a, b) => a.MonthNumber - b.MonthNumber);

                setDashboardData(res.data);

                setUserSummary({
                    ...summary,
                    monthlyBreakdown: mergedMonthlyBreakdown,
                });
                console.log(summary, "heyy")
                // ─────────────────────────────────────
                // MAP VALUES TO FORM
                // ─────────────────────────────────────
                setForm((prev) => existingQuarterReview ? prev : ({
                    ...prev,
                    goal: avgGoal,
                    target: summary?.AvgTargetPercent?.toFixed(2) || "",
                    util: summary?.AvgUtilizationPercent?.toFixed(2) || "",
                    eff: summary?.AvgAllocatedHrs
                        ? (
                            (summary.AvgTotalWork / summary.AvgAllocatedHrs) * 100
                        ).toFixed(2)
                        : "",
                    effLabel: summary?.EfficiencyLevel || "",
                }));

            } catch (err) {
                if (!axios.isCancel(err)) {
                    console.error("Quarterly Dashboard fetch error:", err);
                }
            } finally {
                setLoading(false);
            }
        };

        if (selectedFilterUser) {
            fetchQuarterlyDashboard();
        }

        return () => controller.abort();

    }, [
        selectedFilterUser,
        dateRange.startDate,
        dateRange.endDate,
        efficiencyFilter,
        existingQuarterReview,
    ]);




    useEffect(() => {
        if (!selectedSummary || !selectedGoalSummary) return;

        setForm((prev) => ({
            ...prev,
            goal: goalVal,
            target: targetVal,
            util: utilVal,
            eff: effPercent,
            effLabel: effLabel,
        }));
    }, [selectedSummary, selectedGoalSummary]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const body = {
                    filter: "",
                    searchText: "",
                    departmentID: 0
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
                setUsersAll(usersData);
                console.log("Users:", usersData);
            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };


        fetchUsers();

    }, []);

    // ─────────────────────────────────────────────
    // FETCH QUARTERLY REVIEWS API CALL
    // ─────────────────────────────────────────────

    const fetchQuarterlyReviews = async () => {
        if (!selectedFilterUser) return;

        try {
            setLoading(true);

            const response = await axios.get(
                `/t2.0/authentificationUtilization/quarterly-reviews/${selectedFilterUser}`,
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

            console.log("Quarterly Reviews Response:", response.data);

            // ─────────────────────────────
            // FORMAT API RESPONSE
            // ─────────────────────────────

            const formatted = (response.data || []).map((item) => ({
                id: item.id,
                empId: item.empId,
                quarter: item.quarter,
                target: Number(item.target || 0),
                goal: Number(item.goal || 0),
                util: Number(item.utilization || 0),
                eff: Number(item.efficiency || 0),
                effLabel: item.efficiencyLabel || "",
                tasks: item.tasks || "",
                status: item.status || "",
                feedbackCat: item.feedbackCategory || "",
                feedbackType: item.feedbackType || "",
                feedback: item.feedback
                    ? JSON.parse(item.feedback)?.comment || ""
                    : "",
                ts: item.timestamp || Date.now(),
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            }));

            console.log("Formatted Quarterly Reviews:", formatted);
            setReviews(formatted);

        } catch (err) {
            console.error("Fetch Quarterly Reviews Error:", err);

        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuarterlyReviews();
    }, [selectedFilterUser]);
    useEffect(() => {

        const loadQuarterReview = async () => {

            if (
                !selectedFilterUser ||
                !form.quarter ||
                !form.year
            ) {
                return;
            }

            const exists =
                await fetchExistingQuarterlyReview(
                    selectedFilterUser,
                    form.quarter,
                    form.year
                );

            // if review exists
            // stop dashboard flow
            if (exists) {
                return;
            }

            // if no review exists
            // normal flow continues automatically

        };

        loadQuarterReview();

    }, [
        selectedFilterUser,
        form.quarter,
        form.year
    ]);

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

                const formatted = data?.map((dept) => ({
                    key: dept.departmentID,
                    name: dept.departmentName,
                    description: dept.departmentDescription,
                    status: dept.newStatus,
                })) || [];

                setDepartmentList(formatted);
                console.log("Department list:", formatted);
            } catch (err) {
                console.error("Error fetching department list:", err);
            }
        };

        fetchDepartments();
    }, []);

    // ─────────────────────────────
    // SAVE QUARTERLY REVIEW
    // ─────────────────────────────


    const fetchExistingQuarterlyReview = async (
        empId,
        quarter,
        year
    ) => {

        if (!empId || !quarter || !year) {
            return false;
        }

        try {

            const response = await axios.get(
                `/t2.0/authentificationUtilization/quarterly-review/employee/${empId}`,
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

            const reviews = response.data || [];

            const matched =
                reviews.find(
                    (r) =>
                        r.quarter === quarter &&
                        Number(r.quarterYear) === Number(year)
                );

            // ─────────────────────────────
            // IF REVIEW EXISTS
            // ─────────────────────────────

            if (matched) {

                console.log(
                    "Existing Quarterly Review Found",
                    matched
                );

                setExistingQuarterReview(matched);

                const savedRevisions =
                    typeof matched.monthlyGoalRevisions === "string"
                        ? JSON.parse(matched.monthlyGoalRevisions || "[]")
                        : matched.monthlyGoalRevisions || [];

                setRevisedGoals(
                    Array.isArray(savedRevisions)
                        ? savedRevisions.reduce((acc, r) => {
                            if (r?.monthNumber != null) {
                                acc[r.monthNumber] = Number(r.goalAchievement || 0);
                            }
                            return acc;
                        }, {})
                        : {}
                );

                const savedGrade = Array.isArray(matched.grade)
                    ? matched.grade[0]
                    : (typeof matched.grade === "string"
                        ? JSON.parse(matched.grade || "[]")?.[0]
                        : null);

                if (savedGrade?.goalWeight != null && savedGrade?.targetWeight != null) {
                    const gw = Number(savedGrade.goalWeight);
                    const tw = Number(savedGrade.targetWeight);
                    setWeightage({ goalWeight: gw, targetWeight: tw });
                    setWeightDraft({ goalWeight: String(gw), targetWeight: String(tw) });
                }

                setForm((prev) => ({
                    ...prev,
                    empId: matched.empId,
                    quarter: matched.quarter,
                    year: matched.quarterYear,
                    target: matched.targetPercent || "",
                    goal: matched.goalAchievement || "",
                    util: matched.utilizationPercent || "",
                    eff: matched.efficiencyPercent || "",
                    effLabel: matched.efficiencyLabel || "",
                    status: matched.status || "",
                    starRating: Number(savedGrade?.starRating || 0),
                    starDescription: savedGrade?.starDescription || "",
                    feedbacks:
                        typeof matched.feedback === "string"
                            ? JSON.parse(matched.feedback)
                            : matched.feedback || [],
                    managerRatings:
                        typeof matched.managerRatings === "string"
                            ? JSON.parse(matched.managerRatings)
                            : matched.managerRatings || {},
                }));

                return true;
            }

            // ─────────────────────────────
            // NO REVIEW FOUND
            // ─────────────────────────────

            setExistingQuarterReview(null);
            setRevisedGoals({});
            setForm((prev) => ({
                ...prev,
                target: "",
                goal: "",
                util: "",
                eff: "",
                effLabel: "",
                status: "On Track",
                feedbacks: [{ feedbackCat: "", feedbackType: "", feedback: "" }],
                managerRatings: DEFAULT.managerRatings,
            }));
            return false;

        } catch (err) {

            console.error(
                "Fetch Existing Quarterly Review Error",
                err
            );

            setExistingQuarterReview(null);

            return false;
        }
    };




    const handleSave = async () => {
        if (loading) return;


        // ─────────────────────────────
        // REQUEST BODY
        // ─────────────────────────────

        const currentYear =
            new Date().getFullYear();

        const enrichedFeedbacks = form.feedbacks.map((f) => ({
            ...f,
            assessor1Id: assessorInfo.assessor1?.userID || f.assessor1Id || null,
            assessor1Name: assessorInfo.assessor1?.userName || f.assessor1Name || "",
            assessor2Id: assessorInfo.assessor2?.userID || f.assessor2Id || null,
            assessor2Name: assessorInfo.assessor2?.userName || f.assessor2Name || "",
        }));

        // ✅ Enrich managerRatings with assessor IDs at save time
        const enrichedManagerRatings = Object.fromEntries(
            Object.entries(form.managerRatings).map(([key, val]) => [
                key,
                {
                    ...val,
                    assessor1Id: assessorInfo.assessor1?.userID || val.assessor1Id || null,
                    assessor2Id: assessorInfo.assessor2?.userID || val.assessor2Id || null,
                },
            ])
        );

        const requestBody = {
            empId: Number(selectedFilterUser || form.empId),
            quarter: form.quarter,
            quarterYear: Number(form.year),           // ✅ use form.year not hardcoded currentYear
            quarterStartDate: QUARTER_DATE_RANGES[form.quarter]?.startDate.replace("2026", form.year),
            quarterEndDate: QUARTER_DATE_RANGES[form.quarter]?.endDate.replace("2026", form.year),
            targetPercent: parseFloat(form.target || 0),
            goalAchievement: parseFloat(form.goal || 0),
            utilizationPercent: parseFloat(form.util || 0),
            efficiencyPercent: parseFloat(form.eff || 0),
            efficiencyLabel: form.effLabel || "",
            status: form.status || "On Track",
            feedback: enrichedFeedbacks,             // ✅ enriched
            submittedAt: Date.now(),
            managerRatings: enrichedManagerRatings,  // ✅ enriched
            managerAvgRating: Number((managerRating || 0).toFixed(2)),
            systemGrade: Number(systemGrade || 0),
            finalRating: Number(score || 0),
            monthlyGoalRevisions: monthlyData
                .filter((m: any) => m.revisedGoal?.elApproved)
                .map((m: any) => ({
                    monthNumber: Number(m.MonthNumber),
                    goalAchievement: Number(m.revisedGoal.value),
                })),
            monthlyTargetRevisions: monthlyData
                .filter((m: any) => (m.revisedTarget ?? m.RevisedTarget)?.elApproved)
                .map((m: any) => ({
                    monthNumber: Number(m.MonthNumber),
                    targetAchievement: Number((m.revisedTarget ?? m.RevisedTarget).value),
                })),
            grade: [{
                finalGrade: finalGrade.grade,
                finalGradeLabel: finalGrade.label,
                starRating: Number(form.starRating || 0),
                starDescription: form.starDescription || "",

                // Weightage used for this review
                goalWeight: Number(weightage.goalWeight),
                targetWeight: Number(weightage.targetWeight),
            }]
        };
        console.log("Quarterly Review Payload:", requestBody);

        try {
            setLoading(true);

            let response;

            if (existingQuarterReview?.id) {

                // UPDATE
                response = await axios.put(
                    `/t2.0/authentificationUtilization/quarterly-review/update/${existingQuarterReview.id}`,
                    requestBody,
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

            } else {

                // CREATE
                response = await axios.post(
                    "/t2.0/authentificationUtilization/quarterly-review/create",
                    requestBody,
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
            }

            console.log("Quarterly Review Saved:", response.data);

            addToast({
                title: "Success",
                description:
                    existingQuarterReview
                        ? "Quarterly review updated successfully"
                        : "Quarterly review saved successfully",
                color: "success",
            });

            const newEntry = {
                ...form,
                ts: Date.now(),
            };

            setReviews((prev) => [newEntry, ...prev]);

            setForm({
                ...DEFAULT,
                quarter: form.quarter,
            });

            setErrors({});
            setSelectedFilterUser("");
            setUserSearch("");
            setRevisedGoals({});
            setRevisingMonth(null);
            setRevisingTargetMonth(null);
            setRevisingDailyTaskLogId(null);
            setSaved(true);

            setTimeout(() => {
                setSaved(false);
            }, 2500);

        } catch (err) {
            console.error("Quarterly Review Save Error:", err);
            console.log(err?.response?.data);

            addToast({
                title: "Error",
                description:
                    err?.response?.data?.message ||
                    "Failed to save quarterly review",
                color: "danger",
            });

        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────
    // DELETE QUARTERLY REVIEW
    // ─────────────────────────────────────────────

    const handleDeleteReview = async (id) => {
        try {
            setLoading(true);

            await axios.delete(
                `/t2.0/authentificationUtilization/quarterly-reviews/${id}`,
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

            setReviews((prev) =>
                prev.filter((item) => item.id !== id)
            );

            addToast({
                title: "Success",
                description: "Quarterly review deleted successfully",
                color: "success",
            });

        } catch (err) {
            console.error("Delete Quarterly Review Error:", err);

            addToast({
                title: "Error",
                description:
                    err?.response?.data?.message ||
                    "Failed to delete quarterly review",
                color: "danger",
            });

        } finally {
            setLoading(false);
        }
    };

    const DateRangeDropdown = useCallback(
        ({ value, onChange }) => (
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
    // const weightedAchievement =
    //     (Number(form.goal || 0) * weightage.goalWeight +
    //         Number(form.target || 0) * weightage.targetWeight) / 100;

    // const systemGrade = getSystemGrade(
    //     weightedAchievement,
    //     Number(form.target || 0)
    // );
    return (
        <div className="min-h-screen bg-default-50 p-6 font-sans">
            <Modal
                isOpen={isWeightOpen}
                onOpenChange={onWeightOpenChange}
                placement="center"
                backdrop="blur"
                isDismissable={false}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                Set Weightage
                            </ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-600 mb-2">
                                    Define how much Goal Achievement vs Target Achievement should
                                    weigh into the system grade for this review.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        type="number"
                                        label="Goal Weightage %"
                                        // min={60}
                                        // max={100}
                                        value={weightDraft.goalWeight}
                                        onChange={(e) => {
                                            const goal = Math.max(
                                                // 60,
                                                0,
                                                Math.min(100, Number(e.target.value || 0))
                                            );

                                            setWeightDraft({
                                                goalWeight: String(goal),
                                                targetWeight: String(100 - goal),
                                            });
                                        }}
                                    />

                                    <Input
                                        type="number"
                                        label="Target Weightage %"
                                        min={0}
                                        // max={40}
                                        value={weightDraft.targetWeight}
                                        onChange={(e) => {
                                            const target = Math.max(
                                                0,
                                                // Math.min(40, Number(e.target.value || 0))
                                                Math.min(100, Number(e.target.value || 0))
                                            );

                                            setWeightDraft({
                                                targetWeight: String(target),
                                                goalWeight: String(100 - target),
                                            });
                                        }}
                                    />
                                </div>
                                {Number(weightDraft.goalWeight) + Number(weightDraft.targetWeight) !== 100 && (
                                    // || Number(weightDraft.goalWeight) < 60
                                    <p className="text-xs text-danger mt-2">
                                        Both weightages must total 100%.
                                    </p>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button
                                    color="primary"
                                    isDisabled={
                                        Number(weightDraft.goalWeight) + Number(weightDraft.targetWeight) !== 100
                                        // || Number(weightDraft.goalWeight) < 60
                                    }
                                    onPress={() => {
                                        setWeightage({
                                            goalWeight: Number(weightDraft.goalWeight),
                                            targetWeight: Number(weightDraft.targetWeight),
                                        });
                                        onClose();
                                    }}
                                >
                                    Confirm
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isReviseOpen}
                onOpenChange={(open) => {
                    onReviseOpenChange();
                    if (!open) {
                        setRevisingMonth(null);
                        setRevisingGoalDataId(null);
                    }
                }}
                placement="center"
                backdrop="blur"
                isDismissable={false}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                Revise Goal Achievement
                            </ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-600 mb-2">
                                    Override the auto-calculated Goal Achievement for{" "}
                                    <span className="font-semibold text-default-800">
                                        {revisingMonth != null
                                            ? monthName(revisingMonth)
                                            : ""}
                                    </span>
                                    . This revised value will be saved with the review.
                                </p>
                                <div className="flex items-end gap-4">
                                    <div className="flex-1">
                                        <Input
                                            type="number"
                                            label="Revised Goal Achievement %"
                                            min={0}
                                            max={100}
                                            value={revisedDraft}
                                            onChange={(e) =>
                                                setRevisedDraft(e.target.value)
                                            }
                                        />
                                    </div>
                                    {/* <div className="flex gap-2">
                                        {revisingMonth != null && (
                                            <Button
                                                size="sm"
                                                variant="flat"
                                                color="danger"
                                                className="mb-1"
                                                onPress={() => {
                                                    setRevisedGoals(
                                                        (prev: any) => {
                                                            const next = {
                                                                ...prev,
                                                            };
                                                            delete next[
                                                                revisingMonth
                                                            ];
                                                            return next;
                                                        }
                                                    );
                                                    onClose();
                                                }}
                                            >
                                                Reset to Auto
                                            </Button>
                                        )}
                                    </div> */}
                                </div>
                                {(revisedDraft === "" ||
                                    isNaN(Number(revisedDraft)) ||
                                    Number(revisedDraft) < 0 ||
                                    Number(revisedDraft) > 100) && (
                                        <p className="text-xs text-danger mt-1">
                                            Enter a value between 0 and 100.
                                        </p>
                                    )}
                                {revisingGoalDataId == null && (
                                    <p className="text-xs text-warning mt-1">
                                        No goal data record found for this month — revision cannot be saved.
                                    </p>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button
                                    color="primary"
                                    isLoading={reviseSaving}
                                    isDisabled={
                                        revisedDraft === "" ||
                                        isNaN(Number(revisedDraft)) ||
                                        Number(revisedDraft) < 0 ||
                                        Number(revisedDraft) > 100 ||
                                        revisingGoalDataId == null
                                    }
                                    onPress={handleReviseGoalSave}
                                >
                                    Save Revision
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isReviseTargetOpen}
                onOpenChange={(open) => {
                    onReviseTargetOpenChange();
                    if (!open) {
                        setRevisingTargetMonth(null);
                        setRevisingDailyTaskLogId(null);
                    }
                }}
                placement="center"
                backdrop="blur"
                isDismissable={false}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                Revise Target Achievement
                            </ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-600 mb-2">
                                    Override the auto-calculated Target Achievement for{" "}
                                    <span className="font-semibold text-default-800">
                                        {revisingTargetMonth != null
                                            ? monthName(revisingTargetMonth)
                                            : ""}
                                    </span>
                                    . This revised value will be saved with the review.
                                </p>
                                <div className="flex items-end gap-4">
                                    <div className="flex-1">
                                        <Input
                                            type="number"
                                            label="Revised Target Achievement %"
                                            min={0}
                                            max={100}
                                            value={revisedTargetDraft}
                                            onChange={(e) =>
                                                setRevisedTargetDraft(e.target.value)
                                            }
                                        />
                                    </div>
                                </div>
                                {(revisedTargetDraft === "" ||
                                    isNaN(Number(revisedTargetDraft)) ||
                                    Number(revisedTargetDraft) < 0 ||
                                    Number(revisedTargetDraft) > 100) && (
                                        <p className="text-xs text-danger mt-1">
                                            Enter a value between 0 and 100.
                                        </p>
                                    )}
                                {revisingDailyTaskLogId == null && (
                                    <p className="text-xs text-warning mt-1">
                                        No target data record found for this month — revision cannot be saved.
                                    </p>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button
                                    color="primary"
                                    isLoading={reviseTargetSaving}
                                    isDisabled={
                                        revisedTargetDraft === "" ||
                                        isNaN(Number(revisedTargetDraft)) ||
                                        Number(revisedTargetDraft) < 0 ||
                                        Number(revisedTargetDraft) > 100 ||
                                        revisingDailyTaskLogId == null
                                    }
                                    onPress={handleReviseTargetSave}
                                >
                                    Save Revision
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
            {/* ── Header ── */}
            <div className="mx-auto mb-7 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-xl font-semibold ">Quarterly Review</h1>
                        <p className="text-[11px] mt-0.5">Manager · Consolidated Quarterly Assessment &amp; Performance Metrics</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Chip color="primary" variant="flat" size="sm" className="font-semibold">2025–26 Cycle</Chip>
                    <Chip color="success" variant="dot" size="sm" className="font-semibold">Active</Chip>
                </div>
            </div>

            {/* ── Layout ── */}
            <div className="mx-auto grid grid-cols-[1fr_288px] gap-5 items-start">

                {/* ── LEFT ── */}
                <div className="flex flex-col gap-5">

                    {/* Form Card */}
                    <Card shadow="sm" radius="lg" className="border border-divider">
                        <CardHeader className="px-6 pt-5 pb-0">
                            <div className="flex items-center gap-2.5">
                                <span className="w-[3px] h-4 bg-primary rounded-full block" />
                                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-default-700">New Quarterly Review</p>
                            </div>
                        </CardHeader>

                        <CardBody className="px-6 pt-5 pb-6 flex flex-col gap-4">
                            <div className="bg-default-50 border border-divider rounded-xl p-4 flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <Divider className="flex-1" />
                                    <p className="text-[10px] uppercase tracking-[.15em] text-default-700 whitespace-nowrap">
                                        Star Performance &amp; Final Grade
                                    </p>
                                    <Divider className="flex-1" />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4 items-start">
                                    <div className="flex flex-col items-center justify-center gap-2 bg-white dark:bg-ink-900 border border-divider rounded-xl p-3">
                                        <p className="text-[10px] uppercase tracking-wider text-default-700">
                                            Star Rating
                                        </p>
                                        <StarSelector
                                            value={form.starRating}
                                            onChange={set("starRating")}
                                            isDisabled={finalRatingPercent <= 100}
                                        />
                                        <p className="text-[10px] text-default-700">
                                            {form.starRating > 0
                                                ? `${form.starRating} Star${form.starRating > 1 ? "s" : ""}`
                                                : "None"}
                                        </p>
                                        {finalRatingPercent <= 100 && (
                                            <p className="text-[9px] text-default-400 text-center leading-tight">
                                                Only applicable when Final Rating exceeds 100%
                                            </p>
                                        )}
                                    </div>

                                    <Textarea
                                        label="Star Rating Justification"
                                        placeholder="Describe the exceptional performance that justifies this star rating..."
                                        value={form.starDescription}
                                        onChange={setE("starDescription")}
                                        minRows={3}
                                        size="sm"
                                        radius="lg"
                                        classNames={{ inputWrapper: "bg-white dark:bg-ink-900 border-default-200" }}
                                    />
                                </div>

                                <div className="flex items-center justify-between bg-white dark:bg-ink-900 border border-divider rounded-xl px-4 py-3">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-default-700">
                                            Final Grade
                                        </p>
                                        <p className="text-sm font-semibold text-default-900">
                                            {finalGrade.label}
                                        </p>
                                        <p className="text-[10px] text-default-700 mt-0.5">
                                            Based on Final Rating ({finalRatingPercent.toFixed(1)}%)
                                        </p>
                                    </div>
                                    <Chip
                                        color={gradeColor(finalGrade.grade)}
                                        variant="flat"
                                        size="lg"
                                        className="font-black text-base"
                                    >
                                        {finalGrade.display}
                                    </Chip>
                                </div>
                            </div>
                            {/* Row 1 — Department + Employee + Quarter */}
                            <div className="grid grid-cols-4 gap-4">
                                {/* <Autocomplete
                                aria-label="filter by Reviewee Department"
                                placeholder="Filter by Reviewee Department"
                                className="max-w-xs"
                                selectedKey={filterStatus}
                                onSelectionChange={(key) => {
                                    const dep = key as string;
                                    setFilterStatus(dep);
                                    setSelectedFilterUser("");
                                    setUserSearch("");

                                }}
                            >
                                {departmentList
                                    .filter((ele) => ele.status === "Active")
                                    .map((ele) => (
                                        <AutocompleteItem key={ele.key} value={ele.name}>
                                            {ele.name.replace(/([A-Z])/g, " $1").trim()}
                                        </AutocompleteItem>
                                    ))}
                            </Autocomplete> */}

                                <Autocomplete
                                    aria-label="filter by Reviewee"
                                    placeholder="Filter by Reviewee"
                                    className="max-w-xs"
                                    selectedKey={selectedFilterUser}
                                    inputValue={userSearch}
                                    onInputChange={(value) => {
                                        const dep = value as string;
                                        setUserSearch(dep);
                                        if (!dep) setSelectedFilterUser("");
                                    }}
                                    onSelectionChange={(key) => {
                                        if (key) {
                                            const found = usersAll.find((u) => String(u.userID) === String(key));

                                            if (found) {
                                                setSelectedFilterUser(String(key));
                                                setUserSearch(found.userName);
                                                set("empId")(String(key));
                                            }
                                        }
                                    }}
                                >
                                    {filteredUsers.map((u) => (
                                        <AutocompleteItem key={String(u.userID)} textValue={u.userName}>
                                            {u.userName}
                                        </AutocompleteItem>
                                    ))}
                                </Autocomplete>

                                <Select
                                    label="Quarter"
                                    isRequired
                                    selectedKeys={new Set([form.quarter])}
                                    onSelectionChange={(keys) => set("quarter")(Array.from(keys)[0] ?? "Q1")}
                                    size="sm"
                                    radius="lg"
                                    classNames={{ trigger: "bg-default-100 border-default-200" }}
                                >
                                    {QUARTERS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                                </Select>
                                <Select
                                    label="Year"
                                    selectedKeys={
                                        new Set([String(form.year)])
                                    }
                                    onSelectionChange={(keys) =>
                                        set("year")(
                                            Array.from(keys)[0]
                                        )
                                    }
                                    size="sm"
                                    radius="lg"
                                    classNames={{
                                        trigger:
                                            "bg-default-100 border-default-200"
                                    }}
                                >
                                    {YEARS.map((y) => (
                                        <SelectItem
                                            key={String(y)}
                                            value={String(y)}
                                        >
                                            {String(y)}
                                        </SelectItem>
                                    ))}
                                </Select>
                            </div>

                            {/* Date Range */}
                            <div className="mb-4 hidden">
                                <DateRangeDropdown value={dateRange} onChange={setDateRange} />
                            </div>

                            {/* Info callout */}
                            <div className="flex items-center gap-2.5 bg-primary-50 border border-primary-200 rounded-xl px-3.5 py-2.5 my-2">
                                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                <p className="text-xs text-primary-700">
                                    Quarterly metrics
                                </p>
                            </div>

                            {/* Row 2 — Auto metrics */}
                            <div className="space-y-4 ">

                                {/* Overall Summary */}
                                <div className="grid grid-cols-2 gap-8 p-3">
                                    {[
                                        ["target", "Target %"],
                                        ["goal", "Goal Achievement"],
                                        ["util", "Utilization %"],
                                        ["eff", "Efficiency Level"],
                                    ].map(([field, lbl]) => (
                                        <Input
                                            key={field}
                                            type="text"
                                            label={
                                                <span className="flex items-center gap-1.5 py-2">
                                                    {lbl} <AutoTag />
                                                </span>
                                            }
                                            value={
                                                field === "goal"
                                                    ? form.goal
                                                        ? `${form.goal}%`
                                                        : ""
                                                    : field === "eff"
                                                        ? form.effLabel || ""
                                                        : form[field]
                                                            ? `${form[field]}%`
                                                            : ""
                                            }
                                            isDisabled
                                            size="sm"
                                            radius="lg"
                                            classNames={{
                                                input:
                                                    field === "eff"
                                                        ? `
                                font-semibold
                                ${form.effLabel === "High" ? "text-success" : ""}
                                ${form.effLabel === "At Par" ? "text-warning" : ""}
                                ${form.effLabel === "Low" ? "text-danger" : ""}
                            `
                                                        : "text-default-600",
                                                inputWrapper:
                                                    "bg-default-100 border-default-200",
                                            }}
                                        />
                                    ))}
                                </div>

                                {/* Quarterly Breakdown */}
                                <div className="bg-rose-100 border border-rose-200 rounded-xl p-4">
                                    <p className="text-[10px] uppercase tracking-[.15em] text-default-700 -mt-1">
                                        Monthly Breakdown</p>

                                    <Tabs
                                        aria-label="Quarterly Breakdown"
                                        color="primary"
                                        variant="underlined"
                                    >
                                        {monthlyData.length > 0 ?
                                            (monthlyData.map((month: any) => (
                                                <Tab
                                                    key={month.MonthNumber}
                                                    title={monthName(month.MonthNumber)}
                                                >
                                                    <div className="grid grid-cols-2 gap-8 p-3">
                                                        {[
                                                            ["AvgTargetPercent", "Target %"],
                                                            ["goalAchievement", "Goal Achievement"],
                                                            ["AvgUtilizationPercent", "Utilization %"],
                                                            ["EfficiencyLevel", "Efficiency Level"],

                                                        ].map(([field, lbl]) => {
                                                            const isGoalField = field === "goalAchievement";
                                                            const isTargetField = field === "AvgTargetPercent";
                                                            const isReviseField = isGoalField || isTargetField;

                                                            const rg = isGoalField
                                                                ? month.revisedGoal
                                                                : isTargetField
                                                                    ? (month.revisedTarget ?? month.RevisedTarget)
                                                                    : null;
                                                            const isApproved = !!rg?.elApproved;
                                                            const isPending = !!rg && !rg.elApproved;
                                                            const isRevised = isReviseField && isApproved;

                                                            const currentValue = isApproved
                                                                ? rg.value
                                                                : month[field] ?? 0;

                                                            const REVISE_ROLES = [3, 4, 7];
                                                            const canEnter =
                                                                REVISE_ROLES.includes(Number(user?.userRole)) &&
                                                                Number(user?.userID) === Number(assessorInfo.assessor1?.userID);
                                                            const canApprove =
                                                                isPending &&
                                                                (Number(user?.userRole) === 3 ||
                                                                    (REVISE_ROLES.includes(Number(user?.userRole)) &&
                                                                        Number(user?.userID) === Number(assessorInfo.assessor2?.userID) &&
                                                                        Number(rg.enteredBy) !== Number(user?.userID)));

                                                            const inputNode = (
                                                                <Input
                                                                    key={field}
                                                                    type="text"
                                                                    label={
                                                                        <span className="flex items-center gap-1.5 py-2">
                                                                            {lbl}{" "}
                                                                            {isReviseField
                                                                                ? (isRevised ? <RevisedTag /> : <AutoTag />)
                                                                                : <AutoTag />}
                                                                        </span>
                                                                    }
                                                                    value={
                                                                        field === "EfficiencyLevel"
                                                                            ? month[field] || ""
                                                                            : isReviseField
                                                                                ? `${currentValue}%`
                                                                                : `${month[field] ?? 0}%`
                                                                    }
                                                                    isDisabled
                                                                    size="sm"
                                                                    radius="lg"
                                                                    classNames={{
                                                                        input:
                                                                            field === "EfficiencyLevel"
                                                                                ? `
                                                font-semibold
                                                ${month[field] === "High" ? "text-success" : ""}
                                                ${month[field] === "At Par" ? "text-warning" : ""}
                                                ${month[field] === "Low" ? "text-danger" : ""}
                                            `
                                                                                : isRevised
                                                                                    ? "text-warning font-semibold"
                                                                                    : "text-default-600",
                                                                        inputWrapper:
                                                                            "bg-default-100 border-default-200",
                                                                    }}
                                                                />
                                                            );

                                                            if (!isReviseField) return inputNode;

                                                            return (
                                                                <div key={field} className="flex flex-col gap-1">
                                                                    {inputNode}
                                                                    <div className="flex justify-end">
                                                                        {/* {isPending && (
                                                                            <Chip size="sm" variant="flat" color="warning" className="mr-2">
                                                                                Pending EL approval: {rg.value}%
                                                                            </Chip>
                                                                        )} */}
                                                                        {canEnter && (
                                                                            <Button size="sm" variant="flat" color="primary"
                                                                                onPress={() => isGoalField ? openReviseGoal(month) : openReviseTarget(month)}>
                                                                                Revise {isGoalField ? "Goal" : "Target"}
                                                                            </Button>
                                                                        )}
                                                                        {canApprove && (
                                                                            <Button size="sm" color="success" className="ml-2"
                                                                                onPress={() => isGoalField ? handleApproveRevisedGoal(month) : handleApproveRevisedTarget(month)}>
                                                                                Approve
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </Tab>
                                            ))) : (<Tab key="no-data" title="Monthly Breakdown">
                                                <div className="flex items-center justify-center py-8 text-default-700">
                                                    No Data Available
                                                </div>
                                            </Tab>)}
                                    </Tabs>

                                </div>
                            </div>
                            <Divider />
                            <p className="text-[10px] uppercase tracking-[.15em] text-default-700 -mt-1">
                                Manager Qualitative Assessment
                            </p>

                            {/* Row 3 — Feedback Cat + Type */}
                            <div className="flex flex-col gap-4">
                                {form.feedbacks.map((item, index) => (
                                    <div className="grid grid-cols-[1fr_1fr_2fr] gap-4 items-start">

                                        {/* Feedback Category */}


                                        {/* Feedback Type */}
                                        <Select
                                            label="Feedback Type"
                                            placeholder="Optional..."
                                            selectedKeys={item.feedbackType ? new Set([item.feedbackType]) : new Set()}
                                            onSelectionChange={(keys) =>
                                                updateFeedback(index, "feedbackType", Array.from(keys)[0] ?? "")
                                            }
                                            size="sm"
                                            radius="lg"
                                            classNames={{ trigger: "bg-default-100 border-default-200" }}
                                        >
                                            {FEEDBACK_TYPES.map((t) => (
                                                <SelectItem key={t} value={t}>{t}</SelectItem>
                                            ))}
                                        </Select>

                                        <Select
                                            label="Feedback Category"
                                            placeholder="Select..."
                                            selectedKeys={item.feedbackCat ? new Set([item.feedbackCat]) : new Set()}
                                            onSelectionChange={(keys) =>
                                                updateFeedback(index, "feedbackCat", Array.from(keys)[0] ?? "")
                                            }
                                            size="sm"
                                            radius="lg"
                                            classNames={{ trigger: "bg-default-100 border-default-200" }}
                                        >
                                            {FEEDBACK_CATS.map((c) => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </Select>

                                        {/* Comment */}
                                        <Textarea
                                            label="Comment"
                                            placeholder="Add feedback..."
                                            value={item.feedback}
                                            onChange={(e) => updateFeedback(index, "feedback", e.target.value)}
                                            minRows={1}
                                            size="sm"
                                            radius="lg"
                                            classNames={{ inputWrapper: "bg-default-100 border-default-200" }}
                                        />

                                        {/* +/- buttons */}
                                        <div className="flex gap-2 pt-3">
                                            {index === form.feedbacks.length - 1 && (
                                                <Button isIconOnly color="primary" variant="flat" onPress={addFeedbackRow}>+</Button>
                                            )}
                                            {form.feedbacks.length > 1 && (
                                                <Button isIconOnly color="danger" variant="flat" onPress={() => removeFeedbackRow(index)}>-</Button>
                                            )}
                                        </div>

                                        {/* ✅ Assessor display row — spans full width, read-only */}
                                        {/* <div className="col-span-3 grid grid-cols-2 gap-3">

                                            <div className="flex items-center gap-3 bg-default-50 border border-divider rounded-xl px-4 py-2.5">
                                                <Avatar
                                                    name={initials(item.assessor1Name || "A1")}
                                                    size="sm"
                                                    color="primary"
                                                    classNames={{ base: "shrink-0" }}
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] uppercase tracking-wider text-default-700">
                                                        Assessor 1 · Reporting Manager
                                                    </p>
                                                    <p className="text-sm font-semibold text-default-900 truncate">
                                                        {item.assessor1Name || "—"}
                                                    </p>
                                                    <p className="text-[11px] text-default-700">
                                                        ID: {item.assessor1Id || "—"}
                                                    </p>
                                                </div>
                                                <Chip size="sm" color="primary" variant="flat" className="ml-auto shrink-0">
                                                    Locked
                                                </Chip>
                                            </div>

                                            <div className="flex items-center gap-3 bg-default-50 border border-divider rounded-xl px-4 py-2.5">
                                                <Avatar
                                                    name={initials(item.assessor2Name || "A2")}
                                                    size="sm"
                                                    color="secondary"
                                                    classNames={{ base: "shrink-0" }}
                                                />
                                                <div className="min-w-0">
                                                    <p className="text-[10px] uppercase tracking-wider text-default-700">
                                                        Assessor 2 · EL Manager
                                                    </p>
                                                    <p className="text-sm font-semibold text-default-900 truncate">
                                                        {item.assessor2Name || "—"}
                                                    </p>
                                                    <p className="text-[11px] text-default-700">
                                                        ID: {item.assessor2Id || "—"}
                                                    </p>
                                                </div>
                                                <Chip size="sm" color="secondary" variant="flat" className="ml-auto shrink-0">
                                                    Locked
                                                </Chip>
                                            </div>

                                        </div> */}
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col gap-4 mt-2">
                                <div className="flex items-center gap-2">
                                    <Divider className="flex-1" />
                                    <p className="text-[10px] uppercase tracking-[.15em] text-default-700 whitespace-nowrap">
                                        Manager Evaluation
                                    </p>
                                    <Divider className="flex-1" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                                    {MANAGER_QUESTIONS.map((q, index) => {
                                        const assessor1 = Number(
                                            form.managerRatings?.[q.key]?.assessor1 || 0
                                        );

                                        const assessor2 = Number(
                                            form.managerRatings?.[q.key]?.assessor2 || 0
                                        );

                                        let avg = "—";

                                        if (assessor1 > 0 && assessor2 > 0) {
                                            avg = ((assessor1 + assessor2) / 2).toFixed(1);
                                        } else if (assessor1 > 0) {
                                            avg = assessor1.toFixed(1);
                                        } else if (assessor2 > 0) {
                                            avg = assessor2.toFixed(1);
                                        }

                                        return (
                                            <Card
                                                key={q.key}
                                                radius="lg"
                                                shadow="none"
                                                className="border border-divider bg-default-50 h-full"
                                            >
                                                <CardBody className="p-4 flex flex-col gap-4">

                                                    {/* Header */}
                                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-default-900">
                                                                {index + 1}. {q.title}
                                                            </p>

                                                            <p className="text-xs text-default-700 mt-1 leading-relaxed">
                                                                {q.description}
                                                            </p>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2 shrink-0">
                                                            {assessorInfo.assessor1 && (
                                                                <Chip
                                                                    size="sm"
                                                                    color="primary"
                                                                    variant="flat"
                                                                    avatar={
                                                                        <Avatar
                                                                            name={initials(
                                                                                assessorInfo.assessor1.userName
                                                                            )}
                                                                            size="sm"
                                                                        />
                                                                    }
                                                                >
                                                                    {assessorInfo.assessor1.userName.split(" ")[0]}
                                                                </Chip>
                                                            )}

                                                            {assessorInfo.assessor2 && (
                                                                <Chip
                                                                    size="sm"
                                                                    color="secondary"
                                                                    variant="flat"
                                                                    avatar={
                                                                        <Avatar
                                                                            name={initials(
                                                                                assessorInfo.assessor2.userName
                                                                            )}
                                                                            size="sm"
                                                                        />
                                                                    }
                                                                >
                                                                    {assessorInfo.assessor2.userName.split(" ")[0]}
                                                                </Chip>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Ratings */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                                                        {/* Assessor 1 */}
                                                        <div className="bg-white dark:bg-ink-900 border border-divider rounded-xl p-3">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <p className="text-[11px] uppercase tracking-wider text-default-700">
                                                                    {assessorInfo.assessor1 && (
                                                                        <p className="text-[10px] text-primary-500 font-medium truncate max-w-[80px]">
                                                                            {assessorInfo.assessor1.userName.split(" ")[0]}
                                                                        </p>
                                                                    )}
                                                                </p>


                                                            </div>

                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                max={10}
                                                                step={0.5}
                                                                onWheel={(e) => e.target.blur()}
                                                                placeholder="1 - 10"
                                                                value={assessor1 || ""}
                                                                onWheel={(e) => e.currentTarget.blur()}

                                                                isDisabled={!assessorInfo.assessor1 || Number(user?.userID) !== Number(assessorInfo.assessor1?.userID)}
                                                                onChange={(e) =>
                                                                    setForm((prev) => ({
                                                                        ...prev,
                                                                        managerRatings: {
                                                                            ...prev.managerRatings,
                                                                            [q.key]: {
                                                                                ...prev.managerRatings?.[q.key],
                                                                                assessor1: e.target.value,
                                                                                assessor1Id:
                                                                                    assessorInfo.assessor1?.userID,
                                                                            },
                                                                        },
                                                                    }))
                                                                }
                                                                size="sm"
                                                                radius="lg"
                                                            />
                                                        </div>

                                                        {/* Assessor 2 */}
                                                        <div className="bg-white dark:bg-ink-900 border border-divider rounded-xl p-3">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <p className="text-[11px] uppercase tracking-wider text-default-700">
                                                                    {assessorInfo.assessor2 && (
                                                                        <p className="text-[10px] text-secondary-500 font-medium truncate max-w-[80px]">
                                                                            {assessorInfo.assessor2.userName.split(" ")[0]}
                                                                        </p>
                                                                    )}
                                                                </p>


                                                            </div>

                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                max={10}
                                                                step={0.5}
                                                                onWheel={(e) => e.target.blur()}
                                                                placeholder="1 - 10"
                                                                value={assessor2 || ""}
                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                isDisabled={!assessorInfo.assessor2 || Number(user?.userID) !== Number(assessorInfo.assessor2?.userID)}
                                                                onChange={(e) =>
                                                                    setForm((prev) => ({
                                                                        ...prev,
                                                                        managerRatings: {
                                                                            ...prev.managerRatings,
                                                                            [q.key]: {
                                                                                ...prev.managerRatings?.[q.key],
                                                                                assessor2: e.target.value,
                                                                                assessor2Id:
                                                                                    assessorInfo.assessor2?.userID,
                                                                            },
                                                                        },
                                                                    }))
                                                                }
                                                                size="sm"
                                                                radius="lg"
                                                            />
                                                        </div>

                                                        {/* Average */}
                                                        <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 flex flex-col justify-center items-center">
                                                            <p className="text-[11px] uppercase tracking-wider text-primary-500">
                                                                Average
                                                            </p>

                                                            <p className="text-2xl font-black text-primary">
                                                                {avg}
                                                            </p>


                                                        </div>
                                                    </div>
                                                </CardBody>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Row 4 — Comment
                            <Textarea
                                label={mandatory ? "Comment (required — score < 50%)" : "Comment"}
                                placeholder="Add qualitative feedback for the quarterly period..."
                                value={form.feedback}
                                onChange={setE("feedback")}
                                minRows={3}
                                isInvalid={!!errors.feedback}
                                errorMessage={errors.feedback ? "Required when score is below 50%" : ""}
                                description={!errors.feedback
                                    ? (mandatory
                                        ? "⚠ Score is below 50% — comment is mandatory."
                                        : "Optional above 50% (recommended).")
                                    : ""}
                                size="sm"
                                radius="lg"
                                classNames={{ inputWrapper: "bg-default-100 border-default-200" }}
                            /> */}
                            {/* Star Performance & Final Grade */}


                            {/* Save */}
                            <Button
                                color="primary"
                                radius="lg"
                                size="md"
                                className="w-full font-bold tracking-wide shadow-sm"
                                onPress={handleSave}
                            >
                                Save Quarterly Review
                            </Button>

                            {/* Saved toast inline */}
                            {saved && (
                                <div className="flex items-center justify-center gap-2 text-success-600 text-sm font-semibold animate-pulse">
                                    <span>✓</span> Review saved successfully
                                </div>
                            )}
                        </CardBody>
                    </Card>

                    {/* ── Reviews list ── */}
                    {/* <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[11px] font-bold uppercase tracking-[.15em] text-default-700">
                                Saved Quarterly Reviews
                            </p>
                            {reviews.length > 0 && (
                                <Chip size="sm" color="primary" variant="flat">
                                    {reviews.length} record{reviews.length !== 1 ? "s" : ""}
                                </Chip>
                            )}
                        </div>
                        {reviews.length === 0 ? (
                            <Card shadow="sm" radius="lg" className="border border-divider">
                                <CardBody className="items-center py-10 gap-2">
                                    <p className="text-sm text-default-700">No quarterly reviews yet. Add one above.</p>
                                </CardBody>
                            </Card>
                        ) : (
                            reviews.map((r, i) => (
                                <ReviewCard
                                    key={r.ts + i}
                                    review={r}
                                    index={i}
                                    onDelete={() => openDeleteConfirm(r.id)}
                                    usersAll={usersAll}
                                />
                            ))
                        )}
                    </div> */}
                </div>

                {/* ── RIGHT: Live Preview ── */}
                <LivePreview form={form} weightage={weightage} />            </div>

            {/* Delete Modal */}
            <Modal
                isOpen={isDeleteOpen}
                onOpenChange={onDeleteOpenChange}
                placement="center"
                backdrop="blur"
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                Delete Quarterly Review
                            </ModalHeader>

                            <ModalBody>
                                <p className="text-sm text-default-600">
                                    Are you sure you want to delete this quarterly review?
                                </p>
                                <p className="text-xs text-danger font-medium">
                                    This action cannot be undone.
                                </p>
                            </ModalBody>

                            <ModalFooter>
                                <Button
                                    variant="light"
                                    onPress={onClose}
                                >
                                    Cancel
                                </Button>

                                <Button
                                    color="danger"
                                    onPress={async () => {
                                        await handleDeleteReview(selectedDeleteId);
                                        onDeleteClose();
                                    }}
                                >
                                    Delete
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div >
    );
}