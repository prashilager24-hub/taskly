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

## 2026-11-03 — Query & HR: L&D queue fix and "Receives queries for" in Access Management  (commit: pending)
Summary: an L&D person now sees the L&D queue (it always loaded the HR one), and Access Management can set who receives HR and L&D queries.
### Frontend
- `HR - Modules Taskly/.../TasklyHRModules.jsx`: a resolver loads the queue of their own team (HR or L&D) instead of always HR. `lib/api.js`: the team is URL-encoded (`L&D` used to reach the server as `L` and was rejected).
- `components/access/UsersTab.tsx`: new **HR Support → Receives queries for** (None / HR / L&D) when adding or editing a user. It saves the user's existing feedback resolver team.
### Backend
- `auth/auth.schema.ts`: `feedbackresolverteam` on create and update is now `HR` or `L_D` (or null to clear); anything else is rejected.
### Database
- none
### Env / config
- none
### Notes
- The person has to sign in again to see the change; the team is read at sign-in.

## 2026-11-03 — Dashboard user summary matches Java (leave days, departments first)  (commit: pending)
Summary: the person's own dashboard (`/DashBoardAll` with a user) now averages like Java: full-day leave days are dropped, each department the person worked in is summarised on its own, then the departments are averaged. Before, every daily row was averaged together, leave days included.
### Frontend
- none
### Backend
- `reports/reports.service.ts`: `getUserSummary` replaced by `getUserSummaries(filter, withDailyData)` (Java `getUserSummary` / `getUserSummaryForUsers`). A role 2 request also returns `DailyData` (leave days left out); other roles get the averages only. The business / support split applies to the non-role-2 path, as in Java.
- `reports/efficiencySummary.service.ts`: new `dashboardUserRows` (the person's day rows with the leave type attached and the department 19 / 23 / 22 target rules applied, using the dashboard's own goal rule); `computeRowAverages` exported.
- `calculations/calculationLogic.ts`: `calculateTarget({ kind: 'userAverage' })` (a person across departments, zeros counted); `calculateGoal({ kind: 'day', rules: 'dashboard' })` (the dashboard's goal rule: department 7 is 100, department 19 its own rule, everyone else the average of the day's goals).
### Database
- none
### Env / config
- none
### Notes
- Checked against production for every user, three date ranges, role 1 and role 2: 402 of 408 identical. The rest are local test entries added for one user, and two rows of the same day that Java returns in a different order.
- Still not ported: `userGoalSummary` that Java returns next to `userSummary` for a role 2 request.

### Performance Insights target (same entry)
- `/efficiency-report` (`pages/efficiency.tsx`) now sends `targetByDepartment: true`; `list-efficiency-summary` then sets that person's summary Avg Target % the dashboard's way (each department on its own, then averaged, from the dashboard's day rows). Every other caller of the API is unchanged. Only the summary figure moves; the table rows, utilization, hours and goal stay as they were.

## 2026-11-03 — Utilization and efficiency calculation in one place  (commit: pending)
Summary: every utilization % and every efficiency level now comes from `calculateUtilization` and `calculateEfficiency` in `calculations/calculationLogic.ts`, next to the goal and target logic. No change in results.
### Frontend
- none
### Backend
- `calculationLogic.ts`: new `calculateUtilization({ kind: 'day' | 'average' })`. 'day' is the day's time taken ÷ standard hours (moved out of the daily efficiency calculation); 'average' is the 2-place mean used for user, department, EL and company figures (`skipMissing` for the EL average).
- `calculateEfficiency` gained `kind: 'levelScore' | 'scoreLevel' | 'periodLevel' | 'reportLevel'` for the level of an average (High 3 / At Par 2 / Low 1 scores, a period's average target and utilization, a person's summary against allocated hours). The day, live account and closed position kinds are unchanged.
- `reports/dashboardRollup.ts`, `reports/efficiencySummary.service.ts` and `reports/reports.service.ts` call these instead of their own sums, means and level rules (`levelScore` / `scoreToLevel` removed from `dashboardRollup.ts`). New unit tests: `calculations/utilization.test.ts`, `calculations/efficiency.test.ts`.
### Database
- none
### Env / config
- none
### Notes
- Checked against production with the same requests: 136 user and 100 department cases identical; the remaining differences are the known ones (production fails on very large ranges, Java's order of same-date rows, Java returns 500 for week/month grouping).
- The `AVG(e.UtilizationPercent)` averages and the `CASE ... 'High' / 'At Par'` level rules written in SQL in `reports/reports.service.ts` still run in the database.

## 2026-11-03 — Quarter notes: employee's biggest achievement and failure  (commit: pending)
Summary: each employee writes their own biggest achievement and biggest failure per quarter (Quarter Highlights). The manager's PMS Quarterly Review cannot be submitted until both are in, and Appraisal reads them instead of guessing from feedback categories.
### Frontend
- New page `/pms/my-quarter` ("Quarter Highlights", PMS menu): `components/QuarterNotes.tsx`, route in `App.tsx`, `PmsMyQuarterPage` in `pages/pmsPages.tsx`, sidebar item. One text box each per quarter, 1000 characters, only the signed-in person writes them; future quarters are closed and a quarter locks once its review is submitted.
- `components/quarterlyReview.tsx`: the review form shows the employee's notes read only (section 4) and disables "Save Quarterly Review" for a new review until the employee has written them.
- Appraisal quarter grid / My Appraisal wording updated (`QuarterGrid.tsx`, `MyAppraisal.tsx`).
### Backend
- New `modules/reviews/quarterReflection.service.ts`; routes in `reviews.routes.ts`, mounted at `/quarter-reflection` in `app.ts`: `GET /mine?year=`, `PUT /mine` (always the token's user), `GET /employee/:empId?quarter=&year=` (reviewers, needs `pms_quarterly`).
- `createQuarterly` now rejects with 400 when the employee has no notes for that quarter. Updating an already submitted review is not blocked.
- `appraisal.service.ts`: achievements / failures come from the notes; older quarters without notes fall back to the previous feedback-category text.
- New permission `pms_my_quarter` (Quarter Highlights) in `access/catalog.ts`.
### Database
- Migration `022_quarter_reflection.sql`: table `QuarterReflection` (unique per user, quarter, year) and `pms_my_quarter` granted to every role. Down script in `migrations/down/`. After pulling run `npm run db:migrate`.
### Env / config
- none
### Notes
- Reviews submitted before this change are not affected; only new reviews need the notes.
- Per-user and per-department access overrides do not get `pms_my_quarter` automatically; roles do.

## 2026-11-03 — Push: modules audit (parts 1–3) into main  (commits: 0c1501f, fa0ad85, 43a969d and the layout fix below)

Summary: the modules-audit branch goes into main: user form and notifications (part 1), user types and user roles (part 2), Department Management (part 3). The details are in the three entries below.

### Frontend
- Department page: the sub department cards now come first, the people table after them.
### Backend
- none beyond parts 1–3
### Database
- Migrations 018, 019, 020 and 021 come with this push. After pulling, run `npm run db:migrate` in `nodejs-backend`.
### Env / config
- none
### Notes
- Appraisal data was reset on my local database only (a backup was taken); nothing in this push touches appraisal data.

## 2026-11-02 — Modules audit (part 3): Department Management  (branch modules-audit)

Summary: Department Management rebuilt as approved in the blueprint. Departments get IDs TM-D01 … and sub departments TM-SD01 …; departments show as cards or a table; a new department asks whether it has sub departments; a department page shows its people first, then its sub departments; a sub department page shows its leaders and people; tasks, targets and goals are managed inside each sub department, so the Data Management menu is gone. A Hierarchy tab shows departments, sub departments and reporting lines.

### Frontend
- `pages/departments.tsx` rewritten: `/departments` (tabs Departments, Hierarchy), `/departments/:id` (a department), `/departments/sub/:subId` (a sub department). New `components/deptmgmt/` (api, parts, forms, ListView, HierarchyView, DepartmentPages).
- Departments tab: totals, a notice for the 15 older sub departments under no department with a "Place them" panel, search, type and status filters, Cards / Table (table rows open to their sub departments).
- New department: ID shown, name, type (Business / Support), goal and target criteria, description, "Would you like sub departments?" Yes (first sub departments with EL / FL) or No (one team: people, tasks, targets and goals sit directly in the department).
- Department page: sub department cards with an Add card at the top, then People (with sub department, user type, reports to, status, Move), and Tasks / Targets / Goals tabs that pick a sub department. A one-team department shows its people and data directly.
- Sub department page: EL / FL (Choose when not set), people with joining date and appraisal cycle, Add people (each person belongs to one sub department), Move, Edit (name, leaders, description, department, active), Remove. Tasks / Targets / Goals tabs show Task, Target and Goal Management locked to the sub department.
- Add sub department: ID shown, department fixed, EL / FL, description, people to move in (people of the department suggested), start with the tasks, targets and goals of another sub department.
- `DepartmentSplit` takes `lockedDepartment`; Task, Target and Goal Management take `departmentId` (no page title, no department list). Their own pages (/tasks, /target, /Goal-management) still work.
- Menu: Data Management removed; Admin → "Department Management".

### Backend
- New `modules/deptmgmt` at `/dept-mgmt` (module deptmgmt: read / create / update): `GET /` (departments and sub departments with counts), `GET /departments/:id`, `POST /departments`, `PUT /departments/:id`, `GET /sub-departments/:id`, `POST /sub-departments` (people, copyFrom), `PUT /sub-departments/:id`, `DELETE /sub-departments/:id` (archives; only with no active people), `POST /sub-departments/:id/people` (moves people in), `PUT /mapping` (places older sub departments).
- IDs are given from the highest ever used (never reused). The old `/Department/create` and `/PrimaryDepartment/create` give IDs too.
- Copied goals start not approved by the EL.

### Database
- `021_department_codes.sql`: PrimaryDepartment.Code (TM-D01 … in the order they were made), PrimaryDepartment.Description, Department.Code (TM-SD01 …: department by department, then by name; the 15 under no department last; deleted ones get none), Department.IsDepartmentTeam. Undo: `migrations/down/021_department_codes.down.sql`.
- Run `npm run db:migrate`.

### Env / config
- none

### Notes
- With that numbering Technology's sub departments are TM-SD01 Appraisal Cycle Test, TM-SD02 Engineering, TM-SD03 technology (the blueprint drew Engineering as TM-SD01).
- Only Admin has Department Management and Task / Target / Goal Management today; the tabs inside a sub department follow those module rights.
- Checked: write checks on temporary data (IDs, one-team department, rename, copy, move, name clashes, deactivate / remove rules, ID never reused, mapping), the same calls over HTTP with the forms' payloads, an EL refused, all pages and drawers opened in the browser, Task Management page unchanged; appraisal flow check, notification checks and unit tests still pass.

## 2026-11-02 — Modules audit (part 2): user types and user roles, appraisal notifications out of the bell  (branch modules-audit)

Summary: people are shown by **user type** (Super Admin, Admin, Executive Leader, Functional Leader, Manager, Lead, Associate, Intern) and may hold a **user role** (CEO, CBO, Finance Head, HR Manager). The old roles keep their names and ids, so nothing wired to them changes; each is grouped under a user type. Appraisal notifications no longer show anywhere (the appraisal's own screens, Budget Split's budget discussion, carry them).

### Frontend
- New `components/access/userTypes.ts`: the 8 user types, the 4 user roles, labels.
- Access Management → Users: column "User type" (a role that is not the type's main one is named underneath, e.g. "Finance role" under Admin; a user role shows as a tag); filter "All user types". Add / edit user: user type cards (Super Admin … Intern); when a type has several roles (Admin: Admin / Finance / HR; Executive Leader: ExecutiveLeader / Executive) an "Access from role" picker; "User role" None / CEO / CBO / Finance Head / HR Manager.
- Roles tab: "User type" column; a role's user type is chosen in its editor (new roles too).
- Hierarchy tab and Profile show the user type (Profile also the user role).

### Backend
- `access/userTypes.ts` (USER_TYPES, USER_ROLES). Roles list / save carry `userType`; users list carries `userType`, `userRole`; profile carries both; hierarchy people carry `userType`.
- auth: create / update user accept `userRole` (CEO / CBO / FINANCE_HEAD / HR_MANAGER or null) and return it in the user list.
- hierarchy: the Executive role (no users today) counts as an Executive Leader, as its user type says.
- notifications: the bell leaves out Source APPRAISAL. Appraisal notifications are still recorded, shown nowhere.

### Database
- `020_user_types_and_roles.sql`: AMRole.UserType, filled for the existing roles (Super Administrator → SUPER_ADMIN; Admin, Finance, HR → ADMIN; ExecutiveLeader, Executive → EL; FunctionalLeader → FL; Manager; Lead; normalUser → ASSOCIATE; Intern). Users.UserRole; the EL of Strategic Financial Management (Mithilesh) is set as FINANCE_HEAD. Role names and ids are unchanged. Undo: `migrations/down/020_user_types_and_roles.down.sql`.
- Run `npm run db:migrate`.

### Env / config
- none

### Notes
- Access is unchanged: what a person can open still comes from their role. The Admin role (id 1) keeps full access; the Super Administrator role keeps its appraisal overview access.
- The appraisal still finds the Finance Head from the department (EL of Strategic Financial Management); the new user role does not drive it yet.
- Checked: user type / user role API checks (old roles mapped, create / update / clear a user role, bad value refused, profile), no appraisal notification in the bell for an Associate, FL, EL and the Finance Head, notification checks, appraisal flow check, unit tests, pages opened in the browser.

## 2026-11-02 — Modules audit (part 1): user form, HR Experience / Support menus, scheduled and emailed notifications  (branch modules-audit)

Summary: first batch of the modules audit. The new-user form loses the secondary role and gains joining date, appraisal cycle and variable cycle; HR Support becomes HR Experience and Support; notifications can go out now, at a set time or every week, and by email; appraisal messages leave the Notifications page; Admin down to Lead can use Notifications; the daily log report job is repaired. Department Management is only designed so far (blueprint artifact, waiting for approval).

### Frontend
- Access Management → Add / edit user: no "Second role" field (two people who already have one keep it until edited by hand). New "Joining and cycles": Joining date; Appraisal cycle April / October, filled in from the joining date (December–May → April, June–November → October); Variable cycle Quarterly / Half yearly / Annual. The old "Appraisal cycle" select offered Quarterly / Half yearly / Annual and overwrote people's April / October on save; fixed.
- Menu: HR Support is split into **HR Experience** (Onboarding Experience, Employee Engagement) and **Support** (Query). Page links (/support/…) are unchanged.
- Notifications page: tabs Sent / Scheduled / Weekly / System; the composer has a When step (Send now, Schedule at a date and time, Every week on a day and time, India time) and "Also send by email"; the list shows when each goes out, its email status and emails sent. System lists the jobs that notify people on their own, with an email switch.

### Backend
- auth: create / update user accept `dateOfJoining`, `variableCycle`; return both in the user list.
- notifications: `Source` (MANUAL / APPRAISAL / SYSTEM); the page lists MANUAL only. Scheduling (`sendAt`), weekly repeat (`repeat`, `repeatDay`, `repeatTime`), email (`sendEmail`, one mail per person with an Open in Taskly button to the link, `EmailedCount` counts only mails really sent). The bell shows a notification only once it has gone out, dated by when it last went out; a weekly one comes back as new each week. New job `jobs/notificationScheduler.ts` (every minute). `GET /notifications/system`, `PUT /notifications/system/:job { email }`.
- appraisal: its notifications are stored with Source APPRAISAL (not on the Notifications page; part 2 takes them out of the bell too).
- jobs/dailyTaskAudit.ts: it could never run (it selected `Department.IsActive`, `Users.DepartmentID`, `Users.IsActive`, none of which exist) and its schedule ran at 04:30, not 10:00 India time. Queries fixed (DepartmentUser, DepartmentStatus, UserStatus), schedule `0 10 * * *` India time, and its email now has a switch on Notifications → System, **off by default** because these emails never went out before.
- mailer: `sendMail` returns whether it really sent (false when SMTP is not configured).
- Access catalog: HR Support permission group renamed HR Experience & Support; "Query & HR" → "Query".

### Database
- `018_user_joining_variable_cycle.sql`: Users.VariableCycle; values QUARTERLY / HALF_YEARLY / ANNUAL that the old form wrote into AppraisalCycle are moved there.
- `019_notification_schedule.sql`: Notification.Source, SendAt, RepeatRule, RepeatDay, RepeatTime, SendEmail, DeliveredAt, EmailedCount (existing ones marked delivered; appraisal ones marked APPRAISAL); roles ExecutiveLeader, FunctionalLeader, Manager, Lead get the Notifications module.
- Run `npm run db:migrate`.

### Env / config
- Emails need SMTP_HOST / SMTP_USER / SMTP_PASS (unchanged); email buttons use FRONTEND_URL.

### Notes
- Waiting for approval, not built: Department Management (department / sub department IDs TM-D01 / TM-SD01, card and table views, people first, sub departments, tasks / targets / goals inside each sub department, hierarchy tab); see the blueprint artifact. User types and user roles: done in part 2; Department Management: part 3.
- Checked: notification schedule checks (now, scheduled, weekly once per slot and again next week, closing, validation, email html, job switch), the repaired daily log report runs end to end without SMTP, appraisal flow check and unit tests still pass, pages opened in the browser.

## 2026-11-02 — Fix: Profile sign-in activity  (commit: see git log)

Summary: the Activity Log on My Profile (and on someone's profile opened from Access Management) failed with "Invalid user".

### Frontend
- none

### Backend
- [profile.routes.ts](../nodejs-backend/src/modules/profile/profile.routes.ts): `GET /profile/activity` and `/profile/:userId/activity` are registered before `GET /profile/:userId`, which had been taking "activity" as a user id. No other change: own profile, another user's profile (Admin), and "You can only open your own profile" for everyone else behave as before.

### Database
- none

### Env / config
- none

### Notes
- Checked: own and another user's profile and activity (Admin), own profile and activity (Associate), another user's refused (403), invalid id (400); every page re-opened as Admin, Finance Head, EL, FL and Associate.

## 2026-11-02 — Merge: appraisal module and PMS / notifications work into main  (merge of appraisal-flow-v2 with main 16cf867, a57c6f9)

Summary: brings the whole appraisal module (flow v2) and the earlier PMS section / notifications / hierarchy work from the branch onto main, together with the user profile, HR Support permissions, Goals, calculation and survey template work already on main. Every entry below from both sides is kept.

### Frontend
- Conflicts resolved: sidebar keeps the new Manager Feedback item and the Appraisal group; App.tsx keeps main's PMS pages (Goal Setting page gone) plus the appraisal pages; the date range field uses main's `fieldLabel` version (DateRangeField, CustomDateRangePicker, PMS dashboard).

### Backend
- Conflicts resolved: app.ts mounts both `/profile` and `/appraisal`; server.ts schedules both the efficiency calculation (6:00) and the appraisal job (00:30); the access catalog keeps `appraisal`, `pms_feedback` and the HR Support group with its five pages.

### Database
- **The appraisal migrations are renumbered to run after main's: `012_appraisal.sql` … `017_appraisal_review_reset.sql`** (they were 006–011 on the branch, which clashed with main's 006–011). Down scripts renamed to match (`down/015…017`).
- New database: `npm run db:migrate` applies 001–017 in order.
- A database that already ran the branch's appraisal migrations under the old names must rename them first, or they run twice:
  `UPDATE SchemaMigration SET Name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(Name,'006_appraisal.sql','012_appraisal.sql'),'007_appraisal_budget_requests','013_appraisal_budget_requests'),'008_appraisal_quarter_comments','014_appraisal_quarter_comments'),'009_appraisal_flow_v2','015_appraisal_flow_v2'),'010_appraisal_budget_negotiation','016_appraisal_budget_negotiation'),'011_appraisal_review_reset','017_appraisal_review_reset');` then `npm run db:migrate`.

### Env / config
- none new (appraisal: `APPRAISAL_TIME_WINDOWS`, `APPRAISAL_FINANCE_ROLE_IDS`, `APPRAISAL_HR_ROLE_IDS`, `APPRAISAL_JOB_ENABLED` as before).

### Notes
- docs/APPRAISAL_ARCHITECTURE.md is the first plan and is marked superseded; the CHANGELOG entries describe the module as built.
- Checked after the merge: backend tsc clean, 21 unit tests, 90-check appraisal flow; frontend `vite build` passes and has the same type errors as main before the merge (all pre-existing, so `npm run build`, which runs `tsc` first, still fails as it did on main); every page opened as Admin, Finance Head, EL, FL and Associate.
- Found on main, not from the merge: Profile → sign-in activity returned 400 "Invalid user". Fixed in the next entry.

## 2026-11-02 — Appraisal: reset / revise / approve, override on every hike, overview for a Super Administrator (branch appraisal-flow-v2)

Summary: the manager's second review. Associates and FLs only see "Your appeal is submitted and in progress, we will let you know soon". Every hike anyone enters has a variable pay override. The rest of the EL's budget goes to the FLs automatically. The EL, Finance Head and Admin see Budget discussion first, then Appeals, then the split, with old → new CTC and the increase in %. On an FL's proposal, the EL can Reset budget, Revise proposal or Approve proposal. A new Super Administrator role sees an overview of every department. Every accepted hike gets a celebration, and everyone sees their own final split.

### Frontend
- My Appraisal: once submitted, an Associate / FL sees only "Your appeal is submitted and in progress. We will let you know soon." (no budget or split wording; the EL keeps the tracker). On offer: "Your appraisal hike is released". Accepting shows a celebration (with confetti) whether or not a change was asked, and a "Final split" row of their own: expected, targeted, accepted (fixed / variable), old → new CTC, % of expected / targeted.
- Budget Split (EL): tabs **Budget discussion** (accept / negotiate, the log) → **Appeals** (with CTC and % on CTC) → **Budget split**. The own hike and direct-report hikes have the variable pay override. The FL shares (now at the bottom) are filled automatically with the rest of the budget, spread by each team's expected total; changing a share sets it by hand. On each FL proposal: **Reset budget** (reason required), **Revise proposal** (optional note), **Approve proposal**. The final split table shows Current CTC → New CTC and CTC increase. Team Allocation is no longer in an EL's menu.
- Department Budgets detail (Finance Head and Admin, same screen): tabs Budget discussion → Appeals (expected / target as % on CTC) → Split (with CTC), FL shares at the bottom.
- Team Allocation (FL): override on every team hike and their own; a "sent back to revise" box with the EL's note; waiting text has no budget wording; after approval, a final split of the team and themselves (no team CTC).
- New page **Appraisal → Overview** ([Overview.tsx](../frontend/src/components/appraisal/Overview.tsx)): every department of a cycle with search, status filter, totals (expected, targeted, budget, decided) and a split view per department (split table with CTC, budget discussion, FL shares). Shown to the Super Administrator, Admins and the Finance Head.

### Backend
- [appraisal.flow.ts](../nodejs-backend/src/modules/appraisal/appraisal.flow.ts): allocations carry the variable override and the offer uses it; new `reviseShare` (clears the FL's and team's hikes, share back to the FL with the note) and `resetSplit` (withdraws hikes on offer, clears allocations not yet answered and every share, round back to BUDGET_WITH_EL, logged as RESET; accepted / rejected hikes stay); decided hikes cannot be changed in a split or allocation; new `overview(period)`; the FL no longer receives the team's CTC; "hike released" notifications.
- [appraisal.service.ts](../nodejs-backend/src/modules/appraisal/appraisal.service.ts): Super Administrator role (by name) → `OVERVIEW_ROLE`, no appraisal of their own; `isOverview`; availability has `overview` and hides Team Allocation for ELs without a share. `splitWith` moved to appraisal.calc.ts.
- Routes: `GET /appraisal/overview?period=`, `PUT /appraisal/split/:d/:p/shares/:fl/revise` { comment? }, `PUT /appraisal/split/:d/:p/reset` { comment }; split, allocation and direct bodies accept `variable` { mode: PCT | AMOUNT, value }.
- `appraisalFlowCheck.ts`: 90 checks (adds revise, reset, overrides on decided hikes, menus, overview).

### Database
- `017_appraisal_review_reset.sql` (`npm run db:migrate`): AppraisalAllocation `VariableMode` / `VariableValue`; AppraisalShare `ReturnComment` / `ReturnedAt`; AppraisalBudgetLog.Action gains RESET; inserts role **Super Administrator** (appraisal + dashboard read).
- Locally a user was created for it: Super Administrator, superadministrator@tapmind.com (password Test@12345, change it). On other environments create the user in Access Management with that role.
- To undo: `src/config/migrations/down/017_appraisal_review_reset.down.sql` by hand, before the 016 down script.

### Env / config
- none

### Follow-up (same day): Finance Head picker removed, Appraisal Setup read only except for HR
- The Finance Head is always the head (EL) of Strategic Financial Management; the "Finance Head" card in Appraisal Setup and `PUT /appraisal/finance-head` are gone, and the stored `financeHeadUserId` AppSetting is no longer read (deleted locally; on other environments run `DELETE FROM AppSetting WHERE SettingKey = 'financeHeadUserId'`).
- Appraisal Setup: only HR (HR Operations department / HR roles) edits, downloads the template and bulk uploads. Admins, the Super Administrator and the Finance Head see the same page read only (availability `setup.edit`; `updatePerson` / `bulkUpdatePeople` need `isHrStaff`).

### Follow-up: Overview shows the most recent first
- Overview lists departments by their last activity this cycle (appeal, budget step, split, FL proposal, answer), newest first, whatever the status; departments with nothing yet come last. New "Last activity" column. Board rows carry `lastActivity`. Department Budgets (Finance Head / Admin) is ordered the same way, with the same column; departments waiting for the Finance Head stay highlighted.

### Follow-up: split tables show who each person is; FL view without repeats
- Every split table (EL, Finance / Admin, Overview, FL, the person's own) shows the person's role under the name (EL, FL, Associate, Intern, …) and the status in a new last column. The round now carries `roleName` per person.
- Team Allocation (FL): once the proposal is sent or approved, only the team budget, the note, the split table ("Proposal sent" / "Final split") and the justification are shown; the editing table, own-hike box and budget bar appear only while allocating.

### Follow-up: Budget discussion tab redesigned
- The Budget discussion tab (Finance Head / Admin department page and the EL's Budget Split) is now the discussion itself, full width: a budget strip on top (department budget and where it stands, total expected / targeted with the budget's %, decided so far), the conversation as messages (Finance Head and EL on opposite sides, the viewer's own on the right; proposals, negotiations in red, acceptance in green, resets in amber, each with amount and comment), and the reply box under it (Finance: propose / revise with amount and answer; EL: Accept budget / Negotiate budget). New `BudgetThread` and `BudgetStrip` in parts.tsx.

### Notes
- "Team Budget → Budget split, remove Team Allocation if not in use" was read as: Team Allocation is hidden for ELs (they split the department budget in Budget Split).
- Reset budget keeps hikes people already accepted or rejected; everything else returns to the Finance Head's budget.

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
- `016_appraisal_budget_negotiation.sql` (`npm run db:migrate`): AppraisalRound.Status gains BUDGET_NEGOTIATION and BUDGET_ACCEPTED, new column `ElAcceptedAt`; new table `AppraisalBudgetLog`; AppraisalHike gets `VariableOverride` (PCT / AMOUNT / NULL).
- To undo: `src/config/migrations/down/016_appraisal_budget_negotiation.down.sql` by hand (before the 015 down script if going back to appraisal-module).

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
- `015_appraisal_flow_v2.sql` (`npm run db:migrate`): cycle statuses become EMPLOYEE_OPEN / SUBMITTED / OFFERED / ACCEPTED / POSTPONED (old ASSESSOR_OPEN / FINANCE_REVIEW -> SUBMITTED); cycles get `DepartmentID` and `PeriodStart`; new tables `AppraisalRound`, `AppraisalShare`, `AppraisalAllocation`; `AppraisalRequestReview.Recommendation`. The old `AppraisalBudget` / `AppraisalBudgetAlloc` tables are left in place, unused.
- To go back to appraisal-module: run `src/config/migrations/down/015_appraisal_flow_v2.down.sql` by hand, then switch branch.

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

## 2026-10-30 — Survey templates for Onboarding and Engagement  (commit: 16cf867)
Summary: HR can add Onboarding Experience and Employee Engagement surveys with their own questions; permissions are in Access Management and HR has them by default. The Node engagement backend, which was only placeholders, is now a real port of Java.
### Frontend
- New canvas **Manage templates** (`modules/templates/SurveyTemplates.jsx`) on the Onboarding and Engagement HR consoles: add, edit, copy, set default, turn on/off; questions can be rating, open or (engagement) monthly, grouped into sections for onboarding.
- Send new survey / Roll out survey now pick a **Survey template**. Employee form, HR console and admin views read the questions from the survey (`lib/surveyStructure.js`); surveys from before templates use the original questions. The HR-team block of an onboarding survey starts at the first section whose name contains "HR".
### Backend
- New `modules/hr/surveyTemplates.{service,routes}.ts` at `/hrFeedback/templates` (list is open to signed-in users; changes need the template permission of that kind).
- `engagement.service.ts`: port of Java EngagementService (open surveys, submit, HR list, scores, rollout, admin), with the template's questions. Push notifications are not ported.
- Onboarding send/submit use the template: a survey keeps a copy of its questions, and answers are checked against it.
- Access: new modules `hr_onb_templates` and `hr_eng_templates`. HR role (4) and everyone whose Feedback Resolver Team is HR or L&D get them by default (`HR_TEAM_DEFAULTS` in `access.service.ts`); a personal removal still takes them away.
### Database
- Migration `011_survey_templates.sql`: `SurveyTemplate`, `SurveyTemplateQuestion`, `TemplateID`/`Questions` on `onboarding_surveys` and `engagement_surveys`, and the two current surveys as default templates. Run `npm run db:migrate`.

---

## 2026-10-30 — Goals Achieved list matches Java  (commit: 16cf867)
Summary: `POST /userGoalData/list` now follows Java `listPaginated`, so the Goals page shows the same rows and averages as production.
### Frontend
- none
### Backend
- New `jobs/efficiencyCalculation.ts`: port of Java `calculateAndSaveDailyEfficiency`. Rebuilds `EfficiencyUtilizationSummary` from the work entries (plus live TAM accounts, dept 23, and closed-position goals, dept 22) every day at 6:00 AM IST (`node-cron`, started in `server.ts`) and on `GET /calculateAll` (was a stub; now returns 200 so the dashboard refreshes). Old rows are replaced in one transaction, so a failed run leaves the table untouched. The per-row rules (`calculateEfficiency`) are in `calculationLogic.ts`. Checked against the Java-built table: 9,748 of 9,749 rows identical; the one row differs because its entries changed after Java last ran.
- `calculationLogic.ts` also holds the target rules: `calculateTarget({ kind: 'day' | 'revision' | 'dayAverage' | 'groupAverage' | 'units' })` (department day rules, EL-revised targets, user / department / EL / company averages, Entry Approval %). The daily Target Achieved % itself is still read from `EfficiencyUtilizationSummary` (Java `EfficiencyServiceImpl` is not ported).
- New `modules/calculations/calculationLogic.ts`: goal rules in one place. `calculateGoal({ kind: 'entry' | 'day' | 'user' })` for a goal entry, a user day, a user over a range; `loadGoalContexts` loads the data for the range case. The Goals list, goal form, dashboard rollup (`dashboardRollup.ts`) and efficiency report (`efficiencySummary.service.ts`) all call it. Adds the April–June 2026 rules for users 153/154/155 to the dashboard, so company Q2 goal % is now 66.88 like production.
- `userGoalData.service.ts`: newest entry first (by id; `sortBy=workDate` supported), per-department efficiency (depts 37, 13, 1, 22, 14/31/32, user 129), monthly breakdown with quarterly goals counted across their quarter, overall % from the dashboard goal rollup (`dashboardRollup.ts` now also returns `goalOf`/`usersInDept`), department 21/37 sum-over-sum. Response uses Java's `{ status, statusCode, message, response }` envelope.
### Database
- none
### Notes
- Verified against production on 33 of 35 request shapes. Not ported: Goal = Target users' April–June rows and user 155 April–June sum/sum;  `sortBy=workDate` tie order is arbitrary in Java.

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
- New migration [012_appraisal.sql](../nodejs-backend/src/config/migrations/012_appraisal.sql): adds `Users.DateOfJoining`, `Users.EmployeeLevel`, `Users.CurrentAnnualCtc`; creates `AppraisalCycle`, `AppraisalQuarter`, `AppraisalQuarterReview`, `AppraisalReview`, `AppraisalHike`, `AppraisalRequest`, `AppraisalResponse`, `AppraisalAudit`; gives every role except Admin `appraisal` read.
- PMS notes (`comments`, `achievements`, `failures`) are derived per quarter in `pmsQuarters`; no schema change. `AppraisalQuarter.Comments` from 008 is no longer filled by the screens.
- New migration [014_appraisal_quarter_comments.sql](../nodejs-backend/src/config/migrations/014_appraisal_quarter_comments.sql): `AppraisalQuarter.Comments`. The quarter rows are the four calendar quarters that ended before the cycle began (`quarterSlots`), returned as `slots`.
- New migration [013_appraisal_budget_requests.sql](../nodejs-backend/src/config/migrations/013_appraisal_budget_requests.sql): `AppraisalRequestReview`, `AppraisalBudget`, `AppraisalBudgetAlloc`.
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
## 2026-10-29 — User profile with level/band and sign-in activity  (commit: 16cf867)
Summary: every person has a profile (position, role, department, reporting line) with their sign-in/sign-out log; Designation, Level and Band are captured when a user is created.
### Frontend
- New page `pages/profile.tsx` at `/profile` (own) and `/profile/:userId` (admins); topbar menu has **My profile**; user names in Access Management → Users link to it.
- Users drawer has a **Position** section (Designation, Level, Band), all required, and an **Onboarding** section: New joiner (default Yes) + April/October cycle. Users list shows a `New · Apr/Oct` capsule.
- Onboarding Experience is shown to a user only while flagged new (`lib/onboarding.ts`); HR's survey recipient picker lists new joiners first with the same capsule.
### Backend
- New `modules/profile`: `GET /profile[/:userId]` and `GET /profile[/:userId]/activity?days=`. Other people's profiles need `accessmgmt` read.
- `designation/jobLevel/band` added to user create/update/read and the session payload (`auth.schema.ts`, `auth.service.ts`).
- Activity times are formatted in SQL (the DB stores server local time, the pool reads as UTC).
- `Users.IsNewJoiner` / `JoiningCycle` in create/update/read, session payload and `/access/me`; submitting the onboarding survey clears the flag (`onboarding.service.ts`).
- Onboarding Experience is also shown to HR / L&D team members (`feedbackresolverteam` HR or L_D), not only role 1/4.
- HR Support pages are separate access modules (`hr_onboarding`, `hr_query`, `hr_engagement`) under `hrfeedback` in `catalog.ts`; sidebar and `pages/hrFeedback.tsx` check each one (page redirects to the first allowed one).
### Database
- Migrations `008_user_profile.sql` (`Users.Designation`, `JobLevel`, `Band`) `009_new_joiner.sql` (`IsNewJoiner`, `JoiningCycle`; users from the last 45 days without a submitted survey are backfilled as new) and `010_hr_support_permissions.sql` (everyone who had Support keeps all three pages). Run `npm run db:migrate`.
### Notes
- Existing users have empty position fields; editing one requires filling all three.

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
