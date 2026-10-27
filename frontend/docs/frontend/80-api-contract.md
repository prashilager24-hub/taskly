# API Contract Map (PHASE 4)

All frontend API calls against the Java/Spring Boot backend. Base URL is hardcoded as `https://taskly.tapmind.io/t2.0/authentificationUtilization`.

## Master Endpoint Table

| # | Method | Endpoint | Pages Using | Request Key Fields | Response Key Fields | Breaking Risk |
|---|--------|----------|-------------|--------------------|---------------------|---------------|
| 1 | POST | `/Department/list?page=0&size=0` | 01,03,04,05,06,07,08,09,10,14,15,16,17,18 | searchText, filter, startDate, endDate, roleID, userID | departmentID, departmentName, description, newStatus | **HIGH** — used by 14+ pages |
| 2 | POST | `/users/read?page=&size=` | 01,03,04,05,06,07,08,09,10,14,15,16,17,18 | filter, searchText, departmentID, roleID, token | userID, userName, userEmail, departmentID, departmentName, roleID, role, employeeID, reportingManagerId, elManagerId, appraisalCycle, feedbackresolverteam, newStatus, isActive | **CRITICAL** — complex multi-shape response (`{departments:[...]}` vs `{departmentID}`); 14+ pages |
| 3 | POST | `/Department/create` | 03,13 | departmentName, departmentDescription, executiveLeaderID | success | Medium |
| 4 | POST | `/Department/update/{id}` | 03,13 | departmentName, departmentDescription, functionalLeaderID, executiveLeaderID, primaryDepartmentId | success | Medium |
| 5 | POST | `/Department/delete/{id}` | 03 | — | success | Medium |
| 6 | POST | `/PrimaryDepartment/list` | 13 | {} | primaryDepartmentId, primaryDepartmentName | Low |
| 7 | POST | `/User/create` | 10 | employeeID, userName, userEmail, password, departmentID, role, roleID, secondaryRoleID, reportingManagerId, elManagerId, appraisalCycle, feedbackresolverteam | success | **CRITICAL** — 13 fields, any rename breaks user creation |
| 8 | PUT | `/User/update` | 10 | Same as create | success | **CRITICAL** — same 13 fields |
| 9 | POST | `/usersArchive` | 10 | userIdList[] | success | High |
| 10 | POST | `/updateUserStatus` | 10 | userStatus (1/0), userIdList[] | success | **CRITICAL** — hardcoded 1/0 polarity |
| 11 | POST | `/list-efficiency-summary` | 01,04,05,07,08,09,14,15 | departmentID, startDate, endDate, userID, groupBy, isHeExecutiveLeader, efficiencyLevel, filters | summary{AvgTargetPercent, AvgUtilizationPercent, AvgTotalWork, AvgGoalPercent, EfficiencyLevel, AvgAllocatedHrs}, data[] | **CRITICAL** — 8+ pages depend on summary field names |
| 12 | POST | `/list-target-summary` | 15,16 | departmentID, startDate, endDate, userID, groupBy | summary{target metrics}, data[] | High |
| 13 | POST | `/list-utilization-summary` | 15 | departmentID, startDate, endDate, userID, groupBy | summary{utilization metrics}, data[] | High |
| 14 | POST | `/download-efficiency-summary` | 01,04,09,14,15 | Same as #11 | Excel blob | Medium |
| 15 | POST | `/save-targets` | 16 | targets[{departmentID, userID, targetPercent}] | success | **CRITICAL** — 3-field array structure |
| 16 | POST | `/daily-logs/list?page=&size=` | 17 | departmentID, userID, startDate, endDate, page, size | logID, userID, date, activityType, status, duration, createdAt | High |
| 17 | POST | `/daily-logs/count` | 17 | departmentID, userID, startDate, endDate | count | Medium |
| 18 | POST | `/daily-logs/update-status` | 17 | logID, status | success | Medium |
| 19 | POST | `/download-daily-logs` | 17 | departmentID, userID, startDate, endDate | Excel blob | Medium |
| 20 | POST | `/hr-feedback/list?page=&size=` | 18 | departmentID, userID, startDate, endDate, page, size, status | feedbackID, userID, departmentID, subject, message, status, createdAt, respondedAt, repliedBy | High |
| 21 | POST | `/hr-feedback/count` | 18 | departmentID, userID, startDate, endDate, status | count | Medium |
| 22 | POST | `/hr-feedback/update-status` | 18 | feedbackID, status | success | Medium |
| 23 | POST | `/hr-feedback/reply` | 18 | feedbackID, replyText, respondedBy | success | Medium |
| 24 | POST | `/sales/calls/list?page=&size=` | 11 | userID | CallID, ScheduledDatetime, CreaterUserID, SalesUserID, PublisherName, status, RescheduleLogs[] | High |
| 25 | POST | `/sales/calls/reschedule` | 11 | userID, callID, newDatetime, rescheduledBy, reason | scheduledDatetime | High |
| 26 | POST | `/sales/calls/update-status` | 11 | userID, callID, newDatetime, status | success | High |
| 27 | POST | `/departmentTargets/getTargetsByDepartment` | 09 | departmentId | result[] | Medium |
| 28 | POST | `/departmentGoals/getGoalsByDepartment` | 09 | departmentId | result[] | Medium |
| 29 | POST | `/goal/create` | 07 | goal details | success | High |
| 30 | POST | `/goal/update` | 07 | goal details | success | High |
| 31 | POST | `/goal/delete` | 07 | goalID | success | Medium |
| 32 | POST | `/userGoalData` | 08 | userID, startDate, endDate | goal data | High — second path after 2026-06-30 cutoff |
| 33 | POST | `/task/list?page=&size=` | 01,02,04,05,06 | filters, pagination | taskID, title, status, assignedTo, deadline | High |
| 34 | POST | `/entry-approval/list` | 05 | departmentID, userID, startDate, endDate, status | approval entries | High |
| 35 | POST | `/entry-approval/approve` | 05 | entryID, approvedBy | success | High |
| 36 | POST | `/entry-approval/reject` | 05 | entryID, rejectedBy, reason | success | High |
| 37 | POST | `/login` | Auth flow | email, password | token, user object → stored as `authUserLD` | **CRITICAL** — changes break all auth |
| 38 | POST | `/goal-management/list` | 07 | departmentID, startDate, endDate | goal list | High |
| 39 | POST | `/departmentTasks/list?page=&size=` | 19 | searchText, filter, startDate, endDate | tasks[], totalRecords; taskID, taskName, departmentID, departmentName, standardTimeMins, frequency, isDynamic, isActive, timingType, roleID | High — no auth header sent |
| 40 | POST | `/departmentTasks/create` | 19 | taskName, description, departmentID, standardTimeMins, frequency, isDynamic, timingType, roleID | data.data (new task) | **CRITICAL** — 8-field payload |
| 41 | PUT | `/departmentTasks/update/{id}` | 19 | Same as create | data.data (updated task) | **CRITICAL** — 8-field payload |
| 42 | PUT | `/departmentTasks/{taskID}/status?isActive={bool}` | 19 | {} (empty body; status via query param) | — | **CRITICAL** — query-param convention |

## Response Shape Concerns

### `/users/read` — Dual Response Shape
```
Shape A: { user: { departmentID: 1 } }          — single department
Shape B: { user: { departments: [{...}, ...] } } — multiple departments
```
Frontend handles both via `getUserDepartments()` in 06-forms, 13-primary-department, and similar normalization in 10-access-management, 14-query-report. **If Node.js backend standardizes to one shape, all normalization code breaks or becomes dead code.**

### `/list-efficiency-summary` — Summary Object
Every efficiency page depends on exact field names:
- `AvgTargetPercent`, `AvgUtilizationPercent`, `AvgTotalWork`, `AvgGoalPercent`, `AvgAllocatedHrs`
- Data array items with same fields per department/user

**Renaming any field breaks 8+ pages simultaneously.**

### Pagination Convention
Frontend sends `page=0&size=0` to mean "fetch all". If Node.js backend treats size=0 as "return nothing", all lists break.

## Endpoints NOT Called by Frontend (Backend-Only)
- Background job endpoints
- Push notification registration
- Admin-only backend operations
- Reporting/analytics aggregation jobs

These must continue working during migration but require no frontend changes.
