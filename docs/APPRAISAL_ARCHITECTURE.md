# Appraisal & Appeal module — architecture plan

> **Superseded (2026-11-02).** This was the first plan. The module that was built (appraisal flow v2) works differently: everyone appeals, the Finance Head (head of Strategic Financial Management) agrees a budget per department with its EL, the EL splits it, FLs allocate their share, the EL approves; amounts are shown by role, not masked and revealed. Its migrations are `012_appraisal.sql` … `017_appraisal_review_reset.sql`. See the Appraisal entries in [CHANGELOG.md](CHANGELOG.md) for what exists today.

Part of **PMS**. Implements the flow in `taskly_pms_appraisal_interactive_flowchart.html`:
profile and cycle → 15-day appeal window → appeal + self review → Assessor 1 → Assessor 2 → Finance → final outcome → accept, or reject → postponement → HR → follow-up.

**Hard requirement: every monetary amount is masked.** No amount reaches a screen, a log, a notification, an export or a URL unmasked unless a permitted person explicitly reveals it, and every reveal is recorded. See section 5.

---

## 1. Assumptions (decided so work can start — veto any of them)

| # | Assumption | Why |
|---|---|---|
| A1 | Actual amounts **are stored** (current / proposed / approved fixed and variable pay, budget), encrypted and masked. Hike **percentages are not masked** | You asked for amounts to be masked, which implies they exist. Percentages are needed to review fairly and carry no absolute pay information |
| A2 | Hike figures (Level 1 = 10%, FL = 20%, EL = 30%) are **maximum limits per level**, editable in settings. Finance may exceed them with a recorded reason | Safest reading of the notes; easy to relax later |
| A3 | Finance approvers are **named users in settings** (`appraisalFinanceApprovers`). Salaries of ELs are visible only to a second list (`appraisalElSalaryViewers`, your "Naveen and Raja" note) | Matches the note without inventing a role |
| A4 | The 15-day appeal window starts when HR opens the cycle. Assessors get a further **15 calendar days** after it closes. Both are settings | The flowchart leaves this open |
| A5 | Rejecting the hike is the only way into postponement, and requesting it is **optional** | Flowchart: "Request postponement" after "Reject" |
| A6 | Joining date, designation and band are edited by HR in Taskly, with a one-time CSV import | These fields do not exist today |
| A7 | "No second option" after accepting means no further negotiation at that point | As noted in the flowchart |

---

## 2. What we build on (already in the codebase)

| Area | Reuse |
|---|---|
| Assessors | `nodejs-backend/src/modules/access/hierarchy.ts` already derives Assessor 1 and 2 from the reporting ladder (employee → manager, EL; manager → EL, CEO; EL → CEO). Appraisal freezes that result per appraisal |
| Access | Module catalog (`access/catalog.ts`), role / department / user grants, `logChange`. New modules are added the same way `pms_*` ones were |
| Reviews | `QuarterlyReview` (Q1–Q3 2026, ratings JSON, grade) supplies the "previous 2 quarters" |
| Notifications | `notifications.service` with audiences, for every transition |
| Settings | `AppSetting` key-value table (holds `ceoUserId` today) |
| Scheduler | the existing daily job (task audit) for window close and reminders |
| Frontend | PMS sidebar section, `ProtectedRoute module=…`, `hasModuleAccess`, the overview design components |

Gaps this module fills: no joining date, designation, band; no cycle, appeal, self review, assessor reviews, Finance step, outcome, postponement, HR review, follow-up; no audit trail; no compensation data; no masking.

---

## 3. Actors and routing

| Actor | Who | Does |
|---|---|---|
| Employee | person being appraised | views eligibility, submits appeal and self review, accepts or rejects the outcome, requests postponement |
| Assessor 1 | from `hierarchy.assessorsOf` (manager for employees, EL for managers, CEO for ELs) | first assessment, hike recommendation |
| Assessor 2 | from `hierarchy` (EL for employees, CEO optional for managers, none for ELs) | second assessment, reviews Assessor 1 |
| Finance approver | users in `appraisalFinanceApprovers` | budget and compensation validation: approve, modify, reject, return |
| HR | `pms_appraisal_admin` | cycles, profile data, postponement decisions, settings |
| Admin / CEO | Admin role | can reveal amounts and see all appraisals, every access recorded |

The assessor chain is **frozen at submission** into `AppraisalStage` rows, so a later change in reporting lines does not silently reroute an appraisal. HR can reassign a stage, and that is audited.

---

## 4. Lifecycle (state machine)

States, `Appraisal.Status`:

`NOT_OPEN` → `WINDOW_OPEN` → `SUBMITTED` → `ASSESSOR1` → `ASSESSOR2` → `FINANCE` → `DECIDED` → `ACCEPTED` → `CLOSED`
and `DECIDED` → `REJECTED` → `POSTPONE_REQUESTED` → `HR_REVIEW` → `FOLLOWUP_SCHEDULED` / `POSTPONE_DECLINED` → `CLOSED`.
Side exits: `EXPIRED` (window closed, nothing submitted), `RETURNED` (Finance sends back to an assessor), `WITHDRAWN`.

| From → To | Who | Guard | Side effects |
|---|---|---|---|
| NOT_OPEN → WINDOW_OPEN | HR (open cycle) / scheduler | person eligible for the cycle | notify employee, start 15-day clock |
| WINDOW_OPEN → SUBMITTED | employee | within window, appeal and self review complete | freeze assessor chain, notify Assessor 1 |
| WINDOW_OPEN → EXPIRED | scheduler | window passed | notify employee and HR |
| SUBMITTED → ASSESSOR1 → ASSESSOR2 | assessors | the actor is the frozen assignee, recommendation within limit | notify next stage; Assessor 2 sees Assessor 1's recommendation |
| ASSESSOR2 → FINANCE | Assessor 2 (or Assessor 1 when there is no second) | stage reviews done | notify Finance |
| FINANCE → DECIDED | Finance | approve / modify / reject recorded, reason if over limit | create outcome, notify employee |
| FINANCE → RETURNED | Finance | reason required | back to the named assessor |
| DECIDED → ACCEPTED → CLOSED | employee | within response period | notify HR and Finance, lock record |
| DECIDED → REJECTED | employee | reason required | no compensation change |
| REJECTED → POSTPONE_REQUESTED | employee | months is 3 or 6, reason and expectations | notify HR |
| POSTPONE_REQUESTED → HR_REVIEW → FOLLOWUP_SCHEDULED / POSTPONE_DECLINED | HR | decision and reason | follow-up gets due date, owner, measurable goals, reminders |

Every transition is validated in one place (`appraisal.machine.ts`) and writes an `AppraisalEvent`. Invalid transitions return 409.

---

## 5. Amount masking (security architecture)

**Definition.** A *sensitive amount* is any monetary value: current / proposed / approved fixed pay, variable pay, total, incremental annual cost, team budget available and used. Hike % and ratings are not sensitive amounts.

### 5.1 Storage
- Amounts are stored **encrypted at rest** per column (AES-256-GCM, authenticated, with a random IV per value). Columns are `*_enc VARBINARY`, never plain `DECIMAL`.
- The key comes from env `APPRAISAL_AMOUNT_KEY` (32 bytes), with a `keyId` stored beside each value so keys can be rotated.
- A database dump or a developer with read-only SQL access therefore sees ciphertext, not salaries.

### 5.2 Server: masked by default
- One function decides what a caller gets: `present(amountRow, viewer)` in `appraisal.mask.ts`. It returns `{ masked: true, display: "••••••" }` unless the viewer may reveal.
- The mask is **fixed length**, so its length leaks nothing.
- Normal list and detail endpoints **never** return amounts, only the mask and a `canReveal` flag.
- A single endpoint returns plaintext: `POST /appraisals/:id/amounts/reveal`. It requires the reveal permission and the scope check, writes an `AmountAccessLog` row (who, which appraisal, which fields, when, IP), is rate limited, and answers with `Cache-Control: no-store`.
- Amounts are **never** placed in logs, error messages, notification text, emails, Excel / CSV exports or URLs. Logger redaction covers the field names. Exports include only masked values unless the exporter holds the reveal permission, and that export is logged too.

### 5.3 Who may reveal

| Viewer | Own amounts | Others' amounts |
|---|---|---|
| Employee | yes, **only after** the final outcome is recorded (their own approved pay) | never |
| Assessor 1 / 2 | n/a | only **authorized team budget** and the proposed figures of people in their own scope; never any other pay |
| Finance approver | n/a | all non-EL appraisals |
| EL salaries | n/a | only users in `appraisalElSalaryViewers` (and Admin) |
| HR | n/a | **no** amounts unless also granted `pms_appraisal_finance` |
| Admin / CEO | yes | yes, always logged |

Scope is enforced by the hierarchy (subordinate teams only), never by the client.

### 5.4 Frontend
- One component, `<MaskedAmount>`: shows `₹ ••••••`, and a **Reveal** button when `canReveal`. Revealing calls the reveal endpoint, shows the value, and **re-masks after 30 seconds** or on navigation.
- Plaintext amounts are held in component state only, never in localStorage, URL, global store or console output.
- Forms that need an amount (Finance entering approved pay) use a password-style field with a show toggle.
- Print and PDF views render the mask unless the person revealed on that screen.

### 5.5 Tests that must pass before release
Masking tests are part of the definition of done: no list / detail / notification / export response contains a digit run that matches a stored amount; the reveal endpoint refuses callers outside scope; every reveal creates a log row.

---

## 6. Data model (new migrations 006–009)

```
EmployeeProfile    UserID PK, JoiningDate, Designation, Band, JdDetails, UpdatedBy, UpdatedAt
AppraisalCycle     CycleID PK, Name, CycleMonth ENUM('APRIL','OCTOBER'), CycleYear,
                   OpensOn, AppealDays=15, ReviewDays=15, ResponseDays, Status ENUM('DRAFT','OPEN','REVIEW','DECISION','CLOSED'),
                   CreatedBy, CreatedAt
Appraisal          AppraisalID PK, CycleID FK, UserID FK, Status (see §4), Level, WindowClosesOn,
                   SubmittedAt, DecidedAt, ClosedAt, UNIQUE(CycleID, UserID)
AppraisalAppeal    AppraisalID PK/FK, Answers JSON (achievements, rating rationale, challenges,
                   goal updates, milestone, why-deserve), Quarters JSON (snapshot of previous 2 quarters),
                   ExpectedHikePct, ConventionalHikePct, MinimalHikePct, RequestedDesignation, RequestedTeam,
                   Comments, EvidenceFiles JSON
AppraisalStage     StageID PK, AppraisalID FK, Seq, StageType ENUM('ASSESSOR1','ASSESSOR2','FINANCE'),
                   AssigneeUserID, Status ENUM('PENDING','IN_PROGRESS','DONE','SKIPPED','RETURNED'), DueOn, DoneAt
AppraisalReview    ReviewID PK, StageID FK, ReviewerID, RecommendedHikePct, Decision ENUM('RECOMMEND','APPROVE','MODIFY','REJECT','RETURN'),
                   CommentsEmployee, CommentsInternal, LimitOverrideReason, CreatedAt
AppraisalAmounts   AppraisalID PK/FK, CurrentFixed_enc, CurrentVariable_enc, ProposedFixed_enc, ProposedVariable_enc,
                   ApprovedFixed_enc, ApprovedVariable_enc, IncrementalCost_enc, TeamBudgetAvailable_enc, TeamBudgetUsed_enc,
                   KeyId, UpdatedBy, UpdatedAt
AppraisalOutcome   AppraisalID PK/FK, ApprovedHikePct, FixedVariableSplit, EffectiveOn, NewDesignation, NewTeam,
                   EmployeeResponse ENUM('PENDING','ACCEPTED','REJECTED'), ResponseReason, RespondedAt
AppraisalPostponement  AppraisalID PK/FK, Months ENUM('3','6'), Reason, Expectations,
                   HrDecision ENUM('PENDING','APPROVED','DECLINED'), HrReason, HrDecidedBy, HrDecidedAt,
                   FollowUpDue, FollowUpOwner, FollowUpGoals JSON
AppraisalEvent     EventID PK, AppraisalID FK, ActorID, Action, FromStatus, ToStatus, Detail JSON, At   -- audit trail, no amounts
AmountAccessLog    LogID PK, AppraisalID, ViewerID, Fields JSON(names only), Reason, Ip, At
```
Settings in `AppSetting`: `appraisalHikeLimits` (`{"level1":10,"fl":20,"el":30}`), `appraisalAppealDays`, `appraisalReviewDays`, `appraisalFinanceApprovers`, `appraisalElSalaryViewers`.
Internal comments are never returned to the employee. Employee-visible comments are a separate column.

---

## 7. Access model

New modules in `access/catalog.ts` under PMS, granted by migration:

| Module id | Purpose | Default |
|---|---|---|
| `pms_appraisal` | My appraisal: eligibility, appeal, self review, accept / reject / postpone | every employee role |
| `pms_appraisal_review` | Assessor queue and review form | managers, ELs, CEO |
| `pms_appraisal_finance` | Budget review, amount entry, reveal for non-EL appraisals | none (assigned to Finance users) |
| `pms_appraisal_admin` | Cycles, profile data, postponement decisions, settings | HR |

The module gate decides whether a screen opens. **Row-level scope** (is this my appraisal, my team, my stage) is a separate server-side check, `appraisal.scope.ts`, on every endpoint. Reveal needs both.

---

## 8. API (`/t2.0/authentificationUtilization/appraisal/...`)

| Actor | Endpoints |
|---|---|
| Employee | `GET /mine`, `GET /mine/:cycleId`, `PUT /:id/appeal` (draft), `POST /:id/submit`, `POST /:id/respond` (accept / reject), `POST /:id/postponement` |
| Assessor | `GET /queue`, `GET /:id`, `POST /:id/stages/:stageId/review` |
| Finance | `GET /finance/queue`, `PUT /:id/amounts`, `POST /:id/stages/:stageId/decision` |
| Reveal | `POST /:id/amounts/reveal` (permission + scope + logged + rate limited) |
| HR | `GET/POST /cycles`, `POST /cycles/:id/open`, `GET/PUT /profiles/:userId`, `POST /profiles/import`, `GET /postponements`, `POST /postponements/:id/decision`, `PUT /settings`, `POST /:id/reassign-stage` |
| Shared | `GET /:id/timeline` (events), `GET /report` (counts per stage, no amounts) |

All bodies validated with zod. Transitions go through the state machine. Errors never echo amounts.

---

## 9. Backend structure

```
nodejs-backend/src/modules/appraisal/
  appraisal.routes.ts        thin routes, zod validation
  appraisal.machine.ts       states, allowed transitions, guards
  appraisal.service.ts       orchestration, transactions
  appraisal.scope.ts         row-level permission (own / team / stage / finance / EL-salary)
  appraisal.mask.ts          present(), mask format, reveal rules
  appraisal.crypto.ts        AES-256-GCM encrypt / decrypt, key ids
  appraisal.cycle.ts         eligibility, window dates
  appraisal.notify.ts        notification templates (no amounts)
  appraisal.jobs.ts          window close, reviewer deadlines, follow-up reminders
  appraisal.schema.ts        zod
nodejs-backend/src/config/migrations/006_appraisal_core.sql … 009_appraisal_access.sql
```
Wired in `app.ts`; scheduled jobs registered with the existing scheduler; transitions run inside DB transactions.

---

## 10. Frontend structure

```
frontend/src/pages/appraisalPages.tsx          route wrappers (like pmsPages.tsx)
frontend/src/components/appraisal/
  MyAppraisal.tsx        eligibility, countdown, appeal form, self review, outcome response
  AppealForm.tsx         previous 2 quarters pulled in, required fields
  ReviewQueue.tsx        assessor list + ReviewForm.tsx (recommendation, limit hint, comments)
  FinancePanel.tsx       amounts (masked), approve / modify / reject / return
  OutcomeCard.tsx        final outcome, accept / reject / postpone
  HrConsole.tsx          cycles, profiles + CSV import, postponements, settings
  StepTracker.tsx        the flowchart as a live timeline for one appraisal
  MaskedAmount.tsx       masked amount, reveal button, 30 s re-mask
  api.ts                 typed calls, no amount caching
```
Routes `/pms/appraisal`, `/pms/appraisal/review`, `/pms/appraisal/finance`, `/pms/appraisal/admin`, each behind its module with `ProtectedRoute`, plus a sidebar entry and an `ORDER` entry in `pmsPages.tsx`. Same visual language as the overview pages.

---

## 11. Notifications and scheduling

Notifications (existing service, text never contains amounts): window opened, appeal submitted, your turn to review, returned by Finance, outcome ready, response received, postponement requested, HR decision, follow-up due.
Jobs: close windows and mark `EXPIRED`; remind employees 3 days before close; remind assessors at day 10 of 15 and escalate to HR at day 15; remind owners of follow-ups.

---

## 12. Delivery plan

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Migrations 006–009, catalog modules, settings, `appraisal.crypto` and `appraisal.mask` with tests | tables exist, modules visible in Access Management, an encrypted value round-trips and a masked response contains no amount |
| 2 | Profile editor and CSV import; cycles, eligibility, window | HR opens a cycle and eligible people get a `WINDOW_OPEN` appraisal |
| 3 | Employee appeal and self review (API and page) | submit freezes the assessor chain, previous 2 quarters appear |
| 4 | Assessor 1 and 2 reviews | stage routing follows the hierarchy, limits enforced, scope tested |
| 5 | Finance step, amounts, reveal, final outcome | amounts masked everywhere, reveal logged, outcome recorded |
| 6 | Accept / reject, postponement, HR review, follow-up | the whole branch of the flowchart works |
| 7 | Notifications, reminders, escalations, timeline | every transition notifies and logs |
| 8 | Reports (counts only), permission and masking test suite, changelog and docs | no amount leaks in any test, `docs/CHANGELOG.md` entry added |

---

## 13. Risks

- **Salary confidentiality is the main risk.** Mitigated by encryption, server-side masking, scope checks, reveal logging, and the leak tests in step 8.
- **People without a manager or EL** break assessor routing. Today 70 users have a manager and 60 an EL manager, and 12 users have no appraisal cycle. Step 2 reports these gaps to HR before a cycle can open.
- **Joining dates do not exist yet.** Eligibility cannot be computed until the profile import is done.
- **Hierarchy drift.** Handled by freezing the chain at submission and auditing reassignments.
- **Key loss.** Losing `APPRAISAL_AMOUNT_KEY` loses all amounts. The key must be backed up outside the repo.
