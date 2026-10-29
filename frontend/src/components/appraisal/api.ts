import axios from "axios";

// Appraisal API (/appraisal/*). Responses are { success, response }; errors carry { message }.
// The server removes the fields a role must not see, so every optional key below can be absent: render only what is present.

const BASE = "/t2.0/authentificationUtilization/appraisal";

export type Level = "ASSOCIATE" | "MANAGER" | "HEAD_EL";
export type Status = "EMPLOYEE_OPEN" | "ASSESSOR_OPEN" | "FINANCE_REVIEW" | "OFFERED" | "ACCEPTED" | "POSTPONED";
export type ViewRole = "EMPLOYEE" | "A1" | "A2" | "FINANCE" | "HR";
export type Decision = "APPROVED" | "REJECTED";

export interface Money { annual: number; fixed: number; variable: number; variablePct: number; variablePerHalfYear: number }
export interface Person { userId: number; name: string }
export interface AssessorReview { overallRating: number | null; comment: string; managerFeedback?: string; submittedAt: string | null }

export interface CycleInfo {
    id: number; userId: number; employeeName: string; year: number; start: string; employeeWindowEnd: string; assessorWindowEnd: string;
    status: Status; level: Level; variablePct: number; postponedUntil: string | null; assessor1: Person | null; assessor2: Person | null; late: boolean;
    currentAnnualCtc?: number | null;
}
/** One quarter of the PMS review (Part A). Read-only: it comes from the PMS module. */
export interface PmsQuarter {
    quarter: string; year: number; start: string; end: string;
    targetPercent: number | null; goalAchievement: number | null; utilizationPercent: number | null; efficiencyPercent: number | null; efficiencyLabel: string;
    systemGrade: number | null; managerAvgRating: number | null; finalRating: number | null; gradeLabel: string; feedback: { category: string; text: string }[];
}
export type RequestField = "DESIGNATION" | "TEAM";
export interface RequestReviews { A1?: { comment: string } | null; A2?: { comment: string; decision: Decision | null } | null }
export interface Response { decision: "ACCEPT" | "REJECT"; postponeMonths: number | null; reason: string; expectations: string; comment: string; hrStatus: "PENDING" | "APPROVED" | "RETURNED" | null; hrComment: string; decidedAt: string }
export interface Abilities { selfReview?: boolean; assessorReview?: boolean; approve?: boolean; financeNote?: boolean; respond?: boolean; hrDecision?: boolean }

export interface CycleView {
    role: ViewRole; cycle: CycleInfo; can: Abilities; today: string;
    self?: { answers: Record<string, string>; submittedAt: string | null } | null;
    request?: { newDesignation: string; designationComment: string; newTeam: string; teamComment: string } | null;
    pms?: PmsQuarter[];
    requestReviews?: Record<RequestField, RequestReviews>;
    expected?: Money | null; target?: Money | null;
    /** What the FL / EL propose. Stored as the "minimal" hike; the screens call it the proposed hike. */
    minimal?: { A1: Money | null; A2: Money | null };
    approved?: Money | null;
    assessors?: { A1: AssessorReview | null; A2: AssessorReview | null };
    financeComment?: string | null;
    response: Response | null;
}

export interface TeamItem {
    cycleId: number; userId: number; employeeName: string; level: Level; status: Status; start: string; employeeWindowEnd: string; assessorWindowEnd: string; late: boolean;
    selfSubmitted: boolean; a1Submitted: boolean; a2Submitted: boolean; myRole: "A1" | "A2" | "FINANCE";
    assessor1Name: string | null; pmsFinalAvg: number | null; pmsQuarters: number; asksDesignation: boolean; asksTeam: boolean; canApprove: boolean;
    expected?: Money | null; minimal?: { A1: Money | null; A2: Money | null }; approved?: Money | null;
}
export interface Availability {
    my: { show: boolean; status: Status | null; cycleId: number | null };
    team: { show: boolean; open: number }; budget: { show: boolean; pending: number }; hr: { show: boolean; pending: number }; setup: { show: boolean }; any: boolean;
}
export interface PersonSetup { userId: number; name: string; email: string; roleName: string; dateOfJoining: string | null; level: Level | null; currentAnnualCtc: number | null; cycles: number }

export interface FlLine { userId: number; name: string; allocation: number; used: number; remaining: number; associates: number }
export interface DeptBudget { departmentId: number; name: string; el: { userId: number; name: string } | null; budget: number | null; comment: string; allocated: number; used: number; fls: FlLine[] }
export interface MyShare { departmentId: number; name: string; allocation: number; used: number; remaining: number; associates: number }
export type BudgetOverview =
    | { year: number; role: "FINANCE" | "EL"; departments: DeptBudget[] }
    | { year: number; role: "FL" | "NONE"; shares: MyShare[] };

export interface SelfReviewBody {
    answers: Record<string, string>;
    expectedHike: number | null; targetHike: number | null;
    request: { newDesignation: string; designationComment: string; newTeam: string; teamComment: string };
    submit: boolean;
}
export interface AssessorBody {
    overallRating: number | null; comment: string; managerFeedback?: string; minimalHike: number | null;
    requests?: { designation?: { comment: string; decision?: Decision | null }; team?: { comment: string; decision?: Decision | null } };
    submit: boolean;
}

const unwrap = <T,>(p: Promise<{ data: { response: T } }>) => p.then((r) => r.data.response);
export const errorText = (err: any, fallback = "Something went wrong.") => {
    const fields = err?.response?.data?.errors;
    const first = fields && typeof fields === "object" ? Object.values(fields).flat()[0] : null;
    return (first as string) || err?.response?.data?.message || err?.message || fallback;
};

export const appraisalApi = {
    availability: () => unwrap<Availability>(axios.get(`${BASE}/availability`)),
    my: () => unwrap<CycleView | null>(axios.get(`${BASE}/my`)),
    cycle: (id: number) => unwrap<CycleView>(axios.get(`${BASE}/cycles/${id}`)),
    team: (status?: Status) => unwrap<{ items: TeamItem[] }>(axios.get(`${BASE}/team`, { params: status ? { status } : {} })),
    hr: () => unwrap<CycleView[]>(axios.get(`${BASE}/hr`)),
    people: () => unwrap<PersonSetup[]>(axios.get(`${BASE}/people`)),
    savePerson: (userId: number, body: { dateOfJoining: string | null; level: Level | null; currentAnnualCtc: number | null }) => axios.put(`${BASE}/people/${userId}`, body),
    createCycle: (userId: number, cycleStartDate: string) => axios.post(`${BASE}/cycles`, { userId, cycleStartDate }),
    selfReview: (id: number, body: SelfReviewBody) => axios.put(`${BASE}/cycles/${id}/self-review`, body),
    assessorReview: (id: number, body: AssessorBody) => axios.put(`${BASE}/cycles/${id}/assessor-review`, body),
    /** The EL approves an Associate / FL hike; Finance approves an EL's */
    approve: (id: number, body: { approvedHike: number; comment?: string }) => axios.put(`${BASE}/cycles/${id}/budget-approval`, body),
    financeNote: (id: number, comment: string) => axios.put(`${BASE}/cycles/${id}/finance-note`, { comment }),
    accept: (id: number, comment?: string) => axios.post(`${BASE}/cycles/${id}/respond`, { decision: "ACCEPT", comment }),
    reject: (id: number, body: { postponeMonths: 3 | 6; reason: string; expectations: string; comment?: string }) => axios.post(`${BASE}/cycles/${id}/respond`, { decision: "REJECT", ...body }),
    hrDecide: (id: number, body: { status: "APPROVED" | "RETURNED"; comment?: string }) => axios.put(`${BASE}/cycles/${id}/hr-decision`, body),
    budget: (year?: number) => unwrap<BudgetOverview>(axios.get(`${BASE}/budget`, { params: year ? { year } : {} })),
    setDepartmentBudget: (body: { year: number; departmentId: number; amount: number; comment?: string }) => axios.put(`${BASE}/budget/department`, body),
    setAllocation: (body: { year: number; departmentId: number; flUserId: number; amount: number }) => axios.put(`${BASE}/budget/allocation`, body),
};
