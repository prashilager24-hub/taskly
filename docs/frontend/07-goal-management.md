# GoalManagement Page (src/pages/goalManagement.tsx)

**Route:** `/Goal-management`  
**Access:** `adminOrTech` guard (requires `user.userRole === 1` OR `user.departmentID === 24`)  
**File:** `src/pages/goalManagement.tsx` (711 lines)

---

## Purpose & User Flow
Goal management page — allows admins/tech to manage department goals. Features:
- View goals list with filtering by department
- Add new goals
- Edit existing goals
- Toggle goal status (activate/deactivate)
- Filter by frequency and status
- Download all goals

User flow:
1. Admin/Tech views goals list for their department
2. Clicks "Add New Goal" → opens modal
3. Fills goal name, metric, metric value, unit, frequency, timing type, description
4. Submits → creates goal, refreshes list
5. Clicks edit on a goal → opens edit modal
6. Updates fields → saves changes
7. Clicks activate/deactivate → toggles goal status

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/Department/list?page=0&size=0` | `searchText`, `filter`, `startDate`, `endDate`, `roleID: 1`, `userID: 1` | Department list: `departmentID`, `departmentName`, `description`, `status` | On mount (once) |
| 2 | `POST` | `/t2.0/authentificationUtilization/departmentGoals/list?page=&size=` | `departmentId: 0`, `searchText`, `filter`, `startDate`, `endDate` | Goals list: `goalID`, `departmentID`, `goalName`, `goalMetric`, `metricValue`, `unit`, `frequency`, `isDynamic`, `isActive`, `liveAccounts`, `roleID` | When `pageNumber`, `pageSize`, or `searchValue` changes |
| 3 | `POST` | `/t2.0/authentificationUtilization/departmentGoals/create` | `departmentID`, `goalName`, `goalMetric`, `metricValue`, `unit`, `liveAccounts`, `frequency`, `timingType`, `isDynamic`, `description`, `roleID` | Success toast | When "Add Goal" submitted |
| 4 | `PUT` | `/t2.0/authentificationUtilization/departmentGoals/update/${goalID}` | Same as create payload | Success toast | When "Update Goal" submitted |
| 5 | `PUT` | `/t2.0/authentificationUtilization/departmentGoals/${row.goalID}/status?isActive=${newStatus}` | `{}` | Success toast | When "Activate/Deactivate" submitted |

---

## Forms

| Form | Fields | Validation | Defaults | Submit Behavior |
|------|--------|------------|----------|-----------------|
| Add/Edit Goal Modal | goalName (required), goalMetric (required), metricValue (required), unit (number, required), frequency (select), timingType (select — Ongoing/Fixed), liveAccounts (conditionally required when filterStatus===12), roleID (select), description (optional) | All fields required except description | goalId: -1 (new), frequency: "Monthly", timingType: "MonthEnd", isDynamic: false, isActive: true, roleID: "" | On submit: creates or updates goal, refreshes list, resets form |
| Toggle Status Confirmation | — | — | — | On submit: updates goal status via API |

---

## Tables/Lists

| Table | Columns | Sorting | Filtering | Pagination | Export/Download |
|-------|---------|---------|-----------|------------|-----------------|
| Goals table | Department ID, Goal Name, Metric, Unit, Frequency, Dynamic, Status | ✓ (via ReusableTable) | ✓ (department filter, frequency options, status options) | ✓ (rows per page) | ✓ (Download All button, visible only when no department filter or userID===1 or dept===16) |

**Goal columns** (from `goalColumns`, lines 187-195):
- Department ID
- Goal Name
- Metric
- Unit
- Frequency
- Dynamic
- Status

**Filter options** (from `filterOptions`, lines 478-499):
- Frequency: Daily, Weekly, Monthly, Dynamic, Not Daily
- Status: Active, Inactive

**Table actions** (from `taskActions`, lines 200-228):
- Edit: opens goal in modal for editing
- Activate/Deactivate: toggles goal status (requires exactly one row selected)

**Download button** (lines 381-387): 
- Visible only when `!authUserLD?.departmentID` (no dept filter) OR `authUserLD?.userID === 1` OR user's departments include deptID 16
- Disabled when `loading || !!authUserLD?.departmentID`
- Downloads all goals

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `sidebarOpen`, `selectedDepartment`, `departmentList`, `SelectedTask`, `loading`, `isEditing`, `selectedRows`, `confirmOpen`, `toggleStatusValue`, `tableRefreshKey`, `pageNumber`, `totalRecords`, `pageSize`, `searchValue`, `goals`, `isModalOpen`, `newGoal` |
| Derived | `useMemo` | — |
| Effects | Multiple `useEffect` | Fetch departments on mount; fetch goals when `pageNumber`, `pageSize`, `searchValue`, or `tableRefreshKey` change; handle toggle status; handle edit/add |

---

## Effects & Dependencies
- Line 230-269: `fetchDepartments` — runs once on mount (hardcoded `roleID: 1`, `userID: 1`)
- Line 272-316: `fetchGoals` — dependency: `[pageNumber, pageSize, searchValue, tableRefreshKey]` — fetches goals with pagination and search
- Line 318-362: `handleToggleStatus` — on confirm, updates goal status via API, refreshes goals list
- Line 88-96: `resetGoalForm` — resets form state and filterStatus

---

## UI Components Used (tree)

```
GoalManagement
├── ReusableTable (component, ../components/table) — goals table with filtering, pagination, selectable
├── Modal (from @heroui/react) — add/edit goal modal, status confirmation modal
├── ModalContent, ModalHeader, ModalBody, ModalFooter (from @heroui/react)
├── useDisclosure (from @heroui/react) — for modals
├── Input (from @heroui/input) — goal name, metric value, unit, live accounts (conditionally)
├── Select, SelectItem (from @heroui/select) — frequency, role, timing type (conditional), is dynamic
├── Button (from @heroui/button) — add goal, activate, deactivate, cancel, download
├── Tabs, Tab (from @heroui/react) — not actually used in this component despite imports
├── addToast (from @heroui/react) — notifications
├── Textarea (from @heroui/input) — description (commented out, not rendered)
├── ReusableTable filterOptions — frequency and status filter arrays
├── useMemo, useCallback (from react) — state management
├── format from date-fns — date formatting (in download payload)
├── title from primitives — page title
├── Goal (interface, lines 14-28) — goal shape definition
```

---

## Known Defects, Dead Code, TODOs

1. **Lines 608-617**: `Live Accounts` input is conditionally rendered only when `filterStatus == 12` — hardcoded department ID check
2. **Lines 621-631**: `Role` select has hardcoded role IDs: `1`=Root User, `2`=User, `3`=EL, `4`=FL, `5`=Intern, `6`=Executive, `7`=Manager, `23`=Lead — if backend changes role IDs, this breaks
3. **Lines 633-643**: `Timing Type` select has only 2 options (Ongoing, Fixed) — commented out 3rd option section
4. **Lines 645-652**: `Is Dynamic` select has true/false options — commented out section
5. **Lines 645-681**: `Description` Textarea is **commented out** — not rendered in the form
6. **Line 76**: `newGoal` initial state has `goalId: -1` — magic number used as sentinel for "new" goal
7. **Line 85**: `resetGoalForm` also resets `filterStatus` to "" — may cause unexpected department filter reset
8. **Line 238**: `fetchDepartments` uses hardcoded `roleID: 1`, `userID: 1` — always fetches depts for root user, may not be correct for all logged-in users
9. **Line 288**: `body.departmentId: 0` in fetchGoals — always fetches goals for dept 0, may need to be `filterStatus`
10. **Lines 492-501**: Commented out `efficiencyLevel` calculation at bottom of file — same efficiency logic as in dashboard/efficiency pages
11. **Multiple `console.log` statements** in the code (e.g., line 293: `console.log("departmentlist", formatted)`)
12. **Download button visibility logic** (lines 381-387): Complex condition `!authUserLD?.departmentID || authUserLD?.userID === 1 || (user?.departments ?? []).some((d) => Number(d?.departmentID) === 16)` — hardcoded department ID 16
13. **`isEditing` state** management: When editing, form fields are populated from `newGoal` which is also used for adding — potential for state corruption

---

## Backend Migration Impact

**High risk** — this page makes direct API calls to:
- `/Department/list` — for department filter
- `/departmentGoals/list` — **CRITICAL**: Goals list with pagination, search, and filtering
- `/departmentGoals/create` — Goal creation
- `/departmentGoals/update/${goalID}` — Goal update
- `/departmentGoals/${goalID}/status` — Goal status toggle

**If Node.js backend changes:**
- **Goals response**: The `departmentGoals/list` response shape includes `response.goals` array with fields: `goalID`, `departmentID`, `goalName`, `goalMetric`, `metricValue`, `unit`, `frequency`, `isDynamic`, `timingType`, `isActive`, `liveAccounts`, `roleID`. If any field names change, the mapping (lines 294-309) will break.
- **Live Accounts**: Conditionally required only when `filterStatus === 12` — if backend changes which department triggers this, or the field name `liveAccounts`, the form validation will break.
- **Role IDs**: Hardcoded in the Role select (lines 598-606): `1`=Root User, `2`=User, etc. If backend changes role IDs, the form will show wrong roles.
- **Frequency options**: Hardcoded (Daily, Weekly, Monthly, Quarterly, Dynamic, Not Daily) — if backend changes frequency values, the form will have wrong options.
- **Timing Type**: Currently only Ongoing/Fixed shown — if backend adds more timing types, UI won't reflect them (commented out section exists).
- **Status toggle**: `/departmentGoals/${row.goalID}/status?isActive=${newStatus}` — if backend changes the status endpoint format, toggle will fail.
- **Download logic**: The condition checking `userID === 1` or `departmentID === 16` is hardcoded — if backend changes which users/get access to "Report" feature, this needs updating.

**Additional concerns:**
- `fetchDepartments` hardcodes `roleID: 1`, `userID: 1` — always fetches for root user, may not reflect the logged-in user's departments
- `body.departmentId: 0` in fetchGoals — always fetches for dept 0; should probably use `filterStatus`
- The `filterStatus` state defaults to `""` and is set from department list on mount — if department list is empty, no filter applied
- Role-based access: `adminOrTech` guard on route, but internal logic also checks `isEditing`, `toggleStatusValue`, etc. — consistency needed if roles change