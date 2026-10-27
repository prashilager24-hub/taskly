# Timeline (PHASE 6)

## Assumptions
- **1 developer** working **full-time (6-7h productive/day)**
- **AI assistance** for code generation, refactoring, testing (reduces ~40% manual effort)
- Backend migration runs **in parallel** (separate team/person)
- Frontend must keep working throughout migration
- Working days only (no weekends/holidays)
- Starting from a clean slate with this audit as reference

## Task Breakdown

### Phase A: Foundation (Week 1-2) — 10 working days

| # | Task | Est. Days | Dependencies |
|---|------|-----------|--------------|
| A1 | Create shared API client (`src/lib/api.ts`) with interceptors, base URL from env | 1.5 | — |
| A2 | Replace all 60+ hardcoded API URLs with shared client | 2 | A1 |
| A3 | Add auth token injection + 401 handling + refresh flow | 1.5 | A1 |
| A4 | Extract role/department permission constants into single config | 1 | — |
| A5 | Create environment config (`.env` files for dev/staging/prod) | 0.5 | — |
| A6 | Remove `window.location.reload()`; replace with state updates | 1.5 | A1 |
| A7 | Remove all `console.log` statements | 0.5 | — |
| A8 | Testing + regression check of foundation changes | 1.5 | A1-A7 |
| | **Phase A Total** | **10 days** | |

### Phase B: Critical Modules (Week 3-5) — 15 working days

| # | Task | Est. Days | Dependencies |
|---|------|-----------|--------------|
| B1 | **10-access-management**: Fix 13-field payload, status polarity, roleMap, roleFilter null bug | 3 | A1-A4 |
| B2 | **Auth flow**: login, JWT handling, ProtectedRoute, role guards → backend permissions | 2.5 | A1-A4 |
| B3 | **03-department + 13-primary-department**: User shape normalization, CRUD payloads | 2 | A1-A4 |
| B4 | **01-dashboard**: Efficiency summary field adaptation, cutoff removal | 1.5 | A1-A4 |
| B5 | **05-entry-approval**: Approve/reject payload alignment, status constants | 2 | A1-A4 |
| B6 | **06-forms**: getUserDepartments normalization | 1 | A1-A4 |
| B7 | **16-target-management**: save-targets payload, input validation | 1.5 | A1-A4 |
| B8 | Integration testing with Node.js backend (staging) | 1.5 | B1-B7 |
| | **Phase B Total** | **15 days** | |

### Phase C: Reporting & Analytics (Week 6-7) — 10 working days

| # | Task | Est. Days | Dependencies |
|---|------|-----------|--------------|
| C1 | **04-efficiency**: Summary field names, efficiency level calc → backend | 1.5 | A1-A4 |
| C2 | **08-goals**: Remove 2026-06-30 cutoff, consolidate dual API paths | 2 | A1-A4 |
| C3 | **07-goal-management**: Goal CRUD payloads, role access | 1.5 | A1-A4 |
| C4 | **09-history**: Move efficiency calc to backend, targets/goals endpoints | 1.5 | A1-A4 |
| C5 | **14-query-report**: Filter field alignment, cutoff removal, dept7/user90 path | 2 | A1-A4 |
| C6 | **15-reports**: Three summary endpoints, cutoff removal | 1.5 | A1-A4 |
| | **Phase C Total** | **10 days** | |

### Phase D: Feature Modules (Week 8-9) — 10 working days

| # | Task | Est. Days | Dependencies |
|---|------|-----------|--------------|
| D1 | **11-sales-forward**: Status constants, timezone handling, type fixes | 2 | A1-A4 |
| D2 | **17-daily-logs**: Status constants, duration units, adminOrTech guard | 1.5 | A1-A4 |
| D3 | **18-hr-feedback**: Status constants, reply payload, validation | 1.5 | A1-A4 |
| D4 | **12-pms**: localStorage permissions → API permissions, hardcoded dept/role fixes | 2 | A1-A4, B2 |
| D5 | **19-task-management**: Add auth headers, fix query-param status, role/type sync | 1.5 | A1-A4 |
| D6 | **02-activity-log**: Verify integration with shared client | 0.5 | A1-A2 |
| D7 | Remaining cleanup: type fixes, dead code removal | 1 | — |
| D8 | Integration testing | 1.5 | D1-D7 |
| | **Phase D Total** | **11.5 days** | |

### Phase E: Testing & Hardening (Week 10-11) — 8 working days

| # | Task | Est. Days | Dependencies |
|---|------|-----------|--------------|
| E1 | Full regression testing across all 23 pages | 3 | All |
| E2 | Edge case testing: auth expiry, role changes, empty states, pagination | 1.5 | E1 |
| E3 | Mobile/responsive testing | 1 | E1 |
| E4 | Performance testing (list pages, large datasets) | 1 | E1 |
| E5 | Bug fixes from testing | 1.5 | E1-E4 |
| | **Phase E Total** | **8 days** | |

## Summary

| Phase | Description | Days | Weeks |
|-------|-------------|------|-------|
| A | Foundation (API client, config, cleanup) | 10 | 1-2 |
| B | Critical modules (auth, access mgmt, dept, dashboard) | 15 | 3-5 |
| C | Reporting & analytics (efficiency, goals, reports) | 10 | 6-7 |
| D | Feature modules (sales, daily logs, PMS, feedback, task mgmt) | 11.5 | 8-9 |
| E | Testing & hardening | 8 | 10-11 |
| **Total** | | **54.5 days** | **~11 weeks** |

## Critical Path
```
A1 (API client) → A2 (URL replacement) → A3 (auth) → B2 (auth flow) → 
B1 (access mgmt) → B3 (dept CRUD) → B5 (entry approval) → 
C2 (goals cutoff fix) → C5 (query report) → D4 (PMS) → E1 (regression)
```

## Milestones

| Milestone | Date (Week) | Criteria |
|-----------|-------------|----------|
| M1: Foundation complete | Week 2 | All pages use shared API client; no hardcoded URLs; auth refresh working |
| M2: Critical modules done | Week 5 | User management, auth, departments, dashboard, entry approval working against Node.js |
| M3: Reporting done | Week 7 | All efficiency/goal/report pages working against Node.js |
| M4: All modules done | Week 9 | All 23 pages working against Node.js |
| M5: Production ready | Week 11 | Full regression passed; zero critical defects |

## Risk Buffer
- **+3 days** buffer (total 56 days) for unforeseen backend API differences
- If backend migration is delayed, frontend work on Phase C/D can proceed with mock data

## Gantt Chart (simplified)

```
Week:  1   2   3   4   5   6   7   8   9   10  11
       |   |   |   |   |   |   |   |   |   |   |
A      ████████████
B              █████████████████
C                          ████████████
D                                      ████████████
E                                              ████████████
M1        ●
M2                    ●
M3                            ●
M4                                    ●
M5                                                ●
```
