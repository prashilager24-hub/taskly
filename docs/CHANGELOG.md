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

## 2026-10-30 — Survey templates for Onboarding and Engagement  (commit: e9b0e0f)
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

## 2026-10-30 — Goals Achieved list matches Java  (commit: e9b0e0f)
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

## 2026-10-29 — User profile with level/band and sign-in activity  (commit: e9b0e0f)
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
