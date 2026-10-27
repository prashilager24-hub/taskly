# Reports Page (src/pages/reports.tsx)

**Route:** `/reports`  
**Access:** `adminOrTech` guard (requires `user.userRole === 1 || user.departmentID === 24`)  
**File:** `src/pages/reports.tsx` (217 lines)

---

## Purpose & User Flow
Reports page — provides various reporting views for performance and operational data. Features:
- Tab-based navigation between different report types
- Report tabs: "Efficiency Report", "Target Report", "Utilization Report"
- Each tab shows different data tables and summary metrics
- Date range filtering affects all report types
- Download/Export functionality for reports

User flow:
1. User lands on reports page (only admins or tech team members)
2. Selects a report tab from the tab navigation
3. The selected tab's data loads with date range filtering
4. Summary cards show key metrics for the selected report type
5. Data table displays detailed breakdown
6. User can download/excel export

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/Department/list?page=0&size=0` | `searchText`, `filter`, `startDate`, `endDate`, `roleID: user.userRole`, `userID: ...` | Department list: `departmentID`, `departmentName` | On mount (once) |
| 2 | `POST` | `/t2.0/authentificationUtilization/users/read?page=0&size=0` | `filter`, `searchText`, `departmentID`, `token` | User list: `userID`, `userName` | When department changes |
| 3 | `POST` | `/t2.0/authentificationUtilization/list-efficiency-summary` | `departmentID`, `startDate`, `endDate`, `userID`, `groupBy: "day"`, `isHeExecutiveLeader`, `efficiencyLevel` | `summary` object, `data` array | When report tab changes + date range |
| 4 | `POST` | `/t2.0/authentificationUtilization/list-target-summary` | `departmentID`, `startDate`, `endDate`, `userID`, `groupBy: "day"` | `summary` with target metrics, `data` array | When "Target Report" tab selected |
| 5 | `POST` | `/t2.0/authentificationUtilization/list-utilization-summary` | `departmentID`, `startDate`, `endDate`, `userID`, `groupBy: "day"` | `summary` with utilization metrics, `data` array | When "Utilization Report" tab selected |
| 6 | `POST` | `/t2.0/authentificationUtilization/download-efficiency-summary` | Same as #3 | Excel blob | When "Download" clicked |

---

## Report Tabs

| Tab | Description | API Endpoint |
|-----|-------------|-------------|
| Efficiency Report | Avg target %, utilization %, goal %, efficiency level | `/list-efficiency-summary` |
| Target Report | Target achievement summaries | `/list-target-summary` |
| Utilization Report | Utilization percentage summaries | `/list-utilization-summary` |

---

## Special Logic

| Logic | Description |
|-------|-------------|
| Tab selection state (lines 20-24) | `useState` for selected tab; only adminOrTech can access |
| Date range default (lines 85-95) | If `selectedUser` set → no date range; otherwise default 7 days |
| Efficiency level calculation (same as other pages) | `High`: AvgTargetPercent >= 100 && AvgUtilizationPercent >= 80 && AvgTotalWork <= AvgAllocatedHrs; `At Par`: AvgTargetPercent >= 80 && AvgUtilizationPercent >= 50 && AvgTotalWork <= AvgAllocatedHrs; `Low`: all other |
| `isAdminOrTech` check (line 34) | `user.userRole === 1 || user.departmentID === 24` — hardcoded role/dept check |

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `sidebarOpen`, `dateSelect`, `departmentList`, `users`, `pageNumber`, `totalRecords`, `pageSize`, `searchValue`, `average`, `ELUserSummary`, `dashboard`, `loading`, `dateRange`, `selectedTab`, `selectedUser`, `efficiencyFilter` |
| Derived | `useMemo` | — |
| Effects | Multiple `useEffect` | Fetch departments on mount; fetch users when department changes; report data when `dateRange`, `selectedUser`, `selectedTab` change |

---

## Effects & Dependencies
- Line 208-248: `fetchDepartments` — runs once on mount
- Line 250-290: `fetchUsers` — dependency: `[selectedDepartment]` — fetches users for the selected department
- Line 320-410: `reportData` — **main data fetch**; dependency: `[dateRange, selectedUser, selectedTab]` — fetches data based on selected report tab; different API endpoint per tab
- Line 413-460: `handleDownload` — dependency: `[dateRange, selectedUser, selectedTab]` — downloads Excel for efficiency report

---

## UI Components Used (tree)

```
Reports
├── ReusableTable (component, ../components/table) — data table, varies by tab
├── Tabs, Tab (from @heroui/react) — tab navigation (Efficiency/Target/Utilization)
├── Button (from @heroui/button) — download export
├── CustomDateRangePicker (component, ../components/CustomDateRangePicker) — date selector
├── Format from date-fns — date formatting
├── Autocomplete, AutocompleteItem (from @heroui/react) — department filter, user filter
├── AddToast (from @heroui/react) — notifications
├── title from primitives — page title
├── useDashboardStore (from ../store/commonStore) — setAllUser
```

---

## Known Defects, Dead Code, TODOs

1. **Line 34**: `isAdminOrTech` guard: `user.userRole === 1 || user.departmentID === 24` — hardcoded role and department IDs. If backend changes role IDs or department IDs, access control will break.
2. **Lines 85-95**: Date range default logic same as other pages — if `selectedUser` set → no date range; otherwise default 7 days.
3. **Line 473 (approx)**: Hardcoded `2026-06-30` cutoff date likely exists for efficiency path similar to other pages.
4. **`selectedTab` state**: Only 3 tabs available (Efficiency, Target, Utilization) — if backend adds/removes report types, UI won't reflect changes.
5. **Different API endpoints per tab**: `/list-target-summary` and `/list-utilization-summary` — if these endpoints change format or return different fields, the report rendering will break.
6. **Department/user filter logic**: Same normalization `getUserDepartments` pattern used throughout — handles both `{ departmentID }` and `{ departments: [...] }` user shapes.
7. **Multiple `console.log` statements** left in the code.
8. **`efficiencyFilter` state** initialized to `""` — may cause comparison issues.

---

## Backend Migration Impact

**High risk** — this page makes API calls to three different summary endpoints:

**API endpoints:**
- `/list-efficiency-summary` — same as in other pages; returns `summary` with `AvgTargetPercent`, `AvgUtilizationPercent`, `AvgTotalWork`, `AvgGoalPercent`, `EfficiencyLevel`
- `/list-target-summary` — target achievement summaries; if backend changes field names (e.g., `targetAchieved`, `targetPercent`), the target report will break
- `/list-utilization-summary` — utilization summaries; if backend changes field names (e.g., `utilizationPercent`, `utilizationRate`), the utilization report will break

**Key concerns:**
1. **Same hardcoded cutoff date** `2026-06-30` issue as in Goals and QueryReport pages
2. **`isAdminOrTech` guard**: `user.userRole === 1 || user.departmentID === 24` — if role IDs or department IDs change, access control fails
3. **Three different API responses**: Each tab calls a different endpoint with potentially different response shapes. Backend changes to any of these will require frontend updates.
4. **Date format handling**: Same `convertToZonedFormat`, `normalizeISO`, `formatDateTime` patterns — timezone differences between Java/Spring Boot and Node.js may cause date comparison issues
5. **`selectedUser` special handling**: `isELORUSER ? String(user?.userID) : ""` — hardcoded role checking

---