# Primary Department Page (src/pages/PrimaryDepartment.tsx)

**Route:** `/primaryDepartment`  
**Access:** `adminOnly` guard (requires `user.userRole === 1`)  
**File:** `src/pages/PrimaryDepartment` — actually mapped to `/department` route in App.tsx line 67

---

## Purpose & User Flow
Primary department management — allows admins to link primary departments to sub-departments. This page is rendered at route `/department` (see App.tsx line 67: `<Route path="/department" element={<ProtectedRoute adminOnly={true}><DepartmentPage /></ProtectedRoute>}`), but the component is `src/pages/subdepartment.tsx` which contains the `PrimaryDepartment` logic inside it.

Key features:
- View primary departments list
- Link primary department to a sub-department
- Form to add/edit departments with executive/functional leaders

Since the route is `/department` and the component is `subdepartment.tsx`, the primary department functionality is integrated within the DepartmentPage we already documented in `03-department.md`. The `handleLinkPrimaryDepartment` function (lines 132-166 in subdepartment.tsx) handles the linking logic.

---

## API Calls (within DepartmentPage)

| # | Method | Endpoint | Request Payload | Response Fields Used | When Fires |
|---|--------|----------|----------------|---------------------|-----------|
| 1 | `POST` | `/t2.0/authentificationUtilization/PrimaryDepartment/list` | `{}` | `primaryDepartmentId`, `primaryDepartmentName` | On mount (once) |
| 2 | `POST` | `/t2.0/authentificationUtilization/Department/update/${id}` | `primaryDepartmentId: Number(primaryDepartmentId)` | Success toast | When "Link Primary Department" submitted |
| 3 | `POST` | `/t2.0/authentificationUtilization/Department/create` | `departmentName`, `departmentDescription`, `executiveLeaderID` | Success toast | When "Add Department" submitted |
| 4 | `POST` | `/t2.0/authentificationUtilization/Department/update/${id}` | `departmentName`, `departmentDescription`, `functionalLeaderID`, `executiveLeaderID` | Success toast | When "Update Department" submitted |

---

## Special Logic

| Logic | Description |
|-------|-------------|
| `handleLinkPrimaryDepartment` (lines 132-166) | Links a primary department to current department: POSTs to `/Department/update/${id}` with `{ primaryDepartmentId: Number(primaryDepartmentId) }` |
| Department form normalization (lines 25-45) `getUserDepartments` | Handles both `{ departmentID }` and `{ departments: [...] }` user shapes — same as in Forms page |
| `getPrimaryDepartmentId` (lines 47-52) | Returns first department from array or single departmentID |

---

## Known Defects / Observations

Since this functionality is integrated into the DepartmentPage already documented in `03-department.md`, the primary department features share the same defects:

1. **`handleLinkPrimaryDepartment`** (lines 132-166): Uses `JSON.parse(authUserLD).token` without null check — if authUserLD is null, will throw error
2. **Department response mapping**: Same as DepartmentPage — `departmentID`, `departmentName`, `departmentDescription`, `newStatus`, `departmentStatus`, `executiveLeaderID`, `functionalLeaderID`
3. **Same user shape normalization**: `getUserDepartments` handles both `{ departmentID }` and `{ departments: [...] }` forms
4. **No separate route** — primary department is part of the `/department` route

---