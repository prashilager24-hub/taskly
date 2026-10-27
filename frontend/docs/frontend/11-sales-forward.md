# Sales Forward Page (src/pages/salesForward.tsx)

**Route:** `/sales-forward`  
**Access:** `salesOnly` guard (requires `user.departmentID === 21`)  
**File:** `src/pages/salesForward.tsx` (478 lines)

---

## Purpose & User Flow
Sales forward management — users in department 21 can manage sales call scheduling and status. Features:
- View sales calls list filtered by creator user
- Update call status (reschedule or status change)
- Date range filtering
- Edit call in modal with date picker, status selector, cancelled by, reason
- View reschedule logs per call
- Add new call functionality (button present but may not have full implementation)

User flow:
1. User lands on page with calls list filtered by their userID
2. User can select a call row → opens edit modal
3. Modal shows call details: Call ID, Publisher Name, Sales User ID, Scheduled Date/Time, Status
4. User can change status (from schedule options), date via DatePicker, reason for change
5. User submits → API call to reschedule or update status
6. Call data updates in table
7. "View Logs" dropdown shows reschedule history for the call

---

## API Calls

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/sales/calls/list?page=&size=` | `userID: user.userID` | Calls list: `CallID`, `ScheduledDatetime`, `CreaterUserID`, `SalesUserID`, `PublisherName`, `status`, `RescheduleLogs` array | When `pageNumber`, `pageSize` changes |
| 2 | `POST` | `/t2.0/authentificationUtilization/sales/calls/reschedule` | `userID`, `callID`, `newDatetime`, `rescheduledBy`, `reason` | Success response with `scheduledDatetime` | When "Submit" in modal for RESCHEDULED status |
| 3 | `POST` | `/t2.0/authentificationUtilization/sales/calls/update-status` | `userID`, `callID`, `newDatetime`, `status` | Success response | When "Submit" in modal for other statuses |

---

## Special Options

| Option | Description |
|--------|-------------|
| `schedule` array (lines 31-40) | SCHEDULED, COMPLETED, NO_SHOW, RESCHEDULED, CANCELLED_BY_PUBLISHER, CANCELLED_BY_INTERNAL |
| `cancelledOptions` (lines 41-45) | PUBLISHER, INTERNAL — who cancelled the call |
| `convertToZonedFormat` (lines 47-63) | Converts ISO string to zoned DatePicker value using `Intl.DateTimeFormat().resolvedOptions().timeZone` |
| `normalizeISO` (lines 79-80) | `new Date(iso).toISOString()` — normalizes dates for comparison |
| `validate` (lines 82-97) | If status is CANCELLED_BY_PUBLISHER or CANCELLED_BY_INTERNAL, reason is required |
| `formatDateTime` (lines 272-283) | Formats ISO datetime to `en-GB` locale: `dd/mm/yyyy, hh:MM AM/PM` |

---

## Forms

| Form | Fields | Validation | Defaults | Submit Behavior |
|------|--------|------------|----------|-----------------|
| Update Sales Call Modal | Call ID (disabled), Publisher Name, Sales User ID, DatePicker (value=duration, onChange), Status (select: schedule options), Cancelled By (select: cancelledOptions — shows if RESCHEDULED), Reason (input) | Reason required if status is CANCELLED_BY_PUBLISHER or CANCELLED_BY_INTERNAL (via `validate()`) | duration initially set from `convertToZonedFormat(row._rawDate)`; status from row; reason empty | On submit: calls reschedule or update-status API, updates table data, closes modal |

---

## Tables/Lists

| Table | Columns | Sorting | Filtering | Pagination | Export/Download |
|-------|---------|---------|-----------|------------ |-----------------|
| Sales calls table | Call ID, Scheduled Date/Time, Creator User ID, Sales User ID, Publisher Name, Status, Reschedule Logs, Edit | ✓ (via ReusableTable) | ✓ (via page state, not explicit filter UI beyond date range) | ✓ (rows per page) | — |

**salesColumns** (lines 182-258):
- CallID, ScheduledDatetime, CreaterUserID, SalesUserID, PublisherName
- Status: color-coded dot + text (SCHEDULED→purple, RESCHEDULED→yellow, COMPLETED→green, NO_SHOW→purple, CANCELLED_BY_PUBLISHER→red, CANCELLED_BY_INTERNAL→gray)
- Reschedule Logs: Dropdown with log history
- Edit: button to open modal

**Table actions** (lines 260-270):
- Edit: opens row in modal for updating

---

## State

| Type | Source | Description |
|------|--------|-------------|
| Local state | Multiple `useState` | `sidebarOpen`, `duration`, `selectedRows`, `isSalesModalOpen`, `editData`, `salesData`, `pageNumber`, `totalRecords`, `pageSize`, `selectedCall`, `searchValue`, `isModalOpen`, `schedule`, `cancelledOptions`, `duration` |
| Derived | `useMemo` | — |
| Effects | `useEffect` (lines 285-316) | `fetchData` — runs when `pageNumber`, `pageSize` changes; fetches calls for `user.userID`; formats data with `_rawDate` and `ScheduledDatetime` |

---

## Effects & Dependencies
- Line 285-316: `fetchData` — dependency: `[pageNumber, pageSize]` — fetches sales calls for the logged-in user; formats `ScheduledDatetime` using `formatDateTime`; keeps `_rawDate` untouched for comparison
- Line 65-76: `handleEdit` — `convertToZonedFormat(row._rawDate)` converts raw ISO to zoned DatePicker value; stores `originalISO` and `cancelledBy` from row data
- Line 99-97: `handleSaveChanges` — dependency: `[validate()]` — calls reschedule or update-status API based on `editData.status`; formats dates via `normalizeISO`; updates `salesData` with response

---

## UI Components Used (tree)

```
SalesForward
├── ReusableTable (component, ../components/table) — sales calls table
├── Modal (from @heroui/react) — update sales call modal
├── ModalContent, ModalHeader, ModalBody, ModalFooter (from @heroui/react)
├── useDisclosure (from @heroui/react) — for modal
├── Button (from @heroui/button) — various actions, modal submit
├── Dropdown, DropdownMenu, DropdownTrigger, DropdownItem (from @heroui/react) — view logs, status selection, cancelled by
├── FunnelIcon, ArrowDownTrayIcon (from @heroicons/react/24/outline) — icons
├── Input (from @heroui/input) — Call ID (disabled), Publisher Name, Sales User ID, Reason
├── DatePicker (from @heroui/react) — event date with hideTimeZone, showMonthAndYearPickers
├── Select, SelectItem (from @heroui/select) — Status options (schedule array), Cancelled By (cancelledOptions)
├── Chip (from @heroui/react) — status dots in table
├── PlusIcon (from ../components/table) — not directly used but imported context
├── formatDateTime function (inline) — date formatting to en-GB locale
├── convertToZonedFormat function (inline) — ISO to DatePicker zoned conversion
├── normalizeISO function (inline) — date normalization
├── validate function (inline) — reason validation for cancellations
├── schedule, cancelledOptions arrays (inline) — status option definitions
├── addToast (from @heroui/react) — notifications
├── user from @heroui/react — (imported but appears unused)
├── title from primitives — page title
```

---

## Known Defects, Dead Code, TODOs

1. **Lines 13-16**: `selectedRows` state type `Task[]` but data is actually call objects — type mismatch
2. **Lines 17-18**: `editData` state type `any` — loose typing for modal form data
3. **Lines 32-35**: `cancelledOptions` has `CANCELLED_BY_INTERNAL` but the options array has `PUBLISHER` and `INTERNAL` — the value `CANCELLED_BY_INTERNAL` doesn't match the option value `INTERNAL`
4. **Line 66**: `handleEdit` uses `row._rawDate` — but this property is added in the fetchData effect (line 299: `item._rawDate: item.ScheduledDatetime`), so it exists, but the naming convention is inconsistent
5. **Lines 82-97**: `validate()` function checks `editData.status === "CANCELLED_BY_PUBLISHER" || editData.status === "CANCELLED_BY_INTERNAL"` — but the status values in the schedule array are `"CANCELLED_BY_PUBLISHER"` and `"CANCELLED_BY_INTERNAL"`, so this should work; however, the UI status rendering (lines 193-209) uses `row.status` which may have different formatting
6. **Line 108**: `const newDateISO = duration?.toDate().toISOString()` — DatePicker's `toDate()` may not behave as expected; depends on Duration type from @heroui/react
7. **Lines 114-115**: `const normalizedNew = normalizeISO(newDateISO); const normalizedOld = normalizeISO(oldISO)` — both normalized via `new Date(iso).toISOString()`, but if the DatePicker returns a different format, comparison may fail
8. **Line 137**: `editData.originalISO = row._rawDate` — stores raw date, but `row._rawDate` was added in fetchData, so it's a custom property
9. **Lines 41-45**: `cancelledOptions` has `PUBLISHER` and `INTERNAL` but the schedule array has `CANCELLED_BY_PUBLISHER` and `CANCELLED_BY_INTERNAL` — inconsistency between variable names and actual values
10. **Line 272-283**: `formatDateTime` uses `"en-GB"` locale hardcoded — if user's locale changes, formatting may look different
11. **The "Add Call" button** (line 353: `addButtonLabel="Add Call"`) is present in ReusableTable but there's no full implementation for adding new calls — the modal may open but without proper form handling
12. **`selectedRows`** is `Task[]` type but the table data is call objects — TypeScript type error prone
13. **Multiple `console.log` statements** left in the code (line 402: `console.log("NEW DATE:", newValue)`)
14. **No clear "Add Call" functionality** — the button exists but there's no add modal or API call for creating new calls

---

## Backend Migration Impact

**Medium risk** — this page makes API calls to sales-specific endpoints:

**API endpoints:**
- `/sales/calls/list` — fetches calls for `user.userID`; response has `calls` array with `CallID`, `ScheduledDatetime`, `CreaterUserID`, `SalesUserID`, `PublisherName`, `status`, `RescheduleLogs`
- `/sales/calls/reschedule` — reschedules a call; payload: `userID`, `callID`, `newDatetime`, `rescheduledBy`, `reason`
- `/sales/calls/update-status` — updates call status; payload: `userID`, `callID`, `newDatetime`, `status`

**If Node.js backend changes:**
- **Response shape**: The `calls` array field names (`CallID`, `ScheduledDatetime`, etc.) — if changed, the fetchData mapping (lines 297-301) will break
- **Status values**: Hardcoded `schedule` array: `SCHEDULED`, `COMPLETED`, `NO_SHOW`, `RESCHEDULED`, `CANCELLED_BY_PUBLISHER`, `CANCELLED_BY_INTERNAL` — if backend uses different status values, the status rendering (color coding, dropdown options) will be wrong
- **Reschedule reason validation**: `validate()` checks for reason when status is `CANCELLED_BY_PUBLISHER` or `CANCELLED_BY_INTERNAL` — if backend changes these strings, validation will misbehave
- **Date format**: `convertToZonedFormat` uses `Intl.DateTimeFormat().resolvedOptions().timeZone` to detect timezone — if the Node.js backend is in a different timezone or the frontend is accessed from different locales, the zoned date conversion may produce different results
- **`normalizeISO`**: `new Date(iso).toISOString()` — if backend sends dates in different format, may not parse correctly
- **`formatDateTime`**: Uses `"en-GB"` locale hardcoded — if the Node.js backend serves users in different regions, the date format may need to be locale-aware

**Additional concerns:**
- Department restriction: `salesOnly` guard checks `user.departmentID === 21` — if backend changes department ID for sales team, users may be incorrectly locked out or allowed in
- The `userID` in API payloads comes from `user.userID` — if the user object shape changes after login, may send wrong ID
- No clear add call functionality despite "Add Call" button in table
- The `duration` state is initialized to `null` and set via `convertToZonedFormat` on mount + when editing — if the initial fetch doesn't have proper data, DatePicker may show incorrectly

---