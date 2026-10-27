# DashboardPage (src/pages/dashboard.tsx)

**Route:** `/dashboard`  
**Access:** All authenticated users  
**File:** `src/pages/dashboard.tsx` (705+ lines)

---

## Purpose & User Flow
The dashboard is the main landing page after login. It provides:
- Radial bar charts showing target %, allocated hrs, work hrs, and goal efficiency
- Summary stats: "Target Achieved (Overall)", "Allocated hours per day (Average)", "Working hours per day (Average)", "Overall Goal"
- Department list with filterable user lists
- Report generation (calculateAll, download Excel)
- Missing data log generation
- Date range picker for filtering all data

User flow:
1. Login → dashboard loads with default 7-day range
2. User can change date range via CustomDateRangePicker
3. User can filter by department or view all users
4. User can run "Calculate Report" or download Excel
5. User can view department summaries and individual user efficiency

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/DashBoardAll` | `payload` object containing: `startDate`, `endDate`, `goalStartDate`, `goalEndDate`, `departmentType`, `roleID`, `userID`, `isHeExecutiveLeader`, `isHeFunctionalLeader` | `elSummary`, `flSummary`, `elData` (if role===1), `departmentSummary`, `userSummary`, `companySummary` (efficiency levels, percentages), `elUsersSummary`, `elUsersSummaryGraph`, `flUsersSummary`, `flUsersSummaryGraph`, `allUser` | On mount, whenever `payload`, `refresh`, `dateRange`, or `departmentType` changes |
| 2 | `POST` | `/t2.0/authentificationUtilization/Department/list?page=0&size=0` | `roleID: user.userRole`, `userID: ...` | Department list with `departmentID`, `departmentName`, `departmentDescription`, `newStatus` | On mount (once) |
| 3 | `POST` | `/t2.0/authentificationUtilization/users/read?page=0&size=0` | `filter`, `searchText`, `departmentID`, `roleID`, `userID`, `token` | User list: `userID`, `userName`, `roleID` | When `selectedDepartment` changes |
| 4 | `GET` | `/t2.0/authentificationUtilization/calculateAll` | None | Success toast | When "Run Report" button clicked |
| 5 | `GET` | `/t2.0/authentificationUtilization/MissingData?startDate=&endDate=` | `startDate`, `endDate` | Log data array | When "Log" button clicked |
| 6 | `POST` | `/t2.0/authentificationUtilization/DashBoardAll/download/excel` | Same payload as #1 | Excel blob | When "Download" button clicked |

---

## Forms

| Form | Fields | Validation | Defaults | Submit Behavior |
|------|--------|------------|----------|-----------------|
| Date Range Picker | startDate, endDate | None (free text via calendar) | Last 7 days from today | Updates `dateRange` state, triggers data refetch |
| CustomDateRangePicker | Same as above | None | — | — |

---

## Tables/Lists

| Table | Columns | Sorting | Filtering | Pagination | Export/Download |
|-------|---------|---------|-----------|------------|-----------------|
| Department list (internal) | departmentID, departmentName, description, status | — | By searchTerm (not exposed UI) | — | — |
| User summary table | Target Achieved %, Utilization %, Allocated Hrs, Total Work | — | By department filter, user role | — | Excel download (via calculateAll) |
| Company summary radial chart | 5 radial metrics (Target, Allocated, Work, Goal, Efficiency) | — | Date range filter | — | Excel download |

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | `useState` in DashboardPage | `dateRange`, `goalDateRange`, `refresh`, `selectedDepartment`, `elFilter`, `flFilter`, `departmentType`, `pageNumber`, `pageSize`, `searchValue` |
| Global store | `useDashboardStore` | `dateModification`, `allUser` (persisted) |
| Derived | `useMemo`/`useCallback` | `stats` computed from `companySummary.values`, `ELSummaryFiltered`, `FLSummaryFiltered`, `departmentSummaryFiltered` |
| Effects | `useEffect` in `useDashboardData` hook | Fetches data when `payload` changes; aborts with `AbortController` |

---

## Effects & Dependencies
- `useDashboardData` hook (lines 443-616): Dependencies: `[payload, refresh]` — fetches `/DashBoardAll`; aborts on unmount
- Department fetch (line 921): No dependencies — runs once on mount
- Users fetch (line 952): Dependency: `[selectedDepartment]` — fetches users for selected dept
- Report fetch (line 993): No dependencies — runs on button click
- Download (line 1026): Dependency: `[payload]` — downloads Excel

---

## UI Components Used (tree, defined in)

```
DashboardPage
├── ColumnChart (inline, lines 67-231) — radial bar chart variant
├── StatRow (inline, lines 362-384) — stat card component
├── EfficiencyRules (inline, lines 387-429) — rules explanation panel
├── RadialBarSkeleton (inline, lines 435-439) — loader
├── RadialSummaryCard (memo, lines 659-720) — radial chart card
├── MonthYearPicker (memo, lines 722-841) — month/year selector
├── CustomDateRangePicker (component, ../components/CustomDateRangePicker) — date picker
├── EfficiencyTable (component, ../components/table2) — efficiency table
├── ElDashboard (component, ../components/ElDashboard) — executive dashboard
├── SwitchUserFilter (component, ../components/SwitchUserFilter) — user switching
├── SwitchedUserBanner (component, ../components/SwitchedUserBanner) — banner
├── addToast (from @heroui/react) — toast notifications
├── Dropdown, DropdownMenu, DropdownItem (from @heroui/react) — date range dropdown
├── Tabs, Tab (from @heroui/react) — executive leader tabs
├── Select, SelectItem (from @heroui/react) — department/user selectors
├── Button (from @heroui/react) — action buttons
├── motion, AnimatePresence (framer-motion) — chart animations
├── EmptyContainer (component) — empty state
```

---

## Known Defects, Dead Code, TODOs

1. **Line 92-93**: `STAT_DEFS` has commented-out entries — some labels/keys are commented
2. **Lines 212-216**: `ColumnChart` has commented-out grid stats section
3. **Lines 234-257**: `getEfficiencyLevel` function is completely commented out
4. **Line 519**: `if (user.userRole === 3)` branch in `useDashboardData` references `data.elGoalSummary` which may be undefined
5. **Line 906-918**: `stats` memo depends on `companySummary` but uses `def.key >= 0` check — `def.key === "subtitle"` branch may fail if `companySummary.subtitle` is undefined
6. **Multiple console.log statements** in the code (e.g., line 199 in subdepartment.tsx, line 383 in goals.tsx, etc.)
7. **Line 92-93 in dashboard**: `STAT_DEFS` has a comment `// const getEfficiencyLevel = ` — dead code
8. **Radial chart trend is hardcoded** `" +12.4%"` (line 92) — not dynamic
9. **No error boundary** — fetch errors caught and logged only

---

## Hardcoded Values
- `7` — default date range days (line 856, 857)
- `" +12.4%"` — hardcoded trend percentage (line 92)
- `100`, `80`, `50` — efficiency thresholds in `EfficiencyRules` component
- `8` — standard workday hours mentioned in EfficiencyRules
- `0.07` — animation delay multiplier in ColumnChart
- `120` — spring stiffness in ColumnChart animation
- `18` — spring damping in ColumnChart animation

---

## Files That Could Change Due to Backend Migration
- **API endpoints**: All `/t2.0/authentificationUtilization/...` calls — if Node.js backend changes field names or response shapes, the frontend mappings will break
- **Dashboard payload** (useDashboardData): Object with `departmentType`, `roleID`, `userID`, `isHeExecutiveLeader`, `isHeFunctionalLeader` — if backend changes these field names or adds/removes fields, the payload construction and response mapping will need updates
- **Department list response**: Maps `departmentID`, `departmentName`, `departmentDescription`, `newStatus` — if Node.js changes these, the `dept` mapping in dashboard (line 936-941) and other pages will break
- **User summary response**: Maps `UserName`, `EfficiencyLevel`, `AvgTargetPercent`, `AvgUtilizationPercent`, `AvgAllocatedHrs`, `AvgTotalWork` — critical for chart data
- **Company summary**: `EfficiencyLevel`, `AvgTargetPercent`, `AvgUtilizationPercent`, `AvgAllocatedHrs`, `AvgTotalWork`, `AvgGoalEfficiency` — used in radial charts and stats