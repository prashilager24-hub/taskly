# Access Management Page (src/pages/access-management.tsx)

**Route:** `/access-management`  
**Access:** `adminOnly` guard (requires `user.userRole === 1`)  
**File:** `src/pages/access-management.tsx` (959 lines)

---

## Purpose & User Flow
Access management — admin users can manage all users in the system: view list, add new users, edit user details, toggle user status (active/inactive), delete users, and manage role permissions. Features:
- User list with filtering by role, status, department
- Add new user modal with full form
- Edit user modal (when selecting a row)
- Toggle user status confirmation
- Delete user confirmation
- Role access modal (configure permissions per module)
- Department list for filtering

User flow:
1. Admin views user list
2. Can filter by role, status, or department
3. Selects a user row → can edit, toggle status, or delete
4. "Add New User" button → opens form modal
5. Form has department, role, reporting manager, EL, appraisal cycle, feedback resolver team
6. "Role Access" button → opens permission configuration modal
7. Department/user filters update the user list

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/Department/list?page=0&size=0` | `searchText`, `filter`, `startDate`, `endDate`, `roleID: 1`, `userID: 1` | Department list: `departmentID`, `departmentName`, `description`, `newStatus` | On mount (once); also runs in `fetchDepartments` effect |
| 2 | `POST` | `/t2.0/authentificationUtilization/users/read?page=&size=` | `filter: statusFilter`, `searchText: searchValue`, `departmentID: null`, `roleID: Number(roleFilter)` | User list with full formatting: `userID`, `employeeID`, `userName`, `userEmail`, `departmentName`, `departmentID`, `roleID`, `role`, `secondaryRole`, `newStatus`, `isActive`, `userCreateTime`, `reportingManagerName`, `reportingManagerId`, `elManagerId`, `elManagerName`, `appraisalCycle`, `feedbackResolverTeam` | When `authUserLD`, `pageSize`, `pageNumber`, `searchValue`, `roleFilter`, or `statusFilter` changes |
| 3 | `POST` | `/t2.0/authentificationUtilization/users/read?page=0&size=0` | `filter: "Active"`, `searchText: searchValue`, `departmentID: null`, `roleID: Number(roleFilter)` | All users without pagination → stored in `usersAll` and `setAllUser` | On initial mount (once) |
| 4 | `POST` | `/t2.0/authentificationUtilization/usersArchive` | `userIdList: [deleteConfirm.id]` | Success toast | When "Delete User" confirmed |
| 5 | `POST` | `/t2.0/authentificationUtilization/updateUserStatus` | `userStatus: 1|0`, `userIdList: [user.userID]` | Success toast | When "Toggle Status" confirmed |
| 6 | `POST` | `/t2.0/authentificationUtilization/User/create` | Full user payload: `employeeID`, `userName`, `userEmail`, `password`, `departmentID`, `role`, `roleID`, `secondaryRoleID`, `reportingManagerId`, `elManagerId`, `appraisalCycle`, `feedbackresolverteam` | Success toast | When "Add User" submitted |
| 7 | `PUT` | `/t2.0/authentificationUtilization/User/update` | Full user payload (same as create) | Success toast | When "Update User" submitted |

---

## Forms

| Form | Fields | Validation | Defaults | Submit Behavior |
|------|--------|------------|----------|-----------------|
| Add/Edit User Modal | Employee ID (required), Full Name (required), Email (required, type=email), Password (conditionally required), Department (required, autocomplete), Role (required, select), Secondary Role (select), Reporting Manager (assessor 1, autocomplete), EL / Dept Head (assessor 2, autocomplete), Appraisal Cycle (select), Feedback Resolver Team (select) | All fields required except secondary role; password required for create only (commented out) | New user: employeeID:"", name:"", email:"", password:"", department:"", role:"User", secondaryRole:"", feedbackResolverTeam:"" | On submit: creates or updates user, refreshes list, resets form, reloads page |
| Role Access Modal | Permission configuration per module (tiers: basic/createOnly/advanced/root/custom) | — | — | On submit: saves role privileges via API |

---

## Form Field Details

**Password field** (lines 718-730): Commented out `!isEditMode && (...)` — password is only shown for new users, not edits.

**Department Autocomplete** (lines 731-756): 
- `isRequired={newUser.role !== "Root User"}` — Root User doesn't need department
- Special handling: `prev.role === "Root User" ? null : key ? String(key) : null` — sends null for Root User department

**Reporting Manager EL Autocomplete** (lines 757-789): 
- Pulls from `usersAll` (all users without pagination)
- `isRequired={newUser.role !== "Root User"}`

**EL / Dept Head Autocomplete** (lines 789-809): 
- Same source `usersAll`
- `isRequired={newUser.role !== "Root User"}`

**Appraisal Cycle** (lines 807-817): 
- Two options: "April Cycle (Apr–Mar)" and "October Cycle (Oct–Sep)"

**Role Select** (lines 818-834): 
- Options: Root User, EL, FL, User, Intern, Executive, Manager, Lead
- Maps to roleIDs: 1, 3, 4, 2, 5, 6, 7, 23 respectively

**Secondary Role Select** (lines 835-854): 
- Same options as Role, but optional

**Feedback Resolver Team** (lines 855-870): 
- Options: HR, L&D

---

## Tables/Lists

| Table | Columns | Sorting | Filtering | Pagination | Export/Download |
|-------|---------|---------|-----------|------------|-----------------|
| User list table | ID, Employee ID, Name, Email, Department, Reporting Manager, EL Manager, Appraisal Cycle, Role, Status | ✓ (via ReusableTable) | ✓ (roleID, newStatus filter options) | ✓ (rows per page) | — |

**userColumns** (lines 91-113):
- userID: ID (80px width)
- employeeID: Employee ID (120px width)
- userName: Name
- userEmail: Email
- departmentName: Department
- reportingManagerName: Reporting Manager
- elManagerName: EL Manager
- appraisalCycle: Appraisal Cycle
- role: Role (sortable)
- newStatus: Status (sortable)

**Filter options** (lines 634-659):
- Status: Active, Inactive, Archived, All
- roleID: 1=Root User, 3=EL, 4=FL, 2=User, 5=Intern, 6=Executive, 7=Manager, 23=Lead, 0=All

**Role map** (lines 250-259, 328-337): 
- `roleMap: Record<number, string>` mapping roleIDs to strings
- Used both for displaying role names and in form mappings

**User actions** (lines 115-153):
- Edit: opens form modal with user data pre-populated
- Delete: marks user for deletion confirmation

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `sidebarOpen`, `isEditMode`, `editUser`, `loading`, `isRoleModalOpen`, `toggleConfirm`, `deleteConfirm`, `statusFilter`, `newUser`, `appraisalForm`, `departmentList`, `users`, `usersAll`, `roleFilter`, `selectedRows` |
| Derived | `useMemo` | — |
| Effects | Multiple `useEffect` | Fetch departments on mount; fetch users when `authUserLD`, `pageSize`, `pageNumber`, `searchValue`, `roleFilter`, `statusFilter` change; initial fetch of all users; handle delete/toggle/status |

---

## Effects & Dependencies
- Line 190-225: `fetchDepartments` — runs once on mount (hardcoded `roleID: 1`, `userID: 1`)
- Line 227-303: `fetchUsers` — dependency: `[authUserLD, pageSize, pageNumber, searchValue, roleFilter, statusFilter]` — the main user list fetch; complex mapping of API response to User interface
- Line 305-373: Second `fetchUsers` — runs once on mount; fetches all users without pagination, stores in `usersAll` and `setAllUser`
- Line 410-489: `handleDeleteUser` — on confirm, archives user via API, then reloads page
- Line 441-489: `handleToggleUserStatus` — on confirm, updates user status via API, updates local state
- Line 491-553: `handleUpdateUser` — on submit, updates user via API, resets form, reloads page
- Line 574-603: `handleAddUser` — on submit, creates user via API, resets form, reloads page

---

## UI Components Used (tree)

```
AccessManagement
├── ReusableTable (component, ../components/table) — main user list table
├── Modal (from @heroui/react) — multiple: add user, edit user, delete confirm, toggle status, role access
├── ModalContent, ModalHeader, ModalBody, ModalFooter (from @heroui/react)
├── useDisclosure (from @heroui/react) — for modals
├── Input (from @heroui/input) — employee ID, name, email, password (commented), department
├── Button (from @heroui/button) — add user, role access, delete, toggle status, update, add role
├── Dropdown, DropdownMenu, DropdownTrigger, DropdownItem (from @heroui/react) — status filter, role filter
├── addToast (from @heroui/react) — notifications
├── Select, SelectItem (from @heroui/select) — role, secondary role, feedback resolver team
├── Autocomplete, AutocompleteItem (from @heroui/react) — department, reporting manager, EL, appraisal cycle
├── ReusableTable filterOptions — status and roleID filter arrays
├── RoleStaticData (from ../components/accessRole) — role definitions
├── TIER_META, TierCard, ActionBtn (from ../components/accessRole) — permission tier UI
├── MODULES, TIER_ACTIONS, existingRoles, PRESETS (from ../components/accessRole) — permission data
├── buildInitialPerms, getTierOf (from ../components/accessRole) — permission utilities
├── Format from date-fns — date formatting (userCreateTime)
├── title from primitives — page title
├── useDashboardStore (from ../store/commonStore) — setAllUser called in initial fetch
```

---

## Known Defects, Dead Code, TODOs

1. **Lines 89-90**: `newUser` initial state has `employeeID: ""` — type is string but should possibly be number
2. **Lines 250-259, 328-337**: `roleMap` has hardcoded roleID→name mapping: `1: "Root User"`, `3: "EL"`, `4: "FL"`, `2: "User"`, `5: "Intern"`, `6: "Executive"`, `7: "Manager"`, `23: "Lead"` — if backend changes role IDs, this mapping will be wrong
3. **Lines 382-384**: `isDisabled={loading || !!authUserLD?.userRole && authUserLD.userRole !== 1}` — Role Access button only visible to admin (role 1); if role name changes, this check fails
4. **Line 399**: `setNewUser({ employeeID: "", name: "", email: "", password: "", department: "", role: "User", secondaryRole: "", feedbackResolverTeam: "" })` — reset after add/edit; `password` field included but commented out in form rendering
5. **Lines 718-730**: Password field in form is **commented out** — `!isEditMode && (<Input ... />)` — password only shown for new users, but the comment suggests it was recently uncommented
6. **Lines 895-901**: Submit button disabled condition: `!newUser.name || !newUser.email || (newUser.role !== "Root User" && (!newUser.department || !appraisalForm.reportingManager || !appraisalForm.elManager))` — complex condition; if role name changes from "Root User", this may behave unexpectedly
7. **Line 899**: `!appraisalForm.elManager` — EL manager is required for non-Root users, but if `appraisalForm.elManager` is empty string, `String("")` is falsy, so condition works; but if backend changes format, may break
8. **Lines 939-940**: `handleToggleUserStatus` payload: `userStatus: newStatus === "Active" ? 1 : 0, userIdList: [user.userID]` — hardcoded 1/0 for status; if backend inverts this (0=Active, 1=Inactive), toggle will wrongly set status
9. **Line 945**: `handleDeleteUser` uses `window.location.reload()` after delete — hard page reload; could be replaced with state update
10. **Lines 150-152**: `userActions` delete action: `color: 'danger', label: 'Delete'` — but the actual delete confirmation modal is separate
11. **Multiple `console.log` statements** left in the code (e.g., lines 250, 258, 261 in department fetch, and various in user fetch)
12. **`roleFilter` state** initialized to `null` — may cause issues when first used in `roleID: Number(roleFilter)` — `Number(null)` is `0`, which may fetch all users or wrong role
13. **`statusFilter` state** initialized to `"Active"` — hardcoded default filter

---

## Backend Migration Impact

**High risk** — this page makes direct API calls to many endpoints and has complex role-based logic:

**CRITICAL endpoints:**
- `/users/read` — **Most used endpoint**: fetches user list with complex mapping (lines 261-291). The mapping handles both `{ departments: [...] }` and `{ departmentID }` user shapes, and maps many fields including `roleID`, `departmentName`, `employeeID`, `feedbackresolverteam`, etc. If backend changes any field names, this mapping breaks.
- `/users/create` and `/users/update` — **CRITICAL**: Full user creation/update. Payload includes `employeeID`, `userName`, `userEmail`, `password`, `departmentID`, `role`, `roleID`, `secondaryRoleID`, `reportingManagerId`, `elManagerId`, `appraisalCycle`, `feedbackresolverteam`. If backend changes any of these field names or types, create/update will fail.
- `/usersArchive` — Deletes users via `userIdList: [id]`. If backend changes endpoint or response, deletion fails.
- `/updateUserStatus` — Toggles status via `userStatus: 1|0, userIdList: [id]`. The `1|0` is hardcoded — if backend inverts meaning, toggle will set wrong status.

**Role-based logic concerns:**
1. **Hardcoded role IDs** throughout: `[1, 3, 4, 2, 5, 6, 7, 23]` mapped to role names. If backend changes role IDs, almost every check breaks:
   - `adminOnly` guard: `user.userRole === 1`
   - `salesOnly` guard: `user.departmentID === 21`
   - `HrOnly` guard: `user.departmentID === 22`
   - `TechOnly` guard: `user.departmentID === 24`
   - `adminOrTech` guard: `user.userRole === 1 || user.departmentID === 24`
   - Form role selects: options hardcoded to specific IDs
   - `roleMap` mappings
   - `isELORUSER` checks: `[2, 3, 4, 5, 6, 7, 23].includes(user?.userRole)`

2. **`roleFilter` initialization**: `useState(null)` → `Number(null)` = `0` in API payload — may fetch wrong role filter initially

3. **`statusFilter` initialization**: `useState("Active")` — hardcoded default; if backend changes status values, filter may show wrong data

4. **Department ID special cases**: 
   - `salesOnly` checks `user.departmentID === 21`
   - Access management has complex department handling
   - If backend changes department IDs or adds new departments, many UIs will misbehave

5. **Password handling**: Password field commented out in form but still included in payload when creating user (line 398: `password: newUser.password`). If backend changes password handling (e.g., doesn't accept password in API, uses temp links), this will fail.

6. **`appraisalForm`**: Fields `reportingManager`, `elManager`, `cycle` — if backend changes the field names or appraisal cycle naming, the form will break.

7. **`feedbackResolverTeam`**: Options "HR" and "L&D" — if backend changes these team names or adds new teams, the select options will be out of sync.

8. **`window.location.reload()`** after delete (line 177): Hard page reload; if backend changes auth state management, may cause issues on reload.

---