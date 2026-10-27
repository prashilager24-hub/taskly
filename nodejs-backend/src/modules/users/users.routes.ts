import { Router } from 'express';
import { sendSuccess } from '../../utils/response';

const router = Router();

// ── Static enum values (mirrors Java MetaController + enums) ──────────────────
// These are reference/dropdown data — no DB needed, no auth required

const TASK_STATUSES = [
  { value: 'DONE',    label: '✓ Done',      badgeColour: 'green' },
  { value: 'PARTIAL', label: '◑ Partial',   badgeColour: 'amber' },
  { value: 'MISSED',  label: '✗ Missed',    badgeColour: 'red'   },
  { value: 'CARRY',   label: '→ Carry',     badgeColour: 'grey'  },
];

const TASK_TYPES = [
  { value: 'DEVELOPMENT', label: 'Development' },
  { value: 'TESTING',     label: 'Testing'     },
  { value: 'DESIGN',      label: 'Design'      },
  { value: 'MEETING',     label: 'Meeting'     },
  { value: 'RESEARCH',    label: 'Research'    },
  { value: 'SUPPORT',     label: 'Support'     },
  { value: 'REVIEW',      label: 'Review'      },
  { value: 'OTHER',       label: 'Other'       },
];

const PRODUCTS = [
  { value: 'TASKLY',   label: 'Taskly'   },
  { value: 'TAPMIND',  label: 'Tapmind'  },
];

const LEAVE_TYPES = [
  { value: 'FULL_DAY',  label: 'Full Day'  },
  { value: 'HALF_DAY',  label: 'Half Day'  },
  { value: 'SICK',      label: 'Sick Leave'},
  { value: 'CASUAL',    label: 'Casual Leave'},
  { value: 'EMERGENCY', label: 'Emergency' },
];

const APPROVAL_STATUSES = [
  { value: 'PENDING',  label: 'Pending'  },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

// GET /api/meta/task-statuses
router.get('/task-statuses', (_req, res) => {
  sendSuccess(res, TASK_STATUSES);
});

// GET /api/meta/task-types
router.get('/task-types', (_req, res) => {
  sendSuccess(res, TASK_TYPES);
});

// GET /api/meta/products
router.get('/products', (_req, res) => {
  sendSuccess(res, PRODUCTS);
});

// GET /api/meta/leave-types
router.get('/leave-types', (_req, res) => {
  sendSuccess(res, LEAVE_TYPES);
});

// GET /api/meta/approval-statuses
router.get('/approval-statuses', (_req, res) => {
  sendSuccess(res, APPROVAL_STATUSES);
});

export default router;
