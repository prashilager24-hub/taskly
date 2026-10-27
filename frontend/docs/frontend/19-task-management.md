# Task Management Page (src/pages/TaskManagement.tsx)

**Route:** `/task-management`  
**Access:** All authenticated users (Download button hidden for users with `departmentID`)  
**File:** `src/pages/TaskManagement.tsx` (731 lines)

---

## Purpose & User Flow
Task management — create, edit, activate/deactivate standard tasks assigned to departments. Features:
- Task list with search, filtering (frequency, status), sorting, pagination
- Add New Task modal with full form
- Edit Task via row action
- Activate/Deactivate single task with confirmation modal
- Download All button (disabled for users with departmentID)
- Bulk selection with activate/deactivate toolbar

User flow:
1. User lands on task list showing all tasks with pagination
2. Can search tasks by name/description, filter by frequency or active status
3. "Add New Task" → modal with task name, description, department, task type, standard time, frequency, dynamic flag, role
4. Edit action on row → pre-populates same modal
5. Select one or more rows → toolbar shows Activate/Deactivate buttons
6. Confirm modal before status toggle
7. Download All button available only for admin-level users (no departmentID)

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/Department/list?page=0&size=` | `searchText: ""`, `filter: ""`, `startDate: ""`, `endDate: ""`, `roleID: 1`, `userID: 1` | `response.departments[]`: `departmentID`, `departmentName`, `departmentDescription`, `newStatus` | On mount (once) |
| 2 | `POST` | `/departmentTasks/list?page=&size=` | `searchText: searchValue`, `filter: ""`, `startDate: ""`, `endDate: ""` | `response.tasks[]`: `taskID`, `taskName`, `description`, `departmentID`, `departmentName`, `standardTimeMins`, `frequency`, `isDynamic`, `isActive`, `createdAt`, `modifiedAt`, `timingType`, `roleID`; `response.totalRecords` | When `pageSize`, `pageNumber`, `searchValue` change |
| 3 | `POST` | `/departmentTasks/create` | `taskName`, `description`, `departmentID`, `standardTimeMins`, `frequency`, `isDynamic`, `timingType`, `roleID` | `data.data` (new task object) | When "Add Task" submitted |
| 4 | `PUT` | `/departmentTasks/update/{id}` | Same as create | `data.data` (updated task) | When "Update Task" submitted |
| 5 | `PUT` | `/departmentTasks/{taskID}/status?isActive={bool}` | `{}` (empty body; status via query param) | — | When Activate/Deactivate confirmed |

**Note:** Bearer token read from `localStorage.authUserLD` for create/update/toggle. Department list and task list calls send only `Content-Type` header (no auth token).

---

## Special Logic

| Logic | Description |
|-------|-------------|
| Department list hardcoded params (lines 240-241) | `roleID: 1, userID: 1` — always fetches as admin regardless of actual user |
| Task list null filter (line 285) | `.filter((t: any) => t != null)` — filters out null/undefined entries from API response |
| `createdAt.split("T")[0]` (line 288) | Extracts date portion from ISO timestamp |
| `timingType` → `type` mapping (line 298) | API field `timingType` mapped to frontend field `type` |
| Department select filters Active only (line 548) | `departmentList.filter(ele => ele.status === "Active")` |
| Task type hardcoded list (lines 562-599) | 37 task types: "Fixed", "Each Client", "Each Deal", "Each Query", ..., "Each Waterfall", "Each WF" |
| Role select hardcoded IDs (lines 663-670) | `1=Root User, 2=User, 3=EL, 4=FL, 5=Intern, 6=Executive, 7=Manager, 23=Lead` |
| Download button disabled (lines 374-378) | `isDisabled={loading \|\| !!authUserLD?.departmentID}` — only users without departmentID can download |
| Toggle status via query param (line 327) | `PUT /departmentTasks/{id}/status?isActive={bool}` — status passed as query string, not body |

---

## Forms

### Add/Edit Task Modal

| Field | Type | Validation | Default | Notes |
|-------|------|------------|---------|-------|
| Task Name | Input | — | `''` | Required for meaningful task |
| Description | Textarea | — | `''` | — |
| Department | Select | — | `''` | Only Active departments shown; uses separate `selectedDepartment` state |
| Task Type | Select | — | `''` | 37 hardcoded options (lines 562-599) |
| Standard Time (mins) | Input (text) | — | `30` | Sent as `Number(...)` in payload; stored as string in state |
| Frequency | Select | — | `'Daily'` | Options: Daily, Weekly, Monthly, Dynamic, Not Daily |
| Is Dynamic | Select | — | `false` | Yes/No (`'true'`/`'false'` string comparison) |
| Role | Select | — | `''` | Hardcoded role IDs: 1,2,3,4,5,6,7,23 |

**Submit behavior:** Calls `handleAddTask` (create) or `handleEditTask` (update); on success: toast, append/replace in `tasks` state, close modal, reset form. On failure: toast with `error?.response?.data?.message`, close modal.

**Form reset issue:** `setNewTask` reset (lines 100-108, 159-167) omits `type` field — will retain previous task type after reset.

---

## Tables/Lists

| Table | Columns | Sorting | Filtering | Pagination | Export/Download |
|-------|---------|---------|-----------|------------|-----------------|
| Task list (ReusableTable) | Created At (formatted `dd MMM yyyy`), Task Name, Department ID, Department Name, Standard Time (mins), Frequency, Dynamic, Status | ✓ (per-column `sortable: true`) | ✓ (Frequency: Daily/Weekly/Monthly/Dynamic/Not Daily; Status: Active/Inactive) | ✓ (`pageSize` default 10) | Download All button (disabled for dept users) |

**Table actions:**
- Edit → opens modal with row data pre-populated

**Filter options** (lines 481-502):
- `frequency`: Daily, Weekly, Monthly, Dynamic, Not Daily
- `isActive`: true (Active), false (Inactive)

**Bulk actions toolbar** (lines 407-457): Appears when `selectedRows.length > 0`; Activate and Deactivate buttons; each validates exactly 1 row selected.

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `sidebarOpen`, `loading`, `selectedDepartment`, `departmentList`, `SelectedTask` (note: capital S), `isEditing`, `selectedRows`, `confirmOpen`, `toggleStatusValue`, `tableRefreshKey`, `pageNumber`, `totalRecords`, `pageSize`, `searchValue`, `tasks`, `isModalOpen`, `newTask` |
| Auth | `localStorage.authUserLD` | Read inside component (line 180); `authUser` parsed but only `token` used |
| Effects | Two `useEffect` | Departments on mount; tasks when `authUserLD, pageSize, pageNumber, searchValue` change |

---

## Effects & Dependencies

- Lines 232-267: `fetchDepartments` — runs once on mount; **no auth token** in headers; hardcoded `roleID: 1, userID: 1`
- Lines 268-311: `fetchTasks` — dependency: `[authUserLD, pageSize, pageNumber, searchValue]`; **no auth token** in headers; null-filters response; maps `timingType` → `type`

---

## UI Components Used (tree)

```
TaskManagement
├── ReusableTable (component, ../components/table) — main task list
├── Modal, ModalContent, ModalHeader, ModalBody, ModalFooter (from @heroui/react) — add/edit + confirm modals
├── addToast (from @heroui/react) — notifications
├── Button (from @heroui/button) — Add New Task, Download All, Activate, Deactivate, Cancel, Submit
├── Input (from @heroui/input) — Task Name, Standard Time
├── Textarea (from @heroui/input) — Description
├── Select, SelectItem (from @heroui/select) — Department, Task Type, Frequency, Is Dynamic, Role
├── Sidebar, Topbar (imported but NOT rendered in JSX) — dead imports
├── title (from ../components/primitives) — page title
├── format (from date-fns) — `dd MMM yyyy` for Created At column
├── RollerCoaster (from lucide-react) — imported but NOT used — dead import
├── axios — API calls
```

---

## Known Defects, Dead Code, TODOs

1. **Line 14**: `RollerCoaster` imported from lucide-react but never used — dead import
2. **Lines 9-10**: `Sidebar` and `Topbar` imported but not rendered — dead imports
3. **Line 7**: Commented out `// import { addToast } from "@heroui/react"` — dead comment
4. **Line 36**: `SelectedTask` with capital S (unused after `setSelectedTask(row)` on edit) — inconsistent naming
5. **Lines 240-241**: Department fetch hardcodes `roleID: 1, userID: 1` — always queries as admin; if backend uses these for permission filtering, non-admin users get wrong department list
6. **Lines 244-248, 278-282**: Department and task list calls send **no Authorization header** — only create/update/toggle do (lines 76-79, 133-136, 320-324)
7. **Lines 100-108, 159-167**: Form reset after create/update omits `type` field — `newTask.type` retains previous value
8. **Line 617**: `standardTimeMins` stored as string in state (`e.target.value`) but typed as `number` in interface — sent as `Number(...)` in payload
9. **Lines 120, 168**: `handleEditTask(id)` parameter `id` is untyped (implicit `any`) — line 682 passes `newTask.taskId`
10. **Line 284**: `data.response.tasks` accessed without null check on `data.response` — will crash if response shape changes
11. **Line 288**: `t.createdAt.split("T")[0]` — will crash if `createdAt` is null/undefined
12. **Lines 374-378**: Download button uses double-negative logic: `className={... !authUserLD?.departmentID ? "" : "opacity-0..."}` AND `isDisabled={... !!authUserLD?.departmentID}` — visually hidden AND disabled for dept users
13. **Line 327**: Status toggle uses query parameter `?isActive=${newStatus}` — if backend switches to body param, toggle breaks
14. **Line 36**: `SelectedTask` state set but never read — dead state
15. **Lines 663-670**: Role select hardcodes IDs `[1,2,3,4,5,6,7,23]` — same pattern as access-management
16. **Lines 562-599**: 37 hardcoded task type options — if backend adds/removes types, UI won't reflect changes
17. **Multiple `console.log` statements** (lines 88, 145, 211, 258)
18. **Line 106**: Reset object includes `departmentID: ""` but uses `selectedDepartment` state for payload — departmentID in newTask is effectively unused for API calls

---

## Backend Migration Impact

**High risk** — task CRUD endpoints with unique conventions:

**API endpoints:**
- `/Department/list` — department dropdown; hardcoded `roleID: 1, userID: 1` and `size=` (empty, not 0)
- `/departmentTasks/list` — paginated task list; `searchText` only filter; response has `tasks[]` and `totalRecords`
- `/departmentTasks/create` — 8-field payload: `taskName`, `description`, `departmentID`, `standardTimeMins`, `frequency`, `isDynamic`, `timingType`, `roleID`
- `/departmentTasks/update/{id}` — same 8 fields; PUT method
- `/departmentTasks/{id}/status?isActive={bool}` — PUT with **empty body**; status via query parameter — unusual pattern

**Key concerns:**
1. **Query-param status update** (line 327): If Node.js backend expects body instead of query param, activate/deactivate breaks
2. **No auth on GET endpoints**: Department list and task list calls have no Bearer token — if backend adds auth middleware to these, they'll fail
3. **`timingType` field**: API returns `timingType` but frontend maps to `type` — if backend renames, the edit form won't pre-populate task type
4. **37 hardcoded task types**: UI-only list; if backend validates types and they diverge, create/update fails
5. **Hardcoded `roleID: 1, userID: 1`** in department fetch: If backend uses these for data scoping, non-admin users see wrong departments
6. **Role IDs `[1,2,3,4,5,6,7,23]`**: Same hardcoded mapping as access-management — breaks if backend renumbers roles
7. **`response.tasks` null-filter** (line 285): Frontend defends against null entries in array — if backend sends nulls differently (undefined vs null), filter may not catch them

---
