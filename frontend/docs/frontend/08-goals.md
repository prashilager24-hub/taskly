# Goals Report Page (src/pages/goals.tsx)

**Route:** `/goals`  
**Access:** All authenticated users  
**File:** `src/pages/goals.tsx` (899 lines)

---

## Purpose & User Flow
Goals report page — tracks goal progress and performance over time. Features:
- Date range picker (7/30 days or custom)
- Department and user filtering
- Summary card showing average goal achieved %
- ReusableTable displaying goal data with various columns
- EL (Executive Leader) filter for role 4 users
- Department filtering for role 4 users

User flow:
1. User lands on page with default 7-day range
2. User can filter by department (shows for all roles) and user (filtered by role)
3. User can select "Target" or "Task" filter
4. Summary card shows average goal achieved percentage
5. Table displays goal data with work dates, user names, goals, achieved values
6. User can change date range, filters, or switch between target/task views

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/Department/list?page=0&size=` | `searchText`, `filter`, `startDate`, `endDate`, `roleID: 3`, `userID: ...` | Department list: `departmentID`, `departmentName`, `status`, `executiveLeaderID`, `functionalLeaderID` | When `elFilter` changes |
| 2 | `POST` | `/t2.0/authentificationUtilization/users/read?page=0&size=0` | `filter`, `searchText`, `departmentID`, `...(filterStatus ? {} : null)` | User list: `userID`, `userName`, `roleID` | When `filterStatus` changes |
| 3 | `POST` | `/t2.0/authentificationUtilization/userGoalData/list?page=&size=` | `departmentID`, `userID`, `startDate`, `endDate`, `goalStartDate`, `goalEndDate`, `roleID`, `eLID`, `isHeExecutiveLeader`, `searchText` | `userGoalDataList`: `userGoalDataID`, `workDate`, `userID`, `userName`, `departmentID`, `goalID`, `goalName`, `fixedGoal`, `achievedGoal`, `goalEfficiencyPercent`, `recalculatedTarget` | When `filterStatus`, `dateRange`, `selectedUser`, `pageNumber`, `pageSize`, or `elFilter` changes |
| 4 | Conditional `POST` | `/t2.0/authentificationUtilization/list-efficiency-summary` | `departmentID`, `startDate`, `endDate`, `userID`, `groupBy: "day"`, `isHeExecutiveLeader`, `efficiencyLevel` | `summary.AvgTargetPercent`, `data` array | When `Number(filterStatus) === 7 && Number(selectedUser) === 90 && isWithinCutoff` (date <= 2026-06-30) |

---

## Special Logic

| Logic | Description |
|-------|-------------|
| `showRecalculatedTarget` (line 101) | `Number(user?.departmentID) === 21` — shows fixedGoal differently for department 21 |
| `shouldCallEfficiency` (lines 530-533) | Calls efficiency summary ONLY when: dept===7 AND user===90 AND date within cutoff (2026-06-30) |
| Two data fetching paths: | 1) If condition above met → use efficiency summary API<br>2) Otherwise → use userGoalData API |
| `isWithinCutoff` (lines 526-528) | `dateRange.startDate <= "2026-06-30" && dateRange.endDate <= "2026-06-30"` — hardcoded cutoff date |
| `averageGoalAchieved` (line 644) | From `res.data.response.avgPercent` when using userGoalData API |

---

## Forms
- None — pure display/filter page with table and summary card

---

## Tables/Lists

| Table | Columns | Sorting | Filtering | Pagination | Export/Download |
|-------|---------|---------|-----------|------------|-----------------|
| Goals report table | userGoalDataID, User ID (conditional), Work Date, User Name, Goal Name, Fixed Goal, Achieved, Comments | ✓ (via ReusableTable) | ✓ (department filter, user filter, EL filter, entry type filter) | ✓ (rows per page) | — |

**reportColumns** (lines 124-240):
- userGoalDataID (always shown but labeled "userGoalDataID")
- User ID: shown only when `Number(filterStatus) !== 7` (conditional)
- Work Date: rendered with `format(new Date(item.workDate), "dd MMM yyyy")`
- User Name
- Goal Name
- Fixed Goal: **special logic** — if `departmentID === 21` show `fixedGoal`, if `departmentID === 37` show `fixedGoal` (same), otherwise just `fixedGoal`
- Achieved: shown as number or "0" (text-red-500) if 0
- Comments: shown or "—"

**Special column logic:**
- Fixed Goal cell renderer (lines 159-182): Different handling based on `item.departmentID` (21 or 37)
- Achieved cell renderer (lines 186-197): Shows "0" in red if achievedGoal is 0

**Filter options** (various DropdownItems in the filter dropdown):
- EL selector (for role 4 users): shows users where `user.userID === user.reportingManagerID` or `u.roleID === 3`
- Department filter: shows departments with role-based filtering
- Entry type: ALL/TARGET/TASK (commented out in the read, but UI has filter)
- User filter: shows all users or filtered by EL role

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `isTarget`, `taskIDFilter`, `averageGoalAchieved`, `reportData`, `pageNumber`, `pageSize`, `totalRecords`, `loading`, `departmentList`, `users`, `ELList`, `elFilter`, `isFilterOpen`, `searchValue`, `dateSelect`, `dateRange`, `showRecalculatedTarget` |
| Derived | `useMemo` | `filteredUsers` from `users` + `userSearch` |
| Effects | Multiple `useEffect` | Fetch departments when `elFilter` changes; fetch users when `filterStatus` changes; fetch data when `filterStatus`, `dateRange`, `selectedUser`, `pageNumber`, `pageSize`, or `elFilter` changes; hardcoded `CUTOFF_DATE` logic |

---

## Effects & Dependencies
- Line 246-287: `fetchDepartments` — dependency: `[elFilter]` — fetches departments with roleID 3 and userID based on elFilter
- Line 289-328: `fetchUsers` — dependency: `[filterStatus]` — fetches users; conditional: if filterStatus set → setUsers, else → setELList
- Line 408-657: `fetchData` — **main data fetch**; dependency: `[filterStatus, dateRange, selectedUser, pageNumber, pageSize, elFilter]` — complex logic with two API paths (efficiency summary vs userGoalData)
- Line 655: `fetchData()` called on every dependency change

---

## UI Components Used (tree)

```
GoalsReport
├── ReusableTable (component, ../components/table) — main goal data table
├── Dropdown, DropdownMenu, DropdownTrigger, DropdownItem (from @heroui/react) — date range, filters
├── Button (from @heroui/button) — various actions, filter dropdown trigger
├── DateRangePicker (from @heroui/react) — date range selector
├── CustomDateRangePicker (component, ../components/CustomDateRangePicker) — date picker with presets
├── FilterIcon (inline SVG) — filter icon in dropdown
├── Tabs, Tab (from @heroui/react) — not directly used in rendering but imported
├── Add Filter dropdown item (conditional, lines 750-802) — sub-department filter
├── Autocomplete, AutocompleteItem (from @heroui/react) — EL select, department filter, user filter, sub-department filter
├── Format from @internationalized/date and date-fns — date formatting
├── Filter from @heroui/react — various filter autocompletes
├── Select, SelectItem (from @heroui/select) — department, user, EL filters
├── today, getLocalTimeZone from @internationalized/date — timezone handling
├── addToast (from @heroui/react) — notifications
├── title from primitives — page title
```

---

## Known Defects, Dead Code, TODOs

1. **Line 101**: `showRecalculatedTarget = Number(user?.departmentID) === 21` — hardcoded department ID 21 check
2. **Lines 526-528**: `CUTOFF_DATE = "2026-06-30"` — hardcoded date; if current date passes this, efficiency path won't be used
3. **Lines 530-533**: `shouldCallEfficiency` condition: `Number(filterStatus) === 7 && Number(selectedUser) === 90 && isWithinCutoff` — very specific hardcoded conditions (dept 7, user 90)
4. **Lines 330-373**: Commented-out `fetchGoals` effect — dead code with alternative API calling approach
5. **Lines 380-406**: Commented-out alternative fetch that calls BOTH efficiency AND userGoalData APIs in parallel, then merges data
6. **Lines 520-525**: `efficiencyData` mapping creates `achievedGoal: 100` and `goalEfficiencyPercent: (achievedGoal / fixedGoal) * 100` — frontend calculation that may disagree with backend
7. **Lines 613-615**: `setaverageGoalAchieved(res.data.response.avgPercent)` — gets avg percent from userGoalData response, but if using efficiency path, uses `summary.AvgTargetPercent`
8. **`filterStatus` default** (line 76-78): `user?.departmentID ? String(user.departmentID) : ""` — conditional based on user having department
9. **`selectedUser` default** (lines 80-82): `user?.userID ? user.userID == 1 ? null : String(user.userID) : ""` — special case for userID 1
10. **`elFilter` default** (lines 84-86): `user?.isHeExecutiveLeader ? Number(user.userID) : 0` — if executive leader, use own userID; else 0
11. **Complex conditional rendering** throughout: `user.userRole !== 2 && user.userRole !== 5 && user.userRole !== 6 && user.userRole !== 7 && user.userRole !== 23` — excludes certain roles from showing filter dropdown
12. **Department filter logic** (lines 780-799): Complex role-based filtering of departments — if `user.userRole === 4` (FL), only shows depts where `ele.functionalLeaderID == user.userID`; otherwise shows active depts
13. **`showRecalculatedTarget`** affects the `fixedGoal` render cell (line 160): Only for dept 21 and 37 — other departments just show `fixedGoal` without the conditional
14. **Multiple `console.log` statements** left in the code
15. **`recalculatedTarget` field** from API response used in some paths but not others — inconsistent data usage

---

## Backend Migration Impact

**High risk** — this page makes direct API calls to:
- `/Department/list` — for department filter (with roleID 3 hardcoded)
- `/users/read` — for user list (conditional based on filterStatus)
- `/userGoalData/list` — **CRITICAL**: Primary data source for goal progress

**Two API paths exist:**

**Path 1 (Efficiency Summary)** — only when `Number(filterStatus) === 7 && Number(selectedUser) === 90 && isWithinCutoff`:
- Endpoint: `/t2.0/authentificationUtilization/list-efficiency-summary`
- Payload: `departmentID`, `startDate`, `endDate`, `userID`, `groupBy: "day"`, `isHeExecutiveLeader`, `efficiencyLevel`
- Response used: `effRes.data.data` mapped to `formatted` with fields: `userGoalDataID`, `workDate`, `userID`, `userName`, `departmentID`, `goalID: 0`, `goalName: "TAT"`, `fixedGoal: 100`, `achievedGoal: achievedGoal`, `goalEfficiencyPercent: (achievedGoal / fixedGoal) * 100`, `recalculatedTarget: null`
- `averageGoalAchieved` = `summary.AvgTargetPercent`
- **Risk**: This is a very specific path (dept 7, user 90, date before 2026-06-30). If Node.js changes this endpoint or the response shape, this path breaks.

**Path 2 (User Goal Data)** — default path:
- Endpoint: `/t2.0/authentificationUtilization/userGoalData/list?page=&size=`
- Payload includes: `departmentID`, `userID`, `startDate`, `endDate`, `goalStartDate`, `goalEndDate`, `roleID`, `eLID`, `isHeExecutiveLeader`, `searchText`
- Response used: `res.data.response.userGoalDataList` mapped with many fields including `comment: item.comment || ""`
- `averageGoalAchieved` = `res.data.response.avgPercent`
- **Risk**: The response shape is complex with many conditional fields. If backend changes field names (e.g., `goalEfficiencyPercent` → `goalEfficiencyPercent`, `recalculatedTarget` structure, `fixedGoal` handling), the mapping (lines 626-640) will break.

**Critical concerns:**
1. **`userGoalData/list` response mapping** (lines 626-640): Maps many fields from the API response including `userGoalDataID`, `workDate`, `userID`, `userName`, `departmentID`, `goalID`, `goalName`, `fixedGoal`, `achievedGoal`, `goalEfficiencyPercent`, `recalculatedTarget`, `comment`. This is the most critical mapping — any field rename breaks the table.

2. **Department ID 21 special handling** (line 101, 160-166): `showRecalculatedTarget` and the fixedGoal render cell both check `item.departmentID === 21`. If backend changes department IDs or the way department 21 is identified, this special handling will misbehave.

3. **Hardcoded cutoff date** `2026-06-30` (lines 526-528): This is a future date relative to the current date (2026). When this date passes, the efficiency summary path will never be used, and the userGoalData path will always be used instead. This needs to be updated to a rolling date or removed.

4. **Role-based filtering** throughout: `isELORUSER`, department filtering by role, user filtering by role — all use hardcoded role numbers `[2, 3, 4, 5, 6, 7, 23]` and conditional logic. If backend changes role IDs, all this filtering will break incorrectly.

5. **`selectedUser` special case for userID 1** (line 81-82): `user.userID == 1 ? null : String(user.userID)` — user 1 gets null selectedUser, which changes behavior. If backend changes user 1's ID or the special-casing logic, this breaks.

6. **`elFilter` logic** (lines 84-86, 254-258): `user?.isHeExecutiveLeader ? Number(user.userID) : 0` — if executive leader, filter by own ID; else 0. If backend changes `isHeExecutiveLeader` flag or its meaning, this breaks.

---