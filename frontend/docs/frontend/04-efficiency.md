# Efficiency Page (src/pages/efficiency.tsx)

**Route:** `/efficiency-report`  
**Access:** All authenticated users  
**File:** `src/pages/efficiency.tsx` (705 lines)

---

## Purpose & User Flow
Performance insights page showing efficiency summaries across departments and users. Features:
- Department list selector
- User filter (by user, efficiency level, department)
- Date range picker (7/30 days or custom)
- Summary card showing avg working hours, allocated hrs, target %, utilization %
- Efficiency table with per-user or per-EL/FL data
- Download Excel functionality
- Tabbed view for EL (Executive Leader) and FL (Functional Leader) summaries

User flow:
1. User selects date range
2. User can filter by department and/or specific user
3. Summary card shows aggregated metrics
4. Table shows detailed data below
5. User can download Excel report
6. EL/FL users can switch tabs to view their subordinates' data

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/Department/list?page=0&size=0` | `searchText`, `filter`, `startDate`, `endDate`, `roleID: user.userRole`, `userID: ...` | Department list: `departmentID`, `departmentName`, `newStatus` | On mount (once) |
| 2 | `POST` | `/t2.0/authentificationUtilization/users/read?page=0&size=0` | `filter`, `searchText`, `departmentID`, `token` | User list: `userID`, `userName`, `roleID`, `reportingManagerID`, `elManagerId`, `functionalLeaderID` | When `filterStatus` changes |
| 3 | `POST` | `/t2.0/authentificationUtilization/list-efficiency-summary` | `departmentID`, `startDate`, `endDate`, `userID`, `groupBy: "day"`, `isHeExecutiveLeader`, `efficiencyLevel` | `summary` (AvgTargetPercent, AvgUtilizationPercent, AvgAllocatedHrs, AvgTotalWork, EfficiencyLevel), `data` array | When `filterStatus`, `dateRange`, `selectedUser`, or `efficiencyFilter` changes |
| 4 | `POST` | `/t2.0/authentificationUtilization/download-efficiency-summary` | Same as #3 | Excel blob | When "Download" button clicked |

---

## Forms

| Form | Fields | Validation | Defaults | Submit Behavior |
|------|--------|------------|----------|-----------------|
| Date Range Dropdown | startDate, endDate | None | Last 7 days from today | Updates `dateRange` state |
| CustomDateRangePicker | Same | None | — | — |
| Filter Dropdown (sub-component) | department, user, efficiency level | — | — | Updates filter state, triggers refetch |

---

## Tables/Lists

| Table | Columns | Sorting | Filtering | Pagination | Export/Download |
|-------|---------|---------|-----------|------------|-----------------|
| Efficiency table (ReusableTable) | User ID, User Name, Work Date, Target Achieved %, Allocated Time (hrs), Total Time Taken (hrs) | ✓ (via ReusableTable) | ✓ (via FilterDropdown) | ✓ (rows per page) | ✓ (Download button, Excel) |
| Department summary cards | Avg Target %, Avg Allocated Hrs, Avg Utilization %, Avg Target % | — | — | — | — |

Efficiency table columns (from table2.tsx):
- UserID, UserName, WorkDate, TargetAchievedPercent, AllocatedTimeHrs, TotalTimeOfWork
- Color-coded efficiency levels: High (success), Medium (warning), Low (danger)

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `sidebarOpen`, `dateSelect`, `departmentList`, `users`, `pageNumber`, `totalRecords`, `pageSize`, `searchValue`, `average`, `dashboard`, `loading`, `dateRange`, `userSearch`, `filteredUsers`, `efficiencyLevels`, `efficiencyFilter`, `selectedUser` |
| Derived | `useMemo` | `filteredUsers` computed from `users` + `userSearch` |
| Effects | Multiple `useEffect` | Fetch departments on mount; fetch users when `filterStatus` changes; fetch dashboard data when `filterStatus`, `dateRange`, `selectedUser`, `efficiencyFilter` change |

---

## Effects & Dependencies
- Line 190-228: `fetchDepartments` — runs once on mount
- Line 270-318: `fetchUsers` — dependency: `[filterStatus]` — runs when filter changes; has commented-out fetchLogs
- Line 320-393: `fetchUsers` (second one) — dependency: `[filterStatus]` — fetches users with role-based filtering (EL/FL/Reporting Manager)
- Line 395-439: `fetchDashboard` — dependency: `[filterStatus, dateRange, selectedUser, efficiencyFilter]` — fetches efficiency summary
- Line 442-491: `handleDownload` — dependency: `[filterStatus, dateRange, selectedUser, efficiencyFilter, user]` — downloads Excel

---

## UI Components Used (tree)

```
EfficiencyPage
├── Dropdown (from @heroui/react) — date range and status dropdowns
├── DropdownTrigger, DropdownMenu, DropdownItem (from @heroui/react)
├── Button (from @heroui/button) — various actions
├── CustomDateRangePicker (component, ../components/CustomDateRangePicker) — date selector
├── EfficiencyTable (component, ../components/table2) — main data table
├── FilterDropdown (component, ../components/FilterDropdown) — filter panel with dept/user/efficiency
├── ReusableTable (component, ../components/table) — generic table (not used here, table2 used instead)
├── addToast (from @heroui/react) — notifications
├── Tabs, Tab (from @heroui/react) — EL/FL tab switching (partially commented out)
├── Select, SelectItem (from @heroui/select) — department, user, efficiency level selectors
├── Card, CardBody (from @heroui/card) — summary cards
├── Picker (from @heroui/react) — date select component (imported as DatePicker but not used)
├── useMemo, useCallback (from react) — state management
├── format from date-fns — date formatting
```

---

## Known Defects, Dead Code, TODOs

1. **Lines 105-114**: `reportColumns` and `reportActions` are **commented out** — dead code
2. **Lines 137-188**: `renderReportCell` function is **commented out** — dead code
3. **Lines 230-318**: `fetchLogs` `useEffect` is **commented out** — dead code
4. **Lines 320-393**: Second `fetchUsers` effect has `console.log` statements (lines 383-385)
5. **Lines 492-501**: `efficiencyLevel` calculation is **commented out** at bottom of file
6. **Line 71**: `isELORUSER = [2, 3, 4, 5, 6, 7, 23].includes(user?.userRole)` — hardcoded role numbers
7. **Line 73**: `filterStatus` defaults to `user.departments ? 0 : ""` — conditional based on user departments array
8. **Lines 559-562**: Filter dropdown is **conditionally rendered**: `user.userRole !== 2 && user.userRole !== 5 && user.userRole !== 6 && user.userRole !== 23` — excludes certain roles from filtering
9. **Line 562-571**: FilterDropdown receives `filteredUsers.map(u => ({ key: u.userID, name: u.userName }))` — but `filteredUsers` may not include all users
10. **Line 278**: `departmentId: filterStatus ? Number(filterStatus) : 28` — hardcoded department ID 28 as fallback
11. **Multiple `console.log` statements** (lines 383-385 in goals.tsx-style patterns)
12. **Efficiency thresholds hardcoded** in summary cards (lines 650-665): `High` at ≥100% target, `At Par` at ≥80%, `Low` otherwise — these are frontend calculations that may disagree with backend

---

## Backend Migration Impact

**High risk** — this page makes direct API calls to:
- `/Department/list` — response mapped to department list with `departmentID`, `departmentName`, `newStatus`
- `/users/read` — response mapped to users with `userID`, `userName`, `roleID`, `reportingManagerID`, `elManagerId`, `functionalLeaderID`
- `/list-efficiency-summary` — **CRITICAL**: Response shape includes `summary` object with `AvgTargetPercent`, `AvgUtilizationPercent`, `AvgAllocatedHrs`, `AvgTotalWork`, `EfficiencyLevel` and `data` array
- `/download-efficiency-summary` — Excel download endpoint

**If Node.js backend changes:**
- **Efficiency summary response**: The most critical — `summary` object fields (`AvgTargetPercent`, `AvgUtilizationPercent`, `AvgAllocatedHrs`, `AvgTotalWork`, `EfficiencyLevel`) and `data` array structure must match exactly. Frontend does frontend calculations for efficiency levels but depends on these fields being present.
- **User response**: `reportingManagerID`, `elManagerId`, `functionalLeaderID` field names — if changed, user filtering logic breaks
- **Department response**: `newStatus` field name — if changed, department list display breaks
- **Date formats**: Frontend uses `format(new Date(...), "dd MMM yyyy")` — if backend sends different date formats, formatting may break
- **Efficiency calculation disagreement**: Frontend has its own efficiency level logic (lines 492-501, commented out, but the logic exists):
  - `High`: AvgTargetPercent >= 100 AND AvgUtilizationPercent >= 80 AND AvgTotalWork <= AvgAllocatedHrs
  - `At Par`: AvgTargetPercent >= 80 AND AvgUtilizationPercent >= 50 AND AvgTotalWork <= AvgAllocatedHrs
  - `Low`: all other conditions
  - If backend changes these thresholds or calculations, the frontend will display incorrect efficiency levels

**Additional concerns:**
- `isELORUSER` hardcoded role list `[2, 3, 4, 5, 6, 7, 23]` — if backend changes role IDs, this will misidentify users
- `filterStatus` default of `0` vs `""` — inconsistent behavior based on whether user has departments
- Hardcoded department ID `28` as fallback (line 278) — if dept 28 doesn't exist, may show wrong data
- Download button disabled when `user.departmentID` exists — may need re-evaluation if backend changes department handling