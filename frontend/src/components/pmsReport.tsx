import { Segmented } from "@/components/page";
import {
    Card,
    CardBody,
    Chip,
    Progress,
    Avatar,
    Divider,
    Switch
} from "@/components/ui";

import { TrendingUp, Gauge, Target, Users } from "lucide-react";
import { useState } from "react";
import DashboardFilters from "./pmsdashboardapi";
import ReviewStatus from "./ReviewStatus";
import {
    finalGradeFromPercent,
    finalGradeBand,
    computeQuarterlyGrade,
} from "../lib/pmsGrade";
// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name = "") =>
    name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();

const getStatusColor = (status) => {
    if (status === "On Track") return "success";
    if (status === "At Risk") return "warning";
    return "danger";
};

const getProgressColor = (value) => {
    if (value >= 90) return "success";
    if (value >= 70) return "primary";
    if (value >= 50) return "warning";
    return "danger";
};

const getScoreColor = (score) => {
    if (score >= 8) return "text-success-600";
    if (score >= 6) return "text-primary-600";
    if (score >= 4) return "text-warning-600";
    return "text-danger-600";
};

const getBandChip = (score) => {
    if (score >= 8) return { label: "Top Performer", color: "success" };
    if (score >= 6) return { label: "Good Performer", color: "primary" };
    if (score >= 4) return { label: "Average Performer", color: "warning" };
    return { label: "PIP", color: "danger" };
};

const ratingAvg = (obj) => {
    const a2 = Number(obj?.assessor2 || 0);
    const a1 = Number(obj?.assessor1 || 0);
    if (a2 > 0) return a2;
    if (a1 > 0) return a1;
    return 0;
};


const GRADE_GUIDE = [
    { range: "Critical Concern (<40%)", grade: 1, color: "danger" },
    { range: "Unsatisfactory (40–49%)", grade: 2, color: "danger" },
    { range: "Needs Sig. Improvement (50–59%)", grade: 3, color: "warning" },
    { range: "Needs Improvement (60–69%)", grade: 4, color: "warning" },
    { range: "Partially Meets Expectations (70–79%)", grade: 5, color: "primary" },
    { range: "Approaching Expectations (80–89%)", grade: 6, color: "primary" },
    { range: "Meets Expectations (90%+)", grade: 7, color: "success" },
    { range: "Exceeds Expectations (≥100% + ⭐)", grade: 8, color: "success" },
    { range: "Significantly Exceeds Expectations (≥100% + ⭐⭐)", grade: 9, color: "secondary" },
    { range: "Outstanding / Exceptional (≥100% + ⭐⭐⭐)", grade: 10, color: "warning" },
];

const bandForGrade = (grade) => finalGradeBand(grade);

function LivePreviewSummary({ reviews }) {
    const parsedGrades = reviews.map((r) => {
        const grade =
            typeof r.grade === "string"
                ? JSON.parse(r.grade || "[]")
                : r.grade || [];
        return grade[0] || {};
    });

    const count = reviews.length;

    const avg = (arr) =>
        arr.length > 0
            ? arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length
            : 0;

    // Recompute each review's system grade / final rating with the exact
    // quarterlyReview logic so the preview matches the review UI.
    const computed = reviews.map((r, i) => {
        const gd = parsedGrades[i] || {};
        return computeQuarterlyGrade({
            targetPercent: r.targetPercent,
            goalAchievement: r.goalAchievement,
            targetWeight: Number(gd.targetWeight ?? 40),
            goalWeight: Number(gd.goalWeight ?? 60),
            managerRating: Number(r.managerAvgRating || 0),
            starRating: Number(gd.starRating || 0),
        });
    });

    const avgSystemGradePercentRaw = avg(computed.map((c) => c.systemGrade * 10));
    const avgManagerRating = avg(reviews.map((r) => r.managerAvgRating));
    const avgFinalRatingPercent = avg(computed.map((c) => c.finalRatingPercent));

    const avgTarget = avg(reviews.map((r) => r.targetPercent));
    const avgGoal = avg(reviews.map((r) => r.goalAchievement));
    const avgUtil = avg(reviews.map((r) => r.utilizationPercent));
    const avgEff = avg(reviews.map((r) => r.efficiencyPercent));

    const bandCounts = computed.reduce((acc, c) => {
        const band = bandForGrade(c.grade);
        acc[band.label] = (acc[band.label] || 0) + 1;
        return acc;
    }, {});

    const systemGradePercent = Math.min(avgSystemGradePercentRaw, 100);
    const managerRatingPercent = Math.min(avgManagerRating * 10, 100);
    const finalGradePercent = Math.min(avgFinalRatingPercent, 100);
    const band = bandForGrade(finalGradeFromPercent(finalGradePercent));

    const scoreColorMap = { success: "#17c964", primary: "#006FEE", warning: "#f5a524", danger: "#f31260" };
    const scoreColor = count > 0 ? scoreColorMap[band.color] : "#d4d4d8";

    return (
        <Card className="sticky top-6 shadow-sm border border-divider" radius="lg">
            <CardBody className="gap-3 pt-5 px-5 pb-5">

                <div className="flex flex-col items-center gap-1 pb-2">
                    <p className="text-[10px] uppercase tracking-[.18em] text-default-700">
                        Live Preview
                    </p>
                    <span
                        className="text-5xl font-black leading-none tracking-tighter transition-colors duration-300"
                        style={{ color: scoreColor }}
                    >
                        {count > 0 ? `${finalGradePercent.toFixed(0)}%` : "—"}
                    </span>
                    <div className="mt-1 min-h-[26px] flex justify-center">
                        {count > 0 && (
                            <Chip color={band.color} variant="flat" size="sm" className="font-semibold">
                                {band.label}
                            </Chip>
                        )}
                    </div>
                    <p className="text-[10px] text-default-400">
                        Avg. Final Rating across {count} review{count !== 1 ? "s" : ""}
                    </p>
                </div>

                {/* A / B / Final Rating breakdown */}
                <div className="bg-default-50 rounded-xl p-3 border border-divider">
                    <div className="flex justify-between text-xs mb-1">
                        <span>A) System Grade (Weighted Target + Goal)</span>
                        <span className="font-bold text-primary">
                            {count > 0 ? `${systemGradePercent.toFixed(1)}%` : "—"}
                        </span>
                    </div>

                    <div className="flex justify-between text-xs mb-1">
                        <span>B) Manager Rating</span>
                        <span className="font-bold text-secondary">
                            {count > 0 ? `${managerRatingPercent.toFixed(1)}%` : "—"}
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
                            {count > 0 ? `${(finalGradePercent / 10).toFixed(1)}` : "—"}
                        </span>
                    </div>
                </div>

                <Progress
                    value={finalGradePercent}
                    color={count > 0 ? band.color : "default"}
                    size="sm"
                    radius="sm"
                    className="mb-1"
                    aria-label="avg-final-grade-bar"
                />

                <Divider />
                <Progress
                    value={finalGradePercent}
                    color={count > 0 ? band.color : "default"}
                    size="sm"
                    radius="sm"
                    className="mb-1"
                    aria-label="avg-final-grade-bar"
                />

                <Divider />

                {/* Metric rows */}
                {[
                    ["Target", `${avgTarget.toFixed(1)}%`],
                    ["Goal Ach.", `${avgGoal.toFixed(1)}%`],
                    ["Utilization", `${avgUtil.toFixed(1)}%`],
                    ["Efficiency", `${avgEff.toFixed(1)}%`],
                ].map(([lbl, val]) => (
                    <div key={lbl} className="flex justify-between items-center py-1 border-b border-divider last:border-0">
                        <span className="text-[11px] text-default-700">{lbl}</span>
                        <span className="text-sm font-semibold text-default-900">{val}</span>
                    </div>
                ))}

                <Divider />

                {/* Band distribution */}
                <div className="bg-default-50 border border-divider rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-[.15em] text-default-700 mb-2">
                        Performance Bands
                    </p>
                    <div className="flex flex-col gap-2">
                        {["Top Performer", "Good Performer", "Average Performer", "PIP"].map((label) => {
                            const bandColor =
                                label === "Top Performer" ? "success" :
                                    label === "Good Performer" ? "primary" :
                                        label === "Average Performer" ? "warning" : "danger";
                            return (
                                <div key={label} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full bg-${bandColor}`} />
                                        <span className="text-xs font-medium text-default-600">{label}</span>
                                    </div>
                                    <span className="text-[11px] text-default-700">
                                        {bandCounts[label] || 0}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Grade guide */}
                <div className="bg-default-50 border border-divider rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-[.15em] text-default-700 mb-3">
                        Final Grading Guide
                    </p>
                    <div className="flex flex-col gap-2 text-xs">
                        {GRADE_GUIDE.map((g) => (
                            <div key={g.grade} className="flex justify-between">
                                <span>{g.range}</span>
                                <Chip size="sm" color={g.color} variant="flat">
                                    Grade {g.grade}
                                </Chip>
                            </div>
                        ))}
                    </div>
                </div>

            </CardBody>
        </Card>
    );
}

// ─── ReviewCard ───────────────────────────────────────────────────────────────

function ReviewCard({ review }) {
    console.log("ReviewCard render", review);
    const ratings =
        typeof review.managerRatings === "string"
            ? JSON.parse(review.managerRatings || "{}")
            : review.managerRatings || {};

    const feedback =
        typeof review.feedback === "string"
            ? JSON.parse(review.feedback || "[]")
            : review.feedback || [];

    const grade =
        typeof review.grade === "string"
            ? JSON.parse(review.grade || "[]")
            : review.grade || [];

    const gradeDetails = grade[0] || {};

    const starRating = Number(gradeDetails.starRating || 0);
    const goalWeight = Number(gradeDetails.goalWeight || 0);
    const targetWeight = Number(gradeDetails.targetWeight || 0);

    // Recompute the final rating + grade with the quarterlyReview logic
    // (weighted target/goal, capped at 100, 95% system + 5% manager) so the card
    // always matches the review UI instead of trusting a stored finalRating.
    const {
        finalRatingPercent,
        grade: finalGrade,
        label: finalGradeLabel,
    } = computeQuarterlyGrade({
        targetPercent: review.targetPercent,
        goalAchievement: review.goalAchievement,
        targetWeight: Number(gradeDetails.targetWeight ?? 40),
        goalWeight: Number(gradeDetails.goalWeight ?? 60),
        managerRating: Number(review.managerAvgRating || 0),
        starRating,
    });

    const metrics = [
        { label: "Target", value: review.targetPercent },
        { label: "Goal", value: review.goalAchievement },
        { label: "Util", value: review.utilizationPercent },
        { label: "Eff", value: review.efficiencyPercent },
    ];

    const bars = [
        { label: "Target", value: review.targetPercent },
        { label: "Goal", value: review.goalAchievement },
        { label: "Utilization", value: review.utilizationPercent },
        { label: "Efficiency", value: review.efficiencyPercent },
    ];

    return (
        <Card className="border border-default-200 shadow-sm hover:border-default-400 transition-colors">
            <CardBody className="p-0">

                {/* ── Top: Avatar + Info + Score ── */}
                <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                    <Avatar
                        name={getInitials(review.employeeName)}
                        size="md"
                        color="primary"
                        className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-default-800 truncate leading-tight">
                            {review.employeeName}
                        </p>
                        <p className="text-[11px] text-default-400 truncate mb-2">
                            {review.employeeEmail}
                        </p>
                        <div className="flex gap-1.5 flex-wrap">
                            <Chip size="sm" variant="flat" color="default"
                                classNames={{ content: "text-[10px] font-medium" }}>
                                {review.quarter} {review.quarterYear}
                            </Chip>
                            <Chip size="sm" variant="flat" color={getStatusColor(review.status)}
                                classNames={{ content: "text-[10px] font-medium" }}>
                                {review.status}
                            </Chip>
                            <Chip size="sm" variant="dot" color="primary"
                                classNames={{ content: "text-[10px] font-medium" }}>
                                {review.efficiencyLabel}
                            </Chip>

                        </div>
                        <div>
                            <Chip size="sm" variant="flat" color="primary"
                                classNames={{ content: "text-[10px] font-medium" }}>
                                range: {review.startDate} - {review.endDate}
                            </Chip>
                            <Chip size="sm" variant="flat" color="primary"
                                classNames={{ content: "text-[10px] font-medium" }}>
                                reviewed at: {review.createdAt}
                            </Chip>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-[10px] text-default-400 uppercase tracking-wide">
                            Final Grade
                        </p>

                        <p className="text-2xl font-bold leading-none text-warning-600">
                            {finalGrade}
                        </p>

                        <p className="text-[11px] font-medium text-default-600 mt-1">
                            {finalGradeLabel}
                        </p>

                        <div className="flex gap-1 mt-1.5 justify-end">
                            <Chip
                                size="sm"
                                variant="flat"
                                color="primary"
                                classNames={{ content: "text-[9px] font-semibold" }}
                            >
                                Goal {goalWeight}%
                            </Chip>

                            <Chip
                                size="sm"
                                variant="flat"
                                color="secondary"
                                classNames={{ content: "text-[9px] font-semibold" }}
                            >
                                Target {targetWeight}%
                            </Chip>
                        </div>
                    </div>
                </div>

                {/* ── Metric Strip ── */}
                <div className="grid grid-cols-4 border-y border-default-100">
                    {metrics.map((m, i) => (
                        <div
                            key={m.label}
                            className={`py-2 text-center ${i < metrics.length - 1 ? "border-r border-default-100" : ""}`}
                        >
                            <p className="text-[13px] font-semibold text-default-800">
                                {Number(m.value || 0).toFixed(0)}%
                            </p>
                            <p className="text-[10px] text-default-400 uppercase tracking-wide">
                                {m.label}
                            </p>
                        </div>
                    ))}
                </div>

                {/* ── Progress Bars ── */}
                <div className="px-4 py-3 flex flex-col gap-2">
                    {bars.map((b) => (
                        <div key={b.label} className="flex items-center gap-2">
                            <span className="text-[11px] text-default-400 w-16 shrink-0">
                                {b.label}
                            </span>
                            <Progress
                                value={Number(b.value || 0)}
                                color={getProgressColor(Number(b.value || 0))}
                                size="sm"
                                radius="sm"
                                className="flex-1"
                                aria-label={b.label}
                            />
                            <span className="text-[11px] font-medium text-default-600 w-9 text-right shrink-0">
                                {Number(b.value || 0).toFixed(0)}%
                            </span>
                        </div>
                    ))}
                </div>

                {/* ── Behavioral Ratings ── */}
                {Object.keys(ratings).length > 0 && (
                    <>
                        <Divider />
                        <div className="px-4 py-3">
                            <p className="text-[10px] uppercase tracking-widest text-default-400 font-medium mb-2">
                                Behavioral Ratings
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {Object.entries(ratings).map(([key, val]) => {
                                    const avg = ratingAvg(val);
                                    return (
                                        <div
                                            key={key}
                                            className="flex items-center justify-between bg-default-50 rounded-lg px-3 py-1.5"
                                        >
                                            <span className="text-[11px] text-default-500 capitalize">
                                                {key}
                                            </span>
                                            <Chip
                                                size="sm"
                                                variant="flat"
                                                color={getProgressColor(avg * 10)}
                                                classNames={{ content: "text-[10px] font-semibold" }}
                                            >
                                                {avg.toFixed(1)}
                                            </Chip>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* ── Feedback ── */}
                {feedback.length > 0 && (
                    <>
                        <Divider />
                        <div className="px-4 py-3">
                            <p className="text-[10px] uppercase tracking-widest text-default-400 font-medium mb-2">
                                Feedback
                            </p>
                            <div className="flex flex-col gap-2">
                                {feedback.map((f, i) => {
                                    const isExceeds = f.feedbackCat?.toLowerCase().includes("exceeds");
                                    const isNeeds = f.feedbackCat?.toLowerCase().includes("needs");
                                    return (
                                        <div
                                            key={i}
                                            className={`rounded-lg px-3 py-2 border-l-2 bg-default-50 ${isExceeds
                                                ? "border-success-400"
                                                : isNeeds
                                                    ? "border-warning-400"
                                                    : "border-primary-300"
                                                }`}
                                        >
                                            <div className="flex gap-1.5 flex-wrap mb-1">
                                                {f.feedbackType && (
                                                    <Chip size="sm" variant="flat" color="primary"
                                                        classNames={{ content: "text-[10px] font-medium" }}>
                                                        {f.feedbackType}
                                                    </Chip>
                                                )}
                                                {f.feedbackCat && (
                                                    <Chip size="sm" variant="flat" color="default"
                                                        classNames={{ content: "text-[10px] font-medium" }}>
                                                        {f.feedbackCat}
                                                    </Chip>
                                                )}
                                            </div>
                                            {f.feedback && (
                                                <p className="text-[11px] text-default-500 leading-relaxed">
                                                    {f.feedback}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* ── Footer: System Grade + Final Rating ── */}
                {/* <div className="flex items-center justify-between px-4 py-2.5 bg-default-50 border-t border-default-100 rounded-b-xl">
                    <span className="text-[11px] text-default-400">
                        System grade{" "}
                        <span className="font-semibold text-default-600">
                            {review.systemGrade?.toFixed(1) ?? "—"}/10
                        </span>
                    </span>
                    <span className="text-[11px] text-default-400">
                        Final rating{" "}
                        <span className={`font-semibold ${getScoreColor(score)}`}>
                            {score.toFixed(1)}/10
                        </span>
                    </span>
                </div> */}

            </CardBody>
        </Card>
    );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({
    title,
    value,
    icon,
    color = "primary",
}) {

    return (

        <Card
            className="
                relative overflow-hidden
                border border-default-200
                bg-gradient-to-br from-white to-default-50
                shadow-sm hover:shadow-md
                transition-all duration-300
                hover:-translate-y-1
            "
        >

            {/* glow */}
            <div
                className={`
                    absolute -right-6 -top-6
                    h-24 w-24 rounded-full blur-2xl opacity-20
                    bg-${color}
                `}
            />

            <CardBody className="relative flex flex-row items-center justify-between p-5">

                {/* LEFT */}
                <div className="space-y-2">

                    <p className="text-xs font-medium uppercase tracking-wider text-default-400">
                        {title}
                    </p>

                    <h2 className="text-4xl font-bold tracking-tight text-default-900">
                        {value}
                    </h2>

                    <div className="flex items-center gap-1 text-success text-xs font-medium">

                        <span className="h-2 w-2 rounded-full bg-success" />

                        Updated now

                    </div>

                </div>

                {/* RIGHT ICON */}
                <div
                    className={`
                        flex items-center justify-center
                        h-16 w-16 rounded-2xl
                        bg-${color}/10
                        text-${color}
                        shadow-inner
                    `}
                >

                    <div className="scale-125">
                        {icon}
                    </div>

                </div>

            </CardBody>

        </Card>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function PmsReport({ isReport = false }) {
    const [reviews, setReviews] = useState([]);
    const [monthly, setMonthly] = useState(false);

    // Existing DashboardFilters values
    const [reportFilters, setReportFilters] = useState({
        departmentID: "",
        userID: "",
        quarter: "ALL",
        year: "ALL",
        month: "",
    });

    const totalEmployees = reviews.length;

    const avgEfficiency =
        reviews.length > 0
            ? (reviews.reduce((a, b) => a + Number(b.efficiencyPercent || 0), 0) / reviews.length).toFixed(1)
            : 0;

    const avgUtilization =
        reviews.length > 0
            ? (reviews.reduce((a, b) => a + Number(b.utilizationPercent || 0), 0) / reviews.length).toFixed(1)
            : 0;

    const avgTarget =
        reviews.length > 0
            ? (reviews.reduce((a, b) => a + Number(b.targetPercent || 0), 0) / reviews.length).toFixed(1)
            : 0;
    const avgGoal =
        reviews.length > 0
            ? (reviews.reduce((a, b) => a + Number(b.goalAchievement || 0), 0) / reviews.length).toFixed(1)
            : 0;
    const user = JSON.parse(localStorage.getItem("authUserLD"));
    return (
        <div className="pt-6">
            {/* Header */}
            <div className="mb-8">
                <ReviewStatus
                    token={user?.token}
                    filterType={monthly ? "monthly" : "quarterly"}
                    departmentID={reportFilters.departmentID}
                    userID={reportFilters.userID}
                    year={reportFilters.year}
                    month={reportFilters.month}
                    quarter={reportFilters.quarter}
                />
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-lg font-bold uppercase tracking-wide text-ink-900 dark:text-white">Review reports</h2>
                    <Segmented
                        label="Review type"
                        value={monthly ? "manager" : "employee"}
                        onChange={(v) => setMonthly(v === "manager")}
                        options={[{ key: "employee", label: "Quarterly reviews" }, { key: "manager", label: "Manager feedback" }]}
                    />
                </div>

                <DashboardFilters
                    reviews={reviews}
                    setReviews={setReviews}
                    monthly={monthly}
                    isReport={isReport}
                    onFiltersChange={setReportFilters}
                />
            </div>


            {/* Summary */}
            {/* <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                <SummaryCard title="No of Reviews" value={totalEmployees} icon={<Users size={18} />} />
                <SummaryCard title="Efficiency" value={`${avgEfficiency}%`} icon={<TrendingUp size={18} />} />
                <SummaryCard title="Utilization" value={`${avgUtilization}%`} icon={<Gauge size={18} />} />
                <SummaryCard title="Target" value={`${avgTarget}%`} icon={<Target size={18} />} />
                <SummaryCard title="Goal" value={`${avgGoal}%`} icon={<Target size={18} />} />
            </div> */}

            {/* Empty */}
            {reviews.length === 0 && (
                <Card className="border border-default-200">
                    <CardBody className="py-20 flex items-center justify-center">
                        <div className="text-center">
                            <h2 className="text-xl font-semibold">No Reviews</h2>
                            <p className="text-default-500 mt-2">
                                Select department, user, quarter and year
                            </p>
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* ── Card Grid ── */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_288px] gap-5 items-start">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reviews.map((review) => (
                        <ReviewCard key={review.id} review={review} />
                    ))}
                </div>
                {reviews.length > 0 && <LivePreviewSummary reviews={reviews} />}

            </div>


        </div>

    );
}