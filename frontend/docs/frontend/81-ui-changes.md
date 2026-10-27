# UI Changes Required (PHASE 5)

Changes needed per page/module during the Java→Node backend migration.

## Global Changes (Affect All Pages)

| # | Change | Reason | Files Affected | Risk |
|---|--------|--------|----------------|------|
| G1 | Replace hardcoded API base URL with env var (`VITE_API_BASE_URL`) | Backend URL may change during migration; currently 60+ calls hardcode `https://taskly.tapmind.io/t2.0/authentificationUtilization` | ALL pages, ALL components with API calls (60+) | **HIGH** — single point of failure |
| G2 | Create shared Axios instance with interceptors (auth token injection, refresh, error handling) | Currently each page manages auth headers and errors independently | New file `src/lib/api.ts` + all pages | **HIGH** — refactoring 60+ call sites |
| G3 | Add refresh token or session-expiry handling | Currently no refresh logic; JWT expiry forces silent API failures | `src/lib/api.ts`, auth store | **HIGH** |
| G4 | Standardize error handling (toast on all API failures) | Some pages show toasts, others silently fail | All pages | Medium |
| G5 | Extract role/dept checks to backend-returned permissions | 20+ hardcoded `userRole === 1`, `departmentID === 21/22/24` checks | ProtectedRoute, 18+ pages | **HIGH** |
| G6 | Remove `window.location.reload()` after mutations; use state updates | PRG pattern missing; causes form resubmission on refresh | 10-access-management, 03-department, others | Medium |

## Per-Page Changes

### 01-dashboard.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| D1 | Adapt efficiency summary field names if backend renames | 6 summary fields consumed | Medium |
| D2 | Handle 2026-06-30 cutoff removal if backend consolidates paths | Hardcoded date logic | Low |

### 03-department.tsx + 13-primary-department
| # | Change | Reason | Risk |
|---|--------|--------|------|
| P1 | Standardize user shape response | Dual `{departmentID}` vs `{departments[]}` shapes | Medium |
| P2 | Update role ID references in roleMap | Hardcoded `1: "Root User"` etc. | Medium |

### 05-entry-approval.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| E1 | Confirm approve/reject payload field names | `entryID`, `approvedBy`, `rejectedBy` may change | High |
| E2 | Status value constants alignment | Status strings hardcoded | Medium |

### 06-forms.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| F1 | Update `getUserDepartments()` normalization | Dual shape handling | Medium |

### 07-goal-management.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| G1 | Goal CRUD payload field names | create/update/delete endpoints | High |
| G2 | Role-based access logic (adminOrTech etc.) | Hardcoded role IDs | Medium |

### 08-goals.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| GL1 | Remove/replace 2026-06-30 hardcoded cutoff | Date-specific branching breaks after cutoff | **HIGH** |
| GL2 | Handle dual API paths (efficiency summary vs userGoalData) | Backend may consolidate | Medium |

### 09-history.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| H1 | Efficiency level computation → move to backend | Frontend duplicates business logic | Medium |
| H2 | Department targets/goals endpoint payloads | `departmentId` field naming | Medium |

### 10-access-management.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| A1 | Update 13-field user create/update payload | Any field rename breaks user management | **CRITICAL** |
| A2 | Fix status polarity (1/0) with backend | Hardcoded `userStatus: 1|0` | **CRITICAL** |
| A3 | Fix `roleFilter` null initialization (`Number(null)=0`) | May fetch wrong role on first load | Medium |
| A4 | Password field commented out — re-enable or remove | Line 718-730 dead code | Low |
| A5 | Remove hardcoded roleMap `[1,3,4,2,5,6,7,23]` | Role IDs may change | High |

### 11-sales-forward.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| S1 | Status value constants (6 statuses hardcoded) | Status strings may change | High |
| S2 | Cancelled-by inconsistency (`PUBLISHER` vs `CANCELLED_BY_PUBLISHER`) | Variable naming mismatch | Medium |
| S3 | Timezone handling in `convertToZonedFormat` | Node.js backend timezone may differ | Medium |
| S4 | Fix `Task[]` type on call data | Type mismatch | Low |

### 12-pms.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| PM1 | Replace localStorage permissions with API-fetched permissions | `localStorage.roles` format may change | High |
| PM2 | Fix hardcoded `departmentID === 16` for report access | Dept ID may change | Medium |
| PM3 | Fix hardcoded read-only roles `[2,5,6,23]` | Role IDs may change | Medium |

### 14-query-report.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| Q1 | Advanced filter field names alignment | `Target Achieved`, `Goal Achieved`, etc. must match backend | High |
| Q2 | Remove 2026-06-30 cutoff | Same as GL1 | **HIGH** |
| Q3 | Remove dept 7 / user 90 special path | Lines 530-533 hardcoded | Medium |
| Q4 | Fix inverted dept filter logic (`user.departmentID ? null : ...`) | Confusing UX | Low |

### 15-reports.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| R1 | Three summary endpoints field alignment | efficiency/target/utilization summaries | High |
| R2 | Remove hardcoded cutoff date | Same as GL1 | **HIGH** |
| R3 | Fix `adminOrTech` hardcoded guard | `role===1 || dept===24` | High |

### 16-target-management.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| T1 | `save-targets` payload alignment | 3-field array structure | High |
| T2 | Input validation (no min/max on %) | Invalid values may be sent | Medium |
| T3 | `adminOnly` hardcoded guard | `userRole === 1` | High |

### 17-daily-logs.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| DL1 | Status constants alignment (ACTIVE/COMPLETED/CANCELLED) | Filter mismatch if backend changes | High |
| DL2 | Duration unit display (minutes vs hours) | Display accuracy | Medium |
| DL3 | `adminOrTech` hardcoded guard | `role===1 || dept===24` | High |

### 18-hr-feedback.tsx
| # | Change | Reason | Risk |
|---|--------|--------|------|
| HR1 | Status constants (PENDING/RESOLVED) | Filter mismatch | High |
| HR2 | Reply payload field alignment | `feedbackID`, `replyText`, `respondedBy` | Medium |
| HR3 | Add reply text length validation | No client-side limit | Low |

### 19-task-management.tsx (TaskManagement)
| # | Change | Reason | Risk |
|---|--------|--------|------|
| TM1 | Add auth headers to department/task list calls | No Bearer token on GET endpoints | High |
| TM2 | Fix query-param status update (`?isActive=`) with backend | Unusual convention; may change to body | High |
| TM3 | Fix hardcoded `roleID: 1, userID: 1` in department fetch | Always queries as admin | Medium |
| TM4 | Fix form reset missing `type` field | Retains previous task type after create | Low |
| TM5 | Fix role select hardcoded IDs `[1,2,3,4,5,6,7,23]` | Role IDs may change | Medium |
| TM6 | Remove dead imports (RollerCoaster, Sidebar, Topbar) | Unused code | Low |
| TM7 | 37 hardcoded task types — sync with backend validation | Type mismatch breaks create/update | Medium |

## Change Count Summary

| Risk Level | Count |
|------------|-------|
| **CRITICAL** | 4 (user create/update payload, status polarity, task create/update, task status query-param) |
| **HIGH** | 31 |
| Medium | 22 |
| Low | 8 |
| **Total** | **65 changes** |
