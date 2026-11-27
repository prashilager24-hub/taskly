import { BadgeCheck, BadgeIndianRupee, Briefcase, CalendarDays, Clock, FileText, HeartPulse, KeyRound, Laptop, Megaphone, MonitorCog, PartyPopper, Play, Plus, Send, ShieldCheck, Ticket, TrendingUp, UserPlus, Users, Wallet, Wrench, Receipt, HandCoins, FileCheck2 } from "lucide-react"
import { cycle, DEPARTMENTS, pick, PEOPLE } from "@/peoplehub/mocks/people"
import type { ModuleConfig } from "@/peoplehub/modules/types"

/* ───────────────────────── Finance ───────────────────────── */

export const finance: Record<string, ModuleConfig> = {
  "finance/payroll": {
    eyebrow: "Finance",
    title: "Payroll Processing",
    description: "Run, review and release monthly payroll after HR has locked the inputs. Includes statutory deductions and bank transfer files.",
    stats: [
      { label: "Nov 2026 gross", value: "₹2.14Cr", delta: "+3.1%", trend: "up", icon: Wallet },
      { label: "Net payout", value: "₹1.71Cr", icon: BadgeIndianRupee },
      { label: "PF + ESI + PT", value: "₹19.6L", icon: ShieldCheck },
      { label: "TDS", value: "₹22.8L", icon: Receipt },
    ],
    actions: [
      { label: "Download bank file", icon: FileText, toast: "Bank transfer file (NEFT) generated" },
      { label: "Run payroll", icon: Play, toast: "Payroll run started for Nov 2026" },
    ],
    aside: {
      title: "Nov 2026 payroll run",
      items: [
        { label: "Inputs locked by HR", value: "Done", pct: 100, tone: "success" },
        { label: "Calculation", value: "Done", pct: 100, tone: "success" },
        { label: "Finance review", value: "64%", pct: 64, tone: "warning", hint: "151 of 236 verified" },
        { label: "Disbursement", value: "30 Nov", pct: 0, hint: "Scheduled" },
      ],
    },
    table: {
      title: "Payroll register",
      filters: [{ key: "department", label: "Departments" }],
      tabsOn: "status",
      columns: [
        { key: "employee", label: "Employee", type: "person" },
        { key: "department", label: "Department", minor: true },
        { key: "gross", label: "Gross", type: "currency", align: "right" },
        { key: "deductions", label: "Deductions", type: "currency", align: "right", minor: true },
        { key: "net", label: "Net pay", type: "currency", align: "right" },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: PEOPLE.map((p, i) => {
        const gross = 60000 + ((i * 7919) % 140000)
        const ded = Math.round(gross * 0.17)
        return { id: `PR-${p.id}`, employee: p, department: p.department, gross, deductions: ded, net: gross - ded, status: cycle(["Verified", "Verified", "In Review", "Verified", "Pending"], i) }
      }),
    },
  },
  "finance/payslips": {
    eyebrow: "Finance",
    title: "Payslips",
    description: "Generate, publish and email payslips after payroll is released.",
    stats: [
      { label: "Generated (Oct)", value: "236", icon: FileCheck2 },
      { label: "Published", value: "236", icon: Send },
      { label: "Bounced emails", value: "2", icon: Clock },
      { label: "Re-issued", value: "3", icon: FileText },
    ],
    actions: [
      { label: "Email all", icon: Send, toast: "Payslips queued for email delivery" },
      { label: "Generate payslips", icon: Play, toast: "Generating payslips for Nov 2026" },
    ],
    table: {
      title: "Payslip register",
      tabsOn: "month",
      columns: [
        { key: "employee", label: "Employee", type: "person" },
        { key: "month", label: "Month" },
        { key: "net", label: "Net pay", type: "currency", align: "right" },
        { key: "delivery", label: "Email", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: PEOPLE.slice(0, 16).flatMap((p, i) =>
        ["Oct 2026", "Sep 2026"].map((m, j) => ({ id: `PS-${p.id}-${j}`, employee: p, month: m, net: 52000 + ((i * 6151) % 110000), delivery: i === 5 && j === 0 ? "Bounced" : "Delivered", status: "Published" }))
      ),
    },
  },
  "finance/it-declaration": {
    eyebrow: "Finance",
    title: "IT Declaration Verification",
    description: "Verify investment proofs and update TDS projections for FY 2026–27.",
    approvals: true,
    stats: [
      { label: "Proofs received", value: "164", icon: FileText },
      { label: "Verified", value: "117", hint: "71%", icon: BadgeCheck },
      { label: "Rejected", value: "9", icon: Clock },
      { label: "TDS impact", value: "-₹6.2L", hint: "projected annual saving", icon: TrendingUp },
    ],
    table: {
      title: "Proof verification queue",
      tabsOn: "status",
      columns: [
        { key: "employee", label: "Employee", type: "person" },
        { key: "section", label: "Section" },
        { key: "declared", label: "Declared", type: "currency", align: "right" },
        { key: "proof", label: "Proof amount", type: "currency", align: "right", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: PEOPLE.slice(0, 12).map((p, i) => ({
        id: `ITV-${400 + i}`,
        employee: p,
        section: cycle(["80C – PPF / ELSS / LIC", "80D – Medical insurance", "HRA – Rent paid", "24(b) – Home loan interest"], i),
        declared: cycle([150000, 25000, 240000, 200000], i),
        proof: cycle([150000, 25000, 228000, 196000], i),
        status: cycle(["Pending", "Verified", "Pending", "Rejected", "Verified"], i),
      })),
    },
  },
  "finance/loans": {
    eyebrow: "Finance",
    title: "Loans & Advances Ledger",
    description: "Disburse approved loans and track EMI recovery through payroll.",
    approvals: true,
    stats: [
      { label: "Book size", value: "₹23.6L", icon: HandCoins },
      { label: "To disburse", value: "₹1.75L", hint: "3 requests", icon: Wallet },
      { label: "EMI this month", value: "₹2.1L", icon: Receipt },
      { label: "Overdue", value: "₹0", icon: Clock },
    ],
    actions: [{ label: "Disburse approved", icon: Send, toast: "Disbursement initiated for 3 approved requests" }],
    table: {
      title: "Loan ledger",
      tabsOn: "status",
      columns: [
        { key: "employee", label: "Employee", type: "person" },
        { key: "type", label: "Type" },
        { key: "amount", label: "Principal", type: "currency", align: "right" },
        { key: "outstanding", label: "Outstanding", type: "currency", align: "right", minor: true },
        { key: "emi", label: "EMI", type: "currency", align: "right", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: pick(10, 4).map((p, i) => {
        const amount = cycle([50000, 150000, 25000, 300000, 80000], i)
        return { id: `LG-${640 + i}`, employee: p, type: cycle(["Salary advance", "Personal loan"], i), amount, outstanding: Math.round(amount * cycle([0.66, 0.5, 1, 0.75, 0.17], i)), emi: Math.round(amount / cycle([3, 12, 1, 12, 6], i)), status: cycle(["Disbursed", "Disbursed", "Approved", "Disbursed", "Pending", "Closed"], i) }
      }),
    },
  },
  "finance/reimbursements": {
    eyebrow: "Finance",
    title: "Reimbursement Payouts",
    description: "Audit manager-approved claims and add them to the payroll payout.",
    approvals: true,
    stats: [
      { label: "Approved by managers", value: "₹2.9L", icon: Receipt },
      { label: "Awaiting audit", value: "23", icon: Clock },
      { label: "Paid this month", value: "₹3.4L", icon: Wallet },
      { label: "Policy exceptions", value: "4", icon: ShieldCheck },
    ],
    table: {
      title: "Audit queue",
      tabsOn: "status",
      filters: [{ key: "category", label: "Categories" }],
      columns: [
        { key: "employee", label: "Employee", type: "person" },
        { key: "category", label: "Category" },
        { key: "amount", label: "Amount", type: "currency", align: "right" },
        { key: "approver", label: "Approved by", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: pick(12, 2).map((p, i) => ({ id: `RA-${9100 + i}`, employee: p, category: cycle(["Travel", "Food", "Internet", "Client meeting", "Medical"], i), amount: cycle([1450, 3200, 999, 6800, 2500], i), approver: p.manager, status: cycle(["Pending", "Approved", "Paid", "Pending", "Rejected", "Paid"], i) })),
    },
  },
  "finance/salary-revisions": {
    eyebrow: "Finance",
    title: "Salary Revisions",
    description: "Model, approve and apply salary revisions after appraisal, including arrears.",
    approvals: true,
    stats: [
      { label: "Revision budget", value: "9.5%", hint: "of payroll", icon: Wallet },
      { label: "Avg. hike proposed", value: "8.7%", icon: TrendingUp },
      { label: "Revisions pending", value: "38", icon: Clock },
      { label: "Annual cost impact", value: "₹2.3Cr", icon: BadgeIndianRupee },
    ],
    actions: [
      {
        label: "Propose revision",
        icon: Plus,
        form: {
          title: "Propose salary revision",
          submitLabel: "Send for approval",
          success: "Revision proposal sent",
          fields: [
            { name: "employee", label: "Employee", type: "person", required: true },
            { name: "current", label: "Current CTC (₹)", type: "number", required: true },
            { name: "revised", label: "Revised CTC (₹)", type: "number", required: true },
            { name: "effective", label: "Effective from", type: "date", required: true },
            { name: "reason", label: "Reason", type: "select", options: ["Annual appraisal", "Promotion", "Market correction", "Retention"], required: true },
          ],
        },
      },
    ],
    table: {
      title: "Revision proposals",
      tabsOn: "status",
      columns: [
        { key: "employee", label: "Employee", type: "person" },
        { key: "current", label: "Current CTC", type: "currency", align: "right", minor: true },
        { key: "revised", label: "Revised CTC", type: "currency", align: "right" },
        { key: "hike", label: "Hike" },
        { key: "reason", label: "Reason", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: PEOPLE.slice(0, 12).map((p, i) => {
        const current = 800000 + ((i * 97571) % 2200000)
        const pct = cycle([8, 12, 6, 15, 10, 25], i)
        return { id: `REV-${p.id}`, employee: p, current, revised: Math.round(current * (1 + pct / 100)), hike: `${pct}%`, reason: pct === 25 ? "Promotion" : "Annual appraisal", status: cycle(["Pending", "Approved", "Pending", "Under Review", "Approved", "Processed"], i) }
      }),
    },
  },
}

/* ───────────────────── Talent Acquisition ───────────────────── */

export const talent: Record<string, ModuleConfig> = {
  "talent/open-roles": {
    eyebrow: "Talent Acquisition",
    title: "Open Roles",
    description: "Every open position, with hiring manager, priority and pipeline health. Employees can refer friends.",
    employee: { title: "Open Roles & Referrals", description: "Know someone great? Refer them and earn a referral bonus.", scope: "all" },
    stats: [
      { label: "Open positions", value: "23", icon: Briefcase },
      { label: "Candidates in pipeline", value: "318", icon: Users },
      { label: "Avg. time to hire", value: "34 days", delta: "-6d", trend: "down", upIsGood: false, icon: Clock },
      { label: "Referral hires (YTD)", value: "19", icon: UserPlus },
    ],
    actions: [
      {
        label: "Refer a friend",
        icon: UserPlus,
        role: "employee",
        form: {
          title: "Refer a candidate",
          submitLabel: "Submit referral",
          success: "Referral submitted. Thank you!",
          fields: [
            { name: "role", label: "Role", type: "select", options: ["Senior Backend Engineer", "Product Designer", "Account Executive", "DevOps Engineer", "HR Executive", "Data Analyst", "Content Strategist", "QA Automation Engineer", "Customer Success Manager"], required: true },
            { name: "candidate", label: "Candidate name", type: "text", required: true },
            { name: "email", label: "Candidate email", type: "email", required: true },
            { name: "resume", label: "Resume", type: "file", hint: "PDF, DOC or DOCX · max 5 MB", accept: ".pdf,.doc,.docx" },
          ],
        },
      },
      {
        label: "Create role",
        icon: Plus,
        role: "admin",
        form: {
          title: "Create open role",
          submitLabel: "Publish role",
          status: "Open",
          success: "Role published to careers page",
          fields: [
            { name: "role", label: "Role title", type: "text", required: true, full: true },
            { name: "department", label: "Department", type: "select", fetchOptions: "departments", required: true },
            { name: "location", label: "Location", type: "select", options: ["Bengaluru", "Pune", "Gurugram", "Hyderabad", "Mumbai", "Chennai", "Remote"], required: true },
            { name: "openings", label: "Openings", type: "number", required: true },
            { name: "experience", label: "Experience", type: "select", options: ["0–1 year", "1–3 years", "3–5 years", "5–8 years", "8–10 years", "10–12 years", "12+ years"], required: true },
            { name: "employment", label: "Employment type", type: "select", options: ["Full Time", "Part Time", "Contract", "Internship"], required: true },
            { name: "manager", label: "Hiring manager", type: "person" },
          ],
        },
      },
    ],
    table: {
      title: "Positions",
      tabsOn: "status",
      filters: [{ key: "department", label: "Departments" }],
      columns: [
        { key: "role", label: "Role" },
        { key: "department", label: "Department", minor: true },
        { key: "location", label: "Location", minor: true },
        { key: "experience", label: "Experience", minor: true },
        { key: "employment", label: "Type", minor: true },
        { key: "openings", label: "Openings", type: "number" },
        { key: "candidates", label: "Pipeline", type: "number" },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: [
        ["Senior Backend Engineer", "Engineering", "Bengaluru", "5–8 years", "Full Time", 3, 46, "Open"],
        ["Product Designer", "Design", "Bengaluru", "3–5 years", "Full Time", 1, 28, "Open"],
        ["Account Executive", "Sales", "Gurugram", "3–5 years", "Full Time", 4, 61, "Open"],
        ["DevOps Engineer", "Engineering", "Pune", "5–8 years", "Full Time", 2, 19, "Interview"],
        ["HR Executive", "Human Resources", "Bengaluru", "1–3 years", "Full Time", 1, 33, "Offer"],
        ["Data Analyst", "Operations", "Remote", "1–3 years", "Full Time", 2, 40, "Open"],
        ["Content Strategist", "Marketing", "Mumbai", "3–5 years", "Full Time", 1, 22, "On Hold"],
        ["QA Automation Engineer", "Engineering", "Chennai", "3–5 years", "Full Time", 2, 25, "Interview"],
        ["Customer Success Manager", "Customer Success", "Hyderabad", "1–3 years", "Full Time", 1, 18, "Open"],
        ["Payroll Executive", "Finance", "Mumbai", "0–1 year", "Full Time", 1, 26, "Closed"],
      ].map(([role, department, location, experience, employment, openings, candidates, status], i) => ({ id: `JOB-${120 + i}`, role, department, location, experience, employment, openings, candidates, status })),
    },
  },
  "talent/interview-tracker": {
    eyebrow: "Talent Acquisition",
    title: "Interview Tracker",
    description: "Every scheduled interview, the panel and the feedback, in one list.",
    stats: [
      { label: "Interviews this week", value: "38", icon: CalendarDays },
      { label: "Feedback pending", value: "7", icon: Clock },
      { label: "Selection ratio", value: "1 : 6", icon: Users },
      { label: "No-shows", value: "3", icon: Ticket },
    ],
    actions: [
      {
        label: "Schedule interview",
        icon: CalendarDays,
        form: {
          title: "Schedule interview",
          submitLabel: "Schedule & send invite",
          status: "Scheduled",
          success: "Interview scheduled and calendar invites sent",
          fields: [
            { name: "candidate", label: "Candidate", type: "text", required: true },
            { name: "role", label: "Role", type: "select", options: ["Senior Backend Engineer", "Product Designer", "Account Executive", "DevOps Engineer"], required: true },
            { name: "round", label: "Round", type: "select", options: ["L1 – Technical", "L2 – Technical / Case", "L3 – Leadership / HR"], required: true },
            { name: "date", label: "Date", type: "date", required: true },
            { name: "panel", label: "Interviewer", type: "person", required: true },
          ],
        },
      },
    ],
    table: {
      title: "Interviews",
      tabsOn: "status",
      filters: [{ key: "role", label: "Roles" }],
      columns: [
        { key: "candidate", label: "Candidate" },
        { key: "role", label: "Role" },
        { key: "round", label: "Round" },
        { key: "date", label: "Date", type: "date", minor: true },
        { key: "panel", label: "Interviewer", type: "person", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: ["Ritika Agarwal", "Sameer Khan", "Nandini Rao", "Varun Bhatt", "Swati Mishra", "Akash Yadav", "Fatima Sheikh", "Deepak Nair", "Pallavi Jain", "Omkar Patil", "Shreya Ghosh", "Yash Thakur"].map((candidate, i) => ({
        id: `INT-${700 + i}`,
        candidate,
        role: cycle(["Senior Backend Engineer", "Product Designer", "Account Executive", "DevOps Engineer"], i),
        round: cycle(["L1 – Technical", "L2 – Technical / Case", "L3 – Leadership / HR"], i),
        date: cycle(["24 Nov 2026, 11:00", "25 Nov 2026, 15:30", "26 Nov 2026, 10:00", "21 Nov 2026, 14:00"], i),
        panel: PEOPLE[cycle([2, 3, 10, 6, 0, 14], i)],
        status: cycle(["Scheduled", "Scheduled", "Selected", "Feedback pending", "Rejected", "Selected", "Scheduled", "On Hold"], i),
      })),
    },
  },
  "talent/employee-database": {
    eyebrow: "Talent Acquisition",
    title: "Applicants Database",
    description: "Full applicant directory — all submissions from the careers page with every field.",
    stats: [
      { label: "Total employees", value: "236", delta: "+14", trend: "up", hint: "this quarter", icon: Users },
      { label: "Departments", value: String(DEPARTMENTS.length), icon: Briefcase },
      { label: "Locations", value: "14", icon: Laptop },
      { label: "Avg. tenure", value: "2.8 yrs", icon: Clock },
    ],
    actions: [{ label: "Export directory", icon: FileText, toast: "Directory export started" }],
    table: {
      title: "Directory",
      filters: [
        { key: "department", label: "Departments" },
        { key: "location", label: "Locations" },
      ],
      columns: [
        { key: "employee", label: "Employee", type: "person" },
        { key: "code", label: "Emp. ID", type: "muted" },
        { key: "department", label: "Department" },
        { key: "location", label: "Location", minor: true },
        { key: "manager", label: "Manager", minor: true },
        { key: "joined", label: "Joined", type: "date", minor: true },
      ],
      details: [
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
      ],
      rows: PEOPLE.map((p) => ({ id: p.id, employee: p, code: p.id, department: p.department, location: p.location, manager: p.manager, joined: p.joined, email: p.email, phone: p.phone })),
    },
  },
  "talent/new-hire": {
    eyebrow: "Talent Acquisition",
    title: "New Hire Notifications",
    description: "Automatically tell IT, Admin, Finance and the team when an offer is accepted, so day one is ready.",
    stats: [
      { label: "Offers accepted (Nov)", value: "11", icon: BadgeCheck },
      { label: "Notifications sent", value: "44", icon: Send },
      { label: "Pending IT setup", value: "3", icon: MonitorCog },
      { label: "Joining next 7 days", value: "4", icon: CalendarDays },
    ],
    actions: [
      {
        label: "Send notification",
        icon: Send,
        form: {
          title: "Send new hire notification",
          submitLabel: "Send",
          status: "Delivered",
          success: "Notification sent to all selected teams",
          fields: [
            { name: "hire", label: "New hire", type: "text", required: true },
            { name: "role", label: "Role", type: "text", required: true },
            { name: "doj", label: "Date of joining", type: "date", required: true },
            { name: "teams", label: "Notify", type: "select", options: ["IT + Admin + Finance + Team", "IT only", "Admin only", "Team only"], required: true },
          ],
        },
      },
    ],
    table: {
      title: "Notifications",
      tabsOn: "status",
      columns: [
        { key: "hire", label: "New hire" },
        { key: "role", label: "Role" },
        { key: "doj", label: "Joining", type: "date" },
        { key: "teams", label: "Notified", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: [
        ["Ritika Agarwal", "Senior Backend Engineer", "01 Dec 2026", "IT, Admin, Finance, Team", "Delivered"],
        ["Nandini Rao", "Product Designer", "08 Dec 2026", "IT, Admin, Finance, Team", "Delivered"],
        ["Swati Mishra", "HR Executive", "01 Dec 2026", "IT, Admin, Finance", "Pending"],
        ["Akash Yadav", "Account Executive", "15 Dec 2026", "IT, Admin, Finance, Team", "Scheduled"],
        ["Deepak Nair", "DevOps Engineer", "05 Jan 2027", "—", "Draft"],
        ["Fatima Sheikh", "Data Analyst", "25 Nov 2026", "IT, Admin, Finance, Team", "Delivered"],
      ].map(([hire, role, doj, teams, status], i) => ({ id: `NH-${50 + i}`, hire, role, doj, teams, status })),
    },
  },
}

/* ───────────────────────── Assets & IT ───────────────────────── */

export const assets: Record<string, ModuleConfig> = {
  "assets/issuance": {
    eyebrow: "Assets & IT",
    title: "Asset Issuance",
    description: "Company assets (laptops, monitors, phones, access cards), who holds them, and their condition.",
    employee: { title: "My Assets", description: "Assets issued to you. Raise a request for new equipment.", scope: "self" },
    approvals: true,
    stats: [
      { label: "Total assets", value: "412", icon: Laptop },
      { label: "Issued", value: "351", hint: "85%", icon: BadgeCheck },
      { label: "In stock", value: "48", icon: ShieldCheck },
      { label: "Under repair", value: "13", icon: Wrench },
    ],
    actions: [
      {
        label: "Request asset",
        icon: Plus,
        form: {
          title: "Request / issue asset",
          submitLabel: "Submit",
          status: "Requested",
          success: "Asset request submitted to IT",
          fields: [
            { name: "asset", label: "Asset", type: "select", options: ["MacBook Pro 14\"", "Dell Latitude 7440", "Monitor 27\"", "Headset", "iPhone 15", "Access card"], required: true },
            { name: "employee", label: "For employee", type: "person" },
            { name: "reason", label: "Reason", type: "textarea", required: true },
          ],
        },
      },
    ],
    table: {
      title: "Asset register",
      tabsOn: "status",
      filters: [{ key: "type", label: "Types" }],
      columns: [
        { key: "tag", label: "Asset tag", type: "muted" },
        { key: "asset", label: "Asset" },
        { key: "type", label: "Type", minor: true },
        { key: "employee", label: "Assigned to", type: "person" },
        { key: "issued", label: "Issued on", type: "date", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      details: [{ key: "serial", label: "Serial number" }, { key: "warranty", label: "Warranty till" }],
      rows: [...[0, 1, 2].map((i) => ({ p: PEOPLE[0], i })), ...PEOPLE.slice(1, 13).map((p, i) => ({ p, i: i + 3 }))].map(({ p, i }) => ({
        id: `AST-${1000 + i}`,
        tag: `PH-AST-${1000 + i}`,
        asset: cycle(["MacBook Pro 14\"", "Monitor 27\"", "Access card", "Dell Latitude 7440", "Headset", "iPhone 15"], i),
        type: cycle(["Laptop", "Monitor", "Access", "Laptop", "Accessory", "Phone"], i),
        employee: p,
        issued: cycle(["14 Mar 2023", "14 Mar 2023", "12 Mar 2023", "02 Aug 2024", "11 Oct 2025"], i),
        status: cycle(["Issued", "Issued", "Issued", "Issued", "Under Repair", "Requested", "Issued", "Issued", "Returned"], i),
        serial: `SN${(784512 + i * 3301).toString(16).toUpperCase()}`,
        warranty: cycle(["Mar 2026", "Aug 2027", "Oct 2028"], i),
      })),
    },
  },
  "assets/insurance": {
    eyebrow: "Assets & IT",
    title: "Insurance",
    description: "Group health, term life and accident cover for employees and their dependants, plus claims tracking.",
    employee: { title: "My Insurance", description: "Your policies, covered dependants and claims.", scope: "self" },
    stats: [
      { label: "Lives covered", value: "684", hint: "employees + dependants", icon: HeartPulse },
      { label: "Group health cover", value: "₹5L", hint: "per family, floater", icon: ShieldCheck },
      { label: "Claims (FY)", value: "57", icon: FileText },
      { label: "Renewal", value: "31 Mar 2027", icon: CalendarDays },
    ],
    actions: [
      {
        label: "Add dependant",
        icon: Plus,
        form: {
          title: "Add dependant",
          submitLabel: "Add",
          status: "Pending",
          success: "Dependant addition sent to the insurer",
          fields: [
            { name: "dependant", label: "Name", type: "text", required: true },
            { name: "relation", label: "Relation", type: "select", options: ["Spouse", "Child", "Father", "Mother"], required: true },
            { name: "dob", label: "Date of birth", type: "date", required: true },
          ],
        },
      },
    ],
    table: {
      title: "Policies & claims",
      tabsOn: "policy",
      columns: [
        { key: "employee", label: "Employee", type: "person" },
        { key: "policy", label: "Policy" },
        { key: "cover", label: "Sum insured", type: "currency", align: "right" },
        { key: "members", label: "Members", type: "number", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: [...["Group Health", "Group Term Life", "Group Personal Accident"].map((policy, i) => ({ p: PEOPLE[0], policy, i })), ...PEOPLE.slice(1, 11).map((p, i) => ({ p, policy: cycle(["Group Health", "Group Term Life", "Group Personal Accident"], i), i: i + 3 }))].map(({ p, policy, i }) => ({
        id: `INS-${300 + i}`,
        employee: p,
        policy,
        cover: policy === "Group Health" ? 500000 : policy === "Group Term Life" ? 3000000 : 1000000,
        members: policy === "Group Health" ? cycle([4, 2, 3, 1], i) : 1,
        status: cycle(["Active", "Active", "Active", "Active", "Pending"], i),
      })),
    },
  },
  "assets/it-support": {
    eyebrow: "Assets & IT",
    title: "IT Troubleshooting",
    description: "Raise IT issues and track them to resolution against SLAs.",
    employee: { title: "My IT Tickets", description: "Raise an IT issue and track its progress.", scope: "self" },
    stats: [
      { label: "Open tickets", value: "27", icon: Ticket },
      { label: "Breaching SLA", value: "3", icon: Clock },
      { label: "Avg. resolution", value: "5.2 hrs", delta: "-1.1h", trend: "down", upIsGood: false, icon: Wrench },
      { label: "CSAT", value: "4.7 / 5", icon: BadgeCheck },
    ],
    actions: [
      {
        label: "Raise ticket",
        icon: Plus,
        form: {
          title: "Raise IT ticket",
          submitLabel: "Raise ticket",
          status: "Open",
          success: "Ticket raised. IT will respond within 4 hours",
          fields: [
            { name: "subject", label: "Subject", type: "text", required: true, full: true },
            { name: "category", label: "Category", type: "select", options: ["Laptop / Hardware", "Software install", "VPN / Network", "Email / Accounts", "Access request"], required: true },
            { name: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High", "Critical"], required: true },
            { name: "details", label: "Describe the issue", type: "textarea", required: true },
            { name: "attachment", label: "Screenshot", type: "file" },
          ],
        },
      },
    ],
    table: {
      title: "Tickets",
      tabsOn: "status",
      filters: [{ key: "category", label: "Categories" }],
      columns: [
        { key: "subject", label: "Subject" },
        { key: "employee", label: "Raised by", type: "person", minor: true },
        { key: "category", label: "Category", minor: true },
        { key: "priority", label: "Priority", type: "status" },
        { key: "assignee", label: "Assignee", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: [...pick(10, 6), ...pick(3, 2)].map((p, i) => ({
        id: `IT-${4400 + i}`,
        subject: cycle(["VPN disconnects frequently", "Need Figma license", "Laptop battery draining", "Can't access shared drive", "Outlook not syncing", "Request admin rights for Docker"], i),
        employee: p,
        category: cycle(["VPN / Network", "Software install", "Laptop / Hardware", "Access request", "Email / Accounts", "Access request"], i),
        priority: cycle(["High", "Medium", "Medium", "Critical", "Low"], i),
        assignee: "Nikhil Gupta",
        status: cycle(["Open", "In Progress", "Resolved", "Open", "Resolved", "In Progress", "Closed"], i),
      })),
    },
  },
  "assets/overrides": {
    eyebrow: "Assets & IT",
    title: "Override Options",
    description: "Controlled admin overrides (attendance corrections, access unlocks, policy exceptions), each with a reason and a full audit trail.",
    approvals: true,
    stats: [
      { label: "Overrides this month", value: "19", icon: KeyRound },
      { label: "Pending approval", value: "4", icon: Clock },
      { label: "Auto-expired", value: "6", icon: CalendarDays },
      { label: "Audited", value: "100%", icon: ShieldCheck },
    ],
    actions: [
      {
        label: "New override",
        icon: KeyRound,
        form: {
          title: "Create override",
          description: "Every override is logged with the approver, the reason and an expiry date.",
          submitLabel: "Request override",
          success: "Override requested",
          fields: [
            { name: "employee", label: "Employee", type: "person", required: true },
            { name: "type", label: "Override type", type: "select", options: ["Attendance correction", "Account unlock", "USB / admin access", "Policy exception", "Late payroll input"], required: true },
            { name: "expiry", label: "Valid till", type: "date", required: true },
            { name: "reason", label: "Reason", type: "textarea", required: true },
          ],
        },
      },
    ],
    table: {
      title: "Override log",
      tabsOn: "status",
      columns: [
        { key: "employee", label: "Employee", type: "person" },
        { key: "type", label: "Type" },
        { key: "by", label: "Requested by", minor: true },
        { key: "expiry", label: "Valid till", type: "date", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      details: [{ key: "reason", label: "Reason" }],
      rows: pick(9, 8, false).map((p, i) => ({ id: `OVR-${90 + i}`, employee: p, type: cycle(["Attendance correction", "Account unlock", "USB / admin access", "Policy exception", "Late payroll input"], i), by: cycle(["Nikhil Gupta", "Priya Nair", "Pooja Desai"], i), expiry: cycle(["30 Nov 2026", "25 Nov 2026", "31 Dec 2026"], i), status: cycle(["Pending", "Approved", "Expired", "Approved", "Rejected", "Pending"], i), reason: "Biometric device was offline on 18 Nov; employee was present (manager confirmed)." })),
    },
  },
}

/* ───────────────────── Single-page modules ───────────────────── */

export const misc: Record<string, ModuleConfig> = {
  marketing: {
    eyebrow: "Marketing & Events",
    title: "Marketing & Events",
    description: "Plan internal and external events and campaigns, track spend against budget and measure return on investment.",
    employee: { title: "Events", description: "Upcoming company events. Register to join.", scope: "all" },
    stats: [
      { label: "Events this quarter", value: "12", icon: Megaphone },
      { label: "Budget used", value: "₹18.4L / ₹25L", hint: "74%", icon: Wallet },
      { label: "Leads generated", value: "1,240", delta: "+31%", trend: "up", icon: Users },
      { label: "Blended ROI", value: "3.4×", delta: "+0.6×", trend: "up", icon: TrendingUp },
    ],
    actions: [
      { label: "Register", icon: CalendarDays, role: "employee", toast: "You're registered! A calendar invite is on its way." },
      {
        label: "Create event",
        icon: Plus,
        role: "admin",
        form: {
          title: "Create event / campaign",
          submitLabel: "Create",
          status: "Planned",
          success: "Event created",
          fields: [
            { name: "event", label: "Name", type: "text", required: true, full: true },
            { name: "type", label: "Type", type: "select", options: ["Conference", "Webinar", "Campaign", "Internal event", "Hiring drive"], required: true },
            { name: "date", label: "Date", type: "date", required: true },
            { name: "budget", label: "Budget (₹)", type: "number", required: true },
            { name: "owner", label: "Owner", type: "person" },
          ],
        },
      },
    ],
    table: {
      title: "Events & campaigns",
      tabsOn: "type",
      columns: [
        { key: "event", label: "Event / campaign" },
        { key: "type", label: "Type", minor: true },
        { key: "date", label: "Date", type: "date" },
        { key: "budget", label: "Budget", type: "currency", align: "right", minor: true },
        { key: "spend", label: "Spend", type: "currency", align: "right", minor: true },
        { key: "roi", label: "ROI" },
        { key: "status", label: "Status", type: "status" },
      ],
      details: [{ key: "leads", label: "Leads / attendees", type: "number" }],
      rows: [
        ["HR Tech Summit 2026", "Conference", "05 Dec 2026", 600000, 410000, "—", "Planned", 0],
        ["Payroll Compliance Webinar", "Webinar", "18 Nov 2026", 80000, 72000, "4.8×", "Completed", 420],
        ["Diwali Celebration", "Internal event", "30 Oct 2026", 250000, 238000, "—", "Completed", 210],
        ["LinkedIn Lead Campaign Q3", "Campaign", "01 Oct 2026", 400000, 365000, "3.1×", "Live", 560],
        ["Campus Hiring Drive – IIT Madras", "Hiring drive", "12 Jan 2027", 150000, 0, "—", "Planned", 0],
        ["Customer Meetup Bengaluru", "Conference", "22 Aug 2026", 300000, 290000, "2.6×", "Completed", 140],
        ["Annual Day 2027", "Internal event", "14 Feb 2027", 800000, 120000, "—", "Planned", 0],
        ["Product Launch Webinar", "Webinar", "10 Sep 2026", 60000, 58000, "5.2×", "Completed", 380],
      ].map(([event, type, date, budget, spend, roi, status, leads], i) => ({ id: `EVT-${30 + i}`, event, type, date, budget, spend, roi, status, leads })),
    },
  },

  admin: {
    eyebrow: "Admin",
    title: "Administration",
    description: "Users, roles and permissions, plus organisation-wide settings for PeopleHub.",
    stats: [
      { label: "Active users", value: "236", icon: Users },
      { label: "Admins", value: "9", icon: ShieldCheck },
      { label: "Roles", value: "6", icon: KeyRound },
      { label: "SSO", value: "Enabled", hint: "Google Workspace", icon: BadgeCheck },
    ],
    actions: [
      { label: "Audit log", icon: FileText, toast: "Opening audit log (demo)" },
      {
        label: "Invite user",
        icon: UserPlus,
        form: {
          title: "Invite user",
          submitLabel: "Send invite",
          status: "Pending",
          success: "Invite sent",
          fields: [
            { name: "employee", label: "Employee", type: "person", required: true },
            { name: "role", label: "Role", type: "select", options: ["Super Admin", "HR Admin", "Finance Admin", "IT Admin", "Manager", "Employee"], required: true },
          ],
        },
      },
    ],
    aside: {
      title: "Roles & access",
      items: [
        { label: "Super Admin", value: "2 users", pct: 100, hint: "Full access to every module" },
        { label: "HR Admin", value: "4 users", pct: 70, hint: "HRMS, L&D, TA, PMS" },
        { label: "Finance Admin", value: "2 users", pct: 40, tone: "success", hint: "Finance, payroll" },
        { label: "Employee", value: "227 users", pct: 25, tone: "warning", hint: "Self-service only" },
      ],
    },
    table: {
      title: "Users",
      tabsOn: "role",
      columns: [
        { key: "employee", label: "User", type: "person" },
        { key: "role", label: "Role" },
        { key: "lastActive", label: "Last active", type: "muted", minor: true },
        { key: "mfa", label: "MFA", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: PEOPLE.map((p, i) => ({
        id: `USR-${p.id}`,
        employee: p,
        role: p.name === "Priya Nair" || p.name === "Ishita Bose" ? "HR Admin" : p.name === "Sneha Reddy" || p.name === "Pooja Desai" ? "Finance Admin" : p.name === "Nikhil Gupta" ? "IT Admin" : p.name === "Aditya Chauhan" ? "Super Admin" : p.designation.includes("Manager") ? "Manager" : "Employee",
        lastActive: cycle(["2 min ago", "1 hr ago", "Yesterday", "3 days ago"], i),
        mfa: i % 5 === 4 ? "Off" : "On",
        status: i === 23 ? "Pending" : "Active",
      })),
    },
  },

  support: {
    eyebrow: "Support",
    title: "Help & Support",
    description: "One helpdesk for HR, payroll, admin and facilities questions, with SLAs and a knowledge base.",
    employee: { title: "Help & Support", description: "Ask HR, Payroll, Admin or Facilities a question and track the answer.", scope: "self" },
    stats: [
      { label: "Open queries", value: "31", icon: Ticket },
      { label: "First response", value: "42 min", delta: "-8m", trend: "down", upIsGood: false, icon: Clock },
      { label: "Resolved this week", value: "86", icon: BadgeCheck },
      { label: "Satisfaction", value: "4.6 / 5", icon: HeartPulse },
    ],
    actions: [
      {
        label: "New query",
        icon: Plus,
        form: {
          title: "Raise a query",
          submitLabel: "Submit",
          status: "Open",
          success: "Query submitted. We'll get back within 1 working day",
          fields: [
            { name: "subject", label: "Subject", type: "text", required: true, full: true },
            { name: "team", label: "Team", type: "select", options: ["HR", "Payroll", "Admin", "Facilities", "Finance"], required: true },
            { name: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High"], required: true },
            { name: "details", label: "Details", type: "textarea", required: true },
          ],
        },
      },
    ],
    table: {
      title: "Queries",
      tabsOn: "status",
      filters: [{ key: "team", label: "Teams" }],
      columns: [
        { key: "subject", label: "Subject" },
        { key: "employee", label: "Raised by", type: "person", minor: true },
        { key: "team", label: "Team" },
        { key: "priority", label: "Priority", type: "status", minor: true },
        { key: "updated", label: "Updated", type: "muted", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: [...pick(10, 3), ...pick(3, 9)].map((p, i) => ({
        id: `SUP-${2200 + i}`,
        subject: cycle(["Form 16 not received", "Update bank account", "Parking slot request", "Leave balance mismatch", "Address proof letter", "AC not working on 4th floor"], i),
        employee: p,
        team: cycle(["Payroll", "HR", "Facilities", "HR", "HR", "Facilities"], i),
        priority: cycle(["High", "Medium", "Low", "Medium"], i),
        updated: cycle(["10 min ago", "2 hrs ago", "Yesterday", "2 days ago"], i),
        status: cycle(["Open", "In Progress", "Resolved", "Open", "Closed", "In Progress"], i),
      })),
    },
  },

  outings: {
    eyebrow: "Engagement",
    title: "Quarterly Outing & Team Budget",
    description: "Per-head team budgets for quarterly outings and celebrations. Plan, get approval and track spend.",
    employee: { title: "Team Outings", description: "Your team's outing budget and upcoming plans.", scope: "all" },
    approvals: true,
    stats: [
      { label: "Q3 budget", value: "₹7.08L", hint: "₹3,000 per head", icon: Wallet },
      { label: "Utilised", value: "₹4.2L", hint: "59%", icon: TrendingUp },
      { label: "Outings planned", value: "9", icon: PartyPopper },
      { label: "Avg. team rating", value: "4.5 / 5", icon: HeartPulse },
    ],
    actions: [
      {
        label: "Plan outing",
        icon: PartyPopper,
        form: {
          title: "Plan team outing",
          submitLabel: "Send for approval",
          success: "Outing plan sent for approval",
          fields: [
            { name: "team", label: "Team", type: "select", options: DEPARTMENTS, required: true },
            { name: "plan", label: "Plan", type: "text", required: true, placeholder: "e.g. Go-karting + dinner" },
            { name: "date", label: "Date", type: "date", required: true },
            { name: "headcount", label: "Headcount", type: "number", required: true },
            { name: "estimate", label: "Estimated cost (₹)", type: "number", required: true },
          ],
        },
      },
    ],
    aside: {
      title: "Budget utilisation by team",
      items: DEPARTMENTS.slice(0, 4).map((d, i) => ({ label: d, value: `${[82, 45, 100, 30][i]}%`, pct: [82, 45, 100, 30][i], tone: ([82, 45, 100, 30][i] >= 100 ? "danger" : "brand") as "danger" | "brand", hint: `₹${[1.9, 0.4, 0.6, 0.3][i]}L of ₹${[2.3, 0.9, 0.6, 1.0][i]}L` })),
    },
    table: {
      title: "Outing plans: Q3 FY27",
      tabsOn: "status",
      columns: [
        { key: "team", label: "Team" },
        { key: "plan", label: "Plan" },
        { key: "date", label: "Date", type: "date", minor: true },
        { key: "headcount", label: "Headcount", type: "number", minor: true },
        { key: "estimate", label: "Estimate", type: "currency", align: "right" },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: [
        ["Engineering", "Go-karting + team dinner", "06 Dec 2026", 72, 216000, "Approved"],
        ["Sales", "Day trip to Nandi Hills", "13 Dec 2026", 28, 84000, "Pending"],
        ["Design", "Pottery workshop", "29 Nov 2026", 9, 27000, "Approved"],
        ["Human Resources", "Escape room + lunch", "20 Dec 2026", 14, 42000, "Pending"],
        ["Finance", "Bowling + dinner", "15 Nov 2026", 12, 36000, "Completed"],
        ["Marketing", "Cooking class", "18 Oct 2026", 10, 31000, "Completed"],
        ["Customer Success", "Resort day out", "10 Jan 2027", 22, 66000, "Draft"],
      ].map(([team, plan, date, headcount, estimate, status], i) => ({ id: `OUT-${10 + i}`, team, plan, date, headcount, estimate, status })),
    },
  },
}
