import path from 'path';
import fs from 'fs';
import type mysql from 'mysql2/promise';
import { Router, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import { ocrPdf } from './ocrPdf';
import { z } from 'zod';
import * as svc from './jobApplications.service';
import { addLog, getLogs } from '../talent/talentLogs.service';
import { sendApplicationEmails, sendInterviewScheduleEmail } from '../talent/mail.service';
import { uploadToCDN, cdnConfigured } from '../talent/cdn.service';
import { createMeetEvent, googleConfigured } from '../talent/google.service';
import pdfParse from 'pdf-parse';

const ALLOWED_EXTS = ['.pdf', '.doc', '.docx'];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type "${ext}". Only PDF, DOC, and DOCX are accepted.`));
    }
  },
});

function handleUpload(field: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(field)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ success: false, message: `File too large. Maximum allowed size is ${MAX_SIZE_MB} MB.` });
          return;
        }
        res.status(400).json({ success: false, message: err.message });
        return;
      }
      if (err) {
        res.status(400).json({ success: false, message: (err as Error).message });
        return;
      }
      next();
    });
  };
}

const ApplySchema = z.object({
  openRoleId: z.coerce.number().int().positive().optional(),
  roleTitle: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  currentLocation: z.string().optional(),
  currentCompany: z.string().optional(),
  currentDesignation: z.string().optional(),
  totalExperience: z.string().optional(),
  currentCtc: z.string().optional(),
  expectedCtc: z.string().optional(),
  noticePeriod: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  portfolioUrl: z.string().url().optional().or(z.literal('')),
  coverNote: z.string().optional(),
});

// ── Public router (no auth, wide CORS) ───────────────────────────────────────
export const publicApplicationsRouter = Router();
publicApplicationsRouter.use(cors({ origin: '*', methods: ['POST', 'OPTIONS'] }));

publicApplicationsRouter.post('/', handleUpload('resume'), async (req: Request, res: Response) => {
  const body = { ...req.body };
  const parsed = ApplySchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }
  let resumePath: string | undefined;
  if (req.file) {
    let usedCdn = false;
    if (cdnConfigured()) {
      try {
        const { cdnUrl } = await uploadToCDN(req.file.buffer, req.file.originalname, 'resumes', req.file.mimetype);
        resumePath = cdnUrl;  // CDN URL stored in DB
        usedCdn = true;
      } catch (err) {
        console.error('[apply] CDN upload failed, falling back to local disk:', (err as Error).message);
      }
    }
    if (!usedCdn) {
      const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads', 'resumes');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const filename = `resume-${Date.now()}${path.extname(req.file.originalname)}`;
      fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
      resumePath = `/uploads/resumes/${filename}`;
    }
  }
  const application = await svc.submitApplication({ ...parsed.data, resumePath });
  if (application) {
    await addLog(
      'APPLICATION',
      application.id,
      'Application submitted',
      `${parsed.data.roleTitle} · ${parsed.data.currentCompany ?? ''} · ${parsed.data.totalExperience ?? ''}`.replace(/ · $/, ''),
      parsed.data.fullName,
    );
    // fire-and-forget — don't block the response on email delivery
    sendApplicationEmails({
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      roleTitle: parsed.data.roleTitle,
      currentCompany: parsed.data.currentCompany,
      totalExperience: parsed.data.totalExperience,
      noticePeriod: parsed.data.noticePeriod,
      currentLocation: parsed.data.currentLocation,
      linkedinUrl: parsed.data.linkedinUrl || undefined,
      coverNote: parsed.data.coverNote,
      resumePath: resumePath,
    }).catch(() => {/* already logged inside sendApplicationEmails */});
  }
  res.status(201).json({ success: true, data: application, message: 'Application submitted successfully.' });
});

// ── Admin router (authenticated, used under the BASE path) ───────────────────
export const adminApplicationsRouter = Router();

// POST parse-resume — extracts text from uploaded PDF and returns parsed fields
adminApplicationsRouter.post('/parse-resume', handleUpload('resume'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded.' }); return; }
  try {
    const pdfData = await pdfParse(req.file.buffer);
    const raw = pdfData.text ?? '';
    console.log('[parse-resume] raw text (first 1000 chars):\n', raw.slice(0, 1000));

    // Image-based / scanned PDF — fall back to OCR
    let ocrUsed = false;
    let finalRaw = raw;
    if (raw.trim().length < 20) {
      console.log('[parse-resume] no text layer detected — attempting OCR');
      try {
        const ocrText = await ocrPdf(req.file.buffer);
        if (ocrText.trim().length > 20) {
          finalRaw = ocrText;
          ocrUsed = true;
          console.log('[parse-resume] OCR succeeded, extracted', ocrText.length, 'chars');
        } else {
          res.json({
            success: true,
            parseWarning: 'This PDF could not be read — it may be encrypted or corrupted. Please fill in the fields manually.',
            data: { fullName: '', email: '', phone: '', totalExperience: '', linkedinUrl: '', currentLocation: '', currentCompany: '', currentDesignation: '', currentCtc: '', expectedCtc: '', noticePeriod: '' },
          });
          return;
        }
      } catch (ocrErr) {
        console.error('[parse-resume] OCR failed:', (ocrErr as Error).message);
        res.json({
          success: true,
          parseWarning: 'This PDF appears to be a scanned image and OCR extraction failed. Please fill in the fields manually.',
          data: { fullName: '', email: '', phone: '', totalExperience: '', linkedinUrl: '', currentLocation: '', currentCompany: '', currentDesignation: '', currentCtc: '', expectedCtc: '', noticePeriod: '' },
        });
        return;
      }
    }
    const text = finalRaw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);

    // ── Email ────────────────────────────────────────────────────────────────
    const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);

    // ── Phone — Indian numbers: 3+3+4, 5+5, or 10-digit; also US ───────────
    const phoneMatch = text.match(
      /(?:\+91[\s.\-]?)?(?:[6-9]\d{4}[\s.\-]?\d{5}|[6-9]\d{2}[\s.\-]?\d{3}[\s.\-]?\d{4})|(?:\+1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/
    );

    // ── LinkedIn ─────────────────────────────────────────────────────────────
    const linkedinMatch = text.match(/linkedin\.com\/in\/([a-zA-Z0-9_\-]+)/i);

    // ── Name: first short title-cased line ───────────────────────────────────
    const SKIP_NAME = /^(email|phone|mobile|address|linkedin|summary|experience|education|skill|work|project|certification|profile|objective|contact|reference|total|current|expected|notice|preferred|reason|source|gender|dob|date|senior|junior|lead|software|full|frontend|backend)/i;
    const nameLine = lines.find((l: string) => {
      const words = l.trim().split(/\s+/);
      return words.length >= 2 && words.length <= 5 &&
        l.length < 80 &&
        /^[A-Z]/.test(l) &&
        !SKIP_NAME.test(l) &&
        !/[@\d\/\|•·–——–]/.test(l);
    });

    // ── Helper: extract labelled value robustly ───────────────────────────────
    // Priority: "Label: Value" (colon) → "Label  Value" (spaces, same line, non-label value) → next-line (label alone)
    function extractLabelled(label: RegExp): string {
      // 1) Colon-separated (most reliable, works for "Current CTC: 18 LPA")
      const colon = text.match(new RegExp(label.source + '\\s*:\\s*([^\\n]{1,60})', 'i'));
      if (colon?.[1]?.trim()) return colon[1].trim();
      // 2) Whitespace-separated same line — but only if captured text isn't another label (all-caps phrase)
      const space = text.match(new RegExp(label.source + '[\\t ]+([^\\n]{1,60})', 'i'));
      if (space?.[1]?.trim()) {
        const val = space[1].trim();
        if (!/^[A-Z\s]+$/.test(val)) return val; // discard all-caps label text
      }
      // 3) Next-line: only when the line contains nothing but the label
      for (let i = 0; i < lines.length - 1; i++) {
        const stripped = lines[i].replace(label, '').trim();
        if (label.test(lines[i]) && stripped.length <= 2 && lines[i + 1]?.trim()) {
          return lines[i + 1].trim();
        }
      }
      return '';
    }

    // ── CTC — colon form first; fall back to nearest LPA value ───────────────
    function extractCTC(label: RegExp): string {
      const labelled = extractLabelled(label);
      if (labelled && /LPA|lac|lakhs?|\d/i.test(labelled)) return labelled.split(/\t/)[0].trim();
      // scan for closest LPA value after the label
      const lpa = text.match(new RegExp(label.source + '[\\s\\S]{0,60}?(\\d+(?:\\.\\d+)?\\s*(?:LPA|lac|lakhs?))', 'i'));
      return lpa?.[1]?.trim() ?? labelled;
    }

    // ── Experience ───────────────────────────────────────────────────────────
    const totalExpInline  = text.match(/total[\s\S]{0,20}?experience[\s\S]{0,10}?(\d+(?:\.\d+)?)\s*(?:\+\s*)?(?:year|yr)/i);
    const totalExpSummary = text.match(/(\d+(?:\.\d+)?)\+?\s*(?:year|yr)s?\s*(?:of\s+)?(?:experience|exp)/i);
    const totalExpAny     = text.match(/(\d+(?:\.\d+)?)\s*(?:\+\s*)?(?:year|yr)s?[\s\S]{0,20}?(?:experience|exp)/i);
    const totalExpNum     = totalExpInline ?? totalExpSummary ?? totalExpAny;

    // ── Location ─────────────────────────────────────────────────────────────
    const locationRaw  = extractLabelled(/(?:current\s+)?(?:location|city|address)/i)
                      || extractLabelled(/preferred\s+location/i);
    const locationPipe = text.match(/\|\s*([A-Z][a-zA-Z\s,]{3,40}?)\s*(?:\n|$)/);
    // Icon-prefixed: "📍 Bengaluru, Karnataka" — emoji may appear as Unicode escape
    const locationIcon = text.match(/(?:📍|📌|📍|📌)[^\w\n]*([A-Za-z][a-zA-Z\s,]{3,40}?)(?:\n|$)/);
    const locationLine = locationRaw
      ? [null, locationRaw]
      : locationPipe ?? locationIcon ?? null;

    // ── CTC ──────────────────────────────────────────────────────────────────
    const currentCtc  = extractCTC(/current\s*ctc/i);
    const expectedCtc = extractCTC(/expected\s*ctc/i);

    // ── Notice period ─────────────────────────────────────────────────────────
    const noticePeriod = extractLabelled(/notice\s+period/i)
      || text.match(/(\d+)\s*days?\s*(?:notice|np)/i)?.[1] || '';

    // ── Current company + designation ─────────────────────────────────────────
    let currentCompany    = extractLabelled(/current\s+company/i);
    let currentDesignation = extractLabelled(/current\s+designation/i);

    // Strip trailing dates from any field (e.g. "Zoho Corporation   Jul 2022 – Present")
    const stripDates = (s: string) => s.replace(/[\s\t]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}.*/i, '').trim();

    // Fallback: scan work experience section
    if (!currentCompany || !currentDesignation) {
      const expIdx = lines.findIndex((l: string) => /^(work\s+experience|experience|employment\s+history)$/i.test(l));
      if (expIdx !== -1) {
        const slice = lines.slice(expIdx + 1, expIdx + 25);
        if (!currentDesignation) {
          const desigLine = slice.find((l: string) =>
            /\b(engineer|developer|analyst|manager|lead|architect|designer|consultant|officer|executive|specialist|associate|intern|head|director|vp|president|recruiter|hr|cto|ceo|coo)\b/i.test(l)
            && l.length < 140
          );
          if (desigLine) currentDesignation = stripDates(desigLine);
        }
        if (!currentCompany) {
          const beforeDesig = currentDesignation ? slice.slice(0, slice.indexOf(currentDesignation)) : slice;
          const compLine = beforeDesig.find((l: string) =>
            l.length > 2 && l.length < 100 &&
            /^[A-Z]/.test(l) &&
            !/^(senior|junior|lead|principal|manager|engineer|developer|analyst|intern|associate)/i.test(l) &&
            !/^\d/.test(l) &&
            !/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(l)
          );
          if (compLine) currentCompany = stripDates(compLine);
        }
      }
    }

    const result = {
      fullName:          nameLine ?? '',
      email:             emailMatch?.[0] ?? '',
      phone:             phoneMatch?.[0] ?? '',
      totalExperience:   totalExpNum ? `${totalExpNum[1]}+ years` : '',
      linkedinUrl:       linkedinMatch ? `https://linkedin.com/in/${linkedinMatch[1]}` : '',
      currentLocation:   (Array.isArray(locationLine) ? locationLine[1] : locationLine)?.trim() ?? '',
      currentCompany,
      currentDesignation,
      currentCtc,
      expectedCtc,
      noticePeriod,
    };
    const emptyCount = Object.values(result).filter(v => !v).length;
    const parseWarning = emptyCount >= 8
      ? 'Could not extract enough data from this PDF — please fill in the fields manually.'
      : undefined;
    console.log('[parse-resume] extracted:', result);
    res.json({ success: true, ...(parseWarning ? { parseWarning } : {}), ...(ocrUsed ? { ocrUsed: true } : {}), data: result });
  } catch (err) {
    console.error('[parse-resume] error:', (err as Error)?.message ?? err);
    // Return empty fields so the frontend still shows the form for manual entry
    res.json({
      success: true,
      parseWarning: 'Could not auto-parse this PDF — please fill in the fields manually.',
      data: {
        fullName: '', email: '', phone: '', totalExperience: '',
        linkedinUrl: '', currentLocation: '', currentCompany: '',
        currentDesignation: '', currentCtc: '', expectedCtc: '', noticePeriod: '',
      },
    });
  }
});

// POST upload-applicant — HR manually adds an applicant with parsed/edited details + resume
adminApplicationsRouter.post('/upload-applicant', handleUpload('resume'), async (req: Request, res: Response) => {
  const { roleTitle, fullName, email, phone, currentCompany, currentDesignation,
          totalExperience, relevantExperience, noticePeriod, currentCtc, expectedCtc, currentLocation, linkedinUrl,
          source, internalNotes, sourcedBy, openRoleId } = req.body as Record<string, string>;

  if (!fullName || !email || !roleTitle) {
    res.status(400).json({ success: false, message: 'fullName, email, and roleTitle are required.' });
    return;
  }

  let resumePath: string | undefined;
  if (req.file) {
    if (cdnConfigured()) {
      try {
        const { cdnUrl } = await uploadToCDN(req.file.buffer, req.file.originalname, 'resumes', req.file.mimetype);
        resumePath = cdnUrl;
      } catch { /* fall through */ }
    }
    if (!resumePath) {
      const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads', 'resumes');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const filename = `resume-${Date.now()}${path.extname(req.file.originalname)}`;
      fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
      resumePath = `/uploads/resumes/${filename}`;
    }
  }

  const app = await svc.submitApplication({
    openRoleId: openRoleId ? Number(openRoleId) : undefined,
    roleTitle, fullName, email, phone: phone || '',
    currentCompany: currentCompany || undefined,
    currentDesignation: currentDesignation || undefined,
    totalExperience: totalExperience || undefined,
    relevantExperience: relevantExperience || undefined,
    noticePeriod: noticePeriod || undefined,
    currentCtc: currentCtc || undefined,
    expectedCtc: expectedCtc || undefined,
    currentLocation: currentLocation || undefined,
    linkedinUrl: linkedinUrl || undefined,
    resumePath,
    source: source || 'Database',
    internalNotes: internalNotes || undefined,
    sourcedBy: sourcedBy || undefined,
  });

  const actor = (req as any).user?.username ?? 'Admin';
  await addLog('APPLICATION', app.id, 'Application added', `Manually uploaded by ${actor} · Source: ${source || 'Database'}`, actor);
  res.status(201).json({ success: true, data: app });
});

// POST generate-meet — creates a Google Calendar event and returns the Meet link
adminApplicationsRouter.post('/generate-meet', async (req: Request, res: Response) => {
  if (!googleConfigured()) {
    res.status(503).json({ success: false, message: 'Google Calendar integration is not configured.' });
    return;
  }
  const { title, dateStr, timeStr, durationMinutes, description } = req.body as {
    title?: string; dateStr?: string; timeStr?: string; durationMinutes?: number; description?: string;
  };
  if (!dateStr || !timeStr) {
    res.status(400).json({ success: false, message: 'dateStr and timeStr are required.' });
    return;
  }
  try {
    const result = await createMeetEvent({
      title: title ?? 'Interview',
      dateStr,
      timeStr,
      durationMinutes: durationMinutes ?? 60,
      description,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// GET logs for an application
adminApplicationsRouter.get('/:id/logs', async (req: Request, res: Response) => {
  const logs = await getLogs('APPLICATION', Number(req.params.id));
  res.json({ success: true, data: logs });
});

// GET all applications
adminApplicationsRouter.get('/', async (_req: Request, res: Response) => {
  const data = await svc.listAll();
  res.json({ success: true, data, total: data.length });
});

// PATCH interview stage (kanban column)
adminApplicationsRouter.patch('/:id/interview-stage', async (req: Request, res: Response) => {
  const {
    stage, note,
    sourcedBy, screenedBy, screeningNotes,
    rejectionReason,
    offeredCtc, expectedDoj,
    expectedCtc, noticePeriod,
  } = req.body as Record<string, string>;

  const allowed = ['applied', 'screened', 'l1', 'l2', 'l3', 'offer', 'rejected'];
  if (!allowed.includes(stage)) {
    res.status(400).json({ success: false, message: `stage must be one of: ${allowed.join(', ')}` });
    return;
  }
  const id = Number(req.params.id);
  const before = await svc.getById(id);
  if (!before) { res.status(404).json({ success: false, message: 'Not found' }); return; }

  const { pool } = await import('../../config/db');

  // Gate: forward moves from interview stages require the previous round to be "Selected"
  const gateMap: Record<string, { round: number; label: string }> = {
    l2: { round: 1, label: 'Interview 1' },
    l3: { round: 2, label: 'Interview 2' },
    offer: { round: 3, label: 'Interview 3' },
  };
  if (gateMap[stage]) {
    const { round, label } = gateMap[stage];
    const [roundRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT status FROM InterviewRounds WHERE applicationId = ? AND roundNumber = ?', [id, round]
    );
    if (!roundRows[0] || roundRows[0].status !== 'Selected') {
      res.status(400).json({ success: false, message: `${label} must be marked "Selected" before moving forward.` });
      return;
    }
  }

  // Build field updates
  const updates: Parameters<typeof svc.updateApplication>[1] = {};
  if (stage === 'screened') {
    if (sourcedBy) updates.sourcedBy = sourcedBy;
    if (screenedBy) updates.screenedBy = screenedBy;
    if (screeningNotes) updates.screeningNotes = screeningNotes;
    if (expectedCtc) updates.expectedCtc = expectedCtc;
    if (noticePeriod) updates.noticePeriod = noticePeriod;
  }
  if (stage === 'offer') {
    updates.finalStatus = 'Offer Pending';
    if (offeredCtc) updates.offeredCtc = offeredCtc;
    if (expectedDoj) updates.expectedDoj = expectedDoj;
  }
  if (stage === 'rejected') {
    if (!rejectionReason?.trim()) {
      res.status(400).json({ success: false, message: 'rejectionReason is required when rejecting.' });
      return;
    }
    updates.rejectionReason = rejectionReason;
    updates.rejectedAtStage = before.interviewStage;
    updates.finalStatus = 'Rejected';
  }
  if (Object.keys(updates).length) await svc.updateApplication(id, updates);

  const updated = await svc.updateInterviewStage(id, stage as any);
  if (!updated) { res.status(404).json({ success: false, message: 'Not found' }); return; }

  const actor = (req as any).user?.username ?? 'Admin';
  const stageLabel: Record<string, string> = { applied: 'Applied', screened: 'Screened', l1: 'Interview 1', l2: 'Interview 2', l3: 'Interview 3', offer: 'Offer', rejected: 'Rejected' };
  const parts = [
    note,
    sourcedBy && `Sourced by: ${sourcedBy}`,
    screenedBy && `Screened by: ${screenedBy}`,
    rejectionReason && `Reason: ${rejectionReason}`,
  ].filter(Boolean);
  const details = `${stageLabel[before.interviewStage ?? 'applied']} → ${stageLabel[stage]}${parts.length ? ' · ' + parts.join(' · ') : ''}`;
  await addLog('APPLICATION', id, 'Stage moved', details, actor);
  res.json({ success: true, data: updated });
});

// PATCH final status for offer-stage updates
adminApplicationsRouter.patch('/:id/final-status', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { finalStatus } = req.body as { finalStatus: string };
  const allowed = ['Offer Pending', 'Offer Released', 'Offer Accepted', 'Offer Declined', 'Joined', 'Dropped', 'Rejected'];
  if (!finalStatus || !allowed.includes(finalStatus)) {
    res.status(400).json({ success: false, message: `finalStatus must be one of: ${allowed.join(', ')}` });
    return;
  }
  const updated = await svc.updateApplication(id, { finalStatus });
  if (!updated) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  const actor = (req as any).user?.username ?? 'Admin';
  await addLog('APPLICATION', id, 'Final status updated', finalStatus, actor);
  res.json({ success: true, data: updated });
});

// GET applications for a specific open role
adminApplicationsRouter.get('/role/:roleId', async (req: Request, res: Response) => {
  const data = await svc.listByRole(Number(req.params.roleId));
  res.json({ success: true, data, total: data.length });
});

// POST schedule interview — sends candidate email, moves to SCREENING, logs it
adminApplicationsRouter.post('/:id/schedule-interview', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { interviewDate, interviewTime, interviewType, meetingLink, notes } = req.body;

  if (!interviewDate || !interviewTime || !interviewType) {
    res.status(400).json({ success: false, message: 'interviewDate, interviewTime and interviewType are required' });
    return;
  }

  const application = await svc.getById(id);
  if (!application) { res.status(404).json({ success: false, message: 'Application not found' }); return; }

  const actor = (req as any).user?.username ?? 'Talent Team';

  // Move to SCREENING
  await svc.updateStatus(id, 'SCREENING');
  await addLog('APPLICATION', id, 'Interview scheduled',
    `${interviewDate} · ${interviewTime} · ${interviewType}${meetingLink ? ' · ' + meetingLink : ''}`,
    actor,
  );

  // Send email (fire-and-forget)
  sendInterviewScheduleEmail({
    fullName: application.fullName,
    email: application.email,
    roleTitle: application.roleTitle,
    interviewDate,
    interviewTime,
    interviewType,
    meetingLink: meetingLink || undefined,
    notes: notes || undefined,
    scheduledBy: actor,
    resumePath: application.resumePath || undefined,
  }).catch(() => {});

  res.json({ success: true, message: 'Interview scheduled and candidate notified.' });
});

// PATCH general update (used by CSV import)
const UpdateSchema = z.object({
  roleTitle: z.string().optional(),
  fullName: z.string().optional(),
  currentCompany: z.string().optional(),
  currentDesignation: z.string().optional(),
  totalExperience: z.string().optional(),
  currentCtc: z.string().optional(),
  expectedCtc: z.string().optional(),
  noticePeriod: z.string().optional(),
  currentLocation: z.string().optional(),
  linkedinUrl: z.string().optional(),
  portfolioUrl: z.string().optional(),
  coverNote: z.string().optional(),
  source: z.string().optional(),
  internalNotes: z.string().optional(),
  sourcedBy: z.string().optional(),
  screenedBy: z.string().optional(),
  relevantExperience: z.string().optional(),
  status: z.enum(['NEW', 'SCREENING', 'SHORTLISTED', 'REJECTED', 'HIRED']).optional(),
});

adminApplicationsRouter.patch('/:id', async (req: Request, res: Response) => {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }
  const id = Number(req.params.id);
  const before = await svc.getById(id);
  if (!before) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  const updated = await svc.updateApplication(id, parsed.data);
  const actor = (req as any).user?.username ?? 'Admin';
  const changes = Object.entries(parsed.data)
    .filter(([k, v]) => v !== undefined && String((before as Record<string, unknown>)[k] ?? '') !== String(v))
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  if (changes) await addLog('APPLICATION', id, 'Application updated', changes, actor);
  res.json({ success: true, data: updated });
});

// PATCH status update
adminApplicationsRouter.patch('/:id/status', async (req: Request, res: Response) => {
  const { status, note } = req.body;
  const allowed = ['NEW', 'SCREENING', 'SHORTLISTED', 'REJECTED', 'HIRED'];
  if (!allowed.includes(status)) {
    res.status(400).json({ success: false, message: `status must be one of: ${allowed.join(', ')}` });
    return;
  }
  const id = Number(req.params.id);
  const before = await svc.getById(id);
  const updated = await svc.updateStatus(id, status);
  if (!updated) { res.status(404).json({ success: false, message: 'Not found' }); return; }

  const actor = (req as any).user?.username ?? 'Admin';
  const details = note
    ? `${before?.status ?? '?'} → ${status} · ${note}`
    : `${before?.status ?? '?'} → ${status}`;
  await addLog('APPLICATION', id, 'Status changed', details, actor);
  res.json({ success: true, data: updated });
});

// GET interview rounds for an application
adminApplicationsRouter.get('/:id/rounds', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const [rows] = await (await import('../../config/db')).pool.query(
    'SELECT * FROM InterviewRounds WHERE applicationId = ? ORDER BY roundNumber ASC',
    [id]
  ) as any;
  res.json({ success: true, data: rows });
});

// PUT upsert a single round
adminApplicationsRouter.put('/:id/rounds/:round', async (req: Request, res: Response) => {
  const appId = Number(req.params.id);
  const roundNumber = Number(req.params.round);
  const {
    interviewDate, interviewerName, interviewLink, mode, venue,
    status: rStatus, feedback, managerFeedback, submittedBy,
  } = req.body as Record<string, string>;

  const { pool } = await import('../../config/db');
  await pool.query(
    `INSERT INTO InterviewRounds
       (applicationId, roundNumber, interviewDate, interviewerName, interviewLink, mode, venue, status, feedback, managerFeedback, submitted_by, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       interviewDate    = COALESCE(VALUES(interviewDate), interviewDate),
       interviewerName  = COALESCE(VALUES(interviewerName), interviewerName),
       interviewLink    = COALESCE(VALUES(interviewLink), interviewLink),
       mode             = COALESCE(VALUES(mode), mode),
       venue            = COALESCE(VALUES(venue), venue),
       status           = VALUES(status),
       feedback         = COALESCE(VALUES(feedback), feedback),
       managerFeedback  = COALESCE(VALUES(managerFeedback), managerFeedback),
       submitted_by     = COALESCE(VALUES(submitted_by), submitted_by),
       submitted_at     = COALESCE(VALUES(submitted_at), submitted_at),
       updatedAt        = CURRENT_TIMESTAMP`,
    [
      appId, roundNumber,
      interviewDate || null, interviewerName || null, interviewLink || null,
      mode || 'online', venue || null,
      rStatus || 'Scheduled',
      feedback || null, managerFeedback || null,
      submittedBy || null,
      (rStatus && rStatus !== 'Scheduled') ? new Date() : null,
    ]
  );

  // If status = Rejected, auto-reject the candidate
  if (rStatus === 'Rejected') {
    const stageMap: Record<number, string> = { 1: 'l1', 2: 'l2', 3: 'l3' };
    const atStage = stageMap[roundNumber] ?? 'l1';
    await svc.updateApplication(appId, {
      finalStatus: 'Rejected',
      rejectionReason: feedback || 'Did not clear interview',
      rejectedAtStage: atStage,
    });
    await svc.updateInterviewStage(appId, 'rejected');
  }

  const actor = (req as any).user?.username ?? 'Admin';
  await addLog('APPLICATION', appId, `Round ${roundNumber} ${rStatus ?? 'updated'}`,
    [interviewDate, interviewerName, rStatus, feedback && `Feedback: ${feedback.slice(0, 60)}`].filter(Boolean).join(' · '), actor);

  const [rows] = await pool.query(
    'SELECT * FROM InterviewRounds WHERE applicationId = ? ORDER BY roundNumber ASC', [appId]
  ) as any;

  // Return updated app so frontend can update stage if rejected
  const app = await svc.getById(appId);
  res.json({ success: true, data: rows, app });
});
