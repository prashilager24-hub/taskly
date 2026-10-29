import type { Level, Status } from "./api";

// Variable share of every hike by level. Mirrors the server (appraisal.calc.ts), which stays the source of truth:
// this only drives the live preview under each input.
export const VARIABLE_PCT: Record<Level, number> = { ASSOCIATE: 10, MANAGER: 20, HEAD_EL: 30 };
export const LEVEL_LABEL: Record<Level, string> = { ASSOCIATE: "Associate", MANAGER: "Manager / FL", HEAD_EL: "Head / EL" };

const money = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const inr = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : `₹${money.format(Math.round(n))}`);

export function splitPreview(annual: number, level: Level) {
    const variable = Math.round((annual * VARIABLE_PCT[level]) / 100);
    return { annual, fixed: annual - variable, variable, perHalf: variable / 2 };
}

/** "2026-11-02" → "02 Nov 2026" (the string is a calendar day; no time zone can move it) */
export function day(iso: string | null | undefined) {
    if (!iso) return "—";
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export const addDaysIso = (iso: string, n: number) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export const STATUS_LABEL: Record<Status, string> = {
    EMPLOYEE_OPEN: "Employee window", ASSESSOR_OPEN: "With assessors", FINANCE_REVIEW: "With Finance", OFFERED: "Offer sent", ACCEPTED: "Accepted", POSTPONED: "Postponed",
};
export const STATUS_COLOR: Record<Status, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = {
    EMPLOYEE_OPEN: "primary", ASSESSOR_OPEN: "secondary", FINANCE_REVIEW: "warning", OFFERED: "warning", ACCEPTED: "success", POSTPONED: "danger",
};

/** "1,00,000" typed into a box → 100000 (null when empty) */
export const parseAmount = (s: string): number | null => {
    const t = s.replace(/[^\d]/g, "");
    return t === "" ? null : Number(t);
};
export const showAmount = (n: number | null | undefined) => (n == null ? "" : money.format(n));
