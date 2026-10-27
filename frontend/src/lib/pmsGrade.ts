// Shared PMS final-grade logic (star-aware, decimal scale).
//
// The Final Rating is expressed as a percentage (0–100+). Below 100% the grade
// is a continuous decimal using:
//
//     grade = clamp(finalRatingPercent / 10 - 2, 1, 7)
//
// Examples:  40% -> 2.0   50% -> 3.0   70% -> 5.0   77% -> 5.7   90%+ -> 7.0
//
// Ratings above 100% are only reachable through the star system (0–3 stars) and
// unlock the 8/9/10 tiers:
//
//     > 100% + 3 stars -> 10  Outstanding / Exceptional
//     > 100% + 2 stars -> 9   Significantly Exceeds Expectations
//     > 100% (+1 star) -> 8   Exceeds Expectations

export const FINAL_GRADE_MIN = 1;
export const FINAL_GRADE_MAX = 10;

export const GRADE_LABELS: Record<number, string> = {
    1: "Critical Concern",
    2: "Unsatisfactory",
    3: "Needs Significant Improvement",
    4: "Needs Improvement",
    5: "Partially Meets Expectations",
    6: "Approaching Expectations",
    7: "Meets Expectations",
    8: "Exceeds Expectations",
    9: "Significantly Exceeds Expectations",
    10: "Outstanding / Exceptional",
};

// finalRatingPercent: 0–100+ (Final Rating %).
// starRating: 0 (none), 1, 2, or 3 — only meaningful when finalRatingPercent > 100.
// Returns a grade (decimal below 100%, integer 8/9/10 above 100%), or 0 when no
// rating is available (null/undefined/empty/NaN).
export function finalGradeFromPercent(
    finalRatingPercent: number | null | undefined,
    starRating = 0
): number {
    if (finalRatingPercent === null || finalRatingPercent === undefined) {
        return 0;
    }

    const fr = Number(finalRatingPercent);
    // 0 (or below) means no rating was entered → no grade yet.
    if (!Number.isFinite(fr) || fr <= 0) return 0;

    const stars = Number(starRating || 0);

    if (fr > 100) {
        if (stars >= 3) return 10;
        if (stars === 2) return 9;
        // stars === 1 or 0 (not yet rated) both land on the base "Exceeds" tier
        return 8;
    }
    const raw = fr / 10 - 2;
    const clamped = Math.min(8, Math.max(FINAL_GRADE_MIN, raw));
    return Number(clamped.toFixed(1));
}

// Label for the grade derived from the Final Rating %. The label follows the
// percentage band (so 77% reads "Partially Meets Expectations"), while the
// numeric grade may carry a decimal (e.g. 5.7).
export function finalGradeLabelFromPercent(
    finalRatingPercent: number | null | undefined,
    starRating = 0
): string {
    if (finalRatingPercent === null || finalRatingPercent === undefined) {
        return "";
    }

    const fr = Number(finalRatingPercent);
    if (!Number.isFinite(fr) || fr <= 0) return "";

    const stars = Number(starRating || 0);

    if (fr > 100) {
        if (stars >= 3) return GRADE_LABELS[10];
        if (stars === 2) return GRADE_LABELS[9];
        return GRADE_LABELS[8];
    }
    if (fr >= 90) return GRADE_LABELS[7];
    if (fr >= 80) return GRADE_LABELS[6];
    if (fr >= 70) return GRADE_LABELS[5];
    if (fr >= 60) return GRADE_LABELS[4];
    if (fr >= 50) return GRADE_LABELS[3];
    if (fr >= 40) return GRADE_LABELS[2];
    return GRADE_LABELS[1];
}

// HeroUI colour token for a grade.
export function finalGradeColor(grade: number): "danger" | "warning" | "primary" | "success" {
    const g = Number(grade || 0);
    if (g <= 2) return "danger";
    if (g <= 4) return "warning";
    if (g <= 6) return "primary";
    return "success";
}

export type FinalGradeColor = "danger" | "warning" | "primary" | "success";

// Recompute the Quarterly final rating + grade from the raw inputs, mirroring
// quarterlyReview.tsx exactly:
//   systemGrade  = min((targetWeight·T + goalWeight·G)/(targetWeight+goalWeight), 100) / 10
//   finalScore   = 0.95 * systemGrade + 0.05 * managerRating
//   ratingPct    = finalScore > 0 ? round(finalScore * 10) : 0
//   grade/label  = finalGradeFromPercent / finalGradeLabelFromPercent
// Use this instead of trusting a stored systemGrade/finalRating, so reports and
// downloads always agree with the review UI.
export interface QuarterlyGradeInput {
    targetPercent: number | null | undefined;
    goalAchievement: number | null | undefined;
    targetWeight?: number;
    goalWeight?: number;
    managerRating?: number;
    starRating?: number;
}

export interface QuarterlyGradeResult {
    systemGrade: number;
    finalScore: number;
    finalRatingPercent: number;
    grade: number;
    label: string;
}

export function computeQuarterlyGrade({
    targetPercent,
    goalAchievement,
    targetWeight = 40,
    goalWeight = 60,
    managerRating = 0,
    starRating = 0,
}: QuarterlyGradeInput): QuarterlyGradeResult {
    const tw = Number(targetWeight || 0);
    const gw = Number(goalWeight || 0);
    const total = tw + gw;

    let systemGrade = 0;
    if (total > 0) {
        const weighted =
            (tw * Number(targetPercent || 0) +
                gw * Number(goalAchievement || 0)) /
            total;
        systemGrade = Number((Math.min(weighted, 100) / 10).toFixed(2));
    }

    const finalScore =
        systemGrade * 0.95 + Number(managerRating || 0) * 0.05;
    const finalRatingPercent =
        finalScore > 0 ? Math.round(finalScore * 10) : 0;

    return {
        systemGrade,
        finalScore,
        finalRatingPercent,
        grade: finalGradeFromPercent(finalRatingPercent, starRating),
        label: finalGradeLabelFromPercent(finalRatingPercent, starRating),
    };
}

// Performance band for a grade. Thresholds are expressed on the 1–7 decimal
// scale (equivalent to the historical Score ≥ 8 / 6 / 4 cut-offs).
export function finalGradeBand(
    grade: number
): { label: string; color: FinalGradeColor } {
    const g = Number(grade || 0);
    if (g >= 6) return { label: "Top Performer", color: "success" };
    if (g >= 4) return { label: "Good Performer", color: "primary" };
    if (g >= 2) return { label: "Average Performer", color: "warning" };
    return { label: "PIP", color: "danger" };
}
