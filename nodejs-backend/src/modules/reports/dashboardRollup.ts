/**
 * Company dashboard roll-up — port of Java DashBoardService.getCompanySummary /
 * getELSummaryUsers. Numbers are averages of averages, not one flat AVG():
 *
 *   user (per department)  ->  department  ->  Executive Leader  ->  company
 *
 * Rules carried over from Java:
 *  - a user's FULL_DAY leave days are dropped before averaging
 *  - AvgTargetPercent only counts days / users / departments / leaders whose target is > 0
 *    (a user's days also count when the department is 54)
 *  - utilisation, allocated and worked hours average over everyone, zeros included
 *  - only Executive Leaders with RoleID 3 are rolled up
 *  - levels are the rounded average of High=3 / At Par=2 / Low=1 scores
 *
 * Java does this with several queries per user; here the data is loaded once and rolled up in memory.
 *
 * Not ported (one-off rules in Java): the Apr–Jun 2026 windows for departments 19/22/42 and users
 * 153/154/155/158, and department 23's TAM-account target.
 */
import type mysql from 'mysql2/promise';
import { pool } from '../../config/db';

type Row = mysql.RowDataPacket;

export interface RollupFilter {
  startDate: string;
  endDate: string;
  goalStartDate?: string | null;
  goalEndDate?: string | null;
}

// Goal a user is measured against: an EL-approved revision replaces FixedGoal
const EFFECTIVE_GOAL =
  "CASE WHEN ug.RevisedGoal IS NOT NULL AND ug.RevisedGoal != '' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(ug.RevisedGoal, '$.elApproved')) = 'true' " +
  "THEN CAST(JSON_EXTRACT(ug.RevisedGoal, '$.value') AS DECIMAL(10,2)) " +
  'ELSE ug.FixedGoal END';

// Users whose goal is simply their target % (Java GOAL_EQUALS_TARGET_USERS)
const GOAL_EQUALS_TARGET_USERS = [135, 122, 131, 112, 102, 121, 108];

const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v));
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function levelScore(level: unknown): number {
  switch (String(level ?? '').trim().toLowerCase()) {
    case 'high': return 3;
    case 'at par': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

function scoreToLevel(score: number): string {
  if (score >= 2.5) return 'High';
  if (score >= 1.5) return 'At Par';
  return 'Low';
}

/** Mean of every item; a missing value counts as 0 (Java calculateAverageFromUsers / Departments) */
function meanAll(items: Record<string, unknown>[], key: string): number {
  if (!items.length) return 0;
  return round2(items.reduce((n, i) => n + num(i[key]), 0) / items.length);
}

/** Mean of the items that have a value (Java calculateAverageFromELs) */
function meanPresent(items: Record<string, unknown>[], key: string): number {
  const vals = items.map((i) => i[key]).filter((v) => v != null);
  if (!vals.length) return 0;
  return round2(vals.reduce<number>((n, v) => n + num(v), 0) / vals.length);
}

/** Sum over the items whose target is > 0, divided by how many there are (Java calculateTargetAverage…) */
function meanTarget(items: Record<string, unknown>[]): number {
  let total = 0;
  let count = 0;
  for (const i of items) {
    const v = num(i['AvgTargetPercent']);
    total += v;
    if (v > 0) count++;
  }
  return count ? round2(total / count) : 0;
}

const isFullDay = (leave: unknown) => String(leave ?? '').trim().toUpperCase() === 'FULL_DAY';

export async function computeRollup(filter: RollupFilter, typeCond: (col: string) => string) {
  const { startDate, endDate } = filter;
  const goalStart = filter.goalStartDate || startDate;
  const goalEnd = filter.goalEndDate || endDate;

  const [[effRows], [leaveRows], [deptRows], [userRows], [goalRows], [targetGoalRows]] = await Promise.all([
    pool.query<Row[]>(
      `SELECT e.UserID, e.DepartmentID, DATE_FORMAT(e.WorkDate, '%Y-%m-%d') AS WorkDate,
              e.TargetAchievedPercent, e.UtilizationPercent, e.AllocatedTimeHrs, e.TotalTimeOfWork, e.EfficiencyLevel
       FROM EfficiencyUtilizationSummary e
       WHERE e.DayType = 'Working' AND e.WorkDate BETWEEN ? AND ?${typeCond('e.DepartmentID')}`,
      [startDate, endDate],
    ),
    // The leave type of a user's day is the first work entry that day (Java takes LIMIT 1)
    pool.query<Row[]>(
      `SELECT UserID, DATE_FORMAT(WorkDate, '%Y-%m-%d') AS WorkDate, LeaveType
       FROM UserWorkData WHERE WorkDate BETWEEN ? AND ? ORDER BY DailyTaskLogID`,
      [startDate, endDate],
    ),
    pool.query<Row[]>('SELECT DepartmentID, DepartmentName, ExecutiveLeaderID, FunctionalLeaderID FROM Department'),
    pool.query<Row[]>('SELECT UserID, UserName, RoleID FROM Users'),
    pool.query<Row[]>(
      `SELECT ug.UserID, ug.DepartmentID, DATE_FORMAT(ug.WorkDate, '%Y-%m') AS Month, ug.AchievedGoal, ug.FixedGoal, ${EFFECTIVE_GOAL} AS EffGoal
       FROM UserGoalData ug WHERE ug.WorkDate BETWEEN ? AND ?`,
      [goalStart, goalEnd],
    ),
    // Target % per working day (full-day leave excluded) for the users whose goal is their target
    pool.query<Row[]>(
      `SELECT e.UserID, e.TargetAchievedPercent
       FROM EfficiencyUtilizationSummary e
       WHERE e.UserID IN (?) AND e.DayType = 'Working' AND e.WorkDate BETWEEN ? AND ?
         AND e.WorkDate NOT IN (SELECT uwd.WorkDate FROM UserWorkData uwd WHERE uwd.UserID = e.UserID AND uwd.LeaveType = 'FULL_DAY')`,
      [GOAL_EQUALS_TARGET_USERS, goalStart, goalEnd],
    ),
  ]);

  const leave = new Map<string, unknown>();
  for (const r of leaveRows) {
    const k = `${r['UserID']}|${r['WorkDate']}`;
    if (!leave.has(k)) leave.set(k, r['LeaveType']);
  }
  const deptById = new Map(deptRows.map((d) => [d['DepartmentID'] as number, d]));
  const userById = new Map(userRows.map((u) => [u['UserID'] as number, u]));

  // efficiency rows by "user|department", and the users seen in each department
  const byUserDept = new Map<string, Row[]>();
  const usersInDept = new Map<number, Set<number>>();
  for (const r of effRows) {
    const k = `${r['UserID']}|${r['DepartmentID']}`;
    (byUserDept.get(k) ?? byUserDept.set(k, []).get(k)!).push(r);
    (usersInDept.get(r['DepartmentID']) ?? usersInDept.set(r['DepartmentID'], new Set()).get(r['DepartmentID'])!).add(r['UserID']);
  }

  const goalsByUser = new Map<number, Row[]>();
  for (const g of goalRows) (goalsByUser.get(g['UserID']) ?? goalsByUser.set(g['UserID'], []).get(g['UserID'])!).push(g);

  function userSummary(userId: number, deptId: number) {
    const rows = (byUserDept.get(`${userId}|${deptId}`) ?? []).filter((r) => !isFullDay(leave.get(`${userId}|${r['WorkDate']}`)));
    if (!rows.length) {
      return { AvgTargetPercent: 0, AvgUtilizationPercent: 0, AvgAllocatedHrs: 0, AvgTotalWork: 0, EfficiencyLevel: 'Low' };
    }
    let target = 0, util = 0, allocated = 0, work = 0, targetCount = 0, score = 0;
    for (const r of rows) {
      const t = num(r['TargetAchievedPercent']);
      target += t;
      if (deptId === 54 || t > 0) targetCount++;
      util += num(r['UtilizationPercent']);
      allocated += num(r['AllocatedTimeHrs']);
      work += num(r['TotalTimeOfWork']);
      score += levelScore(r['EfficiencyLevel']);
    }
    const n = rows.length;
    return {
      AvgTargetPercent: targetCount ? round2(target / targetCount) : 0,
      AvgUtilizationPercent: round2(util / n),
      AvgAllocatedHrs: round2(allocated / n),
      AvgTotalWork: round2(work / n),
      EfficiencyLevel: scoreToLevel(score / n),
    };
  }

  const targetGoalByUser = new Map<number, number[]>();
  for (const r of targetGoalRows) (targetGoalByUser.get(r['UserID']) ?? targetGoalByUser.set(r['UserID'], []).get(r['UserID'])!).push(num(r['TargetAchievedPercent']));

  // Department 22 is scored per month: under 40 achieved = 100, then 10 points off per 10 over; months without data count as 0
  function dept22Goal(rows: Row[]): number {
    const monthly = new Map<string, number[]>();
    for (const g of rows) {
      const a = num(g['AchievedGoal']);
      const score = a < 40 ? 100 : Math.max(100 - Math.floor((a - 40) / 10) * 10, 0);
      (monthly.get(g['Month']) ?? monthly.set(g['Month'], []).get(g['Month'])!).push(score);
    }
    let [y, m] = goalStart.split('-').map(Number) as [number, number];
    const [endY, endM] = goalEnd.split('-').map(Number) as [number, number];
    let total = 0;
    let months = 0;
    while (y < endY || (y === endY && m <= endM)) {
      const scores = monthly.get(`${y}-${String(m).padStart(2, '0')}`);
      if (scores) total += round2(scores.reduce((n, v) => n + v, 0) / scores.length);
      months++;
      if (++m > 12) { m = 1; y++; }
    }
    return months ? round2(total / months) : 0;
  }

  function userGoal(userId: number, deptId: number): number {
    if (userId === 90) return 100;
    const rows = goalsByUser.get(userId) ?? [];
    const targets = targetGoalByUser.get(userId);
    if (GOAL_EQUALS_TARGET_USERS.includes(userId)) {
      return targets?.length ? round2(targets.reduce((n, v) => n + v, 0) / targets.length) : 0;
    }
    if (deptId === 22) return dept22Goal(rows.filter((g) => g['DepartmentID'] === 22));
    if (userId === 117) {
      const fixed = rows.reduce((n, g) => n + num(g['FixedGoal']), 0);
      return fixed > 0 ? round2((rows.reduce((n, g) => n + num(g['AchievedGoal']), 0) / fixed) * 100) : 0;
    }
    if (deptId === 21 || deptId === 37) {
      const own = rows.filter((g) => g['DepartmentID'] === deptId);
      const eff = own.reduce((n, g) => n + num(g['EffGoal']), 0);
      return eff > 0 ? round2((own.reduce((n, g) => n + num(g['AchievedGoal']), 0) * 100) / eff) : 0;
    }
    if (!rows.length) return 0;
    const pct = rows.map((g) => {
      if (g['DepartmentID'] === 7) return 100;
      const eff = num(g['EffGoal']);
      return eff === 0 ? 0 : (num(g['AchievedGoal']) / eff) * 100;
    });
    return round2(pct.reduce((n, p) => n + p, 0) / pct.length);
  }

  // Leaders of one kind (Executive: RoleID 3, Functional: RoleID 4) with their departments that have data in the range
  function rollLeaders(leaderField: 'ExecutiveLeaderID' | 'FunctionalLeaderID', roleId: number) {
    const deptIdsByLeader = new Map<number, number[]>();
    for (const deptId of [...usersInDept.keys()].sort((a, b) => a - b)) {
      const leaderId = deptById.get(deptId)?.[leaderField] as number | null | undefined;
      if (!leaderId || userById.get(leaderId)?.['RoleID'] !== roleId) continue;
      (deptIdsByLeader.get(leaderId) ?? deptIdsByLeader.set(leaderId, []).get(leaderId)!).push(deptId);
    }

    return [...deptIdsByLeader.keys()].sort((a, b) => a - b).map((leaderId) => {
      let userCount = 0;
      let score = 0;
      const departments = deptIdsByLeader.get(leaderId)!.map((deptId) => {
        const users = [...usersInDept.get(deptId)!]
          .map((userId) => ({ UserID: userId, UserName: userById.get(userId)?.['UserName'] as string }))
          .sort((a, b) => String(a.UserName).localeCompare(String(b.UserName)))
          .map((u) => ({ ...u, ...userSummary(u.UserID, deptId), AvgGoalEfficiency: userGoal(u.UserID, deptId) }));

        const withTarget = users.filter((u) => u.AvgTargetPercent > 0).length;
        const dept = {
          DepartmentID: deptId,
          DepartmentName: deptById.get(deptId)?.['DepartmentName'] as string,
          AvgTargetPercent: withTarget ? round2(users.reduce((n, u) => n + u.AvgTargetPercent, 0) / withTarget) : 0,
          AvgUtilizationPercent: meanAll(users, 'AvgUtilizationPercent'),
          AvgAllocatedHrs: meanAll(users, 'AvgAllocatedHrs'),
          AvgTotalWork: meanAll(users, 'AvgTotalWork'),
          AvgGoalEfficiency: meanAll(users, 'AvgGoalEfficiency'),
          EfficiencyLevel: scoreToLevel(users.length ? users.reduce((n, u) => n + levelScore(u.EfficiencyLevel), 0) / users.length : 0),
          users,
        };
        userCount += users.length;
        score += levelScore(dept.EfficiencyLevel);
        return dept;
      });

      return {
        id: leaderId,
        name: userById.get(leaderId)?.['UserName'] as string,
        AvgTargetPercent: userCount ? meanTarget(departments) : 0,
        AvgUtilizationPercent: userCount ? meanAll(departments, 'AvgUtilizationPercent') : 0,
        AvgAllocatedHrs: userCount ? meanAll(departments, 'AvgAllocatedHrs') : 0,
        AvgTotalWork: userCount ? meanAll(departments, 'AvgTotalWork') : 0,
        AvgGoalEfficiency: meanAll(departments, 'AvgGoalEfficiency'),
        EfficiencyLevel: scoreToLevel(departments.length ? score / departments.length : 0),
        departments,
      };
    });
  }

  const els = rollLeaders('ExecutiveLeaderID', 3).map(({ id, name, ...rest }) => ({ ELID: id, ELName: name, ...rest }));
  const fls = rollLeaders('FunctionalLeaderID', 4).map(({ id, name, ...rest }) => ({ FLID: id, FLName: name, ...rest }));

  // Company level comes from the flat day rows (leave days excluded), like Java
  const flat = effRows.filter((r) => !isFullDay(leave.get(`${r['UserID']}|${r['WorkDate']}`)));
  const flatScore = flat.length ? flat.reduce((n, r) => n + levelScore(r['EfficiencyLevel']), 0) / flat.length : 0;

  return {
    company: {
      EfficiencyLevel: scoreToLevel(flatScore),
      AvgGoalEfficiency: meanPresent(els, 'AvgGoalEfficiency'),
      AvgTargetPercent: meanTarget(els),
      AvgUtilizationPercent: meanPresent(els, 'AvgUtilizationPercent'),
      AvgAllocatedHrs: meanPresent(els, 'AvgAllocatedHrs'),
      AvgTotalWork: meanPresent(els, 'AvgTotalWork'),
    },
    els,
    fls,
  };
}
