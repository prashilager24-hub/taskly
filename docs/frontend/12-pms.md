# PMS Page (src/pages/pms.tsx)

**Route:** `/pms`  
**Access:** All authenticated users  
**File:** `src/pages/pms.tsx` (89 lines — very thin wrapper)

---

## Purpose & User Flow
PMS (Performance Management System) page — displays different tabs based on user role and permissions. Features:
- Dynamic tab show/hide based on permissions
- PmsDashboard component (default for most users)
- GoalSetting component (for certain roles)
- MonthlyReview and QuarterlyReview components
- PmsReport component visible only for userID 1 and 142

User flow:
1. User lands on PMS page
2. Permissions are loaded from `localStorage.roles` (rolePrivileges)
3. Tabs are computed based on `isReadOnly`, `isReportUser`, and `pmsPermissions`
4. User sees only the tabs they have permission for
5. Clicking tabs navigates to different sub-components

---

## Permission Logic

| Condition | Tabs Shown |
|-----------|-----------|
| `isReadOnly` (role 2, 5, 6, 23) | Only "Dashboard" tab with `PmsDashboard` |
| Otherwise (normal roles) | "Goal Setting", "Manager Feedback" (MonthlyReview), "Quarterly Review", "Dashboard", + "Report" if `isReportUser` |
| `isReportUser` (userID===1 or dept===16) | Additional "Report" tab with `PmsReport isReport={true}` |

**`isReadOnly`** (lines 26-30): `user?.userRole === 2 || user?.userRole === 5 || user?.userRole === 6 || user?.userRole === 23`

**`isReportUser`** (lines 32-34): `Number(user?.userID) === 1 || (user?.departments ?? []).some((d) => Number(d?.departmentID) === 16)`

**`pmsPermissions`** (line 24): `permissions?.pms || []` — loaded from `localStorage.getItem("roles").rolePrivileges`

---

## API Calls
- **None directly** — permissions loaded from localStorage; sub-components may make their own API calls

---

## Components Used
- `PmsDashboard` — imported from `../components/pmsDashboard`
- `GoalSetting` — imported from `../components/goalSetting`
- `QuarterlyReview` — imported from `../components/quarterlyReview`
- `MonthlyReview` — imported from `../components/monthlyReview`
- `Tabs`, `Tab` — from `@heroui/react`

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | `useMemo` for user, storedRole, permissions | User from `localStorage.authUserLD`, roles from `localStorage.roles`, permissions derived from rolePrivileges |
| Derived | Computed `tabs` array | Based on `isReadOnly`, `isReportUser`, `pmsPermissions` |
| Effects | None — all state from localStorage | |

---

## Known Defects / Observations

1. **Very thin page** (89 lines) — most logic is in the sub-components
2. **Permissions from localStorage**: `storedRole = JSON.parse(localStorage.getItem("roles") || "{}")` and `permissions = JSON.parse(storedRole.rolePrivileges || "{}")` — if localStorage format changes or roles are cleared, permissions default to empty
3. **`isReportUser` hardcodes department ID 16**: `Number(d?.departmentID) === 16` — if backend changes department IDs, the report access logic will break
4. **`isReadOnly` hardcodes role numbers**: `[2, 5, 6, 23]` — if backend changes role IDs, read-only users may be misidentified
5. **No API calls on this page** — entirely dependent on localStorage permissions; if the Node.js backend changes how permissions are stored or retrieved, the frontend will need to adapt

---