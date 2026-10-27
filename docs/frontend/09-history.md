# History Page (src/pages/History.tsx)

**Route:** `/User-History`  
**Access:** `adminOnly` guard (requires `user.userRole === 1`)  
**File:** `src/pages/History.tsx` (1044 lines)

---

## Purpose & User Flow
User performance history page — reviews historical performance, productivity, utilization, and target achievement trends. Features:
- Department and user filtering via filter dropdown
- Summary cards showing avg target, utilization, goal percentages per department
- Department detail cards with efficiency levels
- Drill-down modal to view targets and goals per department
- Download efficiency summary Excel (button commented out)
- Executive leader summary tabs (for `isHeExecutiveLeader` users)

User flow:
1. Admin lands on page — filter dropdown allows user selection
2. Summary cards show department-level efficiency metrics (only when user selected)
3. User can click "View Details" on a department card
4. Modal opens showing department targets (🎯) and goals (🚀)
5. EfficiencyTable shows raw data (hidden for role 3)
6. EL users see tabbed department summaries

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/Department/list?page=0&size=0` | `searchText`, `filter`, `startDate`, `endDate`, `roleID: user.userRole`, `userID` | `response.departments[]`: `departmentID`, `departmentName`, `departmentDescription`, `newStatus` | On mount (once) |
| 2 | `POST` | `/users/read?page=0&size=0` | `filter`, `searchText`, `departmentID: filterStatus ? Number(filterStatus) : 0` | `response.users[]`: `userID`, `userName` | When `filterStatus` changes |
| 3 | `POST` | `/list-efficiency-summary` | `departmentID`, `startDate`, `endDate`, `userID`, `groupBy: "day"`, `history: true`, `isHeExecutiveLeader`, `efficiencyLevel` | `summary` object keyed by departmentID; `data[]` with `DepartmentID`, `DepartmentName`, `TargetAchievedPercent`, `AllocatedTimeHrs`, `UtilizationPercent`, `TotalTimeOfWork`, `GoalPercent`, `WorkDate`; `departments[]` for EL summary | When `filterStatus`, `dateRange`, `selectedUser`, `efficiencyFilter` change |
| 4 | `POST` | `/departmentTargets/getTargetsByDepartment` | `departmentId: dept.DepartmentID` | `result[]`: `targetID`, `targetName`, `unit` | When "View Details" clicked |
| 5 | `POST` | `/departmentGoals/getGoalsByDepartment` | `departmentId: dept.DepartmentID` | `result[]`: `goalID`, `goalName`, `frequency`, `unit` | When "View Details" clicked |
| 6 | `POST` | `/download-efficiency-summary` | Same as #3 (minus `history`) | Excel blob (`spreadsheetml.sheet`) | When "Download" clicked (button currently commented out in JSX) |

---

## Special Logic

| Logic | Description |
|-------|-------------|
| `isELORUSER` (line 84) | `user.userRole === 2 \|\| user.userRole === 3 \|\| user.userRole === 4` — if true, `selectedUser` auto-set to user's own ID |
| Efficiency level calc (lines 471-485) | `High`: AvgTargetPercent >= 100 AND AvgUtilizationPercent >= 80 AND AvgTotalWork <= AvgAllocatedHrs; `At Par`: >= 80 / >= 50 / <= allocated; else `Low` |
| Department summary reduction (lines 434-500) | Reduces `data[]` into per-department summary objects with computed averages and efficiency levels |
| `handleViewDetails` (lines 241-269) | Fetches targets + goals for a specific department when modal opened |
| Date range default (lines 90-123) | If `selectedUser` set → clears date range to empty strings; otherwise default 7 days from today |
| Filter dropdown visibility (line 644) | `user.userRole !== 2` — role 2 users don't see Filter button |
| EfficiencyTable hidden for role 3 (line 842) | `user.userRole !== 3` — executive leaders don't see main table |
| EL summary tabs (line 856) | `user.isHeExecutiveLeader` — shows tabbed `EfficiencyTable` per department from `data.departments` |
| `history: true` flag (line 409) | Sent only in dashboard fetch, not in download — unique to this page |

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `sidebarOpen`, `dateSelect`, `isModalOpen`, `selectedDept`, `targets`, `goals`, `departmentList`, `users`, `pageNumber`, `totalRecords`, `pageSize`, `searchValue`, `average`, `ELUserSummary`, `dashboard`, `loading`, `dateRange`, `filterStatus`, `efficiencyFilter`, `isFilterOpen`, `selectedUser`, `userSearch`, `reportData` |
| Derived | Computed | `filteredUsers` — users filtered by `userSearch` |
| Auth | `localStorage.authUserLD` | Parsed once; `user` object used throughout |

---

## Effects & Dependencies

- Lines 102-123: Date range effect — dependency: `[selectedUser]` — clears or sets 7-day default
- Lines 271-308: `fetchDepartments` — runs once on mount; uses `fetch()` (not axios) with `roleID: user.userRole`
- Lines 310-349: `fetchUsers` — dependency: `[filterStatus]` — uses axios with Bearer token
- Lines 399-521: `dashboard` — **main data fetch**; dependency: `[filterStatus, dateRange, selectedUser, efficiencyFilter]` — fetches efficiency summary, computes department summary, sets `average` (only if `selectedUser` set) and `dashboard`, and `ELUserSummary` for role 3
- Lines 524-573: `handleDownload` — fetches Excel blob, triggers download via anchor element

---

## Dead Code

- Lines 351-397: Entire `fetchLogs` effect **commented out** (dailyTaskLog/list endpoint)
- Lines 574-583: Efficiency level ternary **commented out**
- Lines 600-641: Download button and date range dropdown **commented out** in JSX
- Lines 660-686: Department filter autocomplete **commented out** in filter dropdown
- Lines 722-738: Efficiency filter autocomplete **commented out** in filter dropdown
- Lines 1009-1044: Fallback target/goal fetch logic **commented out** at file end
- Lines 169-186: `reportActions` with "View Details" and "Edit" — both have empty `onAction` callbacks (no-op)

---

## UI Components Used (tree)

```
History
├── EfficiencyTable (component, ../components/table2) — main data table + EL tabs
├── Card, CardBody, CardHeader (from @heroui/react) — summary cards + modal cards
├── Modal, ModalContent, ModalHeader, ModalBody (from @heroui/react) — targets/goals drill-down
├── Tabs, Tab (from @heroui/react) — EL department summary tabs
├── Dropdown, DropdownMenu, DropdownTrigger, DropdownItem (from @heroui/react) — filter panel
├── Autocomplete, AutocompleteItem (from @heroui/react) — user filter
├── Chip (from @heroui/react) — efficiency level badge, target/goal chips
├── Spinner (from @heroui/react) — loading state
├── Button (from @heroui/react) — Close button in filter, (Download commented out)
├── CustomDateRangePicker (component, ../components/CustomDateRangePicker) — (commented out in JSX)
├── FilterIcon (inline SVG, lines 47-62) — filter button icon
├── title (from ../components/primitives) — page title
├── format (from date-fns) — (imported but only used in commented code)
├── Sidebar, Topbar (imported but not rendered in JSX)
```

---

## Known Defects, Dead Code, TODOs

1. **Lines 63-64 (previous file)**: Previous version had garbled content — now fixed
2. **Lines 351-397**: Large commented-out `fetchLogs` effect — dead code referencing `/dailyTaskLog/list`
3. **Lines 600-641**: Download button and date range picker both commented out — `handleDownload` function exists but no button calls it (dead code)
4. **Lines 660-686, 722-738**: Department and efficiency filters commented out — only user filter remains active in dropdown
5. **Lines 1009-1044**: Commented-out fallback logic at file end
6. **Lines 169-186**: `reportActions` has empty callbacks — `View Details` and `Edit` buttons do nothing
7. **`filterStatus` initialization** (line 128-130): `user?.departments ? 0 : ""` — mixes number (0) and string ("") types
8. **`isELORUSER`** (line 84): Only checks roles 2, 3, 4 — differs from other pages that check `[2,3,4,5,6,7,23]`
9. **Role 3 special handling** (line 511): `if (user.userRole == 3) { setELUserSummary(data.departments) }` — only role 3 gets EL summary; `==` instead of `===`
10. **Line 644**: `user.userRole !== 2` for filter visibility — hardcoded role check
11. **Line 842**: `user.userRole !== 3` for EfficiencyTable visibility — hardcoded role check
12. **`user.departmentID` vs `filterStatus`**: Department filter autocomplete is commented out but `filterStatus` still used in API calls — always passes `0` (from initial value)
13. **`Sidebar` and `Topbar` imported but not rendered** — dead imports
14. **Multiple `console.log` statements** left in code
15. **`reportData` state** (line 124) set only in commented-out effect — always empty array

---

## Backend Migration Impact

**High risk** — multiple API endpoints with unique request flags:

**Key concerns:**
1. **`history: true` flag** (line 409): Unique to this page's `/list-efficiency-summary` call — if backend doesn't recognize this flag, history page may return wrong data
2. **Efficiency level computation** (lines 471-485): Duplicated frontend business logic — same thresholds as 04-efficiency, 14-query-report, 15-reports. If backend changes thresholds, 4+ pages show wrong levels
3. **`departmentTargets/getTargetsByDepartment`** and **`departmentGoals/getGoalsByDepartment`**: Modal drill-down endpoints — response `result[]` with `targetID/targetName/unit` and `goalID/goalName/frequency/unit` field names
4. **Department summary reduction** (lines 434-500): Complex frontend aggregation of `data[]` into per-department summaries — if backend field names (`TargetAchievedPercent`, `AllocatedTimeHrs`, `UtilizationPercent`, `TotalTimeOfWork`, `GoalPercent`) change, summary cards break
5. **EL summary structure** (line 513): `data.departments` must contain `{ DepartmentName, Users[] }` — if backend changes this shape, EL tabs break
6. **Hardcoded role checks**: `userRole !== 2`, `userRole !== 3`, `userRole === 3`, `isELORUSER` roles 2/3/4 — all break if role IDs change
7. **`user.isHeExecutiveLeader`**: Boolean flag from auth object — if backend changes this field name or type, EL tabs disappear
8. **Mixed fetch/axios**: Uses `fetch()` for departments (line 283) and `axios` for everything else — inconsistent error handling

---
