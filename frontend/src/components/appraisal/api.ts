import axios from "axios";

// Appraisal API (/appraisal/*). Responses are { success, response }; errors carry { message }.
// The server removes the fields a role must not see, so every optional key below can be absent: render only what is present.

const BASE = "/t2.0/authentificationUtilization/appraisal";

export type Level = "ASSOCIATE" | "MANAGER" | "HEAD_EL";
export type Status = "EMPLOYEE_OPEN" | "ASSESSOR_OPEN" | "FINANCE_REVIEW" | "OFFERED" | "ACCEPTED" | "POSTPONED";
export type ViewRole = "EMPLOYEE" | "A1" | "A2" | "FINANCE" | "HR";

export interface Money { annual: number; fixed: number; variable: number; variablePct: number; variablePerHalfYear: number }
export interface Person { userId: number; name: string }
export interface Rating { finalRating: number | null; comments: string }
export interface AssessorReview { overallRating: number | null; comment: string; managerFeedback?: string; submittedAt: string | null }

export interface CycleInfo {
    id: number; userId: number; employeeName: string; year: number; start: string; employeeWindowEnd: string; assessorWindowEnd: string;
    status: Status; level: Level; variablePct: number; postponedUntil: string | null; assessor1: Person | null; assessor2: Person | null; late: boolean;
    currentAnnualCtc?: number | null;
}
export interface QuarterData { quarter: number; goals?: string; targets?: string; biggestAchievements?: string; biggestFailures?: string; ratings?: { A1: Rating | null; A2: Rating | null } }
export interface Response { decision: "ACCEPT" | "REJECT"; postponeMonths: number | null; reason: string; expectations: string; comment: string; hrStatus: "PENDING" | "APPROVED" | "RETURNED" | null; hrComment: string; decidedAt: string }
export interface Abilities { selfReview?: boolean; assessorReview?: boolean; budgetApproval?: boolean; respond?: boolean; hrDecision?: boolean }

export interface CycleView {
    role: ViewRole; cycle: CycleInfo; can: Abilities; today: string;
    self?: { answers: Record<string, string>; submittedAt: string | null } | null;
    request?: { newDesignation: string; designationComment: string; newTeam: string; teamComment: string } | null;
    quarters?: QuarterData[];
    expected?: Money | null; target?: Money | null;
    minimal?: { A1: Money | null; A2: Money | null };
    approved?: Money | null;
    assessors?: { A1: AssessorReview | null; A2: AssessorReview | null };
    financeComment?: string | null;
    response: Response | null;
}

export interface TeamItem {
    cycleId: number; userId: number; employeeName: string; level: Level; status: Status; start: string; employeeWindowEnd: string; assessorWindowEnd: string; late: boolean;
    selfSubmitted: boolean; a1Submitted: boolean; a2Submitted: boolean; myRole: "A1" | "A2" | "FINANCE";
    expected?: Money | null; minimal?: { A1: Money | null; A2: Money | null }; approved?: Money | null;
}
export interface SumTotal {
    scope: "all" | "department" | "team"; label: string; annual: number; fixed: number; variable: number; count: number;
    byDepartment?: { department: string; annual: number; fixed: number; variable: number; count: number }[];
}
export interface Availability {
    my: { show: boolean; status: Status | null; cycleId: number | null };
    team: { show: boolean; open: number }; budget: { show: boolean; pending: number }; hr: { show: boolean; pending: number }; setup: { show: boolean }; any: boolean;
}
export interface PersonSetup { userId: number; name: string; email: string; roleName: string; dateOfJoining: string | null; level: Level | null; currentAnnualCtc: number | null; cycles: number }

export interface SelfReviewBody {
    answers: Record<string, string>;
    quarters: { quarter: number; goals: string; targets: string; biggestAchievements: string; biggestFailures: string }[];
    expectedHike: number | null; targetHike: number | null;
    request: { newDesignation: string; designationComment: string; newTeam: string; teamComment: string };
    submit: boolean;
}
export interface AssessorBody {
    quarters: { quarter: number; finalRating: number | null; comments: string }[];
    overallRating: number | null; comment: string; managerFeedback?: string; minimalHike: number | null; submit: boolean;
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
    team: (status?: Status) => unwrap<{ items: TeamItem[]; sumTotal: SumTotal | null }>(axios.get(`${BASE}/team`, { params: status ? { status } : {} })),
    hr: () => unwrap<CycleView[]>(axios.get(`${BASE}/hr`)),
    people: () => unwrap<PersonSetup[]>(axios.get(`${BASE}/people`)),
    savePerson: (userId: number, body: { dateOfJoining: string | null; level: Level | null; currentAnnualCtc: number | null }) => axios.put(`${BASE}/people/${userId}`, body),
    createCycle: (userId: number, cycleStartDate: string) => axios.post(`${BASE}/cycles`, { userId, cycleStartDate }),
    selfReview: (id: number, body: SelfReviewBody) => axios.put(`${BASE}/cycles/${id}/self-review`, body),
    assessorReview: (id: number, body: AssessorBody) => axios.put(`${BASE}/cycles/${id}/assessor-review`, body),
    approve: (id: number, body: { approvedHike: number; comment?: string }) => axios.put(`${BASE}/cycles/${id}/budget-approval`, body),
    accept: (id: number, comment?: string) => axios.post(`${BASE}/cycles/${id}/respond`, { decision: "ACCEPT", comment }),
    reject: (id: number, body: { postponeMonths: 3 | 6; reason: string; expectations: string; comment?: string }) => axios.post(`${BASE}/cycles/${id}/respond`, { decision: "REJECT", ...body }),
    hrDecide: (id: number, body: { status: "APPROVED" | "RETURNED"; comment?: string }) => axios.put(`${BASE}/cycles/${id}/hr-decision`, body),
};
