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
  if (deptId) {
    await pool.execute('DELETE FROM AppraisalRound WHERE DepartmentID = ?', [deptId]);
    await pool.execute('DELETE FROM DepartmentUser WHERE DepartmentID = ?', [deptId]);
    await pool.execute('DELETE FROM Department WHERE DepartmentID = ?', [deptId]);
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
  for (const k of ['el', 'fl', 'a1', 'a2']) await svc.saveSelfReview(cyc[k], ids[k], { answers: { whyExpectThisSalary: `why ${k}` }, quarters: [], expectedHike: amounts[k][0], targetHike: amounts[k][1], submit: true });
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

  // 3. EL splits
  await throws(() => flow.saveSplit(ids.fl, 4, deptId, period, { send: false }), 'only the EL can split');
  await throws(() => flow.saveSplit(ids.el, 3, deptId, period, { own: { amount: 200000 }, shares: [{ flUserId: ids.fl, amount: 400000 }], send: false }), 'over budget is refused');
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

  // 5. EL approves
  await flow.approveShare(ids.el, 3, deptId, period, ids.fl);
  const r3 = await flow.loadRound(pool, deptId, period);
  ok(r3.status === 'FINALISED', 'round finalised');
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
  await throws(() => svc.respond(cyc.el, ids.el, { decision: 'ACCEPT', request: { newDesignation: 'CTO' } }), 'EL change request is refused');
  await svc.respond(cyc.el, ids.el, { decision: 'ACCEPT' });

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
  await svc.respond(cyc.d1, ids.d1, { decision: 'ACCEPT' });

  // 8. menus
  const avEl = await svc.availability(ids.el, 3);
  const avFl = await svc.availability(ids.fl, 4);
  ok(avEl.split.show && avEl.requests.show && !avEl.departments.show, 'EL menus: split, requests');
  ok(avFl.allocation.show && avFl.requests.show && !avFl.split.show, 'FL menus: allocation, requests');
}

main()
  .catch((e) => { console.error('ERROR', e); failures++; })
  .finally(async () => { await cleanup(); console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED'); await pool.end(); });
