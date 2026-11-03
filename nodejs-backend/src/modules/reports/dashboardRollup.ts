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
import { EFFECTIVE_GOAL, calculateGoal, calculateTarget, calculateEfficiency, calculateUtilization, loadGoalContexts, EMPTY_USER_GOAL_CONTEXT } from '../calculations/calculationLogic';

export { EFFECTIVE_GOAL };

type Row = mysql.RowDataPacket;

export interface RollupFilter {
  startDate: string;
  endDate: string;
  goalStartDate?: string | null;
  goalEndDate?: string | null;
}

export const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v));
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

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

export const isFullDay = (leave: unknown) => String(leave ?? '').trim().toUpperCase() === 'FULL_DAY';

export async function computeRollup(filter: RollupFilter, typeCond: (col: string) => string) {
  const { startDate, endDate } = filter;
  const goalStart = filter.goalStartDate || startDate;
  const goalEnd = filter.goalEndDate || endDate;

  const [[effRows], [leaveRows], [deptRows], [userRows], goalContexts] = await Promise.all([
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
    loadGoalContexts(null, goalStart, goalEnd),
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

  function userSummary(userId: number, deptId: number) {
    const rows = (byUserDept.get(`${userId}|${deptId}`) ?? []).filter((r) => !isFullDay(leave.get(`${userId}|${r['WorkDate']}`)));
    if (!rows.length) {
      return { AvgTargetPercent: 0, AvgUtilizationPercent: 0, AvgAllocatedHrs: 0, AvgTotalWork: 0, EfficiencyLevel: 'Low' };
    }
    let allocated = 0, work = 0, score = 0;
    for (const r of rows) {
      allocated += num(r['AllocatedTimeHrs']);
      work += num(r['TotalTimeOfWork']);
      score += calculateEfficiency({ kind: 'levelScore', level: r['EfficiencyLevel'] });
    }
    const n = rows.length;
    return {
      AvgTargetPercent: calculateTarget({ kind: 'dayAverage', rows: rows.map((r) => ({ TargetAchievedPercent: r['TargetAchievedPercent'], DepartmentID: deptId })) }),
      AvgUtilizationPercent: calculateUtilization({ kind: 'average', values: rows.map((r) => r['UtilizationPercent']) }),
      AvgAllocatedHrs: round2(allocated / n),
      AvgTotalWork: round2(work / n),
      EfficiencyLevel: calculateEfficiency({ kind: 'scoreLevel', score: score / n }),
    };
  }

  // The goal % of a user is worked out in the calculation logic
  const userGoal = (userId: number, deptId: number) =>
    calculateGoal({ kind: 'user', userId, departmentId: deptId, from: goalStart, to: goalEnd, context: goalContexts.get(userId) ?? EMPTY_USER_GOAL_CONTEXT });

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

        const dept = {
          DepartmentID: deptId,
          DepartmentName: deptById.get(deptId)?.['DepartmentName'] as string,
          AvgTargetPercent: calculateTarget({ kind: 'groupAverage', values: users.map((u) => u.AvgTargetPercent) }),
          AvgUtilizationPercent: calculateUtilization({ kind: 'average', values: users.map((u) => u['AvgUtilizationPercent']) }),
          AvgAllocatedHrs: meanAll(users, 'AvgAllocatedHrs'),
          AvgTotalWork: meanAll(users, 'AvgTotalWork'),
          AvgGoalEfficiency: meanAll(users, 'AvgGoalEfficiency'),
          EfficiencyLevel: calculateEfficiency({ kind: 'scoreLevel', score: users.length ? users.reduce((n, u) => n + calculateEfficiency({ kind: 'levelScore', level: u.EfficiencyLevel }), 0) / users.length : 0 }),
          users,
        };
        userCount += users.length;
        score += calculateEfficiency({ kind: 'levelScore', level: dept.EfficiencyLevel });
        return dept;
      });

      return {
        id: leaderId,
        name: userById.get(leaderId)?.['UserName'] as string,
        AvgTargetPercent: userCount ? calculateTarget({ kind: 'groupAverage', values: departments.map((i) => i['AvgTargetPercent']) }) : 0,
        AvgUtilizationPercent: userCount ? calculateUtilization({ kind: 'average', values: departments.map((d) => d['AvgUtilizationPercent']) }) : 0,
        AvgAllocatedHrs: userCount ? meanAll(departments, 'AvgAllocatedHrs') : 0,
        AvgTotalWork: userCount ? meanAll(departments, 'AvgTotalWork') : 0,
        AvgGoalEfficiency: meanAll(departments, 'AvgGoalEfficiency'),
        EfficiencyLevel: calculateEfficiency({ kind: 'scoreLevel', score: departments.length ? score / departments.length : 0 }),
        departments,
      };
    });
  }

  const els = rollLeaders('ExecutiveLeaderID', 3).map(({ id, name, ...rest }) => ({ ELID: id, ELName: name, ...rest }));
  const fls = rollLeaders('FunctionalLeaderID', 4).map(({ id, name, ...rest }) => ({ FLID: id, FLName: name, ...rest }));

  // Company level comes from the flat day rows (leave days excluded), like Java
  const flat = effRows.filter((r) => !isFullDay(leave.get(`${r['UserID']}|${r['WorkDate']}`)));
  const flatScore = flat.length ? flat.reduce((n, r) => n + calculateEfficiency({ kind: 'levelScore', level: r['EfficiencyLevel'] }), 0) / flat.length : 0;

  return {
    goalOf: userGoal,
    usersInDept,
    company: {
      EfficiencyLevel: calculateEfficiency({ kind: 'scoreLevel', score: flatScore }),
      AvgGoalEfficiency: meanPresent(els, 'AvgGoalEfficiency'),
      AvgTargetPercent: calculateTarget({ kind: 'groupAverage', values: els.map((i) => i['AvgTargetPercent']) }),
      AvgUtilizationPercent: calculateUtilization({ kind: 'average', values: els.map((e) => e['AvgUtilizationPercent']), skipMissing: true }),
      AvgAllocatedHrs: meanPresent(els, 'AvgAllocatedHrs'),
      AvgTotalWork: meanPresent(els, 'AvgTotalWork'),
    },
    els,
    fls,
  };
}
