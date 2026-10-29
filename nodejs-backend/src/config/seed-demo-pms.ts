/**
 * Fills the demo quarterly reviews with what the PMS screens show: behavioral ratings, manager feedback,
 * a final grade and the assessors. Safe to run again — it only touches rows that have no manager ratings yet.
 *   npm run db:seed:demo:pms
 */
import type mysql from 'mysql2/promise';
import { pool } from './db';

let state = 11;
const rand = () => ((state = (state * 9301 + 49297) % 233280) / 233280);
const between = (lo: number, hi: number) => Math.round(lo + rand() * (hi - lo));
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;

const DIMENSIONS = ['accountability', 'engagement', 'collaboration', 'innovation', 'communication', 'adaptability'];
const GRADE_LABELS: Record<number, string> = {
  1: 'Critical Concern', 2: 'Unsatisfactory', 3: 'Needs Significant Improvement', 4: 'Needs Improvement',
  5: 'Partially Meets Expectations', 6: 'Approaching Expectations', 7: 'Meets Expectations', 8: 'Exceeds Expectations',
  9: 'Significantly Exceeds Expectations', 10: 'Outstanding',
};
const gradeOf = (pct: number) => (pct >= 100 ? 8 : pct >= 90 ? 7 : pct >= 80 ? 6 : pct >= 70 ? 5 : pct >= 60 ? 4 : pct >= 50 ? 3 : pct >= 40 ? 2 : 1);

const TOPICS: Record<string, [string, string][]> = {
  'Exceeds Expectations': [['Productivity', 'Consistently delivers ahead of plan and helps unblock others.'], ['Quality', 'Work needs almost no rework; reviews are clean.'], ['Ownership', 'Takes full ownership of releases end to end.']],
  'Meets Expectations': [['Productivity', 'Meets expectation on completing the tasks assigned.'], ['Communication', 'Keeps the team updated and raises risks early.'], ['Ownership', 'Follows through on commitments.']],
  'Needs Improvement': [['Quality', 'Needs to further improve on follow-up and attention to detail.'], ['Communication', 'Can improve how progress is shared with stakeholders.'], ['Productivity', 'Needs to be more self-motivated and plan the day better.']],
};

(async () => {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT qr.id, qr.emp_id, qr.target_percent, qr.goal_achievement, rm.UserID AS rmId, rm.UserName AS rmName, el.UserID AS elId, el.UserName AS elName
     FROM quarterlyreview qr JOIN Users u ON u.UserID = qr.emp_id
     LEFT JOIN Users rm ON rm.UserID = u.ReportingManagerID LEFT JOIN Users el ON el.UserID = u.ELManagerID
     WHERE ? OR qr.manager_ratings IS NULL OR qr.manager_ratings = '' OR qr.manager_ratings = 'null'
     ORDER BY qr.id`, [process.argv.includes('--force') ? 1 : 0]);
  // A few different Executive Leaders, so the EL-wise charts have more than one bar
  const [els] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT UserID, UserName FROM Users WHERE RoleID IN (3, 4) AND UserStatus = 1 AND IsUserArchived = 0 ORDER BY UserID LIMIT 4`);
  for (const [i, row] of rows.entries()) {
    const r = row; const el = els.length ? els[i % els.length]! : null;
    if (el) { r['elId'] = el['UserID']; r['elName'] = el['UserName']; }
    const bias = between(-1, 2);
    const ratings: Record<string, unknown> = {};
    const scores: number[] = [];
    for (const d of DIMENSIONS) {
      const a1 = Math.min(9, Math.max(3, between(5, 8) + bias)); const a2 = Math.min(9, Math.max(3, a1 + between(-1, 1)));
      scores.push(a2);
      ratings[d] = { assessor1: a1, assessor2: a2, assessor1Id: r['rmId'] ?? null, assessor2Id: r['elId'] ?? null };
    }
    const mgr = scores.reduce((s, x) => s + x, 0) / scores.length;
    const target = Math.min(100, Number(r['target_percent'] ?? 0)); const goal = Math.min(100, Number(r['goal_achievement'] ?? 0));
    const system = (target * 0.4 + goal * 0.6) / 10;
    const finalRating = Math.round((system * 0.95 + mgr * 0.05) * 100) / 100;
    const pct = finalRating * 10;
    const grade = gradeOf(pct);
    const bucket = pct >= 90 ? 'Exceeds Expectations' : pct >= 75 ? 'Meets Expectations' : 'Needs Improvement';
    const feedback = [pick(TOPICS[bucket]!), pick(TOPICS['Meets Expectations']!), pick(TOPICS[bucket]!)]
      .filter((x, i, a) => a.findIndex((y) => y[0] === x[0]) === i)
      .map(([type, text], i) => ({
        feedbackType: type, feedbackCat: i === 1 ? 'Meets Expectations' : bucket, feedback: text,
        assessor1Name: r['rmName'] ?? null, assessor2Name: r['elName'] ?? null, assessor1Id: r['rmId'] ?? null, assessor2Id: r['elId'] ?? null,
      }));
    await pool.query(
      `UPDATE quarterlyreview SET manager_ratings = ?, feedback = ?, grade = ?, manager_avg_rating = ?, final_rating = ?, system_grade = ? WHERE id = ?`,
      [JSON.stringify(ratings), JSON.stringify(feedback),
        JSON.stringify([{ finalGrade: grade, finalGradeLabel: GRADE_LABELS[grade], goalWeight: 60, targetWeight: 40, starRating: pct >= 100 ? 1 : 0 }]),
        mgr.toFixed(2), finalRating, Math.max(1, Math.min(10, Math.round(system))), r['id']]);
  }
  console.log(`  ✓ Filled ${rows.length} quarterly reviews with ratings, feedback and grades`);
  await pool.end();
})();
