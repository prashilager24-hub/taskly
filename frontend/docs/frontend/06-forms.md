# FormPage (src/pages/forms.tsx)

**Route:** `/department-forms`  
**Access:** All authenticated users  
**File:** `src/pages/forms.tsx` (369 lines)

---

## Purpose & User Flow
Department form page — allows users to submit daily tasks and activity updates for their department. Features:
- Department and user filtering
- Task list display per department/user
- Daily activity log component for form submission

User flow:
1. User lands on page — defaults to their own department (based on `user.departmentID`)
2. Department and user can be filtered via autocomplete selectors
3. When department+user are selected, `DailyActivityLog` component renders
4. User can submit tasks via the DailyActivityLog
5. Task list can be fetched and displayed

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/users/read?page=0&size=0` | `filter`, `searchText`, `departmentID`, `token` | User list: `userID`, `userName`, `roleID` | When `filterStatus` changes (or initially to set default user) |
| 2 | `POST` | `/t2.0/authentificationUtilization/Department/list?page=0&size=0` | `searchText`, `filter`, `startDate`, `endDate`, `roleID: user.userRole`, `userID: ...` | Department list: `departmentID`, `departmentName`, `departmentDescription`, `newStatus`, `departmentStatus` | On mount (once); also resets filterStatus to first department |
| 3 | `POST` | `/t2.0/authentificationUtilization/departmentTasks/getTasksByDepartment` | `departmentId`, `roleId` (varies by role) | Tasks result: `taskID`, `taskName`, `description`, `departmentID`, `standardTimeMins`, `frequency`, `isDynamic`, `isActive`, `modifiedAt` | When `filterStatus` and `selectedUserId` change |
| 4 | `POST` | `/t2.0/authentificationUtilization/departmentTasks/list?page=1&size=50` | `searchText`, `filter`, `startDate`, `endDate` | All tasks: `taskID`, `createdAt`, `taskName`, `description`, `departmentID`, `standardTimeMins`, `frequency`, `isDynamic`, `isActive`, `modifiedAt` | When `filterStatus` changes |

---

## Forms

| Form | Fields | Validation | Defaults | Submit Behavior |
|------|--------|------------|----------|-----------------|
| Department filtering | department (autocomplete), user (autocomplete) | — | Defaults to user's own department | Updates `filterStatus` and `selectedUserId`, triggers task fetch |
| DailyActivityLog (imported component) | Task name, time taken, remarks, etc. | — | — | Submits daily task log |

---

## Tables/Lists

| Table | Columns | Sorting | Filtering | Pagination | Export/Download |
|-------|---------|---------|-----------|------------|-----------------|
| Task list (from `departmentTasks/getTasksByDepartment`) | taskID, taskName, description, standardTimeMins, frequency, isActive | — | By department, by user | — | — |
| All tasks list (from `departmentTasks/list`) | taskID, createdAt, taskName, description, departmentID, standardTimeMins, frequency, isDynamic, isActive, modifiedAt | — | By department, user, search | — | — |

Task columns (from `getTasksByDepartment` response):
- Task ID
- Task Name
- Description
- Standard Time (mins)
- Frequency (Daily/Weekly/Monthly/Dynamic)
- Is Dynamic (Yes/No)
- Is Active

All tasks columns (from `departmentTasks/list`):
- Task ID
- Created At
- Task Name
- Description
- Department ID
- Standard Time (mins)
- Frequency
- Is Dynamic
- Is Active
- Modified At

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `sidebarOpen`, `selectedUserId`, `taskList`, `users`, `departmentList`, `filterStatus`, `departmentInput` |
| Derived | `getUserDepartments` function (lines 25-45) | Normalizes user departments — handles both `{ departmentID }` and `{ departments: [...] }` shapes |
| Effects | `useEffect` calls | Fetch users on mount (dependency: `[filterStatus]`); fetch departments on mount; fetch department tasks when `filterStatus` + `selectedUserId` change |

---

## Effects & Dependencies
- Line 64-82: `filterStatus` initializer — runs once; gets primary dept from user, or first dept from list
- Line 98-146: `fetchUsers` — dependency: `[filterStatus]` — fetches users for department filter
- Line 149-197: `fetchDepartments` — runs once on mount; handles multi-department users vs single dept users
- Line 199-222: `fetchDepartmentTask` — dependency: `[filterStatus, selectedUserId, users]` — fetches tasks by department/user
- Line 225-261: `fetchTasks` — dependency: `[filterStatus]` — fetches all tasks for the department

---

## UI Components Used (tree)

```
FormPage
├── EmptyContainer (component) — when no filters selected and no tasks
├── Autocomplete (from @heroui/react) — department filter, user filter
├── AutocompleteItem (from @heroui/react) — autocomplete options
├── DailyActivityLog (component, ../components/DailyActivityLog) — main form log component
├── Input (from @heroui/input) — department input (with search icon)
├── Button (from @heroui/button) — various actions
├── ReusableTable (component, ../components/table) — not directly used; task lists rendered differently
├── addToast (from @heroui/react) — notifications
├── Select, SelectItem (from @heroui/select) — department/user selectors in filtering
├── useMemo (from react) — getUserDepartments normalization
├── format from date-fns — date formatting (in task creation)
├── title from primitives — page title
```

---

## Known Defects, Dead Code, TODOs

1. **Lines 282-286**: `fetchDepartmentTask` body has `roleId: [1, 3, 4].includes(user.userRole) ? ... : user.userRole` — complex conditional role logic
2. **Line 204**: `departmentID: filterStatus ? Number(filterStatus) : 0` — if filterStatus is empty string, Number("") is 0, may send wrong dept ID
3. **Line 205**: `roleId` calculation is complex and may have edge cases
4. **Lines 98-146**: `fetchUsers` has `if (filterStatus !== null) return;` at top — means it only runs once when filterStatus is null, then never runs again
5. **Line 139-140**: `setSelectedUserId` logic: checks if current ID exists in mapped users, otherwise defaults to `mappedUsers.length ? mappedUsers[0].userID : user.userID` — may fail if user not in list
6. **Line 183**: `userID: (user.isHeExecutiveLeader) ? Number(user.userID) : Number(filterStatus)` — conditional based on executive leader status
7. **Line 196**: `if (departmentList.length > 0) { setFilterStatus(departmentList[0].key); ... }` — auto-selects first department, may surprise users
8. **`tasks` state** (line 89): `const [tasks, setTasks] = useState<Task[]>([])` — initialized as empty type-annotated array
9. **Commented-out `fetchDepartmentTask` effect** (lines 258-324 in the original exploration, but in this file lines 199-222 is the active one, earlier version had commented out second fetch)
10. **No clear submit action** for the daily activity log — the `DailyActivityLog` component handles its own submission, but there's no visible "Submit" button on this page
11. **Line 352-357**: `DailyActivityLog` rendered with `DeptId={filterStatus} selectedUserId={selectedUserId} selectedUserRole=...` — passes department/user info down

---

## Backend Migration Impact

**Medium risk** — this page makes API calls to:
- `/users/read` — user list for filters
- `/Department/list` — department list for filters
- `/departmentTasks/getTasksByDepartment` — tasks by department + role
- `/departmentTasks/list` — all tasks with pagination

**If Node.js backend changes:**
- **User response**: `userID`, `userName`, `roleID` field names — if changed, user filter breaks
- **Department response**: `departmentID`, `departmentName`, `newStatus`, `departmentStatus` — if changed, department filter breaks
- **Tasks response**: Field names like `taskID`, `taskName`, `description`, `standardTimeMins`, `frequency`, `isDynamic`, `isActive`, `modifiedAt` — if changed, task lists break
- **Role-based logic**: `[1, 3, 4].includes(user.userRole)` — if backend changes role IDs, the role-based task fetching will break
- **Default department ID `0`**: `Number(filterStatus) || 0` — if backend changes how departments are numbered, may fetch wrong tasks

**Additional concerns:**
- `getUserDepartments` normalization (lines 25-45): Handles both `{ departmentID }` and `{ departments: [...] }` user shapes. If backend changes one of these shapes, the normalization will produce incorrect results
- `filterStatus` default of `0` vs `""` — inconsistent behavior
- The page auto-selects the first department on mount (line 196) — may not be the user's expected department if backend changes department ordering