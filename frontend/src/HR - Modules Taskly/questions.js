/* ============================================================
   All survey question sets, sourced from Survey Questions.docx.
   Single source of truth — if HR revises a question, change it
   here only. Every module imports from this file.
   ============================================================ */

/* ---- 1. ONBOARDING EXPERIENCE SURVEY
        For new joiners after induction / onboarding ---- */
export const ONB_SECTIONS = [
  {
    section: "Overall Onboarding Experience",
    questions: [
      "How would you rate your overall onboarding experience?",
      "How smooth and well-coordinated was your onboarding process?",
      "How clear and helpful was the information provided during your induction?",
      "How well did the onboarding process help you feel prepared and comfortable to begin your role?",
    ],
  },
  {
    section: "HR Team Experience",
    questions: [
      "How would you rate your overall interaction with the HR team during onboarding?",
      "How approachable and responsive was the HR team throughout your onboarding?",
      "How effectively did the HR team address your questions and support your joining needs?",
    ],
  },
];

export const ONB_QUESTIONS = ONB_SECTIONS.flatMap((s) => s.questions);

/* Short labels for charts and tables — same order as ONB_QUESTIONS */
export const ONB_SHORT = [
  "Overall experience",
  "Smooth & coordinated",
  "Induction clarity",
  "Felt prepared",
  "HR interaction",
  "HR approachability",
  "HR addressed needs",
];

export const ONB_TEXT_Q =
  "What is one thing we could improve to make the onboarding experience better?";

/* Index at which the HR Team Experience block starts (Q5) */
export const ONB_HR_BLOCK_START = 4;

/* ---- 2. HR QUERY / SUPPORT SURVEY
        For employees who raise queries. Team name is substituted so
        the same set serves both HR and L&D queries. ---- */
export const QUERY_QUESTIONS = (team = "HR") => [
  `How would you rate your overall experience while raising a ${team} query?`,
  `How easy is it to reach the ${team} team when you need support?`,
  `How would you rate the response time for your ${team} queries?`,
  `How clearly are your ${team} queries or concerns explained and addressed?`,
  `How would you rate the support and assistance provided by the ${team} team?`,
  `How satisfied are you with the resolution provided for your ${team} query?`,
];

export const QUERY_SHORT = [
  "Raising experience",
  "Ease of reaching",
  "Response time",
  "Clarity of answer",
  "Support provided",
  "Resolution satisfaction",
];

/* ---- 3. EMPLOYEE ENGAGEMENT SURVEY
        Quarterly, all employees ---- */
export const ENG_Q1 =
  "How would you rate the HR engagement activities conducted during each month of this quarter?";

export const ENG_REST = [
  "How would you rate HR's planning and execution of the engagement activities this quarter?",
  "How approachable and responsive was the HR team during these activities?",
];

export const ENG_REST_SHORT = ["Planning & execution", "HR approachability"];

export const ENG_TEXT_Q =
  "What is one thing you would like HR to continue, improve or introduce in future activities?";
