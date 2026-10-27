# DepartmentPage (src/pages/subdepartment.tsx)

**Route:** `/department`  
**Access:** `adminOnly` guard (requires `user.userRole === 1`)  
**File:** `src/pages/subdepartment.tsx` (902 lines)

---

## Purpose & User Flow
Department management page — allows admins to:
- View department list with search/filter
- Add new departments
- Edit existing departments
- Delete departments
- Toggle department status (activate/deactivate)
- Link primary departments

User flow:
1. Admin views department list
2. Clicks "Add Sub Department" → opens modal
3. Fills department name/description, selects executive/functional leaders from user list
4. Submits → creates department, refreshes list
5. Clicks edit on a department → opens edit modal
6. Updates fields → saves changes
7. Clicks delete → shows confirmation modal
8. Clicks toggle (activate/deactivate) → updates status

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/PrimaryDepartment/list` | `{}` | `primaryDepartmentId`, `primaryDepartmentName` | On mount (once) |
| 2 | `POST` | `/t2.0/authentificationUtilization/users/read?page=0&size=0` | `filter`, `searchText`, `departmentID: null`, `token` | User list: `userID`, `userName` | On mount (once) |
| 3 | `POST` | `/t2.0/authentificationUtilization/Department/list?page=0&size=0` | `searchText`, `filter`, `startDate`, `endDate`, `roleID: user.userRole`, `userID: ...` | Department list: `departmentID`, `departmentName`, `departmentDescription`, `newStatus`, `departmentStatus`, `executiveLeaderID`, `functionalLeaderID` | On mount, whenever `edit` state changes |
| 4 | `POST` | `/t2.0/authentificationUtilization/Department/create` | `departmentName`, `departmentDescription`, `executiveLeaderID` | Success toast | When "Add Department" submitted |
| 5 | `POST` | `/t2.0/authentificationUtilization/Department/update/${id}` | `departmentName`, `departmentDescription`, `functionalLeaderID`, `executiveLeaderID` | Success toast | When "Update Department" submitted |
| 6 | `POST` | `/t2.0/authentificationUtilization/Department/archive` | `departmentIDList: [id]` | Success toast | When "Delete Department" confirmed |
| 7 | `POST` | `/t2.0/authentificationUtilization/Department/status` | `departmentIDList: [id]`, `departmentStatus: newStatus` | Success toast | When "Toggle Status" submitted |

---

## Forms

| Form | Fields | Validation | Defaults | Submit Behavior |
|------|--------|------------|----------|-----------------|
| Add/Edit Department Modal | departmentName (required), departmentDescription, executiveLeader (from users list), functionalLeader (from users list) | Name required | Empty strings; leaders selected from user dropdown | On submit: creates or updates department, refreshes list |
| Link Primary Department Modal | Primary Department (from dropdown) | — | — | On submit: links primary dept to current dept |

---

## Tables/Lists

| Table | Columns | Sorting | Filtering | Pagination | Export/Download |
|-------|---------|---------|-----------|------------|-----------------|
| Department list | Name, ID, description, status, actions (edit/delete/toggle/link) | — | Search term (input field) | — | — |
| User list (for leaders) | User name, ID | — | Search term, department filter | — | — |

Department list columns (rendered UI):
- Department name (truncated to 2 lines)
- Department ID
- Status pill: green="Active", red="Inactive"
- Dropdown actions: Edit, Delete, Toggle (Activate/Deactivate), Link Primary Department

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` calls | `sidebarOpen`, `searchTerm`, `filterStatus`, `department`, `departmentDescription`, `users` (array), `executiveLeader`, `functionalLeader`, `departmentList`, `primaryDepartments`, `linkModal`, `selectedDepartmentId`, `edit`, `term`, `toggleConfirm`, `deleteConfirm`, `tasks` (commented out) |
| Derived | `useMemo` | `activePage` (from currentPage) |
| Effects | Multiple `useEffect` calls | Fetch primary depts on mount; fetch users on mount; fetch departments whenever `edit` changes; handle delete/toggle/logic |

---

## Effects & Dependencies
- Line 112-130: `fetchPrimaryDepartments` — runs once on mount
- Line 168-210: `fetchUsers` — runs once on mount
- Line 213-257: `fetchDepartments` — dependency: `[edit]` — runs whenever edit state changes
- Line 326-397: `handleAddDepartment` — on submit, creates dept + refreshes list
- Line 399-441: `handleEditDepartment` — on submit, updates dept
- Line 443-477: `handleDeleteDepartment` — on confirm, archives dept
- Line 479-517: `handleToggleDepartment` — on confirm, updates status

---

## UI Components Used (tree)

```
DepartmentPage
├── ConfirmDeleteModal (inline, lines 22-60) — delete confirmation
├── Modal (from @heroui/react) — multiple modals: add, edit, delete, toggle, link
├── ModalContent, ModalHeader, ModalBody, ModalFooter (from @heroui/react)
├── useDisclosure (from @heroui/react) — for link modal
├── Input (from @heroui/input) — department name, description
├── Select, SelectItem (from @heroui/select) — executive leader, functional leader
├── Autocomplete, AutocompleteItem (from @heroui/react) — user selectors
├── Button (from @heroui/button) — add, edit, delete, toggle actions
├── Dropdown, DropdownMenu, DropdownItem (from @heroui/react) — department actions dropdown
├── addToast (from @heroui/react) — success/error notifications
├── Sidebar (component, ../components/sidebar) — role-filtered sidebar
├── Topbar (component, ../components/topbar) — top navigation
├── EmptyContainer (component) — when no departments
├── Chip (from @heroui/react) — status pills
```

---

## Known Defects, Dead Code, TODOs

1. **Lines 258-285**: `fetchDepartmentTask` and related `fetchTasks` are **commented out** — dead code
2. **Lines 288-324**: Another `fetchTasks` block is **commented out** — dead code
3. **Line 74**: `tasks` state initialized as empty array `[]` with no type annotation
4. **Line 77-79**: `users` state initialized as `User[]` with `[...]` — TypeScript may infer incorrectly
5. **Line 97**: `tasks` state type `Task[]` initialized as `[]` — same issue
6. **Line 174**: `filterStatus` defaults to `user.departmentID` as string, but department list may be empty initially
7. **Line 223**: `bodyData.userID` uses `user.isHeExecutiveLeader ? Number(user.userID) : Number(filterStatus)` — conditional logic
8. **Line 83-84**: `toggleConfirm` and `deleteConfirm` initial states have `id?: number` and `name?: string` — may have type issues
9. **Line 277-281**: `handleLinkPrimaryDepartment` uses `JSON.parse(authUserLD).token` without null check (could throw if authUserLD is null)
10. **Line 199**: `console.log(formatted, "hello")` — debug line left in
11. **Line 201**: `console.log("Users formatted:", formatted)` — debug line left in
12. **Line 250**: `console.log("departmentlist", formatted)` — debug line left in
13. **The commented-out task fetch effects** (lines 258-324) suggest incomplete feature or WIP

---

## Backend Migration Impact

**High risk** — this page makes direct API calls to:
- `/PrimaryDepartment/list` — response mapped to `primaryDepartmentId`, `primaryDepartmentName`
- `/users/read` — response mapped to user list with `userID`, `userName`
- `/Department/list` — response mapped to department objects with `departmentID`, `departmentName`, `departmentDescription`, `newStatus`, `departmentStatus`, `executiveLeaderID`, `functionalLeaderID`
- `/Department/create`, `/Department/update`, `/Department/archive`, `/Department/status` — CRUD operations

**If Node.js backend changes:**
- Department response field names → the `dept` mapping (lines 238-246, 376-384) and all form mappings will break
- User response field names → the user list formatting (lines 191-197, 261-291) will break
- Status field names (`newStatus` vs `departmentStatus`) → toggle logic will break
- Primary department field names → link modal will break

**Additional concerns:**
- `authUserLD` parsing without null check in multiple places (lines 66, 137, 138, 336, 337, 411, 412) — if backend changes token format, could crash
- Role-based logic: `adminOnly` guard on route + `authUserLD?.userRole === 1` checks — if role naming changes, guards need updating
- `departmentStatus` field used in UI status pills — if backend changes this to boolean/inverted, UI display will be wrong