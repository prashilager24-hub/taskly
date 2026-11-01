# Changelog

Context for contributors: **what changed in the frontend, the backend and the database, and what to do after pulling.**
Every push adds an entry at the top. Newest first. A section with nothing to report says "none".

Entry template:

```
## YYYY-MM-DD — short title  (commits: abc1234, …)
Summary: one or two lines on what and why.
### Frontend    – files and behaviour
### Backend     – files and behaviour
### Database    – migrations / schema / data (and the command to run)
### Env / config – new or changed values
### Notes       – caveats, parity with the Java backend, follow-ups
```

---

## 2026-11-01 — Appraisal: budget negotiation, own variable pay, final split view, departments follow edits (branch appraisal-flow-v2)

Summary: changes from the manager's review. The EL now accepts the Finance Head's budget or negotiates it (with a comment and, optionally, the amount they ask for); the Finance Head revises it; every step is logged and shown to both. Only an accepted budget can be split. Employees can override their variable pay on the hikes they appeal for. After the split, the EL and the Finance Head see one final table per department. An EL can add their own designation / team change. Separately (commit bc13711), a person's appraisal follows their department membership and user-record edits until the budget is set.

### Frontend
- Department Budgets (Finance Head): columns renamed "Department Total Expected" / "Department Total Targeted"; the button is "Submit budget" ("Submit revised budget" after the first one); a department whose EL is negotiating is highlighted on the board ("<EL> resubmitted for negotiation", asks ₹…) with a Respond button, and on its page with the EL's comment; a "Budget discussion" timeline shows every step; finalised departments have "View split", opening the final table.
- Budget Split (EL): a new first step, Accept budget / Negotiate budget (comment required, amount optional), beside the discussion timeline; the budget is not shown in the summary until accepted; the split opens only after accepting. After the split the "Decided by" column is gone; the bottom table is the final split: Name, Expected hike, Targeted hike, Accepted hike (fixed and variable under it), % of total budget, % of expected, % of targeted, with totals.
- My Appraisal: each hike field has a "Variable pay override" tick with Custom % / Custom ₹; fixed and variable are worked out from it. An EL accepting their hike can add a designation / team change, recorded at once.
- Team Allocation: the waiting message covers the budget being agreed.

### Backend
- [appraisal.flow.ts](../nodejs-backend/src/modules/appraisal/appraisal.flow.ts): round statuses BUDGET_WITH_EL (waiting for the EL), BUDGET_NEGOTIATION, BUDGET_ACCEPTED; `setBudget` logs PROPOSED / REVISED and is refused once accepted; new `respondBudget` (accept, or negotiate with a comment and optional amount; notifies the Finance Head); `saveSplit` needs an accepted budget; the round carries `budgetLog`, `elAcceptedAt`, and the approved fixed / variable per person; board rows carry the EL's latest ask.
- [appraisal.service.ts](../nodejs-backend/src/modules/appraisal/appraisal.service.ts): `splitWith` (level percentage, or the employee's own percentage / amount; variable can't exceed the hike); the appeal takes `expectedVariable` / `targetVariable`; level changes leave an own variable pay alone; an EL's own change request is stored as approved; menu counters include negotiations (Finance Head) and budgets to accept (EL). From bc13711: `syncOpenCycles` keeps undecided appraisals in line with department membership, A1 / A2, level and CTC until the department's budget is set; an EL in several departments lands in the one they lead; an inactive EL counts as none.
- Route: `PUT /appraisal/split/:departmentId/:period/budget-response` { accept, comment?, amount? }.
- `npx tsx src/scripts/appraisalFlowCheck.ts`: 69 checks (negotiation, own variable pay, EL change request, department / record edits).

### Database
- `010_appraisal_budget_negotiation.sql` (`npm run db:migrate`): AppraisalRound.Status gains BUDGET_NEGOTIATION and BUDGET_ACCEPTED, new column `ElAcceptedAt`; new table `AppraisalBudgetLog`; AppraisalHike gets `VariableOverride` (PCT / AMOUNT / NULL).
- To undo: `src/config/migrations/down/010_appraisal_budget_negotiation.down.sql` by hand (before the 009 down script if going back to appraisal-module).

### Env / config
none

### Notes
- A budget already sent to an EL before this change shows as "Waiting for EL to accept": the EL accepts it before splitting.
- An EL's own designation / team change needs nobody's approval (agreed with Management); tell us if Management or the Finance Head should approve it instead.

---

## 2026-10-31 — Appraisal flow v2: requests go up, money comes down (branch appraisal-flow-v2)

Summary: the appraisal now follows the "Taskly – Appraisal Cycle Workflow" brief. Everyone (Associate / Intern, FL, EL) appeals with expected hike, target hike and why. When a department is complete the Finance Head is told, reviews it and sets its budget with a reason. The EL splits it: their own hike (agreed with Management), people reporting to them directly, and a share with a note for each FL. Each FL allocates their share to the team with a reason per person, adds their own hike, and sends it to the EL, who approves (no reject). The hikes then go out. Associates / Interns may accept or reject; FLs and ELs accept. Designation / team requests: an Associate's goes to their FL, who forwards it with a recommendation to the EL; an FL's goes straight to the EL; the EL's approval opens the celebration. Built on a separate branch so it can be dropped: the previous flow is on appraisal-module (commit 317b4df).

### Frontend
- New pages ([components/appraisal/](../frontend/src/components/appraisal)): **Department Budgets** (Finance Head: all departments of an April / October cycle with appeals in, totals and status; a department page with every appeal on a timeline, the totals and the budget with a required reason), **Budget Split** (EL: the budget and the Finance Head's note, own hike with Management's comment, direct reports, a share and note per FL, then the FL proposals to approve), **Team Allocation** (FL: the share and the EL's note, a hike and reason per team member, own hike in its own box, justification, Submit to EL), **Change Requests** (FL forwards with Recommend / Do not recommend; EL approves or not), and a read-only **person page** (`/appraisal/person/:cycleId`).
- My Appraisal: one question ("Why are you expecting this salary / hike?"), a five-step tracker while waiting, Reject only for Associates / Interns, requests show where they are (with FL / with EL), the celebration stays.
- Removed: Team Appraisals, the assessor review form, the old Budget page. Sidebar: My Appraisal, Department Budgets, Budget Split, Team Allocation, Change Requests, HR Postponements, Appraisal Setup, each shown only to whoever needs it.

### Backend
- New [appraisal.flow.ts](../nodejs-backend/src/modules/appraisal/appraisal.flow.ts): department rounds (department + period), who decides each person's hike (EL own / EL direct / FL team / FL own), the Finance Head's board and budget, the EL's split and approval, the FL's allocation, postponed hikes returning to whoever decided them, in-app notifications at every hand-off.
- [appraisal.service.ts](../nodejs-backend/src/modules/appraisal/appraisal.service.ts): appeal submit -> SUBMITTED and "department complete" check; employee and person views with the stage; respond (FL / EL cannot reject; request routing; HR told of a rejection); `forwardRequests`; `decideRequests` by the department's EL; new sidebar data. Assessor reviews, the auto-decider and Finance approval of single hikes are gone; [appraisal.budget.ts](../nodejs-backend/src/modules/appraisal/appraisal.budget.ts) removed.
- Routes: `GET /periods`, `GET /departments`, `GET /departments/:id/:period`, `PUT /departments/:id/:period/budget`, `GET /split`, `PUT /split/:id/:period`, `PUT /split/:id/:period/shares/:fl/approve`, `PUT /split/:id/:period/direct/:cycleId`, `GET /allocation`, `PUT /allocation/:id/:period`, `GET /requests`, `PUT /cycles/:id/request-forward`. Removed: `/team`, `/assessor-review`, `/budget-approval`, `/finance-note`, `/budget*`.
- Daily job: with date windows on, a department goes to the Finance Head when the appeal window closes (non-submitters marked); postponed hikes return to the FL (EL approves again) or the EL.
- `npx tsx src/scripts/appraisalFlowCheck.ts`: end-to-end check of the whole flow on a temporary department (41 checks; everything it creates is deleted).

### Database
- `009_appraisal_flow_v2.sql` (`npm run db:migrate`): cycle statuses become EMPLOYEE_OPEN / SUBMITTED / OFFERED / ACCEPTED / POSTPONED (old ASSESSOR_OPEN / FINANCE_REVIEW -> SUBMITTED); cycles get `DepartmentID` and `PeriodStart`; new tables `AppraisalRound`, `AppraisalShare`, `AppraisalAllocation`; `AppraisalRequestReview.Recommendation`. The old `AppraisalBudget` / `AppraisalBudgetAlloc` tables are left in place, unused.
- To go back to appraisal-module: run `src/config/migrations/down/009_appraisal_flow_v2.down.sql` by hand, then switch branch.

### Env / config
none

### Notes
- Decisions taken as recommended in the blueprint: a department also goes to the Finance Head when the window closes; the EL's own hike counts against the department budget and the EL accepts it; own hikes come out of the budget being split; FLs have no Reject; after the EL approves only an Admin can change a hike; hike reasons are seen by the EL and Finance Head only; FL / EL come from the user record.
- While testing (`APPRAISAL_TIME_WINDOWS=false`) department members who have not opened My Appraisal count as "not submitted"; the Finance Head can still set a budget early.

---

## 2026-10-31 — Appraisal: assessor chain, HR setup, testing mode (branch appraisal-module, checkpoint before the v2 flow)

Summary: the last assessor set on an appraisal decides the hike; HR keeps joining date, level and CTC and the April / October cycle follows; while date windows are off everyone can open and appeal. Checkpoint commit before the v2 flow (branch appraisal-flow-v2).

### Frontend
- Hike boxes show Fixed and Variable as two compact tiles; the employee-facing "Overall rating" box is gone.
- Team Appraisals progress shows Self and the real assessors (A1, A2), the one with the last word marked Final.
- My Appraisal celebrates an approved designation / team change; a declined one is shown gently ("Not this cycle").
- Appraisal Setup (HR only): joining date, level, CTC, automatic April / October cycle, Save starts the appraisal when due; template download and bulk upload with a checked preview. No "Start cycle" button.
- EL budget split lists FLs / Managers only (not the EL or Admins).

### Backend
- `hierarchy.ts`: assessors come from Reporting manager and Executive Leader on the user record, junior first; the senior one decides.
- `appraisal.service.ts`: decider = Assessor 2 if set, else Assessor 1; Finance approves only when nobody is set. `ensureCycle`, `people`, `POST /people/bulk`; HR = HR roles + the HR Operations department. Testing mode (`APPRAISAL_TIME_WINDOWS=false`): My Appraisal starts a cycle on first open; the menu shows for everyone.
- Daily job starts April / October cycles instead of anniversaries.

### Database
none (no schema change)

### Env / config
none

### Notes
- No minimum tenure before the first appraisal yet.

---

## 2026-10-29 — Appraisal module (branch appraisal-module)  (commits: see branch)

Summary: yearly appraisal flow from the Appraisal Module spec, reworked after the product owner's walk-through (Part A from PMS, FL / EL review of requested changes, hike budget Finance -> EL -> FL, EL approves hikes). Each person's cycle starts on their joining anniversary: days 1 to 15 the employee fills the form, days 16 to 30 the two assessors, then Finance approves the budget, then the employee can only Accept or Reject the offer (reject postpones the hike by 3 or 6 months, HR decides on it). Every hike amount is annual and split into fixed + variable by level on the server. The **Appraisal** menu sits after PMS and appears only while there is something open for the person.

### Frontend
- Sidebar ([components/sidebar.tsx](../frontend/src/components/sidebar.tsx)): new **Appraisal** group after PMS with My Appraisal, Team Appraisals, Budget Approval, HR Postponements, Appraisal Setup. Each item shows only when `GET /appraisal/availability` says it has something for the person now, and the whole group is hidden when nothing is (so an employee sees it from their cycle start until 30 days after they accept; an assessor while a team cycle is running; Finance and HR also always see Setup). Availability is re-asked on every page change.
- Routes in [App.tsx](../frontend/src/App.tsx): `/appraisal`, `/appraisal/team`, `/appraisal/team/:cycleId`, `/appraisal/budget`, `/appraisal/hr`, `/appraisal/setup`; pages in [pages/appraisalPages.tsx](../frontend/src/pages/appraisalPages.tsx), screens in [components/appraisal/](../frontend/src/components/appraisal).
- My Appraisal: status stepper, Q1 to Q4 grid (one row per quarter), ten self-review questions, expected and target hike with a live `₹1,00,000 → ₹90,000 fixed + ₹10,000 variable` preview, optional designation / team change request, Save draft and Submit; read-only with a closed banner once the window ends. The Offer panel (ratings, approved hike as annual / fixed / variable / per half-year, Accept with confirm, Reject form with 3 or 6 months, reason and expectations) appears when the offer is out.
- Team Appraisals (A1, A2) and the review form (see above). HR Postponements: approve or return with a comment. Appraisal Setup (Finance / HR): joining date, level and current CTC per person, and "Start cycle" for exceptions.
- **Part A comes from PMS**: [PmsTable.tsx](../frontend/src/components/appraisal/PmsTable.tsx) shows the four quarters (target, goal, utilization, efficiency, system grade, manager and final rating, grade label, manager feedback) taken from the person's PMS Quarterly Reviews. Nobody types it. Part B (ten self-review questions) is optional; Part C is the expected / target hike and the designation / team requests, each with a comment.
- **Team Appraisals** is consolidated: one table per FL with PMS average, what each person asks for, the proposed hike, status and progress. An EL sees one group per FL, with that FL's budget, used and left.
- **Review form (FL / EL)**: the FL comments on each requested change and proposes a hike, with the team budget left shown while they type; the EL also approves or rejects each request, then gives the final approval of the hike. Finance gets the same approval for an EL's own hike, or writes a note to that EL.
- **Budget page** ([Budget.tsx](../frontend/src/components/appraisal/Budget.tsx)), a different view per role: Finance gives each department a yearly budget (search, departments with a budget first) and sees EL hikes waiting; an EL splits their department budget between the FLs; an FL sees only their own share. An Associate sees nothing. The old Budget Approval page is gone.
- The Associate sees the EL's decision and comment on each request once the offer is out (never the FL's comment).
- **Associate screen, reworked after review**: no cycle / status / level / salary strip and no step bar. One button, **Appeal for Appraisal**, opens the appraisal on the page in two tabs: *Goals and targets by quarter* (PMS numbers read-only, then per quarter **Comments, Biggest achievements, Biggest failures** to fill in, [QuarterGrid.tsx](../frontend/src/components/appraisal/QuarterGrid.tsx)) and *Hike proposal* (expected / target hike, designation and team requests). The written self-review questions (Part B) are removed. The **only pop-up** is the offer, once the EL has approved: amount, fixed / variable / half-yearly, the approval state of each requested change, and Accept / Reject ([OfferModal.tsx](../frontend/src/components/appraisal/OfferModal.tsx)).
- **Associate screen, second rework**: three tabs. *Goals and targets by quarter* is read-only and all from PMS, including the per-quarter **Comments / Biggest achievements / Biggest failures**, taken from the PMS manager feedback (Meets Expectations -> comments, Exceeds -> achievements, Needs Improvement -> failures). *Hike proposal* holds only the expected / target hike with its own Save draft / Submit for review. *Proposed hike* says it is waiting until the EL approves, then shows the amount with Accept / Reject. Accepting opens a pop-up asking (optionally) for a new designation and / or team with a reason; those go to the EL, who gives the final decision ([MyAppraisal.tsx](../frontend/src/components/appraisal/MyAppraisal.tsx), [OfferModal.tsx](../frontend/src/components/appraisal/OfferModal.tsx)). The EL decides on the review page ("Requested changes", "Decide changes" on the team list).
- **The EL's amount is the final hike**: with date windows off there is no separate approval step for an Associate or an FL. Once the needed reviews are in, the EL's hike from their review ("Final hike" on the EL's form) becomes the approved hike and the offer goes straight to the employee. An EL's own hike still waits for Finance. The "Final approval" panel stays only for a cycle that reached it with no EL amount.
- **Finance Head**: a real person now acts as Finance, not only a role ID. By default it is the head (EL) of the *Strategic Financial Management* department (Mithilesh, UserID 141); an Admin can choose someone else in Appraisal Setup (`GET` / `PUT /appraisal/finance-head`, stored as `AppSetting.financeHeadUserId`). Inside the appraisal module the Finance Head gets Finance rights (`FINANCE_HEAD_ROLE`): all department budgets, every appraisal in Team Appraisals, approving ELs' hikes. They keep their EL duties: reviewing their own departments' people, and splitting their own departments' budgets between FLs (Budget page, "Your own departments"). `APPRAISAL_FINANCE_ROLE_IDS` still works next to it (the test Finance role uses it).
- **No date windows for now** (`APPRAISAL_TIME_WINDOWS`, default `false`): submitting sends the appraisal straight to the FL, EL and Finance; once the reviews that are needed are in (Associate: FL and EL; FL: the EL; EL: none) it moves to final approval by itself. Assessors can change their review until the hike is approved. The daily job then only creates cycles and returns postponed offers. Set `APPRAISAL_TIME_WINDOWS=true` to bring the 15-day windows back.
- **FL and EL have their own appraisal** (My Appraisal, same three tabs). Who decides, by level (`deciderRole`): Associate -> the EL as Assessor 2; FL -> the EL as Assessor 1; EL -> Finance for the hike, the CEO (or an Admin) for a designation / team change. The decider sees the approved hike and the decisions. The test seed gives the FL and EL PMS quarters; `advance` sets the status directly when windows are off.
- **FL and EL see the employee's hike proposal**: the expected and target hike (with the split) and the four reasons, in "The employee's hike proposal" panel and an "Expected hike" column on Team Appraisals. The spec had hidden these from the assessors; the product owner wants them visible.
- **Third round**: four questions go with the hike, inside the Hike proposal tab under "Why this hike" (why you deserve this salary, biggest milestone, biggest achievement, why you expect this much salary); there is no separate Self review tab. FL / EL / Finance read the answers. The six other questions from the spec are no longer asked; old answers stay stored. The person being appraised (an Associate, or an FL / EL in their own appraisal) now sees each assessor's **proposed hike and comment** once that assessor has submitted; never a draft, the rating or the manager feedback. The PMS table no longer shows the efficiency label (At Par / High).
- **Comments travel upwards only**: the Associate sees no assessor rating or comment (only the EL's decision on each request, as a tag); the FL sees their own review; the EL sees the FL's too; Finance sees everything (`maskCycle`).
- The approval stage is labelled **Final approval** ("By the EL", or "By Finance" for an EL's own cycle) instead of "Finance / Budget approval".
- The screens draw only the keys the API sent, so a field hidden for a role leaves no empty box.

### Backend
- New module [modules/appraisal/](../nodejs-backend/src/modules/appraisal): `appraisal.calc.ts` (split rule, IST date helpers), `appraisal.mask.ts` (`maskCycle`: hidden keys are removed, not null), `appraisal.service.ts` (transactions, status + date guards, audit rows), `appraisal.routes.ts` (zod). Mounted at `/t2.0/authentificationUtilization/appraisal` in [app.ts](../nodejs-backend/src/app.ts).
- Routes: `GET /availability`, `/my`, `/team?status=`, `/hr`, `/people`, `/cycles/:id`; `PUT /cycles/:id/self-review`, `/assessor-review`, `/budget-approval`, `/hr-decision`, `/people/:userId`; `POST /cycles/:id/respond`, `/cycles`. 403 wrong role, 409 closed window or wrong status ("Appraisal window is closed"), 422 validation.
- Daily job [jobs/appraisalCycle.ts](../nodejs-backend/src/jobs/appraisalCycle.ts) at 00:30 IST, registered in [server.ts](../nodejs-backend/src/server.ts): creates cycles on joining anniversaries, moves EMPLOYEE_OPEN to ASSESSOR_OPEN (day 16) to FINANCE_REVIEW (day 31), returns postponed offers to the assessors with a new 15-day window, sends reminders (employee day 10 and 14, assessors day 25, Finance on arrival; each sent once). Safe to run twice. `APPRAISAL_JOB_ENABLED=false` switches it off.
- **Part A**: `loadFull` reads `quarterlyreview` for the 12 months before the cycle began (`pms`, visible to the employee, FL and EL, not to Finance or HR). The per-quarter ratings typed by assessors are no longer used by the screens; the API still accepts the old fields.
- **Requests**: asked by the employee when accepting (`request` on `POST /respond` ACCEPT); the EL gives the final decision with `PUT /cycles/:id/request-decision` (A2 or Admin, once per change, only after acceptance). The FL and Finance cannot decide; the employee sees the decision only, the FL not at all, Finance with the EL's comment. Requests made in the self review and the review-time comments are no longer used by the screens.
- **Hike**: the FL's and EL's "minimal hike" is now their **proposed hike** (same column, new label). The final approval is given by the **EL** for an Associate / FL cycle and by **Finance** for an EL's own cycle (`canApproveHike`; Admins can step in). `PUT /cycles/:id/finance-note` lets Finance write to an EL about the budget; only that EL sees it.
- **Budget** ([appraisal.budget.ts](../nodejs-backend/src/modules/appraisal/appraisal.budget.ts)): `GET /budget`, `PUT /budget/department` (Finance), `PUT /budget/allocation` (the department's EL). Per year and department. Finance cannot set a budget below what the EL has given out, the EL cannot give out more than the budget, an FL sees only their own share, an Associate gets nothing. "Used" is the approved hike once it is on offer or accepted, otherwise the FL's proposal; postponed hikes and the EL's own hike are not counted.
- Dev tool [scripts/appraisalTest.ts](../nodejs-backend/src/scripts/appraisalTest.ts) (never runs in production): `seed` creates the department "Appraisal Cycle Test" with an EL, an FL, three associates, Finance and HR (all `appraisal.*@tapmind.test`, password `Test@12345`) and starts Associate 1's cycle; `advance <name> assessor|finance|return` moves a cycle to the next window so a whole cycle can be tried in one sitting; `status`, `start`, `reset [name]`, `reset-budget`, `remove`. `seed` also writes four PMS quarters for each test associate.
- Access: new `appraisal` module in [access/catalog.ts](../nodejs-backend/src/modules/access/catalog.ts); the router needs `appraisal` read.

### Database
- New migration [006_appraisal.sql](../nodejs-backend/src/config/migrations/006_appraisal.sql): adds `Users.DateOfJoining`, `Users.EmployeeLevel`, `Users.CurrentAnnualCtc`; creates `AppraisalCycle`, `AppraisalQuarter`, `AppraisalQuarterReview`, `AppraisalReview`, `AppraisalHike`, `AppraisalRequest`, `AppraisalResponse`, `AppraisalAudit`; gives every role except Admin `appraisal` read.
- PMS notes (`comments`, `achievements`, `failures`) are derived per quarter in `pmsQuarters`; no schema change. `AppraisalQuarter.Comments` from 008 is no longer filled by the screens.
- New migration [008_appraisal_quarter_comments.sql](../nodejs-backend/src/config/migrations/008_appraisal_quarter_comments.sql): `AppraisalQuarter.Comments`. The quarter rows are the four calendar quarters that ended before the cycle began (`quarterSlots`), returned as `slots`.
- New migration [007_appraisal_budget_requests.sql](../nodejs-backend/src/config/migrations/007_appraisal_budget_requests.sql): `AppraisalRequestReview`, `AppraisalBudget`, `AppraisalBudgetAlloc`.
- Backfills `EmployeeLevel` from the role (Executive Leader = HEAD_EL, Functional Leader / Manager / Lead = MANAGER, everyone else = ASSOCIATE; Admins are left empty). **`DateOfJoining` is empty for everyone**: set it in Appraisal Setup, or no cycle starts.
- **After pulling, run `npm run db:migrate` in `nodejs-backend`.**

### Env / config
- `APPRAISAL_FINANCE_ROLE_IDS`, `APPRAISAL_HR_ROLE_IDS` (comma separated RoleIDs, default empty) and `APPRAISAL_JOB_ENABLED` (default true), in [config/env.ts](../nodejs-backend/src/config/env.ts) and `.env.local.example`. Admins (role 1) always act as Finance and HR. There is no Finance or HR role in `AMRole` yet: create them in Access Management, then put their RoleIDs here.

### Notes
- The flow changes (Part A from PMS, budget chain, EL approves) come from the product owner's brief and replace the spec's "Finance approves every hike" and its minimal-hike wording. The FL never sees the employee's expected or target hike, nor per-person approved hikes, only their team's used / left.
- Budget is soft: the form shows what is left in red when a proposal goes over, but only the allocation itself is capped. Approving above the share is not blocked.
- Deviations from the spec: (1) the migration is in `src/config/migrations` (the repo's runner) instead of `sql/appraisal_001.sql`; (2) Assessor 1 and 2 are taken from the hierarchy resolver (`assessorsOf`, same rules as Quarterly Review) at creation instead of reading `ReportingManagerID` / `ElManagerID` directly, because those columns are empty for many people; (3) responses use the repo's `{ success, response }` shape.
- Existing data: `Users.AppraisalCycle` already holds APRIL / OCTOBER for 84 people. The spec's joining-anniversary rule does not use it. Confirm with the product owner which one is meant.
- Assumptions from the spec are built as written and kept in one place each: the split percentages in `VARIABLE_PCT` (`appraisal.calc.ts`), the visibility table in `maskCycle`, ratings 1.0 to 5.0. Choices the spec left open: a user's own cycle is always viewed as the employee, even for an Admin; on Submit the employee must enter expected and target hike, assessors an overall rating and a minimal hike; assessors can edit until the window closes even after submitting; a rejection is hidden again once the offer returns to the assessors (it stays in the audit trail).
- Checked: 55 checks over the real API for the new flow (budget chain and its limits, Part A numbers, requests and EL decisions, EL approval and the refusals for FL / Finance / Associate, an EL cycle approved by Finance with the note going to the EL only, menu per person), then each screen in a browser; 34 earlier checks on the seeded people; 18 unit tests (split, dates, masking per role); an HTTP walk with five real logins covering draft, closed windows, role limits, the 3-month rejection, HR, the return to assessors and Accept (86 checks, all passing); the job run twice on one day; the screens in a browser (light and dark, phone width). Throwaway test users and data were removed afterwards.
- Part A uses the quarters ending in the 12 months before the day the cycle was created. A person with no PMS review that year sees "No PMS quarterly review was found".
- Not tested: the new Budget screens on a phone, reminder emails (SMTP is not configured locally), saving a row on the Appraisal Setup screen in a browser (it renders; the API behind it was tested), a Finance or HR role other than Admin.
- Source files use CRLF line endings.

---

## 2026-10-29 — PMS section, Notifications, Hierarchy and assessors, Daily Activity by level  (commits: 658905c, 40e7a81, a9b0e72, c09d2d0, e70016d, ef2fb89, 2bbdaab)

Summary: a batch of earlier work that was pushed without a changelog entry, written up now so it is not lost. PMS becomes its own sidebar section, admins can send Notifications, the reporting ladder decides who reviews whom, and team members get a reduced Daily Activity form. Merged with the dashboard work above; the Taskly dashboard still shows the production numbers after the merge.

### Frontend
- Sidebar ([components/sidebar.tsx](../frontend/src/components/sidebar.tsx), [App.tsx](../frontend/src/App.tsx))
  - **Dashboard** group with two items: Taskly (`/dashboard`) and PMS Dashboard (`/pms/dashboard`). **PMS** is its own group: Goal Setting, Manager Feedback, Quarterly Review, Report. Routes are `/pms/dashboard`, `/pms/goal-setting`, `/pms/manager-feedback`, `/pms/quarterly-review`, `/pms/report`; `/pms` redirects to the first tab the person may open. [pages/pmsPages.tsx](../frontend/src/pages/pmsPages.tsx) holds the page wrappers.
  - The old in-page PMS tabs and the sidebar announcement are gone. Onboarding is hidden 45 days after the join date ([lib/onboarding.ts](../frontend/src/lib/onboarding.ts); `joinedAt` is now in the login session).
- Notifications: [pages/notifications.tsx](../frontend/src/pages/notifications.tsx) (Admin screen to create / edit / end a notification for everyone, departments, roles or named people) and [components/notifications/](../frontend/src/components/notifications) (the bell in the top bar; a person can close a notification and it stays closed).
- PMS pages
  - [goalSetting.tsx](../frontend/src/components/goalSetting.tsx) rewritten; [monthlyReview.tsx](../frontend/src/components/monthlyReview.tsx) (Manager Feedback) made compact.
  - [pmsDashboard.tsx](../frontend/src/components/pmsDashboard.tsx): starts on a chosen department and employee instead of everyone; newest quarter first (your colleague then reversed the quarter tabs to oldest first, newest still selected); a compact **live preview strip** above the review, with the grading guide in a popover.
  - [pmsReport.tsx](../frontend/src/components/pmsReport.tsx) reduced to the report cards only. Monthly Breakdown in Quarterly Review now shows data (see Backend).
  - [quarterlyReview.tsx](../frontend/src/components/quarterlyReview.tsx) takes the assessors from the server (see Backend). The form layout itself is **not** redesigned yet.
- Access Management: new **Hierarchy** tab ([access/HierarchyTab.tsx](../frontend/src/components/access/HierarchyTab.tsx)): the ladder with counts, who reviews whom, who is the CEO / CBO, and everyone with their two assessors.
- Daily Activity ([DailyActivityLog.tsx](../frontend/src/components/DailyActivityLog.tsx), [pages/forms.tsx](../frontend/src/pages/forms.tsx)): Managers, Leads and above can pick a team member; for a team member's day only **Target** and **Goal** entry are shown. A person's own day keeps Task, Target and Goal.
- Date range filter: [DateRangeField.tsx](../frontend/src/components/DateRangeField.tsx) takes an optional `label`. With a label it renders as a field (height `h-14`, label inside, chevron) so it lines up with the Select boxes beside it. Used by the PMS dashboard filters. It also copes with an empty range ("All dates") instead of crashing.
- Crash guards for missing data in [History.tsx](../frontend/src/pages/History.tsx), [QueryReport.tsx](../frontend/src/pages/QueryReport.tsx), [salesForward.tsx](../frontend/src/pages/salesForward.tsx). Query & HR inbox redesigned (`HR - Modules Taskly/.../QueryEmployee.jsx`).

### Backend
- Hierarchy: [access/hierarchy.ts](../nodejs-backend/src/modules/access/hierarchy.ts) (new). Ladder: Admin (CEO / CBO) > Executive Leader > Functional Leader / Manager / Lead > Employee > Intern. Assessors:
  - Employee / Intern: accessor 1 = their manager or FL, accessor 2 = their EL.
  - FL / Manager / Lead: accessor 1 = the EL of their department, accessor 2 = CEO / CBO (optional).
  - EL: accessor 1 = CEO / CBO, no accessor 2.
  - A manager or EL set on the person (`ReportingManagerID`, `ELManagerID`) wins over the department's leaders. The CEO / CBO is `AppSetting.ceoUserId`, else the first real Admin account.
- New routes in [access/access.routes.ts](../nodejs-backend/src/modules/access/access.routes.ts): `GET /access/hierarchy`, `PUT /access/hierarchy/ceo`, `GET /access/assessors/:userId`.
- Notifications: [modules/notifications/](../nodejs-backend/src/modules/notifications) (new), mounted at `/notifications` in [app.ts](../nodejs-backend/src/app.ts). Timestamps are written from Node, not MySQL `NOW()`, to avoid a time-zone shift.
- [access/catalog.ts](../nodejs-backend/src/modules/access/catalog.ts): PMS is split into `pms_goals`, `pms_feedback`, `pms_quarterly`, `pms_dashboard`, `pms_report`; new `notifications` module under Admin.
- [reports/reports.service.ts](../nodejs-backend/src/modules/reports/reports.service.ts) `getUserSummary` returns the aggregates plus `DailyData` (it used to return raw rows, which showed zeros / NaN on the employee dashboard).
- [reports/efficiencySummary.service.ts](../nodejs-backend/src/modules/reports/efficiencySummary.service.ts) and [userGoalData/userGoalData.service.ts](../nodejs-backend/src/modules/userGoalData/userGoalData.service.ts): `monthlyBreakdown`, `isQuarterly`, `revisedGoal` so Monthly Breakdown fills in.
- [auth/auth.service.ts](../nodejs-backend/src/modules/auth/auth.service.ts): `joinedAt` (from `UserCreateTime`) in the session.

### Database
- New migration [004_notifications_pms_tabs.sql](../nodejs-backend/src/config/migrations/004_notifications_pms_tabs.sql): creates `Notification` and `NotificationState`, and splits the `pms` privilege into the five PMS tab keys on `AMRole` so existing roles keep what they could see.
- **After pulling, run `npm run db:migrate` in `nodejs-backend`** (applies 004 to 008; 005 is from the entry above).
- No schema change for the hierarchy: it only reads `Users`, `Department`, `DepartmentUser`, and writes one `AppSetting` row (`ceoUserId`).

### Env / config
- None.

### Notes
- Verified in a headless browser as Super Admin: Taskly and PMS dashboards, the Hierarchy tab, Notifications, date range alignment (light and dark). Notifications targeting and the hierarchy assessors were checked through the API.
- **Not tested:** submitting a Daily Activity log as a manager, the Grading guide popover, the manager / EL / FL dashboards after the merge.
- Open: Quarterly Review form layout; default module access per level is not driven by the hierarchy yet.
- Local test accounts `superadmin1@tapmind.com` / `superadmin2@tapmind.com` are created by hand in the local database; they are not part of the repo.
- Source files use CRLF line endings.

---

## 2026-10-29 — Dashboard matches production, role-based overviews, Sales Forward removed  (commits: 7edc52e, b0f9468, d5fbc95)

Summary: the Node `DashBoardAll` numbers now match the Java backend (production). Executive Leaders, Functional Leaders and everyone else get the same overview design as Admin, scoped to their own data. Sales Forward is removed from the menu and from Access Management.

### Frontend
- [pages/dashboard.tsx](../frontend/src/pages/dashboard.tsx)
  - Admin keeps the company overview. Leaders get a team overview, everyone else a personal overview. The old non-admin layout, its helpers and dead state were removed (about 950 lines).
  - Each role asks the API for its own slice: a leader sends `elID` / `flID` with `userID: null`; anyone else sends their own `userID`.
  - Role checks use the `isHeExecutiveLeader` / `isHeFunctionalLeader` flags from login instead of hard-coded role numbers, and the handlers no longer crash when a response is missing.
- [components/overview/RoleOverviews.tsx](../frontend/src/components/overview/RoleOverviews.tsx) (new)
  - `TeamOverview` (Executive / Functional Leader): team pulse, a bubble map with one bubble per person, and Top / Needs help / Departments rankings.
  - `PersonalOverview` (everyone else): pulse gauge, hours, efficiency, and **Your days**, a calendar of small tiles (date and hours, colored by target), a week-by-week average target and hours beside each row, and a selected-day panel.
  - Calendar dates are read from the API's UTC midnight so the day is right in any time zone.
- [components/overview/AdminOverview.tsx](../frontend/src/components/overview/AdminOverview.tsx): now exports `Speedometer`, `Bullet`, `DeptMap`, `RankRow`, `Rules` and the `Bubble` type so the three views share one look.
- [components/pmsDashboard.tsx](../frontend/src/components/pmsDashboard.tsx): quarter and month tabs run oldest to newest (Q1, Q2, …); the newest is still selected by default.
- [components/sidebar.tsx](../frontend/src/components/sidebar.tsx), [App.tsx](../frontend/src/App.tsx): Sales Forward menu item and `/sales-forward` route removed. [pages/salesForward.tsx](../frontend/src/pages/salesForward.tsx) is left in place and unreferenced.

### Backend
- [reports/dashboardRollup.ts](../nodejs-backend/src/modules/reports/dashboardRollup.ts) (new): port of the Java `getCompanySummary` / `getELSummaryUsers` / FL equivalent. Numbers are averages of averages: user -> department -> leader -> company.
  - Full-day leave is excluded. Target averages count only targets above 0 (a user's days also count in department 54).
  - Only Executive Leaders with `RoleID 3` and Functional Leaders with `RoleID 4` are rolled up. Leaders with no logged work in the range are left out, as in Java.
  - Goal rules: user 90, user 117, departments 21 / 37 / 22, and the "goal equals target" users (135, 122, 131, 112, 102, 121, 108).
  - Loads the data in a few bulk queries and rolls up in memory; Java runs several queries per user.
- [reports/reports.service.ts](../nodejs-backend/src/modules/reports/reports.service.ts)
  - `departmentType` (`business` | `support` | `all`) now filters every dashboard query, using `PrimaryDepartment.Type`. It was ignored before, so the three tabs showed identical numbers.
  - The company summary comes from the roll-up. The flat query only supplies headcounts (`TotalUsers`, `TotalDepartments`).
  - Leader requests (`elID` / `flID` with the leader flag) return leader -> departments -> users. They used to return flat user rows, which made leader dashboards show zeros. `elSummaryAdmin.eldata` is filled in for Admin.
  - EL, FL and department lists also return `AvgAllocatedHrs`, `AvgTotalWork` and `EfficiencyLevel`.
  - The old flat `getELSummaryUsers` / `getFLSummaryUsers` were removed.
- [access/catalog.ts](../nodejs-backend/src/modules/access/catalog.ts): `salesfwd` module removed, so it no longer appears in Access Management. [config/seed.ts](../nodejs-backend/src/config/seed.ts) and [config/seed-demo.ts](../nodejs-backend/src/config/seed-demo.ts) no longer grant it.

### Database
- New migration [005_remove_sales_forward.sql](../nodejs-backend/src/config/migrations/005_remove_sales_forward.sql): removes the `salesfwd` key from `AMRole.RolePrivileges`, `DepartmentAccess.Privileges` and `UserAccess.Grants` / `Denies`. Data only, no schema change.
- **After pulling, run `npm run db:migrate` in `nodejs-backend`.** Migrations 002 to 004 (access management, support access, notifications) must be applied too. The production dump is only the base schema; the migrations bring it up to date (for example the login needs the `ThemePreference` column from 001).

### Env / config
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` must be set in `nodejs-backend/.env`, otherwise the server crashes on start (`push.service.ts`), even though `.env.local.example` calls them optional. Generate a pair with `npx web-push generate-vapid-keys`.

### Notes
- Checked against production for 29 Sep to 29 Oct 2026, Whole Company: target 84.64, allocated 10.25h, worked 10.14h, goal 69.2. Department levels 3 High / 5 At Par / 21 Low.
- All leaders and users showing "Low" in `elSummaryAdmin.eldata` is expected: it is scored from the efficiency level stored on each daily row, which is almost always "Low" in the dump.
- Not ported from Java (one-off rules): the April to June 2026 windows for departments 19 / 22 / 42 and users 153 / 154 / 155 / 158, and department 23's TAM-account target. Ranges that fall in those windows can differ from production.
- Who sees which dashboard: Admin (`RoleID 1`) sees the company overview. Executive and Functional Leaders who lead a department see their team. Everyone else sees their own numbers. A role 3 or 4 user who leads no department is treated like an employee.
- Source files use CRLF line endings; keep them to avoid whole-file diffs.
