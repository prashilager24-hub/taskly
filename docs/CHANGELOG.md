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
