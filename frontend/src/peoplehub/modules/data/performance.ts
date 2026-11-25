import { Award, BookOpen, CalendarDays, Clock, Gift, GraduationCap, MessageSquareText, Plus, Sparkles, TrendingUp, TriangleAlert, Trophy, Users, Wallet } from "lucide-react"
import { cycle, pick, PEOPLE } from "@/peoplehub/mocks/people"
import type { ModuleConfig } from "@/peoplehub/modules/types"

const pipConfig = (eyebrow: string): ModuleConfig => ({
  eyebrow,
  title: "Performance Improvement Plans",
  description: "Structured, time-bound plans with clear goals, check-ins and support, kept fair and transparent for everyone involved.",
  employee: { title: "My Improvement Plan", description: "Your goals, check-ins and support plan, if one is active.", scope: "self" },
  stats: [
    { label: "Active PIPs", value: "5", icon: TriangleAlert },
    { label: "Check-ins due this week", value: "3", icon: CalendarDays },
    { label: "Successfully completed (YTD)", value: "71%", delta: "+8%", trend: "up", icon: TrendingUp },
    { label: "Avg. duration", value: "60 days", icon: Clock },
  ],
  actions: [
    {
      label: "Initiate PIP",
      icon: Plus,
      role: "admin",
      form: {
        title: "Initiate performance improvement plan",
        description: "HR and the reporting manager will be notified. The employee sees the plan once HR publishes it.",
        submitLabel: "Create plan",
        status: "Draft",
        success: "PIP drafted for HR review",
        fields: [
          { name: "employee", label: "Employee", type: "person", required: true },
          { name: "duration", label: "Duration", type: "select", options: ["30 days", "60 days", "90 days"], required: true },
          { name: "start", label: "Start date", type: "date", required: true },
          { name: "mentor", label: "Mentor / buddy", type: "person" },
          { name: "goals", label: "Improvement goals", type: "textarea", required: true, placeholder: "Specific, measurable goals…" },
        ],
      },
    },
  ],
  table: {
    title: "Improvement plans",
    tabsOn: "status",
    columns: [
      { key: "employee", label: "Employee", type: "person" },
      { key: "duration", label: "Duration" },
      { key: "start", label: "Started", type: "date", minor: true },
      { key: "progress", label: "Goals met", type: "progress" },
      { key: "next", label: "Next check-in", type: "date", minor: true },
      { key: "status", label: "Status", type: "status" },
    ],
    details: [{ key: "goals", label: "Goals" }, { key: "mentor", label: "Mentor" }],
    rows: [PEOPLE[18], PEOPLE[4], PEOPLE[9], PEOPLE[22], PEOPLE[11], PEOPLE[7]].map((p, i) => ({
      id: `PIP-${40 + i}`,
      employee: p,
      duration: cycle(["60 days", "90 days", "30 days", "60 days"], i),
      start: cycle(["01 Oct 2026", "15 Sep 2026", "01 Nov 2026", "20 Aug 2026"], i),
      progress: cycle([60, 45, 20, 100, 75, 100], i),
      next: cycle(["28 Nov 2026", "26 Nov 2026", "02 Dec 2026", "—"], i),
      status: cycle(["In Progress", "At Risk", "In Progress", "Completed", "In Progress", "Completed"], i),
      goals: "Close 90% of tickets within SLA; reduce reopen rate below 5%",
      mentor: cycle(["Rohan Mehta", "Rahul Verma", "Aditya Chauhan"], i),
    })),
  },
})

export const performance: Record<string, ModuleConfig> = {
  "pms/performance-bonus": {
    eyebrow: "Growth & Rewards",
    title: "Performance Bonus",
    description: "One-time bonuses for outstanding performance, linked to appraisal ratings and budget.",
    employee: { title: "My Performance Bonus", description: "Bonuses awarded to you.", scope: "self" },
    approvals: true,
    stats: [
      { label: "Bonus budget (FY)", value: "₹1.2Cr", icon: Wallet },
      { label: "Utilised", value: "₹74.5L", hint: "62%", icon: TrendingUp },
      { label: "Employees awarded", value: "58", icon: Users },
      { label: "Pending approval", value: "6", icon: Clock },
    ],
    actions: [
      {
        label: "Recommend bonus",
        icon: Plus,
        role: "admin",
        form: {
          title: "Recommend performance bonus",
          submitLabel: "Send for approval",
          success: "Bonus recommendation sent for approval",
          fields: [
            { name: "employee", label: "Employee", type: "person", required: true },
            { name: "amount", label: "Amount (₹)", type: "number", required: true },
            { name: "basis", label: "Basis", type: "select", options: ["Appraisal rating", "Project delivery", "Retention", "Special contribution"], required: true },
            { name: "justification", label: "Justification", type: "textarea", required: true },
          ],
        },
      },
    ],
    table: {
      title: "Bonus recommendations",
      tabsOn: "status",
      columns: [
        { key: "employee", label: "Employee", type: "person" },
        { key: "basis", label: "Basis" },
        { key: "rating", label: "Rating", type: "rating", minor: true },
        { key: "amount", label: "Amount", type: "currency", align: "right" },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: pick(10, 2).map((p, i) => ({
        id: `BNS-${500 + i}`,
        employee: p,
        basis: cycle(["Appraisal rating", "Project delivery", "Special contribution", "Retention"], i),
        rating: cycle([4.6, 4.4, 4.8, 4.2, 4.5], i),
        amount: cycle([75000, 50000, 120000, 40000, 90000], i),
        status: cycle(["Approved", "Pending", "Paid", "Pending", "Approved", "Rejected", "Paid", "Pending", "Approved", "Paid"], i),
      })),
    },
  },

  "pms/rnr": {
    eyebrow: "Growth & Rewards",
    title: "Rewards & Recognition",
    description: "Recognise great work publicly. Nominate peers, celebrate winners and redeem reward points.",
    employee: { title: "Rewards & Recognition", description: "Nominate colleagues and see who's being celebrated.", scope: "all" },
    stats: [
      { label: "Nominations (Nov)", value: "86", delta: "+22%", trend: "up", icon: Sparkles },
      { label: "Awards given (YTD)", value: "142", icon: Trophy },
      { label: "Points redeemed", value: "48,200", icon: Gift },
      { label: "Participation", value: "73%", hint: "of employees", icon: Users },
    ],
    actions: [
      {
        label: "Nominate",
        icon: Award,
        form: {
          title: "Nominate a colleague",
          submitLabel: "Submit nomination",
          status: "Nominated",
          success: "Nomination submitted 🎉",
          fields: [
            { name: "employee", label: "Colleague", type: "person", required: true },
            { name: "award", label: "Award", type: "select", options: ["Star of the Month", "Spot Award", "Team Player", "Customer Hero", "Innovation Award"], required: true },
            { name: "citation", label: "Why do they deserve it?", type: "textarea", required: true },
          ],
        },
      },
    ],
    table: {
      title: "Recognition wall",
      tabsOn: "award",
      columns: [
        { key: "employee", label: "Recognised", type: "person" },
        { key: "award", label: "Award" },
        { key: "by", label: "Nominated by", minor: true },
        { key: "points", label: "Points", type: "number" },
        { key: "date", label: "Date", type: "date", minor: true },
        { key: "status", label: "Status", type: "status" },
      ],
      details: [{ key: "citation", label: "Citation" }],
      rows: pick(10, 5, false).map((p, i) => ({
        id: `RNR-${800 + i}`,
        employee: p,
        award: cycle(["Star of the Month", "Spot Award", "Team Player", "Customer Hero", "Innovation Award"], i),
        by: PEOPLE[(i * 3 + 2) % PEOPLE.length].name,
        points: cycle([1000, 250, 500, 750, 1500], i),
        date: cycle(["20 Nov 2026", "14 Nov 2026", "08 Nov 2026", "31 Oct 2026"], i),
        status: cycle(["Winner", "Approved", "Nominated", "Winner", "Approved"], i),
        citation: "Went above and beyond to deliver the release on time while mentoring two new joiners.",
      })),
    },
  },

  "ld/training": {
    eyebrow: "L&D",
    title: "Training Modules",
    description: "Learning catalogue with mandatory compliance training, skill tracks and leadership programs.",
    employee: { title: "My Learning", description: "Your assigned and recommended training.", scope: "all" },
    stats: [
      { label: "Active courses", value: "46", icon: BookOpen },
      { label: "Enrolments", value: "612", delta: "+14%", trend: "up", icon: Users },
      { label: "Completion rate", value: "81%", icon: GraduationCap },
      { label: "Learning hours (Q3)", value: "3,940", icon: Clock },
    ],
    actions: [
      {
        label: "Create module",
        icon: Plus,
        role: "admin",
        form: {
          title: "Create training module",
          submitLabel: "Publish",
          status: "Live",
          success: "Training module published",
          fields: [
            { name: "course", label: "Course title", type: "text", required: true, full: true },
            { name: "track", label: "Track", type: "select", options: ["Compliance", "Technical", "Leadership", "Soft skills", "Onboarding"], required: true },
            { name: "mode", label: "Mode", type: "select", options: ["Self-paced", "Instructor-led", "Workshop"], required: true },
            { name: "duration", label: "Duration", type: "text", placeholder: "e.g. 4 hrs" },
            { name: "audience", label: "Audience", type: "select", options: ["All employees", "Managers", "Engineering", "New joiners"] },
          ],
        },
      },
    ],
    table: {
      title: "Course catalogue",
      tabsOn: "track",
      columns: [
        { key: "course", label: "Course" },
        { key: "track", label: "Track" },
        { key: "mode", label: "Mode", minor: true },
        { key: "duration", label: "Duration", minor: true },
        { key: "completion", label: "Completion", type: "progress" },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: [
        ["POSH Awareness", "Compliance", "Self-paced", "1 hr", 94, "Live"],
        ["Information Security Basics", "Compliance", "Self-paced", "45 min", 88, "Live"],
        ["PeopleHub Induction", "Onboarding", "Instructor-led", "3 hrs", 100, "Live"],
        ["Advanced React & Next.js", "Technical", "Self-paced", "12 hrs", 46, "Live"],
        ["Cloud Fundamentals (AWS)", "Technical", "Self-paced", "8 hrs", 61, "Live"],
        ["First-time Manager Program", "Leadership", "Workshop", "2 days", 72, "Live"],
        ["Giving Effective Feedback", "Leadership", "Workshop", "4 hrs", 80, "Scheduled"],
        ["Business Communication", "Soft skills", "Instructor-led", "6 hrs", 55, "Live"],
        ["Negotiation Skills", "Soft skills", "Workshop", "1 day", 0, "Draft"],
        ["SQL for Analysts", "Technical", "Self-paced", "6 hrs", 38, "Live"],
      ].map(([course, track, mode, duration, completion, status], i) => ({ id: `TRN-${100 + i}`, course, track, mode, duration, completion, status })),
    },
  },

  "ld/feedback": {
    eyebrow: "L&D",
    title: "New Joiner Feedback (30/60/90)",
    description: "Structured check-ins at 30, 60 and 90 days so every new joiner settles in well and issues are caught early.",
    employee: { title: "My 30/60/90 Feedback", description: "Share how your first months are going.", scope: "self" },
    stats: [
      { label: "Check-ins due", value: "12", icon: CalendarDays },
      { label: "Response rate", value: "91%", icon: MessageSquareText },
      { label: "Avg. satisfaction", value: "4.4 / 5", delta: "+0.2", trend: "up", icon: Sparkles },
      { label: "Flagged for HR", value: "2", icon: TriangleAlert },
    ],
    actions: [
      {
        label: "Give feedback",
        icon: MessageSquareText,
        form: {
          title: "30/60/90 day check-in",
          submitLabel: "Submit feedback",
          status: "Completed",
          success: "Thanks! Your feedback has been shared with HR",
          fields: [
            { name: "milestone", label: "Milestone", type: "select", options: ["30 days", "60 days", "90 days"], required: true },
            { name: "rating", label: "Overall experience", type: "select", options: ["5 – Excellent", "4 – Good", "3 – Okay", "2 – Poor", "1 – Very poor"], required: true },
            { name: "clarity", label: "Is your role clear?", type: "select", options: ["Yes, fully", "Mostly", "Not really"] },
            { name: "comments", label: "What could be better?", type: "textarea" },
          ],
        },
      },
    ],
    table: {
      title: "Check-ins",
      tabsOn: "milestone",
      columns: [
        { key: "employee", label: "Employee", type: "person" },
        { key: "milestone", label: "Milestone" },
        { key: "due", label: "Due", type: "date", minor: true },
        { key: "rating", label: "Rating", type: "rating" },
        { key: "status", label: "Status", type: "status" },
      ],
      rows: [PEOPLE[0], ...PEOPLE.slice(-10)].map((p, i) => ({
        id: `FB-${200 + i}`,
        employee: p,
        milestone: cycle(["30 days", "60 days", "90 days"], i),
        due: cycle(["25 Nov 2026", "28 Nov 2026", "03 Dec 2026", "10 Dec 2026"], i),
        rating: i % 4 === 3 ? "" : cycle([4.5, 4.0, 4.8, 3.2, 4.6], i),
        status: i % 4 === 3 ? "Pending" : cycle(["Completed", "Completed", "Completed", "Pending", "Overdue"], i),
      })),
    },
  },

  "ld/pip": pipConfig("L&D"),
  pip: pipConfig("PIP"),
}
