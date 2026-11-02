/* ============================================================
   What a survey asks, read from the template it was sent with.
   Surveys sent before templates existed carry no template and use
   the original questions in ./questions.js.
   ============================================================ */
import {
  ONB_SECTIONS, ONB_SHORT, ONB_TEXT_Q, ONB_HR_BLOCK_START,
  ENG_Q1, ENG_REST, ENG_REST_SHORT, ENG_TEXT_Q,
} from "./questions";

const isHrSection = (name) => /\bHR\b/i.test(name || "");

/** Onboarding: sections of rating questions, short labels, the open question, and where the HR block starts */
export function onboardingStructure(survey) {
  const t = survey && survey.template;
  if (!t || !Array.isArray(t.questions)) {
    const questions = ONB_SECTIONS.flatMap((s) => s.questions);
    return {
      name: "Onboarding Experience Survey",
      sections: ONB_SECTIONS.map((s) => ({ section: s.section, questions: s.questions.map((text) => ({ text })) })),
      questions, short: ONB_SHORT, textQuestion: ONB_TEXT_Q, hrBlockStart: ONB_HR_BLOCK_START, ratingCount: questions.length, key: "default",
    };
  }
  const rated = t.questions.filter((q) => q.kind === "RATING");
  const sections = [];
  rated.forEach((q) => {
    const name = q.section || "Questions";
    const last = sections[sections.length - 1];
    if (last && last.section === name) last.questions.push(q);
    else sections.push({ section: name, questions: [q] });
  });
  const firstHr = rated.findIndex((q) => isHrSection(q.section));
  return {
    name: t.name || "Onboarding Experience Survey",
    sections,
    questions: rated.map((q) => q.text),
    short: rated.map((q) => q.short || q.text),
    textQuestion: (t.questions.find((q) => q.kind === "TEXT") || {}).text || null,
    hrBlockStart: firstHr < 0 ? rated.length : firstHr,
    ratingCount: rated.length,
    key: String(t.templateId ?? "t"),
  };
}

/** The surveys that share the most common set of questions, so one "average by question" chart can line up */
export function dominantOnboarding(surveys) {
  const groups = new Map();
  surveys.forEach((s) => {
    const st = onboardingStructure(s);
    const g = groups.get(st.key) || { st, surveys: [] };
    g.surveys.push(s);
    groups.set(st.key, g);
  });
  let best = null;
  groups.forEach((g) => { if (!best || g.surveys.length > best.surveys.length) best = g; });
  return best || { st: onboardingStructure(null), surveys: [] };
}

/** Engagement: the monthly question, the other rating questions, and the open question */
export function engagementStructure(survey) {
  if (!survey || !survey.restQuestions) {
    return {
      name: "Employee Engagement Survey", monthlyQuestion: ENG_Q1,
      rest: ENG_REST.map((text, i) => ({ text, short: ENG_REST_SHORT[i] })), textQuestion: ENG_TEXT_Q,
    };
  }
  return {
    name: survey.templateName || "Employee Engagement Survey",
    monthlyQuestion: survey.monthlyQuestion || ENG_Q1,
    rest: survey.restQuestions,
    textQuestion: survey.textQuestion,
  };
}
