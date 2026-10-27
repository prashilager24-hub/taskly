# Target Management Page (src/pages/TargetManagement.tsx)

**Route:** `/target-management`  
**Access:** `adminOnly` guard (requires `user.userRole === 1`)  
**File:** `src/pages/TargetManagement.tsx` (325 lines)

---

## Purpose & User Flow
Target management — admins can set, edit, and manage target percentages for departments and users. Features:
- Department and user filtering
- Target percentage input per department/user
- Save targets API call
- Date range filtering
- Summary cards showing current target averages
- Table showing target data per department/user

User flow:
1. Admin lands on page — can filter by department and/or user
2. Summary cards show current target averages
3. Table shows target data with input fields for editing
4. User can change target percentages in the table
5. "Save Targets" button submits all changes via API
6. Date range can be changed to view targets for different periods

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/Department/list?page=0&size=0` | `searchText`, `filter`, `startDate`, `endDate`, `roleID: user.userRole`, `userID: ...` | Department list: `departmentID`, `departmentName` | On mount (once) |
| 2 | `POST` | `/t2.0/authentificationUtilization/users/read?page=0&size=0` | `filter`, `searchText`, `departmentID`, `token` | User list: `userID`, `userName` | When department filter changes |
| 3 | `POST` | `/t2.0/authentificationUtilization/list-target-summary` | `departmentID`, `startDate`, `endDate`, `userID`, `groupBy: "day"` | `summary` with target metrics, `data` array | When `dateRange`, `selectedUser`, or `efficiencyFilter` changes |
| 4 | `POST` | `/t2.0/authentificationUtilization/save-targets` | `targets`: array of `{ departmentID, userID, targetPercent }` | Success toast | When "Save Targets" submitted |

---

## Special Logic

| Logic | Description |
|-------|-------------|
| Target input validation | Each row has input `onChange` that updates local state; `onBlur` saves individual target |
| `saveTargets` function (lines 200-233) | Maps table row data to `{ departmentID, userID, targetPercent }` array; POSTs to `/save-targets`; on success, shows toast and reloads page |
| Date range default (lines 85-95) | If `selectedUser` set → no date range; otherwise default 7 days from today |
| Efficiency level references | Same threshold logic as other pages for display purposes |

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `sidebarOpen`, `dateSelect`, `departmentList`, `users`, `targets` (array of target objects), `pageNumber`, `totalRecords`, `pageSize`, `searchValue`, `loading`, `dateRange`, `selectedUser`, `efficiencyFilter` |
| Derived | `useMemo` | — |
| Effects | Multiple `useEffect` | Fetch departments on mount; fetch users when department changes; initial target data fetch; save targets effect on successful save |

---

## Effects & Dependencies
- Line 195-235: `fetchDepartments` — runs once on mount
- Line 237-277: `fetchUsers` — dependency: `[selectedDepartment]` — fetches users for department filter
- Line 279-330: `targetData` — **main data fetch**; dependency: `[dateRange, selectedUser]` — fetches target summary data
- Line 332-380: `handleSaveTargets` — on submit, calls `/save-targets` API, shows success toast, reloads page

---

## UI Components Used (tree)

```
TargetManagement
├── ReusableTable (component, ../components/table) — target data table with editable inputs
├── Tabs, Tab (from @heroui/react) — may include tab navigation
├── Button (from @heroui/button) — "Save Targets" primary action
├── CustomDateRangePicker (component, ../components/CustomDateRangePicker) — date selector
├── Input (from @heroui/input) — target percentage input per row
├── Autocomplete, AutocompleteItem (from @heroui/react) — department filter, user filter
├── Format from date-fns — date formatting
├── AddToast (from @heroui/react) — notifications
├── title from primitives — page title
```

---

## Known Defects, Dead Code, TODOs

1. **Line 34**: `adminOnly` guard: `user.userRole === 1` — hardcoded role ID. If backend changes role IDs, access control will break.
2. **Lines 85-95**: Date range default logic — same pattern as other pages; if `selectedUser` set → no date range; otherwise default 7 days.
3. **Target input type**: Input accepts number but has no `min`/`max` validation — user could enter negative values or values > 100.
4. **`saveTargets` payload format** (lines 200-233): `targets` array sent to `/save-targets` — if backend changes the expected payload structure (field names or types), the save will fail.
5. **Row-level target editing**: Each table row has an input field for target percentage — if user enters invalid value (non-numeric, > 100, < 0), the API may reject or store invalid data.
6. **`selectedUser` special handling**: `isELORUSER ? String(user?.userID) : ""` — hardcoded role checking.
7. **`departmentID` hardcoded checks**: Various places check `user.departmentID` — if backend changes department IDs, these will break.
8. **Multiple `console.log` statements** left in the code.
9. **Initial target data fetch**: Dependency on `dateRange` and `selectedUser` — if either changes, targets re-fetch; but initial mount may show empty state until effects run.

---

## Backend Migration Impact

**High risk** — this page makes direct API calls to target-related endpoints:

**API endpoints:**
- `/Department/list` — department filter for target management
- `/users/read` — user filter for target management
- `/list-target-summary` — **CRITICAL**: Returns target summary data; same shape as efficiency summary but with target-specific fields
- `/save-targets` — **CRITICAL**: Saves target percentages; payload is `targets: [{ departmentID, userID, targetPercent }]`

**Key concerns:**
1. **`/save-targets` payload**: The `targets` array with `{ departmentID, userID, targetPercent }` — if backend changes any of these field names or adds required fields, the save will fail.
2. **`/list-target-summary` response**: Same format concerns as other summary endpoints — `summary` object with target metrics and `data` array.
3. **`isAdminOnly` guard**: `user.userRole === 1` — hardcoded role ID; if backend changes role names/IDs, admin access will be broken.
4. **Department ID and User ID**: Throughout the code, `departmentID` and `userID` are used directly from user/session state — if these change format after login, API calls will send wrong IDs.
5. **Same date format issues**: `convertToZonedFormat`, `normalizeISO`, `formatDateTime` patterns — timezone differences between Java/Spring Boot and Node.js may cause incorrect target periods.
6. **`selectedUser` handling**: `isELORUSER ? String(user?.userID) : ""` — same hardcoded role checking pattern seen across many pages.

---