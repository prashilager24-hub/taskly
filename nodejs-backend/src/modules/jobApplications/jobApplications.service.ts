import { pool } from '../../config/db';
import type mysql from 'mysql2/promise';

export interface ApplicationRow extends mysql.RowDataPacket {
  id: number;
  open_role_id: number | null;
  role_title: string;
  full_name: string;
  email: string;
  phone: string;
  current_location: string | null;
  current_company: string | null;
  current_designation: string | null;
  total_experience: string | null;
  current_ctc: string | null;
  expected_ctc: string | null;
  notice_period: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  cover_note: string | null;
  resume_path: string | null;
  jd_url: string | null;
  source: string | null;
  internal_notes: string | null;
  sourcedBy: string | null;
  screenedBy: string | null;
  screening_notes: string | null;
  rejection_reason: string | null;
  rejected_at_stage: string | null;
  final_status: string | null;
  offered_ctc: string | null;
  expected_doj: string | null;
  relevantExperience: string | null;
  status: 'NEW' | 'SCREENING' | 'SHORTLISTED' | 'REJECTED' | 'HIRED';
  interviewStage: 'applied' | 'screened' | 'l1' | 'l2' | 'l3' | 'offer' | 'rejected';
  applied_at: Date;
  updated_at: Date;
  // current round info (from JOIN, populated in list/getById)
  current_round_date: string | null;
  current_round_interviewer: string | null;
  current_round_status: string | null;
}

function toApplication(row: ApplicationRow) {
  return {
    id: row.id,
    openRoleId: row.open_role_id,
    roleTitle: row.role_title,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    currentLocation: row.current_location,
    currentCompany: row.current_company,
    currentDesignation: row.current_designation,
    totalExperience: row.total_experience,
    currentCtc: row.current_ctc,
    expectedCtc: row.expected_ctc,
    noticePeriod: row.notice_period,
    linkedinUrl: row.linkedin_url,
    portfolioUrl: row.portfolio_url,
    coverNote: row.cover_note,
    resumePath: row.resume_path,
    jdUrl: row.jd_url ?? null,
    source: row.source ?? null,
    internalNotes: row.internal_notes ?? null,
    sourcedBy: row.sourcedBy ?? null,
    screenedBy: row.screenedBy ?? null,
    screeningNotes: row.screening_notes ?? null,
    rejectionReason: row.rejection_reason ?? null,
    rejectedAtStage: row.rejected_at_stage ?? null,
    finalStatus: row.final_status ?? null,
    offeredCtc: row.offered_ctc ?? null,
    expectedDoj: row.expected_doj ?? null,
    relevantExperience: row.relevantExperience ?? null,
    status: row.status,
    interviewStage: row.interviewStage ?? 'applied',
    appliedAt: row.applied_at,
    updatedAt: row.updated_at,
    currentRoundDate: row.current_round_date ?? null,
    currentRoundInterviewer: row.current_round_interviewer ?? null,
    currentRoundStatus: row.current_round_status ?? null,
  };
}

export async function submitApplication(data: {
  openRoleId?: number;
  roleTitle: string;
  fullName: string;
  email: string;
  phone: string;
  currentLocation?: string;
  currentCompany?: string;
  currentDesignation?: string;
  totalExperience?: string;
  relevantExperience?: string;
  currentCtc?: string;
  expectedCtc?: string;
  noticePeriod?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  coverNote?: string;
  resumePath?: string;
  source?: string;
  internalNotes?: string;
  sourcedBy?: string;
}) {
  const [result] = await pool.query<mysql.ResultSetHeader>(
    `INSERT INTO JobApplications
      (open_role_id, role_title, full_name, email, phone, current_location,
       current_company, current_designation, total_experience, relevantExperience, current_ctc,
       expected_ctc, notice_period, linkedin_url, portfolio_url, cover_note, resume_path,
       source, internal_notes, sourcedBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.openRoleId ?? null,
      data.roleTitle,
      data.fullName,
      data.email,
      data.phone,
      data.currentLocation ?? null,
      data.currentCompany ?? null,
      data.currentDesignation ?? null,
      data.totalExperience ?? null,
      data.relevantExperience ?? null,
      data.currentCtc ?? null,
      data.expectedCtc ?? null,
      data.noticePeriod ?? null,
      data.linkedinUrl ?? null,
      data.portfolioUrl ?? null,
      data.coverNote ?? null,
      data.resumePath ?? null,
      data.source ?? null,
      data.internalNotes ?? null,
      data.sourcedBy ?? null,
    ]
  );
  const [rows] = await pool.query<ApplicationRow[]>(
    `${WITH_ROUND} WHERE ja.id = ?`, [result.insertId]
  );
  return toApplication(rows[0]);
}

// JOIN that includes current round info for the app's active stage
const WITH_ROUND = `
  SELECT ja.*, or2.description AS jd_url,
    ir.interviewDate AS current_round_date,
    ir.interviewerName AS current_round_interviewer,
    ir.status AS current_round_status
  FROM JobApplications ja
  LEFT JOIN OpenRoles or2 ON or2.id = ja.open_role_id
  LEFT JOIN InterviewRounds ir
    ON ir.applicationId = ja.id
    AND ir.roundNumber = CASE ja.interviewStage
      WHEN 'l1' THEN 1 WHEN 'l2' THEN 2 WHEN 'l3' THEN 3 ELSE NULL
    END
`;

export async function listAll() {
  const [rows] = await pool.query<ApplicationRow[]>(
    `${WITH_ROUND} ORDER BY ja.applied_at DESC`
  );
  return rows.map(toApplication);
}

export async function listByRole(openRoleId: number) {
  const [rows] = await pool.query<ApplicationRow[]>(
    `${WITH_ROUND} WHERE ja.open_role_id = ? ORDER BY ja.applied_at DESC`,
    [openRoleId]
  );
  return rows.map(toApplication);
}

export async function getById(id: number) {
  const [rows] = await pool.query<ApplicationRow[]>(
    `${WITH_ROUND} WHERE ja.id = ?`, [id]
  );
  return rows[0] ? toApplication(rows[0]) : null;
}

export async function updateStatus(id: number, status: ApplicationRow['status']) {
  await pool.query('UPDATE JobApplications SET status = ? WHERE id = ?', [status, id]);
  return getById(id);
}

export async function updateInterviewStage(id: number, stage: ApplicationRow['interviewStage']) {
  await pool.query('UPDATE JobApplications SET interviewStage = ? WHERE id = ?', [stage, id]);
  return getById(id);
}

export async function updateApplication(id: number, fields: {
  roleTitle?: string;
  fullName?: string;
  currentCompany?: string;
  currentDesignation?: string;
  totalExperience?: string;
  currentCtc?: string;
  expectedCtc?: string;
  noticePeriod?: string;
  currentLocation?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  coverNote?: string;
  source?: string;
  internalNotes?: string;
  status?: ApplicationRow['status'];
  sourcedBy?: string;
  screenedBy?: string;
  screeningNotes?: string;
  rejectionReason?: string;
  rejectedAtStage?: string;
  finalStatus?: string;
  offeredCtc?: string;
  expectedDoj?: string;
  relevantExperience?: string;
}) {
  const colMap: Record<string, string> = {
    roleTitle: 'role_title', fullName: 'full_name', currentCompany: 'current_company',
    currentDesignation: 'current_designation', totalExperience: 'total_experience',
    currentCtc: 'current_ctc', expectedCtc: 'expected_ctc', noticePeriod: 'notice_period',
    currentLocation: 'current_location', linkedinUrl: 'linkedin_url',
    portfolioUrl: 'portfolio_url', coverNote: 'cover_note',
    source: 'source', internalNotes: 'internal_notes',
    sourcedBy: 'sourcedBy', screenedBy: 'screenedBy',
    screeningNotes: 'screening_notes',
    rejectionReason: 'rejection_reason', rejectedAtStage: 'rejected_at_stage',
    finalStatus: 'final_status', offeredCtc: 'offered_ctc', expectedDoj: 'expected_doj',
    relevantExperience: 'relevantExperience', status: 'status',
  };
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || !colMap[k]) continue;
    sets.push(`${colMap[k]} = ?`);
    vals.push(v);
  }
  if (!sets.length) return getById(id);
  vals.push(id);
  await pool.query(`UPDATE JobApplications SET ${sets.join(', ')} WHERE id = ?`, vals);
  return getById(id);
}
