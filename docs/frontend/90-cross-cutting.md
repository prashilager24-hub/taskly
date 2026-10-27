# Cross-Cutting Concerns (PHASE 3)

## Hardcoded Values Summary

| Category | Values | Locations | Impact if Changed |
|----------|--------|-----------|------------------|
| **Role IDs** | 1=Root User, 2=User, 3=EL, 4=FL, 5=Intern, 6=Executive, 7=Manager, 23=Lead | `roleMap` objects across all pages; `isReadOnly` checks `[2,5,6,23]`; `adminOnly` `=== 1`; `salesOnly` `departmentID===21`; `HrOnly` `departmentID===22`; `TechOnly` `departmentID===24`; `adminOrTech` `role===1||dept===24` | ALL role-based guards and filtering break; users may be locked out or incorrectly granted access |
| **Department IDs** | 21=Sales, 22=HR, 24=Tech | `salesOnly` `departmentID===21`; `HrOnly` `departmentID===22`; `TechOnly` `departmentID===24`; `isReportUser` `departmentID===16`; `adminOrTech` `dept===24` | Department-based access control breaks; users may be misclassified |
| **Status Codes** | 1=Active, 0=Inactive (toggle); ACTIVE/COMPLETED/CANCELLED/PENDING/RESOLVED (text) | `toggleUserStatus` `userStatus: 1|0`; status filters across dailyLogs, hrFeedback, salesForward; `validate()` reason checks | Status toggle sets wrong value; filter shows wrong data; reason validation misfires |
| **Date Cutoff** | `2026-06-30` | `08-goals.md` line 526; `04-efficiency.md` line 526; `14-query-report.md` line 526; multiple pages | After this date, efficiency summary path won't trigger; reports show stale data |
| **API Base URL** | `https://taskly.tapmind.io/t2.0/authentificationUtilization` | ALL 60+ API calls use relative paths against this base | If backend URL changes, ALL API calls break — require build-time config update |
| **Pagination defaults** | `page=0&size=0` (empty = all) | Department/list, users/read, efficiency summary, etc. | If backend changes empty-pagination behavior, lists may be empty or overflow |
| **Timezone** | `Intl.DateTimeFormat().resolvedOptions().timeZone` | `convertToZonedFormat` in salesForward, dailyLogs, efficiency, etc. | Different timezone on Node.js backend causes date comparison/misfiring |
| **Locale** | `"en-GB"` hardcoded | `formatDateTime` in salesForward, query-report, reports | Non-GB locale users see different date format; UX inconsistency |

---

## Role-Based Logic Duplication

### Duplicate Role Checks Across Pages

| Check | Pages | Count |
|-------|-------|-------|
| `user.userRole === 1` (admin) | 01-dashboard, 03-department, 05-entry-approval, 06-forms, 07-goal-management, 08-goals, 09-history, 10-access-management, 13-primary-department, 14-query-report, 16-target-management, 18-hr-feedback | 12 pages |
| `user.userRole !== 2` (exclude role 2) | 14-query-report line 616 | 1 page |
| `isReadOnly` `[2,5,6,23]` | 12-pms.md | 1 page |
| `isELORUSER` `[2,3,4,5,6,7,23]` | 10-access-management, 14-query-report, 16-target-management | 3 pages |
| `user.userRole === 3` (EL) | 14-query-report line 815 | 1 page |
| `user.userRole !== 3` | 14-query-report | 1 page |
| `user.departmentID === 21` (sales) | 11-sales-forward, 14-query-report (possibly) | 1-2 pages |
| `user.departmentID === 22` (HR) | 10-access-management | 1 page |
| `user.departmentID === 24` (tech) | 11-sales-forward (maybe), 14-query-report, 17-daily-logs, 18-hr-feedback, `adminOrTech` | 4+ pages |
| `Number(user.userID) === 1` (report user) | 12-pms.md line 34 | 1 page |
| `user.departmentID === 16` (report dept) | 12-pms.md line 34 | 1 page |

### Duplicate Department Checks

| Check | Pages | Count |
|-------|-------|-------|
| `user.departmentID === 21` | 11-sales-forward, 14-query-report | 2 pages |
| `user.departmentID === 22` | 10-access-management | 1 page |
| `user.departmentID === 24` | 17-daily-logs, 18-hr-feedback, 14-query-report, `adminOrTech` | 4 pages |
| `user.departmentID === 16` | 12-pms.md | 1 page |

---

## Auth/Security Review

### Critical Security Concerns

1. **JWT stored in localStorage** (`authUserLD`) — XSS vulnerability; no HttpOnly cookie; if XSS exists, attacker can steal tokens
2. **No refresh token logic** — when JWT expires, user must re-login; long-running sessions force logout
3. **All API calls use same hardcoded base URL** — if base URL compromised, all endpoints accessible
4. **No rate limiting visible** — API calls from frontend may be vulnerable to abuse
5. **`window.location.reload()` after delete** (line 177 in access-management, similar in other pages) — may cause resubmission on refresh; no PRG (Post/Redirect/Get) pattern
6. **No CSRF tokens** — since using localStorage JWT, vulnerable to CSRF if site doesn't implement double-submit cookie pattern
7. **`authUserLD` null checks inconsistent** — some components check `!!authUserLD?.userRole`, others assume it exists; may cause runtime errors
8. **`setAllUser` called in multiple places** — `commonStore.tsx`; potential race conditions if multiple fetches update store simultaneously

### State Management Issues

- **Zustand persisted store** (`commonStore.tsx`) stores auth state in localStorage — if cleared, user logged out unexpectedly
- **No centralized API client** — each page manages its own API calls; inconsistent error handling; some show toast on error, some don't
- **Multiple `useEffect` fetch patterns** — some on mount with dependencies, some conditional; hard to track data freshness
- **`setAllUser` side effect** in `commonStore.tsx` — called from multiple page mounts; may overwrite user data unexpectedly

---

## Frontend-Backend Logic Duplication

### What Frontend Does That Should Be Backend

| Feature | Frontend Implementation | Should Be Backend |
|---------|------------------------|-------------------|
| **Role-based access control** | 12+ pages have `adminOnly`, `salesOnly`, `HrOnly`, `TechOnly`, `adminOrTech` guards hardcoded | Centralized auth middleware in backend |
| **Status code mapping** (1/0 for Active/Inactive) | `handleToggleUserStatus` etc. | Auth/status service |
| **Efficiency level calculation** (High/At Par/Low) | `04-efficiency.md` lines 471-486; `01-dashboard`; `04-efficiency`; `14-query-report`; `15-reports` | Business logic service |
| **Filter field/operator/value mapping** | `14-query-report` lines 376-381; `11-sales-forward` validate() | Query builder service |
| **Date range normalization** | `convertToZonedFormat`, `normalizeISO`, `formatDateTime` patterns everywhere | Date/time service in backend |
| **Pagination empty state** (`page=0&size=0`) | Multiple pages assume empty params = all records | Backend pagination defaults |

### What Backend Does That Frontend Replicates

| Feature | Backend Should Provide | Frontend Currently Does |
|---------|----------------------|------------------------|
| **Permission checking** | Role/dept checks in auth middleware | `isReadOnly`, `isReportUser`, `pmsPermissions` from localStorage |
| **Filter options generation** | Department/user lists with proper formatting | `fetchDepartments`, `fetchUsers` in every page |
| **Summary computations** | Avg calculations, efficiency levels | Frontend reduces API data into summary cards |
| **Download/Excel generation** | Backend generates Excel, frontend just calls endpoint | All pages call `/download-...` endpoints |

---

## Consolidated Defects Across All Pages

| Defect Type | Count | Description |
|-------------|-------|-------------|
| Hardcoded role IDs | 20+ occurrences | `user.userRole === 1` or specific role numbers |
| Hardcoded department IDs | 10+ occurrences | `departmentID === 21`, `22`, `24`, `16` |
| Hardcoded status values | 8+ occurrences | `ACTIVE`, `PENDING`, `RESOLVED`, `1`, `0`, etc. |
| Hardcoded date cutoffs | 4 occurrences | `2026-06-30` in goals, efficiency, query-report, reports |
| Inconsistent `selectedUser` handling | 6+ occurrences | `isELORUSER ? String(user?.userID) : ""` pattern |
| Inconsistent `selectedDepartment` handling | 5+ occurrences | `String(selectedDepartment ?? "")` pattern |
| Missing null checks on auth | 4+ occurrences | `authUserLD` may be null but code assumes exists |
| Duplicate `console.log` statements | 15+ across codebase | Debug left in production |
| `window.location reload()` after mutations | 3+ occurrences | Not PRG pattern; causes resubmission |
| Commented-out password field | 1 occurrence | Access management form |
| Type mismatches (Task[] vs call objects) | 2 occurrences | Sales forward, access management |

---

## Migration Recommendations

### High Priority (Must Fix Before Migration)

1. **Extract role/department checks to backend middleware** — remove all `adminOnly`, `salesOnly`, `HrOnly`, `TechOnly`, `adminOrTech` from frontend; let backend handle authorization and return only authorized data
2. **Replace hardcoded API base URL** with environment variable or build-time config — currently all 60+ calls break if URL changes
3. **Implement refresh token flow** or session management — currently no way to get new JWT without re-login
4. **Centralize efficiency level calculation** in backend service — frontend should just receive the level, compute locally
5. **Create shared API client** (Axios instance with interceptors) — consistent error handling, auth token injection, refresh logic

### Medium Priority (Should Fix)

6. **Replace hardcoded status values** with enums or constants from backend — frontend should use backend-provided status options
7. **Implement proper PRG pattern** after mutations — replace `window.location.reload()` with state update + redirect
8. **Add null checks for authUserLD** throughout — or ensure auth state is always populated before these components render
9. **Remove duplicate `console.log` statements** — clean up before migration
10. **Create role/department enum types** — frontend should use backend-provided role names/IDs, not hardcoded numbers

### Low Priority (Nice to Have)

11. **Implement i18n support** — currently all English-only; if migration involves multi-language support, i18n should be added
12. **Add proper type safety** — replace `any` types, fix `Task[]` vs call object mismatches, add proper interfaces
13. **Create unit tests for cross-cutting concerns** — ensure role guards, filter logic work correctly
14. **Add loading/error state consistency** — currently some pages show skeleton, some show nothing, some toast on error