# Frontend Audit and UI Change Plan

## Cover Page
**Project:** Taskly  
**Audit Type:** Full read-only frontend audit (React/TypeScript)  
**Conversion Context:** Backend migration from Java/Spring Boot to Node.js — frontend must keep working  
**Output:** `Frontend_Audit_and_UI_Change_Plan.pdf`

---

## 1. Folder Structure & Key Files

| Category | Details |
|----------|---------|
| **Build Tool** | Vite 5 + React 18 + TypeScript 5 |
| **UI Library** | `@heroui/react` v2.8.5 + Tailwind CSS 4 (HeroUI plugin) |
| **Routing** | `react-router-dom` v6 with `ProtectedRoute` pattern |
| **State Mgmt** | Zustand (persisted) + `localStorage` for auth |
| **API Client** | Direct `axios` calls — **no centralized instance** |
| **Auth** | JWT in `localStorage`, Bearer token in headers |
| **Charts** | `react-apexcharts` + custom radial bar charts |
| **Excel** | `exceljs` + `xlsx` for file generation |
| **WebGL** | `ogl` for Aurora canvas background |
| **Notifications** | Push API + Service Worker + `localStorage` |
| **No .env files** | All configs hardcoded or in `package.json` |
| **No i18n** | English-only, all texts hardcoded |

### Package.json Key Versions
- `axios` ^1.13.1
- `react-router-dom` ^6.23.0
- `zustand` ^5.0.12
- `@heroui/react` ^2.8.5 + all sub-packages
- `apexcharts` ^5.3.6 + `react-apexcharts`
- `framer-motion` ^11.18.2
- `ogl` ^1.0.11
- `query-string` ^9.3.1
- `date-fns` ^4.1.0
- `moment` ^2.30.1
- `exceljs` ^4.4.0 + `xlsx` ^0.18.5

### Key Config Files
- `vite.config.ts` — Vite build config, `@vitejs/plugin-react`
- `tailwind.config.js` — HeroUI plugin, custom colors, dark mode `class`
- `postcss.config.js` — PostCSS setup
- `vercel.json` — Deployment config
- `src/config/site.ts` — Site navigation config (general-purpose, not Taskly-specific)
- `.gitignore`, `.npmrc`

### Environment Variables
**None found.** All API base URLs are hardcoded:

```
https://taskly.tapmind.io/t2.0/authentificationUtilization
```

Every axios call uses relative paths like `/t2.0/authentificationUtilization/<endpoint>` which are resolved against this base.

---

## 2. Routing — Full Route Table

### Public Routes
| Path | Component | Notes |
|------|-----------|-------|
| `/` | `IndexPage` (login) | Aurora canvas background; redirects to `/dashboard` if token exists |
| `/logout` | `Logout` | Removes `authUserLD` from localStorage |
| `/passwordHandler` | `ResetPasswordPage` | Forgot password flow |

### Protected Routes (behind `ProtectedLayout` = `ProtectedRoute` + `Layout` with sidebar + topbar)
| Path | Component | Access Guard |
|------|-----------|-------------|
| `/dashboard` | `DashboardPage` | All authenticated |
| `/activity-log` | `ActivityLogPage` | All authenticated |
| `/department` | `DepartmentPage` | `adminOnly` |
| `/primaryDepartment` | `PrimaryDepartmentPage` | `adminOnly` |
| `/department-forms` | `FormPage` | All authenticated |
| `/tasks` | `TaskManagementPage` | `adminOnly` |
| `/target` | `TargetManagement` | `adminOnly` |
| `/efficiency-report` | `Efficiency` | All authenticated |
| `/access-management` | `AccessManagementPage` | `adminOnly` |
| `/sales-forward` | `SalesForward` | `salesOnly` (deptID=21) |
| `/Goal-management` | `GoalManagement` | `adminOrTech` |
| `/pms` | `PMS` | All authenticated |
| `/Entry-Approval` | `EntryApproval` | All authenticated |
| `/User-History` | `History` | `adminOnly` |
| `/Query-Report` | `QueryReport` | `adminOnly` |
| `/goals` | `Goals` | All authenticated |
| `/hr-feedback` | `HRFeedback` | All authenticated |

### ProtectedRoute Guards
| Role Check | Condition |
|------------|-----------|
| `adminOnly` | `user.userRole === 1` |
| `salesOnly` | `user.departmentID === 21` |
| `HrOnly` | `user.departmentID === 22` |
| `TechOnly` | `user.departmentID === 24` |
| `adminOrTech` | `user.userRole === 1` OR `user.departmentID === 24` |

### Sidebar Menu Filtering
- Defined in `src/components/sidebar.tsx` (427 lines)
- Filtered by: `user.userRole`, `user.departmentID`, `rolePermissions`
- Menu items with `adminOnly`, `salesOnly`, `departments` props are filtered accordingly
- Role-per-module check: `rolePermissions?.[module]?.includes("read")`

### Topbar User Display
- Shows user name from `authUserLD`
- Shows department name (parsed and title-cased)
- Avatar with dropdown: Profile, Logout
- Token expiry timer: auto-logout if JWT `exp` elapsed

---

## 3. State Management & API Layer

### Zustand Store (`src/store/commonStore.tsx`)
- Single store: `useDashboardStore`
- Persisted to localStorage key `"dashboard-storage"`
- Fields: `dateModification` (boolean), `allUser` (User[])
- Used by `DashboardPage` only

### Auth State (localStorage)
| Key | Contents |
|-----|----------|
| `authUserLD` | User profile: `userID`, `userName`, `userEmail`, `departmentName`, `departmentID`, `role`, `roleID`, `token`, `isActive`, `userCreateTime` |
| `roles` | Role privileges: `JSON.parse(rolePrivileges)` — stores per-module permissions |
| `pushEnabled` | Flag: `"true"` / `"false"` |

### API Layer — Direct axios calls (NO centralized instance)
- **Base URL:** `https://taskly.tapmind.io/t2.0/authentificationUtilization`
- **Pattern:** `axios.post("/t2.0/authentificationUtilization/<endpoint>", body, { headers })`
- **Auth header:** `Authorization: Bearer <token>` when token exists
- **Content-Type:** `application/json` on all POST calls

### Common API Pattern
```tsx
axios.post("/t2.0/authentificationUtilization/<endpoint>", body, {
  headers: { "Content-Type": "application/json" }
});
// With auth:
axios.post("/t2.0/authentificationUtilization/<endpoint>", body, {
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  }
});
```

### Token Expiry Handling
- Topbar (`src/components/topbar.tsx` lines 83-104): On mount, decodes JWT payload, checks `exp * 1000 - Date.now()`
- If expired → `handleLogout()` → `localStorage.removeItem("authUserLD")` + `window.location.href = "/"`
- Timer setTimeout auto-logs out

### 401/403 Handling
- **Not explicitly handled** in API layer — relies on route guards (`ProtectedRoute`)
- If token expires, topbar auto-logout redirects to `/`
- No interceptor to catch 401 and refresh token / show error

### Token Storage
- JWT stored in `localStorage.getItem("authUserLD")` as full JSON object
- Token accessible via `JSON.parse(authUserLD).token`
- No secure HTTP-only cookie usage

---

## 4. Global Providers, Layouts, Theme, i18n

### Providers (`src/provider.tsx`)
```tsx
<HeroUIProvider navigate={navigate} useHref={useHref}>
  <ToastProvider />
  {children}
</HeroUIProvider>
```
- `HeroUIProvider` from `@heroui/system` — provides theming and navigation context
- `ToastProvider` from `@heroui/toast` — toast notifications

### Layout (`src/components/layout.tsx`)
- Sidebar (collapsible on mobile)
- Topbar (fixed, with user profile + notifications)
- Main content area with padding `p-6`
- Dark mode: `dark:bg-gray-900` on body

### Theme (`tailwind.config.js`)
- HeroUI plugin configured
- Custom colors: primary `#FE5F00`, secondary, danger, success, neutral
- Dark mode: `class` strategy
- Font: `Poppins`
- Keyframes: "shine" animation for Aurora background

### i18n
- **None detected** — all text hardcoded in English
- No `react-i18next` or similar
- All UI strings are literal values in component files

---

## 5. Pages/Modules Summary (23 pages)

| # | Page | Route | Purpose |
|---|------|-------|---------|
| 1 | Login | `/` | Authentication form |
| 2 | Dashboard | `/dashboard` | Main dashboard with radial charts, stats, department lists |
| 3 | Activity Log | `/activity-log` | Daily activity logging via `DailyActivityLog` component |
| 4 | Department | `/department` | Department management (add/edit/delete/sub-departments) |
| 5 | Efficiency Report | `/efficiency-report` | Efficiency summary and table |
| 6 | Entry Approval | `/Entry-Approval` | Task/goal/target approval workflow |
| 7 | Forgot Password | `/passwordHandler` | Password reset flow |
| 8 | Forms | `/department-forms` | Department form submission |
| 9 | Goal Management | `/Goal-management` | Department goal CRUD |
| 10 | Goals Report | `/goals` | Goal progress report across users/departments |
| 11 | History | `/User-History` | User performance history |
| 12 | Access Management | `/access-management` | User role/permission management |
| 13 | Sales Forward | `/sales-forward` | Sales call scheduling/rescheduling (deptID=21) |
| 14 | PMS | `/pms` | PMS dashboard, goal setting, reviews |
| 15 | Primary Department | `/primaryDepartment` | Link primary department to sub-department |
| 16 | Query Report | `/Query-Report` | Filterable performance query report |
| 17 | Reports | `/reports` | Daily task reports |
| 18 | Target Management | `/tasks` | Target/Task CRUD per department |
| 19 | Daily Logs | `/daily-log` | Daily activity logs with filtering |
| 20 | HR Feedback | `/hr-feedback` | HR modules (delegates to external HR repo) |
| 21 | Department Forms (duplicate) | — | See Forms page |
| 22 | Efficiency (duplicate) | — | See Efficiency report |
| 23 | Index/Login | `/` | Login page |

> **Note:** Pages 21-22 appear to be duplicates of pages 5 and 8 based on file names but have different implementations.

---

## 6. Hardcoded API Base URL
```
https://taskly.tapmind.io/t2.0/authentificationUtilization
```

All 60+ API endpoints use this base with relative paths. The entire frontend will need to adapt if the Node.js backend changes this base URL or response shapes.

---