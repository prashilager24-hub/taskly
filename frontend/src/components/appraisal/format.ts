import type { Level, RequestStage, RoundStatus, ShareStatus, Stage, Status } from "./api";

// Variable share of every hike by level. Mirrors the server (appraisal.calc.ts), which stays the source of truth:
// this only drives the live preview under each input.
export const VARIABLE_PCT: Record<Level, number> = { ASSOCIATE: 10, MANAGER: 20, HEAD_EL: 30 };
export const LEVEL_LABEL: Record<Level, string> = { ASSOCIATE: "Associate", MANAGER: "Manager / FL", HEAD_EL: "Head / EL" };
/** The largest amount the server accepts (₹10 crore) */
export const MAX_AMOUNT = 100_000_000;

const money = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const inr = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : `₹${money.format(Math.round(n))}`);

export function splitPreview(annual: number, level: Level, own?: { mode: "PCT" | "AMOUNT"; value: number | null } | null) {
    const variable = own && own.value != null
        ? Math.min(annual, Math.round(own.mode === "PCT" ? (annual * Math.min(100, own.value)) / 100 : own.value))
        : Math.round((annual * VARIABLE_PCT[level]) / 100);
    return { annual, fixed: annual - variable, variable, perHalf: variable / 2, pct: annual ? Math.round((variable / annual) * 100) : VARIABLE_PCT[level] };
}
/** How much the hike raises the CTC: the new CTC and the increase as a percentage of the old one (null without a CTC) */
export const ctcRise = (ctc: number | null | undefined, hike: number | null | undefined) =>
    ctc == null || hike == null || !ctc ? null : { now: ctc + hike, pct: Math.round((hike / ctc) * 1000) / 10 };
/** a / b as a whole percentage, or "—" */
export const pctOf = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? "—" : `${Math.round((a / b) * 100)}%`);

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
    EMPLOYEE_OPEN: "Appeal open", SUBMITTED: "Submitted", OFFERED: "Hike ready", ACCEPTED: "Accepted", POSTPONED: "Postponed",
};
export const STATUS_COLOR: Record<Status, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = {
    EMPLOYEE_OPEN: "primary", SUBMITTED: "secondary", OFFERED: "warning", ACCEPTED: "success", POSTPONED: "danger",
};
/** One person's place in the flow, as the statuses list names it */
export const STAGE_LABEL: Record<Stage, string> = {
    APPEAL_OPEN: "Appeal open", SUBMITTED: "Submitted", BUDGET_REVIEW: "In progress", IN_ALLOCATION: "Hike being decided",
    AWAITING_EL: "Waiting for EL approval", OFFERED: "Hike ready", ACCEPTED: "Accepted", POSTPONED: "Postponed",
};
export const STAGE_COLOR: Record<Stage, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = {
    APPEAL_OPEN: "primary", SUBMITTED: "default", BUDGET_REVIEW: "secondary", IN_ALLOCATION: "secondary", AWAITING_EL: "warning", OFFERED: "warning", ACCEPTED: "success", POSTPONED: "danger",
};
export const ROUND_LABEL: Record<RoundStatus, string> = {
    COLLECTING: "Collecting appeals", READY_FOR_FINANCE: "Ready for Finance", BUDGET_WITH_EL: "Waiting for EL to accept", BUDGET_NEGOTIATION: "EL negotiating", BUDGET_ACCEPTED: "Budget accepted", SHARES_WITH_FLS: "Shares with FLs", FINALISED: "Finalised",
};
export const ROUND_COLOR: Record<RoundStatus, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = {
    COLLECTING: "default", READY_FOR_FINANCE: "warning", BUDGET_WITH_EL: "secondary", BUDGET_NEGOTIATION: "danger", BUDGET_ACCEPTED: "primary", SHARES_WITH_FLS: "primary", FINALISED: "success",
};
export const SHARE_LABEL: Record<ShareStatus, string> = { PLANNED: "Not sent", SHARE_RECEIVED: "Share received", DRAFT: "Draft", SUBMITTED: "Waiting for EL", APPROVED: "Approved" };
export const SHARE_COLOR: Record<ShareStatus, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = { PLANNED: "default", SHARE_RECEIVED: "primary", DRAFT: "secondary", SUBMITTED: "warning", APPROVED: "success" };
export const REQ_LABEL: Record<RequestStage, string> = { WITH_FL: "With FL", WITH_EL: "With EL", APPROVED: "Approved", NOT_APPROVED: "Not this cycle" };
export const REQ_COLOR: Record<RequestStage, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = { WITH_FL: "secondary", WITH_EL: "warning", APPROVED: "success", NOT_APPROVED: "default" };
/** "2026-10-01" → "October 2026 cycle" */
/** The April / October period a date belongs to (the latest 1 April / 1 October on or before it) */
export const periodOfDate = (d: string) => { const y = Number(d.slice(0, 4)); const m = Number(d.slice(5, 7)); return m >= 10 ? `${y}-10-01` : m >= 4 ? `${y}-04-01` : `${y - 1}-10-01`; };
export const periodLabel = (p: string) => `${Number(p.slice(5, 7)) === 4 ? "April" : "October"} ${p.slice(0, 4)} cycle`;

/** "1,00,000" typed into a box → 100000 (null when empty) */
export const parseAmount = (s: string): number | null => {
    const t = s.replace(/[^\d]/g, "");
    return t === "" ? null : Number(t);
};
export const showAmount = (n: number | null | undefined) => (n == null ? "" : money.format(n));
