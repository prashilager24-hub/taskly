/* ============================================================
   Sample data — replace every export here with your API layer.
   Shapes are the contract each module component expects.
   ============================================================ */

export const CURRENT_USER = {
  name: "Ravikumar S",
  dept: "Engineering",
  joined: "14 Jul 2026",
};

export const NOTIFY_LIST = "hr@tapmind.com; admin@tapmind.com";

export const NEW_JOINERS = [
  { name: "Ravikumar S", dept: "Engineering", joined: "14 Jul 2026" },
  { name: "Meera K", dept: "Ad Ops", joined: "04 Aug 2026" },
  { name: "Vikram T", dept: "Sales", joined: "11 Aug 2026" },
];

/* ---- Module 1 ----------------------------------------------
   status: "pending" | "submitted" | "no_response"
   answers: 7 integers 1-10, index-aligned to ONB_QUESTIONS
   feedback: string answer to ONB_TEXT_Q (Q8)
------------------------------------------------------------- */
export const SEED_SURVEYS = [
  { id: "S-014", employee: "Ravikumar S", dept: "Engineering", joined: "14 Jul 2026", sentOn: "12 Aug 2026", due: "19 Aug 2026", status: "pending", answers: [], feedback: "" },
  { id: "S-011", employee: "Divya M", dept: "Ad Ops", joined: "01 Jul 2026", sentOn: "30 Jul 2026", due: "06 Aug 2026", status: "submitted", answers: [8, 6, 9, 8, 9, 9, 8], feedback: "Induction deck was thorough. Laptop arrived three days late." },
  { id: "S-009", employee: "Arjun P", dept: "Product", joined: "23 Jun 2026", sentOn: "30 Jun 2026", due: "07 Jul 2026", status: "submitted", answers: [5, 4, 6, 5, 7, 7, 6], feedback: "No one was assigned to receive me on Day 1. Accounts took a week." },
  { id: "S-007", employee: "Sneha R", dept: "Sales", joined: "10 Jun 2026", sentOn: "10 Jul 2026", due: "17 Jul 2026", status: "no_response", answers: [], feedback: "" },
  { id: "S-005", employee: "Karthik V", dept: "Engineering", joined: "02 Jun 2026", sentOn: "02 Jul 2026", due: "09 Jul 2026", status: "submitted", answers: [9, 8, 9, 9, 10, 9, 9], feedback: "Buddy programme helped a lot. Keep it." },
];

/* ---- Module 2 ----------------------------------------------
   team: "HR" | "L&D"
   status: "open" | "in_progress" | "resolved" | "closed"
     resolved = resolver is done, employee has not yet taken the survey
     closed   = support survey submitted
   ratings: 6 integers 1-10, index-aligned to QUERY_QUESTIONS(team)
   ageHrs: hours since raised — drives the SLA / Overdue flag
------------------------------------------------------------- */
export const SEED_QUERIES = [
  {
    id: "Q-1042", employee: "Ravikumar S", dept: "Engineering", team: "HR", category: "Payroll",
    subject: "PF number not reflecting in portal", priority: "Normal", raisedOn: "17 Aug", ageHrs: 48,
    status: "in_progress", ratings: [], ratingComment: "",
    thread: [
      { who: "Ravikumar S", at: "17 Aug, 10:22", text: "My PF number is not showing in the payroll portal since joining. Payslip shows a blank UAN field." },
      { who: "HR Team", at: "17 Aug, 14:05", text: "Checked with the payroll vendor — UAN activation is pending at their end. Will update by Thursday." },
    ],
  },
  {
    id: "Q-1044", employee: "Sneha R", dept: "Sales", team: "HR", category: "Policy",
    subject: "Maternity policy clarification", priority: "High", raisedOn: "16 Aug", ageHrs: 76,
    status: "open", ratings: [], ratingComment: "",
    thread: [{ who: "Sneha R", at: "16 Aug, 09:10", text: "Need clarity on how maternity leave interacts with the annual leave carry-forward." }],
  },
  {
    id: "Q-1038", employee: "Ravikumar S", dept: "Engineering", team: "L&D", category: "Training",
    subject: "Request for Kafka certification budget", priority: "Normal", raisedOn: "11 Aug", ageHrs: 102,
    status: "resolved", ratings: [], ratingComment: "",
    thread: [
      { who: "Ravikumar S", at: "11 Aug, 10:22", text: "Requesting approval for the Confluent Kafka developer certification." },
      { who: "L&D Team", at: "16 Aug, 15:40", text: "Approved under the H2 upskilling budget. Voucher shared over mail; reimbursement on completion." },
    ],
  },
  {
    id: "Q-1021", employee: "Ravikumar S", dept: "Engineering", team: "HR", category: "Leave",
    subject: "Comp-off carry forward clarification", priority: "Low", raisedOn: "02 Aug", ageHrs: 20,
    status: "closed", ratings: [9, 9, 10, 9, 9, 9], ratingComment: "Answered same day with the policy clause attached.",
    thread: [
      { who: "Ravikumar S", at: "02 Aug, 11:00", text: "Can comp-offs be carried into the next quarter?" },
      { who: "HR Team", at: "02 Aug, 16:20", text: "Yes, up to 5 days within the same financial year. Policy clause 6.3 attached." },
    ],
  },
  {
    id: "Q-1012", employee: "Arjun P", dept: "Product", team: "L&D", category: "Training",
    subject: "Training nomination rejected", priority: "Normal", raisedOn: "24 Jul", ageHrs: 130,
    status: "closed", ratings: [4, 5, 3, 2, 4, 3], ratingComment: "No reason was given for the rejection.",
    thread: [
      { who: "Arjun P", at: "24 Jul, 12:00", text: "My nomination for the PM workshop was rejected without explanation." },
      { who: "L&D Team", at: "29 Jul, 18:05", text: "Seats were filled. You are on the waitlist for the next batch." },
    ],
  },
  {
    id: "Q-0998", employee: "Divya M", dept: "Ad Ops", team: "HR", category: "Payroll",
    subject: "Reimbursement delay", priority: "Normal", raisedOn: "15 Jul", ageHrs: 168,
    status: "closed", ratings: [5, 6, 3, 5, 5, 4], ratingComment: "Took three follow-ups to get a response.",
    thread: [
      { who: "Divya M", at: "15 Jul, 09:30", text: "Travel reimbursement from June is still not processed." },
      { who: "HR Team", at: "22 Jul, 17:45", text: "Processed in this cycle. Apologies for the delay." },
    ],
  },
];

/* ---- Module 3 ----------------------------------------------
   status: "collecting" | "closed"
   months: 3 month labels, rated individually under ENG_Q1
   response.months: 3 integers 1-10, index-aligned to survey.months
   response.rest:   2 integers 1-10, index-aligned to ENG_REST
------------------------------------------------------------- */
export const SEED_ENGAGEMENT = [
  {
    id: "E-03", quarter: "Q2 FY26 — Jul to Sep 2026", months: ["July", "August", "September"],
    sentTo: 142, opens: "12 Aug 2026", closes: "25 Aug 2026", status: "collecting",
    responses: [
      { by: "Divya M", anonymous: true, months: [8, 9, 7], rest: [8, 9], feedback: "Annual Day was excellent. Announce dates earlier." },
      { by: "Arjun P", anonymous: true, months: [5, 6, 4], rest: [5, 6], feedback: "Activities clash with sprint demos every time." },
      { by: "Karthik V", anonymous: false, months: [9, 9, 8], rest: [9, 9], feedback: "" },
      { by: "Sneha R", anonymous: true, months: [7, 8, 7], rest: [7, 8], feedback: "More cross-team activities please." },
    ],
  },
  {
    id: "E-02", quarter: "Q1 FY26 — Apr to Jun 2026", months: ["April", "May", "June"],
    sentTo: 138, opens: "10 May 2026", closes: "24 May 2026", status: "closed",
    responses: [
      { by: "Divya M", anonymous: true, months: [7, 6, 7], rest: [7, 8], feedback: "Town hall Q&A was cut short." },
      { by: "Meera K", anonymous: true, months: [8, 7, 6], rest: [7, 7], feedback: "" },
      { by: "Karthik V", anonymous: true, months: [9, 8, 8], rest: [8, 9], feedback: "POSH session was handled well." },
    ],
  },
];
