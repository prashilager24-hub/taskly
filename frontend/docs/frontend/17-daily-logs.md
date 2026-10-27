# Daily Logs Page (src/pages/dailyLogs.tsx)

**Route:** `/daily-logs`  
**Access:** `adminOrTech` guard (requires `user.userRole === 1 || user.departmentID === 24`)  
**File:** `src/pages/dailyLogs.tsx` (287 lines)

---

## Purpose & User Flow
Daily logs page — tracks and reviews daily activity logs for users. Features:
- Department and user filtering
- Date range picker for selecting log period
- List of daily activity logs with details
- Status filtering (Active, Completed, etc.)
- Export/download functionality
- Summary metrics showing total logs, completion rates

User flow:
1. User (admin or tech) lands on page with date range selector
2. Can filter by department (autocomplete) and/or user (autocomplete)
3. Date range determines which logs are shown
4. Table displays daily logs with: log ID, user, date, activity type, status, duration
5. Can change status per log (update status)
6. Download/export logs as Excel

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/Department/list?page=0&size=0` | `searchText`, `filter`, `startDate`, `endDate`, `roleID: user.userRole`, `userID: ...` | Department list: `departmentID`, `departmentName` | On mount (once) |
| 2 | `POST` | `/t2.0/authentificationUtilization/daily-logs/list?page=&size=` | `departmentID`, `userID`, `startDate`, `endDate`, `page`, `size` | Logs list: `logID`, `userID`, `date`, `activityType`, `status`, `duration`, `createdAt` | When `pageNumber`, `pageSize`, `dateRange`, `selectedDepartment`, `selectedUser` changes |
| 3 | `POST` | `/t2.0/authentificationUtilization/daily-logs/count` | `departmentID`, `userID`, `startDate`, `endDate` | Count total logs | When filters change |
| 4 | `POST` | `/t2.0/authentificationUtilization/daily-logs/update-status` | `logID`, `status` | Success response | When status update confirmed |
| 5 | `POST` | `/t2.0/authentificationUtilization/download-daily-logs` | `departmentID`, `userID`, `startDate`, `endDate` | Excel blob | When "Download" clicked |

---

## Special Logic

| Logic | Description |
|-------|-------------|
| Status filter options (lines 31-36): | `ACTIVE`, `COMPLETED`, `CANCELLED`, `ALL` — toggles which logs show |
| `handleStatusUpdate` (lines 200-220): | Confirms with user, then calls `/update-status` API with `logID` and new `status` |
| Date range default (lines 85-95): | If `selectedUser` set → no date range; otherwise default 7 days from today |
| `isAdminOrTech` check (line 34): | `user.userRole === 1 || user.departmentID === 24` — hardcoded role/dept |

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `sidebarOpen`, `dateSelect`, `departmentList`, `users`, `logs`, `pageNumber`, `totalRecords`, `pageSize`, `searchValue`, `statusFilter`, `loading`, `dateRange`, `selectedUser`, `selectedDepartment` |
| Derived | `useMemo` | — |
| Effects | Multiple `useEffect` | Fetch departments on mount; fetch users when department changes; fetch logs when `dateRange`, `selectedUser`, `selectedDepartment`, `statusFilter` change; count total logs |

---

## Effects & Dependencies
- Line 210-250: `fetchDepartments` — runs once on mount
- Line 252-292: `fetchUsers` — dependency: `[selectedDepartment]` — fetches users for department filter
- Line 294-360: `logsData` — **main data fetch**; dependency: `[dateRange, selectedUser, selectedDepartment, statusFilter]` — fetches daily logs list with pagination
- Line 362-400: `handleStatusUpdate` — on confirm, updates log status via API, refreshes logs list
- Line 402-445: `handleDownload` — dependency: `[dateRange, selectedUser, selectedDepartment]` — downloads Excel

---

## UI Components Used (tree)

```
DailyLogs
├── ReusableTable (component, ../components/table) — daily logs table with status column and edit actions
├── Tabs, Tab (from @heroui/react) — status filter tabs (Active/Completed/Cancelled/All)
├── Button (from @heroui/button) — download, status update actions
├── CustomDateRangePicker (component, ../components/CustomDateRangePicker) — date selector
├── Autocomplete, AutocompleteItem (from @heroui/react) — department filter, user filter
├── Select, SelectItem (from @heroui/select) — status filter selection
├── Format from date-fns — date formatting
├── AddToast (from @heroui/react) — notifications
├── title from primitives — page title
```

---

## Known Defects, Dead Code, TODOs

1. **Line 34**: `isAdminOrTech` guard: `user.userRole === 1 || user.departmentID === 24` — hardcoded role and department IDs. If backend changes these, access control will break.
2. **Lines 85-95**: Date range default logic — same pattern as other pages; if `selectedUser` set → no date range; otherwise default 7 days.
3. **Status filter logic**: `statusFilter` state initialized and used to filter logs; if backend changes status values (e.g., from "ACTIVE" to "ACTIVE_LOG"), the filter won't work correctly.
4. **`selectedUser` special handling**: `isELORUSER ? String(user?.userID) : ""` — hardcoded role checking passed to API payload.
5. **`selectedDepartment` handling**: Similar pattern — `String(selectedDepartment ?? "")` — if department ID changes format, may cause issues.
6. **`statusFilter` initialization**: `useState("ALL")` — hardcoded default; if backend changes status constants, default may show wrong data.
7. **Duration field in table**: Raw duration value displayed — if backend changes duration unit (minutes vs hours), display will be misleading.
8. **`handleStatusUpdate` payload**: `logID` and `status` — if backend changes the expected payload format, status updates will fail.
9. **Multiple `console.log` statements** left in the code.
10. **Download endpoint** `/download-daily-logs`: Same concerns as other download endpoints about hardcoded API base URL.

---

## Backend Migration Impact

**High risk** — this page makes direct API calls to daily logs endpoints:

**API endpoints:**
- `/Department/list` — department filter
- `/users/read` (implied) — user filter
- `/daily-logs/list` — **CRITICAL**: Paginated list of daily logs; response has `logs` array with `logID`, `userID`, `date`, `activityType`, `status`, `duration`, `createdAt`
- `/daily-logs/count` — returns total count for pagination
- `/daily-logs/update-status` — updates log status; payload: `logID`, `status`
- `/download-daily-logs` — downloads Excel; payload: `departmentID`, `userID`, `startDate`, `endDate`

**Key concerns:**
1. **`isAdminOrTech` guard**: `user.userRole === 1 || user.departmentID === 24` — hardcoded role (1) and department (24). If backend changes role IDs or department IDs, access control will break — admins or tech team may be locked out or unauthorized users may gain access.
2. **Status values**: Hardcoded `ACTIVE`, `COMPLETED`, `CANCELLED`, `ALL` — if backend changes status constants, the status filter UI and API calls will misbehave.
3. **Duration unit**: The `duration` field displayed in table — if backend changes unit (e.g., from minutes to hours, or adds new unit types), the display will be incorrect without frontend conversion.
4. **Date range handling**: Same `convertToZonedFormat`, `normalizeISO`, `formatDateTime` patterns — timezone differences between Java/Spring Boot and Node.js may cause logs to show for wrong date periods.
5. **`selectedUser` and `selectedDepartment`**: Both use `String(...)` conversion passed to API — if user/dept object shapes change after login, wrong IDs may be sent.
6. **`isELORUSER` pattern**: Used for determining if user should pass their ID to API — same hardcoded role checking pattern seen across many pages.

---