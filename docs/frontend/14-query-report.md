# Query Report Page (src/pages/QueryReport.tsx)

**Route:** `/Query-Report`  
**Access:** `adminOnly` guard (requires `user.userRole === 1`)  
**File:** `src/pages/QueryReport.tsx` (865 lines)

---

## Purpose & User Query Report
Query report — analyzes and filters performance data across departments and users. Features:
- Department and user filtering
- Advanced filter panel with field/operator/value triads
- Date range picker
- Summary card with aggregated metrics
- Efficiency table showing per-department performance
- Download Excel functionality
- Filter persistence across sessions

User flow:
1. User lands on query report page
2. Can filter by department (autocomplete) and/or user (autocomplete)
3. Can add advanced filters: field (Target Achieved/Goal Achieved/Utilization/Utilization) + operator (+/-/=) + value
4. Summary card shows aggregated data
5. Table shows department-level performance data
6. User can change filters, date range, or download report

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/Department/list?page=0&size=0` | `searchText`, `filter`, `startDate`, `endDate`, `roleID: user.userRole`, `userID: ...` | Department list: `departmentID`, `departmentName`, `newStatus` | On mount (once) |
| 2 | `POST` | `/t2.0/authentificationUtilization/users/read?page=0&size=0` | `filter`, `searchText`, `departmentID`, `token` | User list: `userID`, `userName` | When `filterStatus` changes |
| 3 | `POST` | `/t2.0/authentificationUtilization/list-efficiency-summary` | `departmentID`, `startDate`, `endDate`, `userID`, `groupBy: "day"`, `isHeExecutiveLeader`, `efficiencyLevel`, `filters` | `summary` object (AvgTargetPercent, AvgUtilizationPercent, AvgTotalWork, AvgGoalPercent), `data` array | When `filterStatus`, `dateRange`, `selectedUser`, `efficiencyFilter`, or `filters` change |
| 4 | `POST` | `/t2.0/authentificationUtilization/download-efficiency-summary` | Same as #3 | Excel blob | When "Download" button clicked |

---

## Filter Panel Special Logic

| Logic | Description |
|-------|-------------|
| `filters` state (lines 58-64) | Array of filter objects: `{ field, operator, value }` — can add multiple filters |
| `filterFields` (lines 65-71): "Target Achieved", "Goal Achieved", "Efficiency", "Utilization" | Available fields for filtering |
| `numericOperators` (lines 76-82): "=", ">", "<", ">=", "<=" | For numeric fields (Target Achieved, Goal Achieved, Utilization) |
| `textOperators` (lines 72-75): "=", "contains" | For text fields |
| `showFilters` condition (line 616): `user.userRole !== 2` | Filter dropdown only shown for non-role-2 users |
| Filters mapping to API (lines 376-381): `filters.filter(f => f.field && f.value).map(f => ({ field: f.field, operator: f.operator, value: f.value }))` | Transforms UI filters to API payload format |

---

## Forms
- None — filter panel with Autocomplete selects and Input for values

---

## Tables/Lists

| Table | Columns | Sorting | Filtering | Pagination | Export/Download |
|-------|---------|---------|-----------|------------|-----------------|
| Efficiency table (ReusableTable) | Department ID, Department Name, Avg Target %, Avg Utilization %, Avg Goal %, Efficiency Level | — (data from API, not table sorting) | ✓ (department, user filters + advanced filter panel) | — | ✓ (Download button) |

**Report columns** (lines 147-156): Standard task log columns but used for efficiency data display.

**Summary card** (lines 860-880): Shows `AvgTargetPercent`, `AvgUtilizationPercent`, `AvgTotalWork`, `AvgGoalPercent`, and `EfficiencyLevel` computed from the same thresholds as other pages:
- `High`: AvgTargetPercent >= 100 && AvgUtilizationPercent >= 80 && AvgTotalWork <= AvgAllocatedHrs
- `At Par`: AvgTargetPercent >= 80 && AvgUtilizationPercent >= 50 && AvgTotalWork <= AvgAllocatedHrs
- `Low`: all other conditions

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `sidebarOpen`, `dateSelect`, `departmentList`, `users`, `pageNumber`, `totalRecords`, `pageSize`, `searchValue`, `average`, `ELUserSummary`, `dashboard`, `loading`, `dateRange`, `filterStatus`, `efficiencyFilter`, `isFilterOpen`, `filters` |
| Derived | `useMemo` | `filteredUsers` from `users` + `userSearch` |
| Effects | Multiple `useEffect` | Fetch departments on mount; fetch users when `filterStatus` changes; dashboard fetch when `filterStatus`, `dateRange`, `selectedUser`, `efficiencyFilter`, `filters` change |

---

## Effects & Dependencies
- Line 232-270: `fetchDepartments` — runs once on mount
- Line 272-312: `fetchUsers` — dependency: `[filterStatus]` — fetches users for department filter
- Line 362-493: `dashboard` — **main data fetch**; dependency: `[filterStatus, dateRange, selectedUser, efficiencyFilter, filters]` — fetches efficiency summary with optional advanced filters
- Line 496-545: `handleDownload` — dependency: `[filterStatus, dateRange, selectedUser, efficiencyFilter]` — downloads Excel

---

## UI Components Used (tree)

```
QueryReport
├── ReusableTable (component, ../components/table) — efficiency data table
├── Dropdown, DropdownMenu, DropdownTrigger, DropdownItem (from @heroui/react) — date range, filters
├── Button (from @heroui/button) — download, various actions
├── CustomDateRangePicker (component, ../components/CustomDateRangePicker) — date selector
├── Format from date-fns — date formatting
├── Filter from @heroui/react — advanced filter panel with field/operator/value triads
├── Autocomplete, AutocompleteItem (from @heroui/react) — department filter, user filter
├── Select, SelectItem (from @heroui/select) — efficiency filter, operator select, field select
├── Add Filter button (inside DropdownMenu) — adds new filter triad to `filters` state
│   - Field: Autocomplete with target/goal/utilization/utilization options
│   - Operator: Autocomplete with numeric/text operators
│   - Value: Input for filter value
├── Tabs, Tab (from @heroui/react) — not directly used in rendering
├── FilterIcon (inline SVG) — filter SVG in dropdown
├── Add Filter button (standalone, line 782) — adds new filter to state
├── + Add Filter button (inside filter dropdown, line 782) — adds new filter triad
├── title from primitives — page title
├── addToast (from @heroui/react) — notifications
```

---

## Known Defects, Dead Code, TODOs

1. **Lines 526-528**: `CUTOFF_DATE = "2026-06-30"` — hardcoded date; same issue as in Goals page
2. **Lines 530-533**: `shouldCallEfficiency` condition: `Number(filterStatus) === 7 && Number(selectedUser) === 90 && isWithinCutoff` — very specific hardcoded conditions (dept 7, user 90, date before 2026-06-30)
3. **Lines 376-381**: Filters mapping to API payload — complex transformation from UI `filters` array to API `filters` format; any change in field names or operator values will break this mapping
4. **Lines 616**: Filter dropdown conditionally rendered: `user.userRole !== 2` — role 2 users can't access filters
5. **Line 708**: `user.departmentID ? null : (...)` — department autocomplete only shown when user has no department; inverted logic may confuse users
6. **`efficiencyFilter` state** (line 121): initialized to `""` — may cause issues when compared with numeric values
7. **Line 815**: `user.userRole !== 3 && (` — executive leaders (role 3) don't see the main efficiency table, only the EL tabs
8. **Complex `filters` state management**: Adding/removing filters via the user interface modifies `filters` array; if the API changes the filter format, all filter logic breaks
9. **Multiple `console.log` statements** left in the code (e.g., line 264: `console.log("departmentlist", formatted)`)
10. **Download button visibility** may have same issues as other pages (disabled when `loading || !!user?.departmentID`)

---

## Backend Migration Impact

**High risk** — this page makes direct API calls to:
- `/Department/list` — department filter
- `/users/read` — user filter
- `/list-efficiency-summary` — **CRITICAL**: Primary data source

**Key concerns:**
1. **`/list-efficiency-summary` response**: Same as in other pages — `summary` object with `AvgTargetPercent`, `AvgUtilizationPercent`, `AvgTotalWork`, `AvgGoalPercent`, `EfficiencyLevel` and `data` array. If backend changes these field names, the summary card and table data will display incorrectly.

2. **Advanced filter panel** (the unique feature of this page): The `filters` state manages an array of `{ field, operator, value }` objects. The mapping to API (lines 376-381) transforms UI filters to:
   ```js
   {
     field: f.field,  // e.g., "Target Achieved", "Goal Achieved", "Efficiency", "Utilization"
     operator: f.operator,  // "=", ">", "<", ">=", "<="
     value: f.value  // the filter value
   }
   ```
   If backend changes any of these field names, operator values, or expected value formats, the filters won't work.

3. **Hardcoded cutoff date** `2026-06-30` (lines 526-528): Same issue as in Goals page — when this date passes, the efficiency path won't trigger.

4. **Role-based access**: `adminOnly` guard on route, but also `user.userRole !== 2` check for filter dropdown (line 616), and `user.userRole !== 3` check for showing main table. If role IDs change, all these checks break.

5. **Department ID 7 and user ID 90** special path (lines 530-533): Very specific condition to call efficiency summary — if backend changes which users/depts should use this path, or the condition logic, it will misbehave.

6. **`isFilterOpen` state** management: Complex open/close state for the filter dropdown; if the API or UI changes, this state management may conflict.

7. **`selectedUser` special handling** (line 98-100): `isELORUSER ? String(user?.userID) : ""` — similar to other pages, hardcoded role checking.

---