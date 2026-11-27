import path from 'path';
import fs from 'fs';
import { Router, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import { z } from 'zod';
import * as svc from './openRoles.service';
import { addLog, getLogs } from '../talent/talentLogs.service';
import { uploadToCDN, cdnConfigured } from '../talent/cdn.service';

const ALLOWED_EXTS = ['.pdf', '.doc', '.docx'];
const MAX_SIZE_MB = 10;
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

async function handleJdUpload(file: Express.Multer.File): Promise<string> {
  if (cdnConfigured()) {
    try {
      const { cdnUrl } = await uploadToCDN(file.buffer, file.originalname, 'jd', file.mimetype);
      return cdnUrl;  // CDN URL stored in DB
    } catch (err) {
      console.error('[openRoles] CDN upload failed, falling back to local disk:', (err as Error).message);
      // fall through to local disk
    }
  }
  const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads', 'jd');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `jd-${Date.now()}${path.extname(file.originalname)}`;
  fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
  return `/uploads/jd/${filename}`;
}

const CreateSchema = z.object({
  title: z.string().min(1),
  department: z.string().min(1),
  location: z.string().min(1),
  openings: z.coerce.number().int().positive().default(1),
  experience: z.string().optional(),
  employmentType: z.string().optional(),
  description: z.string().optional(),
  hiringManager: z.string().optional(),
  recruiter: z.string().optional(),
});

const UpdateSchema = CreateSchema.partial().extend({
  status: z.enum(['OPEN', 'ON_HOLD', 'CLOSED']).optional(),
});

function actor(req: Request) {
  return (req as any).user?.username ?? 'Admin';
}

const router = Router();

// GET logs for a role
router.get('/:id/logs', async (req: Request, res: Response) => {
  const logs = await getLogs('OPEN_ROLE', Number(req.params.id));
  res.json({ success: true, data: logs });
});

// GET all roles (admin: all statuses)
router.get('/', async (_req: Request, res: Response) => {
  const data = await svc.listAll();
  res.json({ success: true, data, total: data.length });
});

router.get('/:id', async (req: Request, res: Response) => {
  const role = await svc.getById(Number(req.params.id));
  if (!role) { res.status(404).json({ success: false, message: 'Not found' }); return; }
  res.json({ success: true, data: role });
});

router.post('/', handleUpload('description'), async (req: Request, res: Response) => {
  const body = { ...req.body };
  if (req.file) {
    body.description = await handleJdUpload(req.file);
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  const role = await svc.create({ ...parsed.data, createdBy: (req as any).user?.sub });
  if (role) {
    await addLog('OPEN_ROLE', role.id, 'Role created', `${role.title} · ${role.department} · ${role.location}`, actor(req));
  }
  res.status(201).json({ success: true, data: role });
});

router.put('/:id', handleUpload('description'), async (req: Request, res: Response) => {
  const body = { ...req.body };
  if (req.file) {
    body.description = await handleJdUpload(req.file);
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) { res.status(400).json({ success: false, errors: parsed.error.flatten() }); return; }

  const id = Number(req.params.id);
  const before = await svc.getById(id);
  const role = await svc.update(id, parsed.data);
  if (!role) { res.status(404).json({ success: false, message: 'Not found' }); return; }

  if (parsed.data.status && before?.status !== parsed.data.status) {
    await addLog('OPEN_ROLE', id, 'Status changed', `${before?.status} → ${parsed.data.status}`, actor(req));
  } else {
    const fieldDiffs: string[] = [];
    const toCheck: Array<[keyof typeof parsed.data, keyof NonNullable<typeof before>, string]> = [
      ['title', 'title', 'Title'],
      ['department', 'department', 'Department'],
      ['location', 'location', 'Location'],
      ['openings', 'openings', 'Openings'],
      ['experience', 'experience', 'Experience'],
      ['employmentType', 'employmentType', 'Employment type'],
      ['hiringManager', 'hiringManager', 'Hiring manager'],
      ['recruiter', 'recruiter', 'Recruiter'],
    ];
    for (const [newKey, oldKey, label] of toCheck) {
      const nv = parsed.data[newKey];
      if (nv === undefined) continue;
      const ov = before?.[oldKey];
      if (String(nv) !== String(ov ?? '')) {
        fieldDiffs.push(`${label}: ${ov ?? '—'} → ${nv}`);
      }
    }
    if (req.file) fieldDiffs.push('JD updated');
    await addLog('OPEN_ROLE', id, 'Role updated', fieldDiffs.length ? fieldDiffs.join(' · ') : null, actor(req));
  }
  res.json({ success: true, data: role });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const before = await svc.getById(id);
  await svc.remove(id);
  await addLog('OPEN_ROLE', id, 'Role deleted', before?.title ?? null, actor(req));
  res.json({ success: true });
});

// Public router: wide-open CORS, only OPEN roles
export const publicOpenRolesRouter = Router();
publicOpenRolesRouter.use(cors({ origin: '*', methods: ['GET', 'OPTIONS'] }));
publicOpenRolesRouter.get('/', async (_req: Request, res: Response) => {
  const data = await svc.listPublic();
  res.json({ success: true, data, total: data.length });
});

// Admin router: all statuses + CRUD + logs
export const adminOpenRolesRouter = router;
