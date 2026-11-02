import axios from "axios";

// Appraisal API (/appraisal/*). Responses are { success, response }; errors carry { message }.
// Flow v2: everyone appeals; the Finance Head sets each department's budget; the EL splits it; each FL allocates their share
// and the EL approves; the hikes go out. The server leaves out what a person must not see, so optional keys can be absent.

const BASE = "/t2.0/authentificationUtilization/appraisal";

export type Level = "ASSOCIATE" | "MANAGER" | "HEAD_EL";
export type Status = "EMPLOYEE_OPEN" | "SUBMITTED" | "OFFERED" | "ACCEPTED" | "POSTPONED";
/** Where one person's appraisal stands (the statuses list) */
export type Stage = "APPEAL_OPEN" | "SUBMITTED" | "BUDGET_REVIEW" | "IN_ALLOCATION" | "AWAITING_EL" | "OFFERED" | "ACCEPTED" | "POSTPONED";
export type RoundStatus = "COLLECTING" | "READY_FOR_FINANCE" | "BUDGET_WITH_EL" | "BUDGET_NEGOTIATION" | "BUDGET_ACCEPTED" | "SHARES_WITH_FLS" | "FINALISED";
export type BudgetAction = "PROPOSED" | "REVISED" | "NEGOTIATE" | "ACCEPTED" | "RESET";
export type ShareStatus = "PLANNED" | "SHARE_RECEIVED" | "DRAFT" | "SUBMITTED" | "APPROVED";
export type Source = "EL_OWN" | "EL_DIRECT" | "FL_TEAM" | "FL_OWN";
export type RequestStage = "WITH_FL" | "WITH_EL" | "APPROVED" | "NOT_APPROVED";
export type Decision = "APPROVED" | "REJECTED";
export type RequestField = "DESIGNATION" | "TEAM";

/** override: the employee set the variable pay themselves; null / missing: the level's percentage */
export interface Money { annual: number; fixed: number; variable: number; variablePct: number; variablePerHalfYear: number; override?: "PCT" | "AMOUNT" | null }
/** Variable pay set by hand on a hike (appeal, or a hike the EL / FL decides): a percentage of it, or an amount out of it */
export interface VariableOverride { mode: "PCT" | "AMOUNT"; value: number }
export interface Person { userId: number; name: string }

export interface CycleInfo {
    id: number; userId: number; employeeName: string; year: number; start: string; employeeWindowEnd: string;
    status: Status; level: Level; variablePct: number; postponedUntil: string | null; assessor1: Person | null; assessor2: Person | null;
    currentAnnualCtc?: number | null;
}
/** One quarter of the PMS review. Read-only: it comes from the PMS module. */
export interface PmsQuarter {
    quarter: string; year: number; start: string; end: string;
    targetPercent: number | null; goalAchievement: number | null; utilizationPercent: number | null; efficiencyPercent: number | null; efficiencyLabel: string;
    systemGrade: number | null; managerAvgRating: number | null; finalRating: number | null; gradeLabel: string; feedback: { category: string; text: string }[];
    comments: string; achievements: string; failures: string;
}
export interface Response { decision: "ACCEPT" | "REJECT"; postponeMonths: number | null; reason: string; expectations: string; comment: string; hrStatus: "PENDING" | "APPROVED" | "RETURNED" | null; hrComment: string; decidedAt: string }
export interface ChangeRequest {
    field: RequestField; value: string; why: string; stage: RequestStage; decision: Decision | null;
    /** The FL's comment and recommendation, and the EL's comment: only for the FL, the EL and the Finance Head */
    fl?: { comment: string; recommendation: "SUPPORT" | "NOT_SUPPORT" | null } | null; elComment?: string;
}
export interface Route { source: Source | null; fl: Person | null; el: Person | null }

interface ViewBase {
    cycle: CycleInfo; stage: Stage; department: string | null; route: Route; timed: boolean; today: string;
    self: { answers: Record<string, string>; submittedAt: string | null } | null;
    expected: Money | null; target: Money | null; pms: PmsQuarter[]; slots: { n: number; quarter: string; year: number }[];
    approved: Money | null; requests: ChangeRequest[]; response: Response | null;
}
/** My Appraisal */
export interface MyView extends ViewBase { role: "EMPLOYEE"; can: { appeal: boolean; respond: boolean; reject: boolean; ask: boolean } }
/** One person's appraisal as their FL / EL / the Finance Head sees it */
export interface PersonView extends ViewBase {
    role: "EL" | "FL" | "FINANCE" | "VIEWER"; allocation: number | null; reason?: string;
    can: { forward: boolean; decide: boolean };
}

export interface RoundPerson {
    cycleId: number; userId: number; name: string; level: Level; status: Status; start: string;
    a1: Person | null; source: Source; flUserId: number | null;
    expected: number | null; target: number | null; why: string; submittedAt: string | null;
    pmsAvg: number | null; pmsQuarters: number; currentAnnualCtc: number | null;
    allocation: number | null; reason: string; approved: number | null; approvedFixed: number | null; approvedVariable: number | null;
    /** Variable pay set by whoever decided the hike; null: the level's percentage */
    variable: VariableOverride | null;
}
export interface Share {
    flUserId: number; name: string; amount: number; elComment: string; status: ShareStatus; justification: string; submittedAt: string | null; approvedAt: string | null;
    /** The EL sent the proposal back to be revised, with this note */
    returnComment: string; returnedAt: string | null;
    people: number; teamExpected: number; allocated: number;
}
export interface Round {
    roundId: number | null; departmentId: number; department: string; period: string; el: Person | null; status: RoundStatus;
    budget: number | null; financeComment: string; budgetSetAt: string | null; elAcceptedAt: string | null; elSentAt: string | null;
    budgetLog: BudgetLogEntry[];
    people: RoundPerson[]; notStarted: Person[]; fls: Person[]; shares: Share[];
    totals: { people: number; submitted: number; expected: number; target: number; allocated: number }; complete: boolean;
}
/** One step between the Finance Head and the EL on a department's budget */
export interface BudgetLogEntry { action: BudgetAction; amount: number | null; comment: string; at: string; by: Person | null }
export interface BoardRow { departmentId: number; department: string; el: Person | null; people: number; submitted: number; expected: number; target: number; allocated: number; budget: number | null; status: RoundStatus; ask: { amount: number | null; comment: string } | null }
export interface FlShare { roundId: number; departmentId: number; department: string; period: string; el: Person | null; share: Share; people: (RoundPerson & { own: boolean; stage: Stage })[] }
export interface FlWaiting { department: string; period: string; status: RoundStatus; el: Person | null; team: number; submitted: number }
export interface InboxItem { cycleId: number; name: string; level: Level; department: string | null; role: PersonView["role"]; source: Source | null; fl: Person | null; approved: Money | null; requests: ChangeRequest[]; can: { forward: boolean; decide: boolean } }

/** HR list: the person, the cycle and the decision only */
export interface HrItem { cycle: CycleInfo; response: Response | null; can: { hrDecision?: boolean } }

export interface Availability {
    my: { show: boolean; status: Status | null; cycleId: number | null };
    departments: { show: boolean; pending: number }; overview: { show: boolean }; split: { show: boolean; pending: number }; allocation: { show: boolean; pending: number };
    requests: { show: boolean }; hr: { show: boolean; pending: number }; setup: { show: boolean; edit: boolean }; any: boolean;
}
export type CycleMonth = "APRIL" | "OCTOBER";
export interface PersonSetup {
    userId: number; name: string; email: string; employeeId: string | null; roleName: string;
    dateOfJoining: string | null; level: Level | null; currentAnnualCtc: number | null;
    cycleMonth: CycleMonth | null; cycles: number; latestCycle: { start: string; status: Status } | null;
}
export interface PersonBody { dateOfJoining: string | null; level: Level | null; currentAnnualCtc: number | null }

/** Who acts as Finance: chosen in Appraisal Setup, or the head of the Strategic Financial Management department */
export interface FinanceHead { userId: number | null; name: string | null; email: string | null; department: string }

export interface AppealBody { answers: Record<string, string>; quarters: never[]; expectedHike: number | null; targetHike: number | null; expectedVariable?: VariableOverride | null; targetVariable?: VariableOverride | null; submit: boolean }
export interface SplitBody {
    own?: { amount: number; comment?: string; variable?: VariableOverride | null } | null;
    direct?: { cycleId: number; amount: number; reason?: string; variable?: VariableOverride | null }[];
    shares?: { flUserId: number; amount: number; comment?: string }[];
    send: boolean;
}
export interface AllocationBody { items: { cycleId: number; amount: number | null; reason?: string; variable?: VariableOverride | null }[]; justification?: string; submit: boolean }
/** Every department of a period, and the split of each department that has appraisals */
export interface Overview { rows: BoardRow[]; rounds: Round[] }

const unwrap = <T,>(p: Promise<{ data: { response: T } }>) => p.then((r) => r.data.response);
export const errorText = (err: any, fallback = "Something went wrong.") => {
    const fields = err?.response?.data?.errors;
    const first = fields && typeof fields === "object" ? Object.values(fields).flat()[0] : null;
    return (first as string) || err?.response?.data?.message || err?.message || fallback;
};

export const appraisalApi = {
    availability: () => unwrap<Availability>(axios.get(`${BASE}/availability`)),
    my: () => unwrap<MyView | null>(axios.get(`${BASE}/my`)),
    cycle: (id: number) => unwrap<PersonView | MyView>(axios.get(`${BASE}/cycles/${id}`)),
    appeal: (id: number, body: AppealBody) => axios.put(`${BASE}/cycles/${id}/self-review`, body),
    accept: (id: number, request?: { newDesignation?: string; designationComment?: string; newTeam?: string; teamComment?: string }) => axios.post(`${BASE}/cycles/${id}/respond`, { decision: "ACCEPT", request }),
    reject: (id: number, body: { postponeMonths: 3 | 6; reason: string; expectations: string; comment?: string }) => axios.post(`${BASE}/cycles/${id}/respond`, { decision: "REJECT", ...body }),

    periods: () => unwrap<string[]>(axios.get(`${BASE}/periods`)),
    board: (period: string) => unwrap<BoardRow[]>(axios.get(`${BASE}/departments`, { params: { period } })),
    round: (departmentId: number, period: string) => unwrap<Round>(axios.get(`${BASE}/departments/${departmentId}/${period}`)),
    setBudget: (departmentId: number, period: string, amount: number, comment: string) => axios.put(`${BASE}/departments/${departmentId}/${period}/budget`, { amount, comment }),

    overview: (period: string) => unwrap<Overview>(axios.get(`${BASE}/overview`, { params: { period } })),

    split: () => unwrap<Round[]>(axios.get(`${BASE}/split`)),
    respondBudget: (departmentId: number, period: string, body: { accept: boolean; comment?: string; amount?: number | null }) => axios.put(`${BASE}/split/${departmentId}/${period}/budget-response`, body),
    saveSplit: (departmentId: number, period: string, body: SplitBody) => axios.put(`${BASE}/split/${departmentId}/${period}`, body),
    approveShare: (departmentId: number, period: string, flUserId: number) => axios.put(`${BASE}/split/${departmentId}/${period}/shares/${flUserId}/approve`),
    reviseShare: (departmentId: number, period: string, flUserId: number, comment: string) => axios.put(`${BASE}/split/${departmentId}/${period}/shares/${flUserId}/revise`, { comment }),
    resetSplit: (departmentId: number, period: string, comment: string) => axios.put(`${BASE}/split/${departmentId}/${period}/reset`, { comment }),
    offerDirect: (departmentId: number, period: string, cycleId: number, amount: number, reason: string, variable?: VariableOverride | null) => axios.put(`${BASE}/split/${departmentId}/${period}/direct/${cycleId}`, { amount, reason, variable }),

    allocation: () => unwrap<{ shares: FlShare[]; waiting: FlWaiting[] }>(axios.get(`${BASE}/allocation`)),
    saveAllocation: (departmentId: number, period: string, body: AllocationBody) => axios.put(`${BASE}/allocation/${departmentId}/${period}`, body),

    requests: () => unwrap<InboxItem[]>(axios.get(`${BASE}/requests`)),
    forward: (cycleId: number, body: { comment?: string; recommend: boolean }) => axios.put(`${BASE}/cycles/${cycleId}/request-forward`, body),
    decide: (cycleId: number, body: { designation?: { decision: Decision; comment?: string }; team?: { decision: Decision; comment?: string } }) => axios.put(`${BASE}/cycles/${cycleId}/request-decision`, body),

    hr: () => unwrap<HrItem[]>(axios.get(`${BASE}/hr`)),
    hrDecide: (id: number, body: { status: "APPROVED" | "RETURNED"; comment?: string }) => axios.put(`${BASE}/cycles/${id}/hr-decision`, body),
    people: () => unwrap<PersonSetup[]>(axios.get(`${BASE}/people`)),
    savePerson: (userId: number, body: PersonBody) => unwrap<{ cycleStarted: number | null }>(axios.put(`${BASE}/people/${userId}`, body)),
    savePeople: (rows: ({ userId: number } & PersonBody)[]) => unwrap<{ saved: number; started: number; failed: { userId: number; message: string }[] }>(axios.post(`${BASE}/people/bulk`, { rows })),
    financeHead: () => unwrap<FinanceHead>(axios.get(`${BASE}/finance-head`)),
};
