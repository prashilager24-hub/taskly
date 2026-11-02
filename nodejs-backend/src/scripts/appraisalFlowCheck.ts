// End-to-end check of the appraisal flow v2 on a temporary department and people (all deleted at the end): npx tsx src/scripts/appraisalFlowCheck.ts
import type mysql from 'mysql2/promise';
import { pool } from '../config/db';
import * as svc from '../modules/appraisal/appraisal.service';
import * as flow from '../modules/appraisal/appraisal.flow';
import { periodOf, todayIST, addDays } from '../modules/appraisal/appraisal.calc';

type Row = mysql.RowDataPacket;
const DEPT = 'E2E Flow v2 (temporary)';
const ids: Record<string, number> = {};
let deptId = 0;
const extraDepts: number[] = [];
let failures = 0;
const ok = (cond: unknown, what: string) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${what}`); if (!cond) failures++; };
const throws = async (fn: () => Promise<unknown>, what: string) => { try { await fn(); ok(false, what); } catch (e) { ok(true, `${what} (${(e as Error).message})`); } };

async function user(key: string, role: number) {
  const [r] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO Users (UserEmail, UserName, UserPassword, RoleID, UserStatus, IsUserArchived, UserCreateTime, UserModifyTime, UserPasswordExpiryDate)
     VALUES (?, ?, 'x', ?, 1, 0, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR))`, [`e2e.v2.${key}@tapmind.test`, `E2E ${key}`, role]);
  ids[key] = r.insertId;
}

async function cleanup() {
  const all = Object.values(ids);
  if (all.length) {
    for (const u of all) await pool.execute("DELETE n FROM Notification n WHERE JSON_CONTAINS(n.Audience, CAST(? AS JSON), '$.users')", [u]);
    await pool.query('DELETE FROM AppraisalAudit WHERE CycleID IN (SELECT CycleID FROM AppraisalCycle WHERE UserID IN (?))', [all]);
    await pool.query('DELETE FROM AppraisalCycle WHERE UserID IN (?)', [all]);
  }
  await pool.execute('DELETE FROM Notification WHERE Title LIKE ?', [`${DEPT}%`]);
  await pool.execute('DELETE FROM Notification WHERE Title LIKE ?', ['E2E edits%']);
  for (const id of [deptId, ...extraDepts].filter(Boolean)) {
    await pool.execute('DELETE FROM AppraisalRound WHERE DepartmentID = ?', [id]);
    await pool.execute('DELETE FROM DepartmentUser WHERE DepartmentID = ?', [id]);
    await pool.execute('DELETE FROM Department WHERE DepartmentID = ?', [id]);
  }
  if (all.length) await pool.query('DELETE FROM Users WHERE UserID IN (?)', [all]);
}

async function main() {
  await user('el', 3); await user('fl', 4); await user('a1', 2); await user('a2', 5); await user('d1', 2);
  await pool.execute('UPDATE Users SET ELManagerID = ? WHERE UserID = ?', [ids.el, ids.fl]);
  for (const k of ['a1', 'a2']) await pool.execute('UPDATE Users SET ReportingManagerID = ?, ELManagerID = ? WHERE UserID = ?', [ids.fl, ids.el, ids[k]]);
  await pool.execute('UPDATE Users SET ReportingManagerID = ?, ELManagerID = ? WHERE UserID = ?', [ids.el, ids.el, ids.d1]);
  const [d] = await pool.execute<mysql.ResultSetHeader>('INSERT INTO Department (DepartmentName, ExecutiveLeaderID, DepartmentStatus, IsDepartmentArchived) VALUES (?, ?, 1, 0)', [DEPT, ids.el]);
  deptId = d.insertId;
  for (const k of ['fl', 'a1', 'a2', 'd1']) await pool.execute('INSERT INTO DepartmentUser (DepartmentID, UserID) VALUES (?, ?)', [deptId, ids[k]]);
  const period = periodOf(todayIST());

  // 1. everyone opens My Appraisal (testing mode starts the cycle) and appeals
  const cyc: Record<string, number> = {};
  for (const k of ['el', 'fl', 'a1', 'a2', 'd1']) { const v = await svc.myCycle(ids[k], 2); cyc[k] = v!.cycle.id; }
  const r0 = await flow.loadRound(pool, deptId, period);
  ok(r0.people.length === 5 && r0.status === 'COLLECTING', `5 appraisals in the round, collecting (${r0.status})`);
  ok(r0.people.find((p) => p.userId === ids.el)?.source === 'EL_OWN', 'EL is EL_OWN');
  ok(r0.people.find((p) => p.userId === ids.fl)?.source === 'FL_OWN', 'FL is FL_OWN');
  ok(r0.people.find((p) => p.userId === ids.a1)?.source === 'FL_TEAM', 'Associate under FL is FL_TEAM');
  ok(r0.people.find((p) => p.userId === ids.d1)?.source === 'EL_DIRECT', 'Associate reporting to EL is EL_DIRECT');
  const amounts: Record<string, [number, number]> = { el: [300000, 250000], fl: [150000, 120000], a1: [120000, 90000], a2: [60000, 50000], d1: [80000, 60000] };
  for (const k of ['el', 'fl', 'a2']) await svc.saveSelfReview(cyc[k], ids[k], { answers: { whyExpectThisSalary: `why ${k}` }, quarters: [], expectedHike: amounts[k][0], targetHike: amounts[k][1], submit: true });
  // a1 sets their own variable pay: 25% on the expected hike, ₹5,000 on the target
  await throws(() => svc.saveSelfReview(cyc.a1, ids.a1, { answers: {}, quarters: [], expectedHike: 120000, targetHike: 90000, targetVariable: { mode: 'AMOUNT', value: 95000 }, submit: false }), 'variable pay above the hike is refused');
  await svc.saveSelfReview(cyc.a1, ids.a1, { answers: { whyExpectThisSalary: 'why a1' }, quarters: [], expectedHike: 120000, targetHike: 90000, expectedVariable: { mode: 'PCT', value: 25 }, targetVariable: { mode: 'AMOUNT', value: 5000 }, submit: true });
  const a1x = await svc.myCycle(ids.a1, 2);
  ok(a1x!.expected?.variable === 30000 && a1x!.expected?.fixed === 90000 && a1x!.expected?.override === 'PCT', `own variable 25%: fixed 90000 + variable 30000 (${a1x!.expected?.fixed} + ${a1x!.expected?.variable})`);
  ok(a1x!.target?.variable === 5000 && a1x!.target?.fixed === 85000 && a1x!.target?.variablePct === 6 && a1x!.target?.override === 'AMOUNT', 'own variable ₹5,000: fixed 85000, 6%');
  ok((await flow.loadRound(pool, deptId, period)).status === 'COLLECTING', 'still collecting with 4 of 5');
  await svc.saveSelfReview(cyc.d1, ids.d1, { answers: { whyExpectThisSalary: 'why d1' }, quarters: [], expectedHike: 80000, targetHike: 60000, submit: true });
  const r1 = await flow.loadRound(pool, deptId, period);
  ok(r1.status === 'READY_FOR_FINANCE' && r1.totals.expected === 710000, `ready for Finance, total expected ${r1.totals.expected}`);
  const [nf] = await pool.execute<Row[]>('SELECT 1 FROM Notification WHERE Title = ?', [`${DEPT} is ready for its budget`]);
  ok(nf.length === 1, 'Finance Head notified once');
  ok((await svc.myCycle(ids.a1, 2))!.stage === 'BUDGET_REVIEW', 'associate stage: Budget being set');
  const row = (await flow.board(period)).find((b) => b.departmentId === deptId);
  ok(row?.status === 'READY_FOR_FINANCE' && row.submitted === 5, 'board row ready, 5 of 5');

  // 2. Finance Head sets the budget with a reason
  await throws(() => flow.setBudget(141, deptId, period, 500000, ' '), 'budget without a reason is refused');
  await flow.setBudget(141, deptId, period, 500000, 'Good year');
  ok((await flow.loadRound(pool, deptId, period)).status === 'BUDGET_WITH_EL', 'budget with the EL');

  // 2b. the EL negotiates, the Finance Head revises, the EL accepts; nothing can be split before that
  await throws(() => flow.saveSplit(ids.el, 3, deptId, period, { send: false }), 'split before accepting is refused');
  await throws(() => flow.respondBudget(ids.el, 3, deptId, period, { accept: false, comment: ' ' }), 'negotiating without a comment is refused');
  await throws(() => flow.respondBudget(ids.fl, 4, deptId, period, { accept: true }), 'only the EL answers the budget');
  await flow.respondBudget(ids.el, 3, deptId, period, { accept: false, comment: 'Team grew this year', amount: 650000 });
  ok((await flow.loadRound(pool, deptId, period)).status === 'BUDGET_NEGOTIATION', 'EL negotiating');
  ok((await svc.availability(141, svc.FINANCE_HEAD_ROLE)).departments.pending >= 1, 'Finance Head has it to answer');
  ok((await svc.myCycle(ids.a1, 2))!.stage === 'BUDGET_REVIEW', 'associate stage stays: budget being set');
  await throws(() => flow.respondBudget(ids.el, 3, deptId, period, { accept: true }), 'EL cannot accept while waiting for the Finance Head');
  await flow.setBudget(141, deptId, period, 600000, 'Meet in the middle');
  await flow.respondBudget(ids.el, 3, deptId, period, { accept: true, comment: 'Agreed' });
  const rn = await flow.loadRound(pool, deptId, period);
  ok(rn.status === 'BUDGET_ACCEPTED' && rn.budget === 600000 && !!rn.elAcceptedAt, 'EL accepted 600000');
  ok(rn.budgetLog.map((l) => l.action).join(',') === 'PROPOSED,NEGOTIATE,REVISED,ACCEPTED' && rn.budgetLog[1].amount === 650000 && rn.budgetLog[1].comment === 'Team grew this year', 'every step logged with its comment');
  await throws(() => flow.setBudget(141, deptId, period, 700000, 'more'), 'Finance cannot change an accepted budget');

  // 3. EL splits
  await throws(() => flow.saveSplit(ids.fl, 4, deptId, period, { send: false }), 'only the EL can split');
  await throws(() => flow.saveSplit(ids.el, 3, deptId, period, { own: { amount: 300000 }, shares: [{ flUserId: ids.fl, amount: 400000 }], send: false }), 'over budget is refused');
  await flow.saveSplit(ids.el, 3, deptId, period, { own: { amount: 120000, comment: 'Agreed with the CEO' }, direct: [{ cycleId: cyc.d1, amount: 50000, reason: 'Ran hiring' }], shares: [{ flUserId: ids.fl, amount: 300000, comment: 'Reward a1' }], send: true });
  const r2 = await flow.loadRound(pool, deptId, period);
  ok(r2.status === 'SHARES_WITH_FLS', 'shares with FLs');
  ok(r2.people.find((p) => p.userId === ids.el)?.status === 'OFFERED' && r2.people.find((p) => p.userId === ids.d1)?.status === 'OFFERED', 'EL own and direct report offered');
  ok((await svc.myCycle(ids.a1, 2))!.stage === 'IN_ALLOCATION', 'associate stage: Hike being decided');

  // 4. FL allocates
  const fs = await flow.flShares(ids.fl);
  ok(fs.length === 1 && fs[0].share.amount === 300000 && fs[0].people.length === 3, 'FL sees the share and 3 people (2 team + own)');
  await throws(() => flow.saveAllocation(ids.fl, deptId, period, { items: [{ cycleId: cyc.a1, amount: 250000 }, { cycleId: cyc.a2, amount: 100000 }], submit: false }), 'FL over share is refused');
  await throws(() => flow.saveAllocation(ids.fl, deptId, period, { items: [{ cycleId: cyc.a1, amount: 110000 }], submit: true, justification: 'x' }), 'submit with someone missing is refused');
  await flow.saveAllocation(ids.fl, deptId, period, { items: [{ cycleId: cyc.a1, amount: 110000, reason: 'Led release' }, { cycleId: cyc.a2, amount: 60000, reason: 'Good start' }, { cycleId: cyc.fl, amount: 120000 }], justification: 'Top performer first', submit: true });
  ok((await svc.myCycle(ids.a1, 2))!.stage === 'AWAITING_EL', 'associate stage: Waiting for EL approval');
  await throws(() => flow.saveAllocation(ids.fl, deptId, period, { items: [], submit: false }), 'FL cannot edit after submitting');

  // 4b. "Revise proposal": the EL sends it back; the FL's hikes are cleared and the same share is allocated again
  await throws(() => flow.reviseShare(ids.fl, 4, deptId, period, ids.fl, 'x'), 'only the EL sends a proposal back');
  await flow.reviseShare(ids.el, 3, deptId, period, ids.fl, 'Give a2 more');
  const rv = await flow.loadRound(pool, deptId, period);
  const rvs = rv.shares.find((s) => s.flUserId === ids.fl)!;
  ok(rvs.status === 'SHARE_RECEIVED' && rvs.returnComment === 'Give a2 more' && !!rvs.returnedAt && rvs.amount === 300000, 'proposal back with the FL, with the note, same share');
  ok(rv.people.filter((p) => p.flUserId === ids.fl).every((p) => p.allocation == null), "the FL's and the team's hikes are cleared");
  await flow.saveAllocation(ids.fl, deptId, period, { items: [{ cycleId: cyc.a1, amount: 110000, reason: 'Led release' }, { cycleId: cyc.a2, amount: 60000, reason: 'More now' }, { cycleId: cyc.fl, amount: 120000 }], justification: 'Revised', submit: true });

  // 4c. "Reset budget": back to the Finance Head's budget. d1 accepted first: that stays; the EL's own offer is withdrawn
  await svc.respond(cyc.d1, ids.d1, { decision: 'ACCEPT' });
  await throws(() => flow.resetSplit(ids.el, 3, deptId, period, ' '), 'reset without a reason is refused');
  await flow.resetSplit(ids.el, 3, deptId, period, 'Start again with the CEO');
  const rr = await flow.loadRound(pool, deptId, period);
  ok(rr.status === 'BUDGET_WITH_EL' && !rr.elAcceptedAt && !rr.elSentAt && rr.budget === 600000, 'reset: the 600000 budget waits for the EL again');
  ok(rr.budgetLog.at(-1)?.action === 'RESET' && rr.budgetLog.at(-1)?.comment === 'Start again with the CEO', 'reset logged with its reason');
  ok(rr.people.find((p) => p.userId === ids.el)?.status === 'SUBMITTED' && rr.people.find((p) => p.userId === ids.el)?.allocation == null, "EL's own offer withdrawn");
  ok(rr.people.find((p) => p.userId === ids.d1)?.status === 'ACCEPTED' && rr.people.find((p) => p.userId === ids.d1)?.allocation === 50000, 'accepted hike stays');
  ok(rr.shares.every((s) => s.status === 'PLANNED' && !s.amount) && rr.people.filter((p) => p.flUserId === ids.fl).every((p) => p.allocation == null), 'shares and FL proposals cleared');
  ok((await svc.myCycle(ids.a1, 2))!.stage === 'BUDGET_REVIEW', 'associate back to: in progress');
  await throws(() => flow.saveSplit(ids.el, 3, deptId, period, { send: false }), 'split again only after accepting again');
  await flow.respondBudget(ids.el, 3, deptId, period, { accept: true });
  await throws(() => flow.saveSplit(ids.el, 3, deptId, period, { direct: [{ cycleId: cyc.d1, amount: 1 }], send: false }), 'an accepted hike cannot be changed');
  await throws(() => flow.saveSplit(ids.el, 3, deptId, period, { own: { amount: 120000, variable: { mode: 'AMOUNT', value: 130000 } }, send: false }), 'EL variable above the hike is refused');
  // the EL's own hike with 40% variable; everything left goes to the FL
  await flow.saveSplit(ids.el, 3, deptId, period, { own: { amount: 120000, comment: 'Agreed with the CEO', variable: { mode: 'PCT', value: 40 } }, shares: [{ flUserId: ids.fl, amount: 430000, comment: 'The rest' }], send: true });
  const elOffer = await svc.myCycle(ids.el, 3);
  ok(elOffer!.cycle.status === 'OFFERED' && elOffer!.approved?.variable === 48000 && elOffer!.approved?.fixed === 72000 && elOffer!.approved?.override === 'PCT', 'EL offered 120000 with 40% variable');
  // the FL sets a2's variable pay themselves
  await throws(() => flow.saveAllocation(ids.fl, deptId, period, { items: [{ cycleId: cyc.a2, amount: 60000, variable: { mode: 'AMOUNT', value: 70000 } }], submit: false }), 'FL variable above the hike is refused');
  await flow.saveAllocation(ids.fl, deptId, period, { items: [{ cycleId: cyc.a1, amount: 110000, reason: 'Led release' }, { cycleId: cyc.a2, amount: 60000, reason: 'More now', variable: { mode: 'AMOUNT', value: 15000 } }, { cycleId: cyc.fl, amount: 120000 }], justification: 'Final', submit: true });

  // 5. EL approves
  await flow.approveShare(ids.el, 3, deptId, period, ids.fl);
  const r3 = await flow.loadRound(pool, deptId, period);
  ok(r3.status === 'FINALISED', 'round finalised');
  const a1r = r3.people.find((p) => p.userId === ids.a1)!;
  ok(a1r.approved === 110000 && a1r.approvedFixed === 99000 && a1r.approvedVariable === 11000, 'approved hike has its fixed and variable');
  const a2r = r3.people.find((p) => p.userId === ids.a2)!;
  ok(a2r.approvedVariable === 15000 && a2r.approvedFixed === 45000 && a2r.variable?.mode === 'AMOUNT', "FL's variable override reaches a2's offer");
  const a1v = await svc.myCycle(ids.a1, 2);
  ok(a1v!.cycle.status === 'OFFERED' && a1v!.approved?.annual === 110000 && a1v!.can.reject, 'associate offered 110000 and may reject');
  const flv = await svc.myCycle(ids.fl, 4);
  ok(flv!.approved?.annual === 120000 && !flv!.can.reject, 'FL offered 120000 and may not reject');
  const elView = await svc.cycleFor(cyc.a1, ids.el, 3) as { reason?: string };
  const a1Self = await svc.cycleFor(cyc.a1, ids.a1, 2) as { reason?: string };
  ok(elView.reason === 'Led release' && a1Self.reason === undefined, 'EL sees the reason, the associate does not');

  // 6. requests: associate -> FL -> EL; FL -> EL
  await throws(() => svc.respond(cyc.fl, ids.fl, { decision: 'REJECT', postponeMonths: 3, reason: 'r', expectations: 'e' }), 'FL reject is refused');
  await svc.respond(cyc.a1, ids.a1, { decision: 'ACCEPT', request: { newDesignation: 'Senior Engineer', designationComment: 'Owns the service' } });
  ok((await svc.myCycle(ids.a1, 2))!.requests[0]?.stage === 'WITH_FL', 'associate request is with the FL');
  await throws(() => svc.decideRequests(cyc.a1, ids.el, 3, { designation: { decision: 'APPROVED' } }), 'EL cannot decide before the FL forwards');
  ok((await svc.requestsInbox(ids.fl, 4)).some((r) => r.cycleId === cyc.a1 && r.can.forward), 'FL inbox has it to forward');
  await svc.forwardRequests(cyc.a1, ids.fl, 4, { comment: 'Deserves it', recommend: true });
  ok((await svc.requestsInbox(ids.el, 3)).some((r) => r.cycleId === cyc.a1 && r.can.decide), 'EL inbox has it to decide');
  await svc.decideRequests(cyc.a1, ids.el, 3, { designation: { decision: 'APPROVED', comment: 'Well done' } });
  const a1done = await svc.myCycle(ids.a1, 2);
  ok(a1done!.requests[0]?.stage === 'APPROVED' && !('fl' in a1done!.requests[0]!), 'approved, and the associate sees no FL comment');
  await svc.respond(cyc.fl, ids.fl, { decision: 'ACCEPT', request: { newTeam: 'Platform', teamComment: 'Fit' } });
  ok((await svc.myCycle(ids.fl, 4))!.requests[0]?.stage === 'WITH_EL', 'FL request goes straight to the EL');
  await svc.decideRequests(cyc.fl, ids.el, 3, { team: { decision: 'REJECTED' } });
  ok((await svc.myCycle(ids.fl, 4))!.requests[0]?.stage === 'NOT_APPROVED', 'FL request not approved');
  await svc.respond(cyc.el, ids.el, { decision: 'ACCEPT', request: { newDesignation: 'CTO', designationComment: 'Agreed with the CEO' } });
  const elDone = await svc.myCycle(ids.el, 3);
  ok(elDone!.requests[0]?.stage === 'APPROVED' && elDone!.requests[0]?.value === 'CTO', 'EL adds their own change: recorded as approved');

  // 7. associate rejects, the hike comes back to the FL after the months, FL re-proposes, EL approves
  await svc.respond(cyc.a2, ids.a2, { decision: 'REJECT', postponeMonths: 3, reason: 'Too low', expectations: '80k' });
  ok((await svc.myCycle(ids.a2, 5))!.cycle.status === 'POSTPONED', 'intern postponed');
  await flow.returnPostponed(addDays(todayIST(), 100));
  const r4 = await flow.loadRound(pool, deptId, period);
  ok(r4.shares[0]?.status === 'DRAFT' && r4.people.find((p) => p.userId === ids.a2)?.status === 'SUBMITTED', 'back with the FL as a draft');
  await flow.saveAllocation(ids.fl, deptId, period, { items: [{ cycleId: cyc.a2, amount: 70000, reason: 'Revised' }], submit: true });
  await flow.approveShare(ids.el, 3, deptId, period, ids.fl);
  const a2v = await svc.myCycle(ids.a2, 5);
  ok(a2v!.cycle.status === 'OFFERED' && a2v!.approved?.annual === 70000, 'intern offered the revised 70000');
  ok((await svc.myCycle(ids.a1, 2))!.cycle.status === 'ACCEPTED', 'already-accepted associate untouched by the re-approval');

  // 8. menus
  const avEl = await svc.availability(ids.el, 3);
  const avFl = await svc.availability(ids.fl, 4);
  ok(avEl.split.show && avEl.requests.show && !avEl.departments.show, 'EL menus: split, requests');
  ok(avFl.allocation.show && avFl.requests.show && !avFl.split.show, 'FL menus: allocation, requests');
  ok(!avEl.allocation.show, 'an EL has no Team Allocation');
  const avOv = await svc.availability(ids.d1, svc.OVERVIEW_ROLE);
  ok(avOv.overview.show && !avOv.my.show && !avOv.departments.show, 'Super Administrator: Overview only');
  ok(!(await svc.availability(ids.d1, 2)).overview.show && (await svc.availability(141, svc.FINANCE_HEAD_ROLE)).overview.show && (await svc.availability(1, 1)).overview.show, 'Overview: Admin and Finance Head too, nobody else');
  const ov = await flow.overview(period);
  const ovr = ov.rounds.find((r) => r.departmentId === deptId);
  ok(!!ov.rows.find((r) => r.departmentId === deptId) && ovr?.status === 'FINALISED' && ovr.people.length === 5, 'overview has the department and its split');
  ok((await flow.flShares(ids.fl))[0]!.people.filter((p) => !p.own).every((p) => p.currentAnnualCtc == null), "FL does not see the team's CTC");

  await edits(period);
}

const dept = async (name: string, el: number, members: number[]) => {
  const [d] = await pool.execute<mysql.ResultSetHeader>('INSERT INTO Department (DepartmentName, ExecutiveLeaderID, DepartmentStatus, IsDepartmentArchived) VALUES (?, ?, 1, 0)', [name, el]);
  extraDepts.push(d.insertId);
  for (const m of members) await pool.execute('INSERT INTO DepartmentUser (DepartmentID, UserID) VALUES (?, ?)', [d.insertId, m]);
  return d.insertId;
};
const cycleRow = async (userId: number) => (await pool.execute<Row[]>('SELECT * FROM AppraisalCycle WHERE UserID = ?', [userId]))[0][0]!;

// 9. Admin / HR edit departments and user records while appraisals are open: the appraisal follows until the budget is set
async function edits(period: string) {
  await user('el2', 3); await user('fl2', 4); await user('m1', 2); await user('el3', 3);
  await pool.execute('UPDATE Users SET ELManagerID = ? WHERE UserID = ?', [ids.el2, ids.fl2]);
  await pool.execute('UPDATE Users SET ReportingManagerID = ?, ELManagerID = ? WHERE UserID = ?', [ids.fl2, ids.el2, ids.m1]);
  const B = await dept('E2E edits B', ids.el2, [ids.el2, ids.fl2, ids.m1]);
  const C = await dept('E2E edits C', ids.el3, [ids.el3]);
  // el3 is also a member of B (lower id) but leads C: their own appraisal belongs in C
  await pool.execute('INSERT INTO DepartmentUser (DepartmentID, UserID) VALUES (?, ?)', [B, ids.el3]);
  const cy: Record<string, number> = {};
  for (const k of ['el2', 'fl2', 'm1', 'el3']) cy[k] = (await svc.myCycle(ids[k], 2))!.cycle.id;
  ok((await cycleRow(ids.el3))['DepartmentID'] === C, 'member of two departments: an EL lands in the one they lead');
  ok((await cycleRow(ids.m1))['DepartmentID'] === B && (await cycleRow(ids.m1))['Assessor1UserID'] === ids.fl2, 'm1 in B under fl2');
  for (const k of ['el2', 'fl2', 'm1']) await svc.saveSelfReview(cy[k], ids[k], { answers: { whyExpectThisSalary: 'x' }, quarters: [], expectedHike: 10000, targetHike: 9000, submit: true });
  await pool.execute('DELETE FROM DepartmentUser WHERE DepartmentID = ? AND UserID = ?', [B, ids.el3]);
  await svc.syncOpenCycles(true);
  ok((await flow.loadRound(pool, B, period)).status === 'READY_FOR_FINANCE', 'B ready with its 3 appeals');

  // Admin moves m1 from B to C and makes el3 their manager
  await pool.execute('UPDATE DepartmentUser SET DepartmentID = ? WHERE DepartmentID = ? AND UserID = ?', [C, B, ids.m1]);
  await pool.execute('UPDATE Users SET ReportingManagerID = ?, ELManagerID = ? WHERE UserID = ?', [ids.el3, ids.el3, ids.m1]);
  await svc.syncOpenCycles(true);
  const m1 = await cycleRow(ids.m1);
  ok(m1['DepartmentID'] === C && m1['Assessor1UserID'] === ids.el3, 'moved: m1 is now in C under el3');
  const rB = await flow.loadRound(pool, B, period);
  const rC = await flow.loadRound(pool, C, period);
  ok(rB.people.length === 2 && rB.status === 'READY_FOR_FINANCE', 'B: 2 people left, still ready');
  ok(rC.people.find((p) => p.userId === ids.m1)?.source === 'EL_DIRECT' && rC.status === 'COLLECTING', 'C: m1 reports to the EL directly; el3 has not appealed, so collecting');
  ok((await flow.board(period)).filter((b) => b.departmentId === C)[0]?.people === 2, 'board counts 2 in C');

  // HR changes m1's level and CTC (Appraisal Setup) after they appealed
  await pool.execute("UPDATE Users SET EmployeeLevel = 'MANAGER', CurrentAnnualCtc = 900000 WHERE UserID = ?", [ids.m1]);
  await svc.syncOpenCycles(true);
  const m1b = await cycleRow(ids.m1);
  ok(m1b['EmployeeLevel'] === 'MANAGER' && m1b['VariablePct'] === 20 && Number(m1b['CurrentAnnualCtc']) === 900000, 'level and CTC follow the user record');
  const [hk] = await pool.execute<Row[]>("SELECT VariablePct FROM AppraisalHike WHERE CycleID = ? AND Kind = 'EXPECTED'", [cy.m1]);
  ok(hk[0]?.['VariablePct'] === 20, 'typed hike split follows the new level');

  // el3 appeals: C becomes ready
  await svc.saveSelfReview(cy.el3, ids.el3, { answers: { whyExpectThisSalary: 'x' }, quarters: [], expectedHike: 10000, targetHike: 9000, submit: true });
  ok((await flow.loadRound(pool, C, period)).status === 'READY_FOR_FINANCE', 'C ready once el3 appeals');

  // Budget set on B: B is frozen. Moving fl2 out of B no longer moves their appraisal
  await flow.setBudget(141, B, period, 100000, 'E2E');
  await flow.respondBudget(ids.el2, 3, B, period, { accept: true });
  await pool.execute('UPDATE DepartmentUser SET DepartmentID = ? WHERE DepartmentID = ? AND UserID = ?', [C, B, ids.fl2]);
  await svc.syncOpenCycles(true);
  ok((await cycleRow(ids.fl2))['DepartmentID'] === B, 'after the budget is set, a department move does not move the appraisal');

  // An inactive EL counts as none
  await pool.execute('UPDATE Users SET UserStatus = 0 WHERE UserID = ?', [ids.el3]);
  ok((await flow.loadRound(pool, C, period)).el === null, 'inactive EL counts as no EL');
  ok((await flow.board(period)).find((b) => b.departmentId === C)?.el === null, 'board shows C without an EL, still listed');
  await throws(() => flow.setBudget(141, C, period, 1000, 'x'), 'no budget for a department without an EL');
  await pool.execute('UPDATE Users SET UserStatus = 1 WHERE UserID = ?', [ids.el3]);
}

main()
  .catch((e) => { console.error('ERROR', e); failures++; })
  .finally(async () => { await cleanup(); console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED'); await pool.end(); });
