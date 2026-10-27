# EntryApproval Page (src/pages/EntryApproval.tsx)

**Route:** `/Entry-Approval`  
**Access:** All authenticated users  
**File:** `src/pages/EntryApproval.tsx` (1200 lines)

---

## Purpose & User Flow
Task/goal/target approval management. Users can:
- View combined approval list of tasks, targets, and goals pending approval
- Filter by department, user, entry type (Task/Target/Goal)
- Select multiple rows for batch actions
- Approve or reject selected entries
- View details in a drawer/update form

User flow:
1. Page loads with combined approval list
2. User can filter by department, user, entry type, date range
3. User selects one or more rows (table selection)
4. User clicks "Approve" or "Reject" 
5. If rejecting: enters comment, submits rejection
6. If approving: submits approval, list refreshes
7. Selected rows can be opened in a drawer for update

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/combined/list?page=0&size=0` | `userID`, `departmentID`, `startDate`, `endDate`, `entryType` | `data` array with `entries` array — each entry has `id`, `type`, `taskName`, `goalName`, `targetName`, `departmentName`, `departmentID`, `workDate`, `userName`, `remarks`, `status`, `approvedByEL`, `commentForRejection`, `leaveType`, `dailyTaskLogID`, `targetID`, `goalID`, `userGoalDataID`, `allocatedTime`, `timeTakenToWork`, `setUp`, `units`, `achievedUnits`, `totalUnitValues`, `isForTarget`, `isHalfDayLeave` | On mount (via `getCombinedApprovalList`), whenever `filterStatus`, `selectedUser`, `pageNumber`, `pageSize`, or `dateRange` changes |
| 2 | `POST` | `/t2.0/authentificationUtilization/combined/approve` | `departmentID`, `taskEntryIDs` (array), `goalEntryIDs` (array) | Success toast | When "Approve" button clicked (single submit) |
| 3 | `POST` | `/t2.0/authentificationUtilization/combined/reject` | `id`, `type`, `comment` | Success toast | When "Reject" button clicked |
| 4 | `POST` | `/t2.0/authentificationUtilization/Department/list?page=0&size=0` | `searchText`, `filter`, `startDate`, `endDate`, `roleID: user.userRole`, `userID: ...` | Department list: `departmentID`, `departmentName`, `description`, `status` | On mount (for filter departments) |
| 5 | `POST` | `/t2.0/authentificationUtilization/users/read?page=0&size=0` | `filter`, `searchText`, `departmentID`, `token` | User list: `userID`, `userName` | On mount (for filter users) |

---

## Forms

| Form | Fields | Validation | Defaults | Submit Behavior |
|------|--------|------------|----------|-----------------|
| Reject Entry Modal | rejection comment (Textarea, minRows=4) | Comment required for cancellation | Empty string | On submit: sends reject API call, refreshes list |
| Update Form (Drawer) | Passes `task` object to `UpdateForm` component | — | — | Submits updated task data |
| Filter Dropdown | department, user, entry type, date range | — | — | Updates filter state |

---

## Tables/Lists

| Table | Columns | Sorting | Filtering | Pagination | Export/Download |
|-------|---------|---------|-----------|------------|-----------------|
| Combined approval table | Date, User, Entry Type, TypeID, Task/Goal/Name, Allocated, Worked, Units, Status, Comment, Remarks, Actions | ✓ (via ReusableTable) | ✓ (department, user, entry type filters) | ✓ (rows per page) | — |

**Approval columns** (from `approvalColumns` array, lines 210-402):
- Date (workDate)
- User (userName)
- Entry Type (Goal/Target/Task — rendered based on goalID/targetID/taskID)
- TypeID (goalID || targetID || taskID || "-")
- Name (goalName || targetName || taskName || "-")
- Allocated (goalID → fixedGoal; else allocatedTime)
- Worked (goalID → achievedGoal; else timeTakenToWork)
- Units (goalID → achievedGoal; else achievedUnits)
- Status (chip: Pending/Approved/Rejected with color coding)
- Comment (item.commentForRejection)
- Remarks (item.remarks)
- Actions (— — edit button commented out)

**Table actions** (lines 115-153):
- Edit: opens selected item in drawer (but edit button code is commented out in the table rendering)
- Delete: marks row for deletion

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `sidebarOpen`, `isUpdateOpen`, `selectedUpdateItem`, `selectedDepartmentId`, `rejectModalOpen`, `rejectComment`, `departmentList`, `users`, `isFilterOpen`, `tableData`, `pageNumber`, `totalRecords`, `pageSize`, `searchValue`, `selectedRows`, `loading`, `dateRange`, `entryTypeFilter`, `userSearch` |
| Derived | `useMemo` | `filteredUsers` from `users` + `userSearch` |
| Effects | Multiple `useEffect` | Fetch departments on mount; fetch users when `filterStatus` changes; `getCombinedApprovalList` triggered on `[filterStatus, selectedUser, pageNumber, pageSize, dateRange, entryTypeFilter]` |

---

## Effects & Dependencies
- Line 404-450: `fetchDepartments` — runs once on mount
- Line 452-470: `fetchTasks` (for update) — dependency: `[selectedDepartmentId]` — fetches tasks by department
- Line 474-513: `fetchUsers` — dependency: `[filterStatus]` — fetches users for department filter
- Line 756-780: `getCombinedApprovalList` — dependency: `[filterStatus, selectedUser, pageNumber, pageSize, dateRange, entryTypeFilter]` — the main data fetch; fires on every dependency change
- Line 848-904: `handleToggleUserStatus` — on confirm, updates user status via API

---

## UI Components Used (tree)

```
EntryApproval
├── ReusableTable (component, ../components/table) — main approval table
├── Modal (from @heroui/react) — multiple: reject confirmation, update drawer
├── ModalContent, ModalHeader, ModalBody, ModalFooter (from @heroui/react)
├── useDisclosure (from @heroui/react) — for modals
├── Textarea (from @heroui/input) — rejection comment
├── Button (from @heroui/button) — approve, reject, cancel, add, filter
├── Dropdown, DropdownMenu, DropdownTrigger, DropdownItem (from @heroui/react) — date range, filter options
├── FunnelIcon (from @heroicons/react) — filter icon
├── Chip (from @heroui/react) — status chips in columns
├── Autocomplete (from @heroui/react) — department, user, entry type filters
├── AutocompleteItem (from @heroui/react) — autocomplete options
├── Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter (from @heroui/react) — update drawer
├── addToast (from @heroui/react) — notifications
├── UpdateForm (component, ../components/updateForm) — update form inside drawer
├── Select, SelectItem (from @heroui/select) — department, role, entry type selectors
├── TableColumn, TableAction (from ../components/table) — table config
├── Format from date-fns — date formatting
├── FunnelIcon, ArrowDownTrayIcon (from @heroicons/react/24/outline) — icons
```

---

## Known Defects, Dead Code, TODOs

1. **Lines 367-396**: `approvalColumns` has a **commented-out `renderCell` for actions** — the entire actions column rendering is commented out (lines 367-400)
2. **Line 117-118**: The `actions` column in `approvalColumns` has the `renderCell` completely commented out
3. **Lines 397-401**: The `userActions` table action definitions exist but the "Update" button in the footer only works for single-row selection and has complex logic
4. **Line 1059**: `getCombinedApprovalList` has a **massive commented-out block** (lines 547-603) that was attempting to "ENHANCE" data mapping — this was the original approach abandoned
5. **Lines 605-743**: The current `formattedData` mapping is the active code — it's complex and maps many fields from the API response
6. **Lines 851-862**: The approve button is **conditionally rendered**: `selectedRows.length > 0 && user.userRole !== 2` — role 2 (normal User) cannot approve
7. **Line 919**: The approve POST calls `/combined/approve` with `departmentID`, `taskEntryIDs`, `goalEntryIDs` — if backend changes the approval endpoint shape, this will break
8. **Line 1088-1104**: The reject POST calls `/combined/reject` with `id`, `type`, `comment` — if backend changes, this breaks
9. **Line 1091**: `departmentID` is conditionally included: `filterStatus ? Number(filterStatus) : null` — if filterStatus is empty string, may send `null` or `undefined`
10. **Line 1095**: `taskEntryIDs` filtered by `row.entryType === "Task" || row.entryType === "Target"` — only these types are included in task entries
11. **Line 1097**: `goalEntryIDs` filtered by `row.entryType === "Goal"` — only goals included
12. **Line 970-977**: Filter department Autocomplete only shows `ele.status === "Active"` departments — if backend changes status field, this breaks
13. **Line 986-1006**: Filter user Autocomplete has complex logic for finding user by key — may fail if user format changes
14. **Lines 1015-1029**: Filter entry type has hardcoded "Task"/"Target"/"Goal" options
15. **`pendingTasks` and `rejectedTasks` arrays** (lines 44-87) are **hardcoded sample data** — never used in actual API flow, dead code
16. **`getStatusChip` function** (lines 124-153) is defined but may not be used in the rendered table (the status renderCell in columns uses `getStatusChip` but the column chart may not call it correctly)
17. **Multiple `console.log` or `debugger` statements** left in the code

---

## Backend Migration Impact

**High risk** — this page makes direct API calls to:
- `/combined/list` — **CRITICAL**: Returns combined data of tasks, targets, and goals. The response shape is complex with many nested fields. If Node.js backend changes field names, nesting, or pagination shape, the `formattedData` mapping (lines 605-743) will break.
- `/combined/approve` — Approval endpoint. Payload includes `departmentID`, `taskEntryIDs`, `goalEntryIDs`. If backend changes these field names or the response, approval will fail.
- `/combined/reject` — Rejection endpoint. Payload includes `id`, `type`, `comment`. If backend changes, rejection will fail.
- `/Department/list` — For department filter. Response mapped to department list.
- `/users/read` — For user filter. Response mapped to user list.

**Critical concerns:**
1. **`formattedData` mapping (lines 605-743)**: This is the most complex mapping in the codebase — it flat-maps `resData.data` entries, then maps each `entry.entries` item with many conditional fields. If the backend changes even one field name (e.g., `dailyTaskLogID` → `dailyTaskLogId`, or `goalID` → `goalId`), this entire mapping needs updating.

2. **Role-based access**: 
   - `isELORUSER = [2, 3, 4, 5, 6, 7, 23].includes(user?.userRole)` — hardcoded role numbers
   - Approve button disabled for role 2 (normal User)
   - If backend changes role IDs, this will misbehave

3. **`departmentID` handling**: 
   - Conditionally included in approve payload
   - If `filterStatus` is empty string `""`, `Number("")` is `0` — may send wrong department

4. **Entry type logic**:
   - `isTask = !!item.taskID`, `isTarget = !!item.targetID`, `isGoal = !!item.goalID`
   - If backend changes these field names, the type detection will fail

5. **Date range**: 
   - `startDate`/`endDate` passed as `dateRange?.startDate || null`
   - If backend expects different date format, logs/approvals may fail

6. **Pagination**: 
   - `page=0&size=0` is used in some calls (fetch first page, get totalRecords from response)
   - If backend changes pagination (e.g., page starts at 1, or size default changes), this may return wrong data

---