# Open Items & Unclear Questions (PHASE 7)

## UNCLEAR — Backend Migration Questions

| # | Question | Impact | Affected Pages | Needs Answer From |
|---|----------|--------|----------------|-------------------|
| U1 | What happens to `/list-efficiency-summary` field names (`AvgTargetPercent`, etc.) in Node.js? | 8+ pages show summary cards | 01,04,05,07,08,09,14,15 | Backend team |
| U2 | Does Node.js backend treat `page=0&size=0` as "fetch all" or "fetch none"? | All list pages may return empty | 14+ pages | Backend team |
| U3 | Will role IDs remain the same (1=Root, 2=User, 3=EL, 4=FL, 5=Intern, 6=Executive, 7=Manager, 23=Lead)? | All role-based guards break | All 23 pages | Backend team |
| U4 | Will department IDs remain the same (21=Sales, 22=HR, 24=Tech, 16=Report)? | Department guards break | 10,11,12,14,17,18 | Backend team |
| U5 | What is the polarity of `updateUserStatus` — is 1=Active or 1=Inactive? | Status toggle may set wrong value | 10 | Backend team |
| U6 | Will `/users/read` return single shape (`{departmentID}`) or dual shape (`{departments[]}`)? | Normalization code breaks or dead | 6,10,13,14 | Backend team |
| U7 | Is `2026-06-30` cutoff still needed? Does backend consolidate the dual API paths (efficiency summary vs userGoalData)? | Goals/reports show wrong data after cutoff | 04,08,14,15 | Product owner |
| U8 | Does Node.js backend use same timezone as Java backend? | Date comparisons, zoned date pickers | 01,04,08,09,11,14,15,16,17 | Backend team |
| U9 | Will status string values stay the same (ACTIVE, PENDING, RESOLVED, SCHEDULED, etc.)? | Status filters show wrong data | 11,17,18 | Backend team |
| U10 | Will the login response keep same structure (`token`, `user` with `userRole`, `departmentID`, `departments[]`)? | Entire auth flow breaks | All | Backend team |
| U11 | What format will permissions use in Node.js? Currently read from `localStorage.roles.rolePrivileges` (JSON)? | PMS tab visibility breaks | 12 | Backend team |
| U12 | Will `/save-targets` keep `targets[{departmentID, userID, targetPercent}]` array format? | Target saving fails | 16 | Backend team |
| U13 | Will user create/update keep all 13 fields (`employeeID`, `userName`, `userEmail`, `password`, `departmentID`, `role`, `roleID`, `secondaryRoleID`, `reportingManagerId`, `elManagerId`, `appraisalCycle`, `feedbackresolverteam`)? | User management fails | 10 | Backend team |
| U14 | Advanced filter format in `/list-efficiency-summary`: `{field, operator, value}` — field names must match exactly? | Query report filters fail | 14 | Backend team |
| U15 | What will the new backend API base URL be? | All API calls fail | All | DevOps/Backend |

## Decisions Needed

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| D1 | Move efficiency level calculation to backend? | (a) Keep in frontend, (b) Move to backend, (c) Backend returns raw fields + frontend computes | (b) Move to backend — single source of truth |
| D2 | Replace localStorage permissions with API-fetched? | (a) Keep localStorage, (b) Fetch on login, (c) Fetch on each page load | (b) Fetch on login + refresh on token renewal |
| D3 | Introduce TypeScript enums for roles/departments/status? | (a) Yes, (b) Keep string/number literals | (a) Yes — prevents silent failures |
| D4 | Add i18n support during migration? | (a) Yes, (b) No, defer | (b) Defer — migration is complex enough |
| D5 | Use React Query/SWR for data fetching? | (a) Yes, (b) Keep useEffect pattern | (b) Defer — too much refactoring for migration |
| D6 | Add `window.location.reload()` removal — replace with what? | (a) State update + re-fetch, (b) React Query invalidation | (a) State update — minimal change |
| D7 | Should frontend keep dual user shape normalization or standardize? | (a) Keep both, (b) Standardize to one after backend confirms | (b) Wait for backend U6 answer |

## Final Checklist Per Module

| Module | API Payloads Aligned | Role/Dept Guards Updated | Status Constants Checked | Date Logic Verified | Console.log Removed | Tests |
|--------|---------------------|--------------------------|-------------------------|--------------------|--------------------|-------|
| 01-dashboard | ☐ | ☐ | ☐ | ☐ (cutoff) | ☐ | ☐ |
| 02-activity-log | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 03-department | ☐ | ☐ | ☐ | — | ☐ | ☐ |
| 04-efficiency | ☐ | ☐ | ☐ | ☐ (cutoff) | ☐ | ☐ |
| 05-entry-approval | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 06-forms | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 07-goal-management | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 08-goals | ☐ | ☐ | ☐ | ☐ (cutoff) | ☐ | ☐ |
| 09-history | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10-access-management | ☐ | ☐ | ☐ | — | ☐ | ☐ |
| 11-sales-forward | ☐ | ☐ | ☐ | ☐ (timezone) | ☐ | ☐ |
| 12-pms | ☐ (localStorage) | ☐ | ☐ | — | ☐ | ☐ |
| 13-primary-department | ☐ | ☐ | ☐ | — | ☐ | ☐ |
| 14-query-report | ☐ | ☐ | ☐ | ☐ (cutoff) | ☐ | ☐ |
| 15-reports | ☐ | ☐ | ☐ | ☐ (cutoff) | ☐ | ☐ |
| 16-target-management | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 17-daily-logs | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 18-hr-feedback | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 19-task-management | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

## Next Steps
1. Share U1-U15 questions with backend team
2. Get decisions D1-D7 from tech lead/product owner
3. Set up staging environment with Node.js backend
4. Begin Phase A (Foundation) from timeline
