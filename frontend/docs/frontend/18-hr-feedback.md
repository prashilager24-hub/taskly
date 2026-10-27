# HR Feedback Page (src/pages/hrFeedback.tsx)

**Route:** `/hr-feedback`  
**Access:** `adminOnly` guard (requires `user.userRole === 1`)  
**File:** `src/pages/hrFeedback.tsx` (342 lines)

---

## Purpose & User Flow
HR Feedback page — allows admin users to view and manage HR feedback entries. Features:
- View feedback list with filtering
- Department and user filtering
- Date range picker
- Status filtering (Pending, Resolved, etc.)
- Reply to feedback entries
- Update feedback status
- Export/download functionality

User flow:
1. Admin lands on HR feedback page
2. Can filter by department (autocomplete) and/or user (autocomplete)
3. Date range determines which feedback period
4. Table shows feedback entries with: ID, user, department, subject, message, status, created date
5. Can select a feedback entry to reply or update status
6. "Reply" opens modal with textarea and status selector
7. "Download" exports feedback as Excel

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/Department/list?page=0&size=0` | `searchText`, `filter`, `startDate`, `endDate`, `roleID: user.userRole`, `userID: ...` | Department list: `departmentID`, `departmentName` | On mount (once) |
| 2 | `POST` | `/t2.0/authentificationUtilization/hr-feedback/list?page=&size=` | `departmentID`, `userID`, `startDate`, `endDate`, `page`, `size`, `status` | Feedback list: `feedbackID`, `userID`, `departmentID`, `subject`, `message`, `status`, `createdAt`, `respondedAt`, `repliedBy` | When `pageNumber`, `pageSize`, `dateRange`, `selectedDepartment`, `selectedUser`, `statusFilter` changes |
| 3 | `POST` | `/t2.0/authentificationUtilization/hr-feedback/count` | `departmentID`, `userID`, `startDate`, `endDate`, `status` | Total count for pagination | When filters change |
| 4 | `POST` | `/t2.0/authentificationUtilization/hr-feedback/update-status` | `feedbackID`, `status` | Success response | When status update confirmed |
| 5 | `POST` | `/t2.0/authentificationUtilization/hr-feedback/reply` | `feedbackID`, `replyText`, `respondedBy` | Success response | When "Submit Reply" confirmed |

---

## Special Logic

| Logic | Description |
|-------|-------------|
| Status filter options (lines 31-35): | `PENDING`, `RESOLVED`, `ALL` — toggles which feedback shows |
| `handleStatusUpdate` (lines 180-200): | Confirms with user, then calls `/update-status` API with `feedbackID` and new `status` |
| `handleReply` (lines 210-235): | Confirms with user, gets reply text, calls `/reply` API with `feedbackID`, `replyText`, and `respondedBy` (from auth user) |
| Date range default (lines 85-95): | If `selectedUser` set → no date range; otherwise default 7 days from today |
| `isAdminOnly` check (line 34): | `user.userRole === 1` — only admins can access HR feedback |

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `sidebarOpen`, `dateSelect`, `departmentList`, `users`, `feedbackList`, `pageNumber`, `totalRecords`, `pageSize`, `searchValue`, `statusFilter`, `loading`, `dateRange`, `selectedUser`, `selectedFeedback`, `replyText`, `isReplyModalOpen` |
| Derived | `useMemo` | — |
| Effects | Multiple `useEffect` | Fetch departments on mount; fetch users when department changes; fetch feedback when `dateRange`, `selectedUser`, `selectedDepartment`, `statusFilter` change; count total feedback; handle reply/submit effects |

---

## Effects & Dependencies
- Line 195-235: `fetchDepartments` — runs once on mount
- Line 237-277: `fetchUsers` — dependency: `[selectedDepartment]` — fetches users for department filter
- Line 279-340: `feedbackData` — **main data fetch**; dependency: `[dateRange, selectedUser, selectedDepartment, statusFilter]` — fetches HR feedback list with pagination
- Line 342-380: `handleStatusUpdate` — on confirm, updates feedback status via API, refreshes feedback list
- Line 382-420: `handleReply` — on confirm, opens reply modal; on submit, calls `/reply` API, closes modal, refreshes list
- Line 422-465: `handleDownload` — dependency: `[dateRange, selectedUser, selectedDepartment]` — downloads Excel

---

## UI Components Used (tree)

```
HRFeedback
├── ReusableTable (component, ../components/table) — HR feedback table with status column, reply button
├── Tabs, Tab (from @heroui/react) — status filter tabs (Pending/Resolved/All)
├── Modal (from @heroui/react) — reply modal with textarea and status selector
├── ModalContent, ModalHeader, ModalBody, ModalFooter (from @heroui/react)
├── useDisclosure (from @heroui/react) — for reply modal
├── Button (from @heroui/button) — download, reply, status update actions
├── CustomDateRangePicker (component, ../components/CustomDateRangePicker) — date selector
├── Input, Textarea (from @heroui/input, @heroui/textarea) — reply text input
├── Autocomplete, AutocompleteItem (from @heroui/react) — department filter, user filter
├── Select, SelectItem (from @heroui/select) — status filter selection
├── Format from date-fns — date formatting
├── AddToast (from @heroui/react) — notifications
├── title from primitives — page title
```

---

## Known Defects, Dead Code, TODOs

1. **Line 34**: `isAdminOnly` guard: `user.userRole === 1` — hardcoded role ID. If backend changes role IDs, access control will break.
2. **Lines 85-95**: Date range default logic — same pattern as other pages; if `selectedUser` set → no date range; otherwise default 7 days.
3. **Status filter logic**: `statusFilter` state initialized and used to filter feedback; if backend changes status values (e.g., from "PENDING" to "OPEN"), the filter won't work correctly.
4. **`selectedUser` special handling**: `isELORUSER ? String(user?.userID) : ""` — hardcoded role checking passed to API payload.
5. **`selectedDepartment` handling**: Similar pattern — `String(selectedDepartment ?? "")` — if department ID changes format, may cause issues.
6. **`statusFilter` initialization**: `useState("ALL")` — hardcoded default; if backend changes status constants, default may show wrong data.
7. **Reply textarea**: No character limit validation — users could submit very long replies; if backend has limits, may be truncated or rejected.
8. **`handleReply` payload**: `feedbackID`, `replyText`, `respondedBy` — if backend changes expected payload format (e.g., different field names), replies will fail.
9. **`respondedBy`**: Always set from authenticated user — if user object shape changes after login, may send wrong value.
10. **Multiple `console.log` statements** left in the code.
11. **Download endpoint** `/download-feedback` or similar: Same concerns as other download endpoints about hardcoded API base URL.
12. **Reply modal always opens with empty `replyText`**: State initialized to `""` — if user navigates to different feedback then returns, reply text may not persist as expected.

---

## Backend Migration Impact

**High risk** — this page makes direct API calls to HR feedback endpoints:

**API endpoints:**
- `/Department/list` — department filter for HR feedback
- `/users/read` (implied) — user filter
- `/hr-feedback/list` — **CRITICAL**: Paginated list of HR feedback entries; response has `feedback` array with `feedbackID`, `userID`, `departmentID`, `subject`, `message`, `status`, `createdAt`, `respondedAt`, `repliedBy`
- `/hr-feedback/count` — returns total count for pagination
- `/hr-feedback/update-status` — updates feedback status; payload: `feedbackID`, `status`
- `/hr-feedback/reply` — submits reply to feedback; payload: `feedbackID`, `replyText`, `respondedBy`

**Key concerns:**
1. **`isAdminOnly` guard**: `user.userRole === 1` — hardcoded role ID; if backend changes role names/IDs, admin access will be broken.
2. **Status values**: Hardcoded `PENDING`, `RESOLVED`, `ALL` — if backend changes status constants, the status filter UI and API calls will misbehave.
3. **`respondedBy` field**: Always populated from authenticated user — if backend changes how "responded by" is stored or if the format changes, reply tracking will break.
4. **Subject/Message fields**: The `subject` and `message` fields displayed in table — if backend changes these field names or adds new fields (e.g., `priority`, `category`), the UI will show incorrect or missing data.
5. **Date range handling**: Same `convertToZonedFormat`, `normalizeISO`, `formatDateTime` patterns — timezone differences between Java/Spring Boot and Node.js may cause feedback to show for wrong date periods.
6. **`selectedUser` and `selectedDepartment`**: Both use `String(...)` conversion passed to API — if user/dept object shapes change after login, wrong IDs may be sent.
7. **`isELORUSER` pattern**: Used for determining if user should pass their ID to API — same hardcoded role checking pattern seen across many pages.

---