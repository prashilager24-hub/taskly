/* Score helpers shared by every module */

export const avg = (nums) =>
  nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;

export const one = (n) => Number(n).toFixed(1);

export const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/* Onboarding — answers is a flat array of 7 ratings */
export const surveyScore = (s) => (s.answers.length ? avg(s.answers) : null);

/* Query support survey — ratings is a flat array of 6 */
export const queryScore = (q) =>
  q.ratings && q.ratings.length ? avg(q.ratings) : null;

/* Engagement — a response holds 3 month ratings plus 2 further ratings */
export const respValues = (r) => [...r.months, ...r.rest];
export const engAvg = (e) => avg(e.responses.flatMap(respValues));
