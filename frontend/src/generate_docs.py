from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy

doc = Document()

# ── Page margins ──────────────────────────────────────────────────────────────
for section in doc.sections:
    section.top_margin    = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin   = Cm(2.5)
    section.right_margin  = Cm(2.5)

# ── Colour palette ────────────────────────────────────────────────────────────
ORANGE  = RGBColor(0xFE, 0x5F, 0x00)
DARK    = RGBColor(0x1F, 0x29, 0x37)
GRAY    = RGBColor(0x6B, 0x72, 0x80)
WHITE   = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT   = RGBColor(0xF9, 0xFA, 0xFB)
BLUE    = RGBColor(0x1D, 0x4E, 0xD8)

# ── Helper: shade a table cell ────────────────────────────────────────────────
def shade_cell(cell, hex_color: str):
    tc   = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd  = OxmlElement("w:shd")
    shd.set(qn("w:val"),   "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"),  hex_color)
    tcPr.append(shd)

# ── Helper: add a styled heading ──────────────────────────────────────────────
def add_heading(text, level=1, color=DARK):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        run.font.color.rgb = color
        run.font.bold = True
        if level == 1:
            run.font.size = Pt(18)
        elif level == 2:
            run.font.size = Pt(14)
        else:
            run.font.size = Pt(12)
    return p

# ── Helper: add normal paragraph ─────────────────────────────────────────────
def add_para(text, bold=False, color=DARK, size=10, indent=False):
    p = doc.add_paragraph()
    if indent:
        p.paragraph_format.left_indent = Inches(0.3)
    run = p.add_run(text)
    run.font.size  = Pt(size)
    run.font.bold  = bold
    run.font.color.rgb = color
    return p

# ── Helper: add bullet ────────────────────────────────────────────────────────
def add_bullet(text, level=0, color=DARK):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.left_indent = Inches(0.3 + level * 0.2)
    run = p.add_run(text)
    run.font.size = Pt(10)
    run.font.color.rgb = color
    return p

# ── Helper: add a 2-col info table ───────────────────────────────────────────
def add_info_table(rows_data):
    table = doc.add_table(rows=len(rows_data), cols=2)
    table.style = "Table Grid"
    for i, (label, value) in enumerate(rows_data):
        row = table.rows[i]
        shade_cell(row.cells[0], "FFF2E5")
        row.cells[0].text = label
        row.cells[1].text = value
        for cell in row.cells:
            for para in cell.paragraphs:
                for run in para.runs:
                    run.font.size = Pt(9)
        row.cells[0].paragraphs[0].runs[0].font.bold = True
    doc.add_paragraph()

# ── Helper: add a header row table ───────────────────────────────────────────
def add_header_table(headers, rows_data):
    table = doc.add_table(rows=1 + len(rows_data), cols=len(headers))
    table.style = "Table Grid"
    hdr = table.rows[0]
    for i, h in enumerate(headers):
        shade_cell(hdr.cells[i], "FE5F00")
        hdr.cells[i].text = h
        for run in hdr.cells[i].paragraphs[0].runs:
            run.font.bold  = True
            run.font.color.rgb = WHITE
            run.font.size  = Pt(9)
    for ri, row_data in enumerate(rows_data):
        row = table.rows[ri + 1]
        fill = "FFFFFF" if ri % 2 == 0 else "FFF9F5"
        for ci, val in enumerate(row_data):
            shade_cell(row.cells[ci], fill)
            row.cells[ci].text = str(val)
            for run in row.cells[ci].paragraphs[0].runs:
                run.font.size = Pt(9)
    doc.add_paragraph()

# ── Helper: page break ────────────────────────────────────────────────────────
def page_break():
    doc.add_page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  COVER PAGE
# ══════════════════════════════════════════════════════════════════════════════
cover = doc.add_paragraph()
cover.alignment = WD_ALIGN_PARAGRAPH.CENTER
cover.paragraph_format.space_before = Pt(80)
run = cover.add_run("TASKLY")
run.font.size  = Pt(42)
run.font.bold  = True
run.font.color.rgb = ORANGE

sub = doc.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = sub.add_run("Complete Developer Documentation")
r.font.size = Pt(18)
r.font.color.rgb = DARK

sub2 = doc.add_paragraph()
sub2.alignment = WD_ALIGN_PARAGRAPH.CENTER
r2 = sub2.add_run("Workforce Productivity & Performance Management Platform")
r2.font.size = Pt(12)
r2.font.color.rgb = GRAY

doc.add_paragraph()
doc.add_paragraph()
meta = doc.add_paragraph()
meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
r3 = meta.add_run("Version 1.0  |  April 2026  |  TapMind")
r3.font.size = Pt(10)
r3.font.color.rgb = GRAY

page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  TABLE OF CONTENTS  (manual)
# ══════════════════════════════════════════════════════════════════════════════
add_heading("Table of Contents", 1, ORANGE)
toc_items = [
    ("1", "Project Overview"),
    ("2", "Folder & Codebase Structure"),
    ("3", "Page-Level Documentation"),
    ("4", "Component Documentation"),
    ("5", "Feature Breakdown"),
    ("6", "API & Data Flow"),
    ("7", "State Management"),
    ("8", "Styling & UI System"),
    ("9", "Key Workflows"),
    ("10", "Setup & Running Instructions"),
    ("11", "Developer Notes"),
]
for num, title_text in toc_items:
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.2)
    r = p.add_run(f"{num}.  {title_text}")
    r.font.size = Pt(11)
    r.font.color.rgb = BLUE

page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 1 – PROJECT OVERVIEW
# ══════════════════════════════════════════════════════════════════════════════
add_heading("1. Project Overview", 1, ORANGE)

add_heading("1.1 Project Name", 2)
add_para("Taskly (internally branded as TapMind Taskly)")

add_heading("1.2 Purpose", 2)
add_para(
    "Taskly is a comprehensive workforce productivity and performance management platform "
    "built for TapMind. It enables organisations to track daily employee activities, "
    "measure efficiency and utilisation, manage departments, assign tasks and targets, "
    "monitor goal achievement, and generate performance reports — all from a single "
    "role-aware web application."
)

add_heading("1.3 Tech Stack", 2)
add_header_table(
    ["Layer", "Technology", "Version / Notes"],
    [
        ["Frontend Framework", "React", "18.3.1"],
        ["Language", "TypeScript", "5.6.3"],
        ["Build Tool", "Vite", "5.x"],
        ["UI Component Library", "HeroUI (@heroui/react)", "2.8.x"],
        ["Styling", "Tailwind CSS", "4.x (via @tailwindcss/vite)"],
        ["Routing", "React Router DOM", "6.23.0"],
        ["HTTP Client", "Axios", "1.13.x"],
        ["Charts", "ApexCharts + react-apexcharts", "5.x / 1.8.x"],
        ["Animation", "Framer Motion", "11.x"],
        ["Date Utilities", "date-fns, moment, @internationalized/date", "Multiple"],
        ["Background FX", "OGL (WebGL)", "1.x"],
        ["Linting", "ESLint + Prettier", "9.x / 3.x"],
        ["Deployment", "Vercel (vercel.json present)", "—"],
        ["Backend API", "REST API (base path /t2.0/authentificationUtilization/)", "External"],
    ]
)

add_heading("1.4 High-Level Architecture", 2)
add_para(
    "The application follows a Single-Page Application (SPA) architecture. "
    "All routing is handled client-side via React Router. "
    "Authentication state is persisted in localStorage (key: authUserLD). "
    "API calls are made directly from page components using Axios to a backend REST API "
    "proxied under /t2.0/. The UI is composed of HeroUI primitives styled with Tailwind CSS."
)
add_bullet("Browser → React SPA (Vite dev server / Vercel CDN)")
add_bullet("React Router → Page Components → Axios → Backend REST API")
add_bullet("Auth token stored in localStorage, sent as Bearer token in headers")
add_bullet("Role-based access enforced both in routing (ProtectedRoute) and sidebar menu filtering")
add_bullet("Toast notifications via HeroUI ToastProvider for all user feedback")

page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 2 – FOLDER & CODEBASE STRUCTURE
# ══════════════════════════════════════════════════════════════════════════════
add_heading("2. Folder & Codebase Structure", 1, ORANGE)

add_heading("2.1 Root-Level Files", 2)
add_header_table(
    ["File / Folder", "Purpose"],
    [
        ["index.html", "HTML entry point; mounts React root div"],
        ["vite.config.ts", "Vite build config; registers React, TailwindCSS, tsconfig-paths plugins; dev server on port 3030"],
        ["tailwind.config.js", "Tailwind theme extension: custom primary colour (#FE5F00), Poppins font, HeroUI plugin, shine animation"],
        ["tsconfig.json / tsconfig.node.json", "TypeScript compiler options"],
        ["eslint.config.mjs", "ESLint rules (React, hooks, a11y, import, prettier)"],
        ["postcss.config.js", "PostCSS config for Tailwind"],
        ["vercel.json", "Vercel deployment config (SPA rewrites)"],
        [".npmrc", "npm registry settings"],
        ["package.json", "Project metadata, scripts, and all dependencies"],
        ["DOCUMENTATION.doc", "Legacy/placeholder documentation file"],
        ["Tapmind.ico / favicon.ico", "Application icons"],
    ]
)

add_heading("2.2 src/ Directory", 2)
add_header_table(
    ["Path", "Responsibility"],
    [
        ["src/main.tsx", "React DOM root; wraps App in BrowserRouter + Provider (HeroUI + Toast)"],
        ["src/App.tsx", "Route definitions; public routes (/, /logout, /passwordHandler) and protected routes under ProtectedLayout"],
        ["src/provider.tsx", "HeroUIProvider + ToastProvider wrapper; wires React Router navigation into HeroUI"],
        ["src/bg.tsx", "DarkVeil WebGL background component using OGL; renders animated noise/scanline effect on login page"],
        ["src/Aurora.css", "CSS for aurora/glow animation effects"],
        ["src/styles/globals.css", "Global CSS resets and Tailwind base imports"],
        ["src/vite-env.d.ts", "Vite environment type declarations"],
        ["src/config/site.ts", "Static site configuration (nav items, links) — legacy scaffold, not actively used in routing"],
        ["src/types/index.ts", "Shared TypeScript types (IconSvgProps)"],
        ["src/pages/", "One file per application page/screen"],
        ["src/components/", "Reusable UI components shared across pages"],
        ["src/layouts/", "Layout wrappers (currently empty/minimal)"],
    ]
)

add_heading("2.3 Key Dependencies Overview", 2)
add_header_table(
    ["Package", "Role"],
    [
        ["@heroui/react", "Full UI component library (Button, Modal, Table, Input, Select, Tabs, Drawer, etc.)"],
        ["react-router-dom", "Client-side routing and navigation"],
        ["axios", "HTTP requests to backend API"],
        ["apexcharts / react-apexcharts", "Radial bar and column charts on Dashboard"],
        ["framer-motion", "Animated bar chart tooltips and transitions"],
        ["date-fns", "Date formatting throughout the app"],
        ["moment", "Date arithmetic in CustomDateRangePicker"],
        ["ogl", "WebGL renderer for login page background animation"],
        ["query-string", "URL query parameter parsing (password reset token)"],
        ["react-day-picker", "Calendar UI in custom date range picker"],
        ["tailwind-variants (tv)", "Variant-based Tailwind class composition (primitives.ts)"],
        ["clsx", "Conditional class name utility"],
    ]
)

page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 3 – PAGE-LEVEL DOCUMENTATION
# ══════════════════════════════════════════════════════════════════════════════
add_heading("3. Page-Level Documentation", 1, ORANGE)

# ── 3.1 Login Page ────────────────────────────────────────────────────────────
add_heading("3.1 Login Page", 2)
add_info_table([
    ("File",        "src/pages/index.tsx"),
    ("Route",       "/  (public)"),
    ("Purpose",     "Entry point for unauthenticated users. Handles login and forgot-password flows."),
    ("Background",  "DarkVeil WebGL animated background rendered behind the card"),
])
add_heading("UI Components", 3)
add_bullet("HeroUI Card, CardHeader, CardBody")
add_bullet("HeroUI Input (email, password with eye-toggle)")
add_bullet("HeroUI Button (loading state during API call)")
add_bullet("EyeFilledIcon / EyeSlashFilledIcon for password visibility toggle")
add_bullet("title() primitive for styled heading")

add_heading("API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/authenticate", "Login — sends {username, password}; receives JWT token + user profile"],
        ["POST", "/t2.0/authentificationUtilization/forgotPassword", "Forgot password — sends {email}; triggers reset email"],
    ]
)

add_heading("State", 3)
add_bullet("email, password — controlled form inputs")
add_bullet("isVisible — toggles password field type")
add_bullet("isLoading — disables button and shows spinner")
add_bullet("isForgot — switches between login and forgot-password views")
add_bullet("forgetEmail — email input for forgot-password flow")

add_heading("User Interactions", 3)
add_bullet("Submit login form → POST authenticate → store authUserLD in localStorage → navigate to /dashboard")
add_bullet("Click 'Forgot password?' → toggle isForgot → show email input")
add_bullet("Submit forgot-password form → POST forgotPassword → show success toast")
add_bullet("Click 'Back to Login' → toggle isForgot back")

add_heading("Edge Cases", 3)
add_bullet("If authUserLD already exists in localStorage on mount → redirect to /dashboard (prevents re-login)")
add_bullet("Empty forgetEmail → warning toast before API call")
add_bullet("API error → danger toast with message")
add_bullet("900ms artificial delay after successful login for UX smoothness")

doc.add_paragraph()

# ── 3.2 Dashboard ─────────────────────────────────────────────────────────────
add_heading("3.2 Dashboard Page", 2)
add_info_table([
    ("File",    "src/pages/dashboard.tsx"),
    ("Route",   "/dashboard  (protected)"),
    ("Purpose", "Central analytics hub. Displays company-wide, department, EL/FL, and individual user performance summaries with radial charts and bar charts."),
    ("Access",  "All authenticated roles; data scope varies by role"),
])
add_heading("UI Components", 3)
add_bullet("HeroUI Card, Tabs, Tab, Drawer, Autocomplete, Dropdown")
add_bullet("ReactApexChart (radialBar) — lazy loaded via React.lazy/Suspense")
add_bullet("Custom ColumnChart — animated bar chart with Framer Motion tooltips")
add_bullet("EfficiencyTable (table2.tsx) — tabular efficiency data")
add_bullet("CustomDateRangePicker — date range selector")
add_bullet("EmptyContainer — shown when no data available")
add_bullet("Memoised sub-components: StatRow, IconSet, EfficiencyRules, LeaderSummaryGrid, RadialBarSkeleton")

add_heading("API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/DashBoardAll", "Fetch all dashboard summary data (company, department, EL, FL, user summaries)"],
        ["POST", "/t2.0/authentificationUtilization/Department/list", "Fetch department list for filter dropdown"],
        ["POST", "/t2.0/authentificationUtilization/users/read", "Fetch EL/FL user lists for filter dropdowns"],
    ]
)

add_heading("State (via useDashboardData custom hook)", 3)
add_bullet("companySummary — overall company KPIs")
add_bullet("departmentSummary — per-department KPIs")
add_bullet("ELSummary / FLSummary — Executive/Functional Leader summaries")
add_bullet("userSummary / userSummaryData — individual user KPIs")
add_bullet("ELUserSummary / FLUserSummary — users under each EL/FL")
add_bullet("dateRange — selected date range (default: last 7 days)")
add_bullet("selectedDepartment, elFilter, flFilter — filter states")
add_bullet("loading — controls skeleton/spinner display")

add_heading("Role-Based Data Scope", 3)
add_header_table(
    ["Role ID", "Role", "Dashboard View"],
    [
        ["1", "Admin", "Full company view: company summary, all departments, all EL/FL, all users"],
        ["2", "User (Employee)", "Personal summary only; own daily data chart"],
        ["3", "Executive Leader (EL)", "Own EL summary + departments and users under them"],
        ["4", "Functional Leader (FL)", "Own FL summary + departments and users under them"],
    ]
)

add_heading("Key Features", 3)
add_bullet("Radial bar charts showing Target %, Utilization %, Allocated Hrs, Work Hrs, Goal Efficiency")
add_bullet("Custom animated column chart for department/user bar comparisons")
add_bullet("Efficiency Rules panel explaining High/At Par/Low calculation logic")
add_bullet("Drawer panel for viewing detailed activity logs")
add_bullet("AbortController used to cancel in-flight API requests on re-render")
add_bullet("All derived/filtered data computed with useMemo — no redundant useEffect chains")

doc.add_paragraph()

# ── 3.3 Department Form (Data Entry) ─────────────────────────────────────────
add_heading("3.3 Department Form / Data Entry Page", 2)
add_info_table([
    ("File",    "src/pages/forms.tsx"),
    ("Route",   "/department-forms  (protected)"),
    ("Purpose", "Daily data entry form for employees. Allows logging tasks, targets, and goals for the day. Embeds the DailyActivityLog component."),
    ("Access",  "All authenticated users"),
])
add_heading("UI Components", 3)
add_bullet("HeroUI Autocomplete — department filter (hidden for users with a fixed departmentID)")
add_bullet("DailyActivityLog component — full form for logging activities")
add_bullet("EmptyContainer — shown when no department is selected")

add_heading("API Calls", 3)
add_bullet("POST /t2.0/authentificationUtilization/users/read — fetch users list")
add_bullet("POST /t2.0/authentificationUtilization/Department/list — fetch departments")
add_bullet("POST /t2.0/authentificationUtilization/departmentTasks/getTasksByDepartment — fetch tasks for selected department")
add_bullet("POST /t2.0/authentificationUtilization/departmentTasks/list — fetch all tasks")

add_heading("Logic", 3)
add_bullet("If user has departmentID in their profile, auto-selects their department")
add_bullet("Role 4 (FL) users see only their assigned departments")
add_bullet("Passes taskList and DeptId as props to DailyActivityLog")

doc.add_paragraph()

# ── 3.4 Activity Log ──────────────────────────────────────────────────────────
add_heading("3.4 Activity Log Page", 2)
add_info_table([
    ("File",    "src/pages/activity-log.tsx"),
    ("Route",   "/activity-log  (protected)"),
    ("Purpose", "Thin wrapper that renders the DailyActivityLog component in a full-page layout."),
    ("Access",  "All authenticated users"),
])
add_bullet("Renders DailyActivityLog without pre-filtering (no task/dept props passed)")
add_bullet("Used as a standalone activity log viewer")

doc.add_paragraph()

# ── 3.5 Daily Logs ────────────────────────────────────────────────────────────
add_heading("3.5 Daily Logs Page", 2)
add_info_table([
    ("File",    "src/pages/dailyLogs.tsx"),
    ("Route",   "/daily-log  (protected)"),
    ("Purpose", "View and filter submitted daily task/target logs. Shows summary stats and a paginated data table."),
    ("Access",  "All roles; data scope varies"),
])
add_heading("UI Components", 3)
add_bullet("ReusableTable — paginated, searchable, sortable log table")
add_bullet("CustomDateRangePicker — date range filter in a Dropdown")
add_bullet("HeroUI Autocomplete — filters for Type (Task/Target), EL, Department, Task/Target, User")
add_bullet("HeroUI Chip — special display for FULL DAY LEAVE entries")
add_bullet("Summary bar — shows total working hours and allocated hours")

add_heading("API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/Department/list", "Fetch departments for filter"],
        ["GET",  "/t2.0/authentificationUtilization/Department/taskTarget/{deptId}", "Fetch combined task+target list for a department"],
        ["POST", "/t2.0/authentificationUtilization/users/read", "Fetch users for filter"],
        ["POST", "/t2.0/authentificationUtilization/form/list", "Fetch paginated daily log entries"],
    ]
)

add_heading("Dynamic Columns", 3)
add_bullet("Task mode: shows Allocated Time and User Time Taken columns")
add_bullet("Target mode: shows Target Units, Achieved Units, Target Percentage columns")
add_bullet("isTarget state (null=All, true=Target, false=Task) controls column set")

doc.add_paragraph()

# ── 3.6 Performance Insights (Efficiency) ────────────────────────────────────
add_heading("3.6 Performance Insights Page", 2)
add_info_table([
    ("File",    "src/pages/efficiency.tsx"),
    ("Route",   "/efficiency-report  (protected)"),
    ("Purpose", "Detailed efficiency and utilisation analytics. Shows summary KPIs and a detailed efficiency table. Supports Excel download."),
    ("Access",  "All roles; Admin sees filter panel"),
])
add_heading("UI Components", 3)
add_bullet("EfficiencyTable (table2.tsx) — efficiency data table with progress bars")
add_bullet("CustomDateRangePicker — date range selector")
add_bullet("HeroUI Dropdown with Autocomplete filters (Department, User, Efficiency Level)")
add_bullet("Summary bar — Avg Working Hrs, Avg Allocated Hrs, Avg Utilization %, Avg Target %, Efficiency Level")
add_bullet("HeroUI Tabs — EL users see per-department tabs")

add_heading("API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/Department/list", "Departments for filter"],
        ["POST", "/t2.0/authentificationUtilization/users/read", "Users for filter"],
        ["POST", "/t2.0/authentificationUtilization/list-efficiency-summary", "Fetch efficiency summary data"],
        ["POST", "/t2.0/authentificationUtilization/download-efficiency-summary", "Download Excel report (blob response)"],
    ]
)

add_heading("Download Feature", 3)
add_bullet("Calls download-efficiency-summary with responseType: 'blob'")
add_bullet("Creates a temporary anchor element to trigger browser download")
add_bullet("File saved as Efficiency-Summary.xlsx")

doc.add_paragraph()

# ── 3.7 Department Management ─────────────────────────────────────────────────
add_heading("3.7 Department Management Page", 2)
add_info_table([
    ("File",    "src/pages/department.tsx"),
    ("Route",   "/department  (admin only)"),
    ("Purpose", "CRUD management for company departments. Admins can create, edit, delete, activate/deactivate departments and assign Executive/Functional Leaders."),
    ("Access",  "Admin (userRole === 1) only"),
])
add_heading("UI Components", 3)
add_bullet("Department cards grid (responsive 1-4 columns)")
add_bullet("HeroUI Dropdown (⋮ menu) per card — Edit, Delete, Activate/Deactivate")
add_bullet("HeroUI Modal — Add/Edit department form")
add_bullet("HeroUI Modal — Delete confirmation")
add_bullet("HeroUI Modal — Activate/Deactivate confirmation")
add_bullet("HeroUI Select — Executive Leader and Functional Leader dropdowns")

add_heading("API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/users/read", "Fetch all users for leader dropdowns"],
        ["POST", "/t2.0/authentificationUtilization/Department/list", "Fetch department list"],
        ["POST", "/t2.0/authentificationUtilization/Department/create", "Create new department"],
        ["POST", "/t2.0/authentificationUtilization/Department/update/{id}", "Update department"],
        ["POST", "/t2.0/authentificationUtilization/Department/archive", "Soft-delete (archive) department"],
        ["PUT",  "/t2.0/authentificationUtilization/Department/status", "Toggle department active/inactive status"],
    ]
)

add_heading("State", 3)
add_bullet("departmentList — list of departments from API")
add_bullet("department, departmentDescription — form inputs")
add_bullet("executiveLeader, functionalLeader — selected leader IDs")
add_bullet("edit — boolean flag for edit vs create mode")
add_bullet("deleteConfirm, toggleConfirm — confirmation modal state objects")
add_bullet("selectedDepartmentId — ID of department being edited")

doc.add_paragraph()

# ── 3.8 Task Management ───────────────────────────────────────────────────────
add_heading("3.8 Task Management Page", 2)
add_info_table([
    ("File",    "src/pages/TaskManagement.tsx"),
    ("Route",   "/tasks  (admin only)"),
    ("Purpose", "Full CRUD for department tasks. Supports pagination, search, frequency/status filtering, and activate/deactivate actions."),
    ("Access",  "Admin only"),
])
add_heading("UI Components", 3)
add_bullet("ReusableTable — paginated, searchable, filterable task table")
add_bullet("HeroUI Modal — Add/Edit task form")
add_bullet("HeroUI Modal — Activate/Deactivate confirmation")
add_bullet("Bulk action bar — appears when rows are selected")

add_heading("API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/Department/list", "Departments for task form dropdown"],
        ["POST", "/t2.0/authentificationUtilization/departmentTasks/list?page=N&size=N", "Paginated task list"],
        ["POST", "/t2.0/authentificationUtilization/departmentTasks/create", "Create task"],
        ["PUT",  "/t2.0/authentificationUtilization/departmentTasks/update/{id}", "Update task"],
        ["PUT",  "/t2.0/authentificationUtilization/departmentTasks/{id}/status?isActive=bool", "Toggle task status"],
    ]
)

add_heading("Task Form Fields", 3)
add_bullet("Task Name, Description, Department (Select), Task Type (Select — 35+ options)")
add_bullet("Standard Time (mins), Frequency (Daily/Weekly/Monthly/Dynamic/Not Daily)")
add_bullet("Is Dynamic (Yes/No)")

doc.add_paragraph()

# ── 3.9 Target Management ─────────────────────────────────────────────────────
add_heading("3.9 Target Management Page", 2)
add_info_table([
    ("File",    "src/pages/targetManagement.tsx"),
    ("Route",   "/target  (admin only)"),
    ("Purpose", "CRUD management for department performance targets. Targets define measurable KPIs per department."),
    ("Access",  "Admin only"),
])
add_heading("API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/departmentTargets/list", "Paginated target list"],
        ["POST", "/t2.0/authentificationUtilization/departmentTargets/create", "Create target"],
        ["PUT",  "/t2.0/authentificationUtilization/departmentTargets/update/{id}", "Update target"],
        ["PUT",  "/t2.0/authentificationUtilization/departmentTargets/{id}/status", "Toggle target status"],
    ]
)
add_heading("Target Form Fields", 3)
add_bullet("Department (Autocomplete), Target Name, Target Metric, Metric Value, Unit (number)")
add_bullet("Frequency (Daily/Weekly/Monthly), Timing Type (Ongoing/Fixed)")
add_bullet("Is Dynamic (Yes/No), Description (Textarea)")

doc.add_paragraph()

# ── 3.10 Goal Management ──────────────────────────────────────────────────────
add_heading("3.10 Goal Management Page", 2)
add_info_table([
    ("File",    "src/pages/goalManagement.tsx"),
    ("Route",   "/Goal-management  (admin or Tech dept)"),
    ("Purpose", "CRUD management for department goals. Goals are higher-level KPIs tracked separately from tasks/targets."),
    ("Access",  "Admin or Tech department users"),
])
add_heading("API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/departmentGoals/list", "Paginated goal list"],
        ["POST", "/t2.0/authentificationUtilization/departmentGoals/create", "Create goal"],
        ["PUT",  "/t2.0/authentificationUtilization/departmentGoals/update/{id}", "Update goal"],
        ["PUT",  "/t2.0/authentificationUtilization/departmentGoals/{id}/status", "Toggle goal status"],
    ]
)
add_heading("Goal Form Fields", 3)
add_bullet("Department (Autocomplete), Goal Name, Goal Metric, Metric Value, Unit")
add_bullet("Frequency (Daily/Weekly/Monthly/Quarterly)")
add_bullet("Live Accounts field — conditionally shown only for department ID 12")

doc.add_paragraph()

# ── 3.11 Goals Report ─────────────────────────────────────────────────────────
add_heading("3.11 Goals Report Page", 2)
add_info_table([
    ("File",    "src/pages/goals.tsx"),
    ("Route",   "/goals  (protected)"),
    ("Purpose", "View goal achievement data per user/department over a date range. Shows fixed goal vs achieved goal with percentage."),
    ("Access",  "All roles; data scope varies"),
])
add_heading("Special Logic", 3)
add_bullet("Department 7 (TAT dept): fetches from list-efficiency-summary instead of userGoalData/list")
add_bullet("Department 21: shows recalculatedTarget instead of fixedGoal")
add_bullet("Department 37: custom goalEfficiencyPercent calculation")
add_bullet("Colour-coded goal percentage: green ≥85%, yellow ≥60%, red <60%")

add_heading("API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/userGoalData/list", "Fetch goal achievement records"],
        ["POST", "/t2.0/authentificationUtilization/list-efficiency-summary", "Used for dept 7 (TAT) goal data"],
        ["POST", "/t2.0/authentificationUtilization/Department/list", "Departments for filter"],
        ["POST", "/t2.0/authentificationUtilization/users/read", "Users for filter"],
    ]
)

doc.add_paragraph()

# ── 3.12 Access Management ────────────────────────────────────────────────────
add_heading("3.12 Access Management Page", 2)
add_info_table([
    ("File",    "src/pages/access-management.tsx"),
    ("Route",   "/access-management  (admin only)"),
    ("Purpose", "User management: create, edit, delete users; assign roles (EL/FL/User) and departments; activate/deactivate accounts."),
    ("Access",  "Admin only"),
])
add_heading("UI Components", 3)
add_bullet("ReusableTable — paginated user list with role/status colour badges")
add_bullet("HeroUI Modal — Add/Edit user form")
add_bullet("HeroUI Modal — Delete confirmation")
add_bullet("HeroUI Modal — Activate/Deactivate confirmation")
add_bullet("Bulk action bar — activate/deactivate selected user")

add_heading("API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/users/read", "Paginated user list with role/status filter"],
        ["POST", "/t2.0/authentificationUtilization/User/create", "Create new user"],
        ["PUT",  "/t2.0/authentificationUtilization/User/update", "Update user details"],
        ["POST", "/t2.0/authentificationUtilization/usersArchive", "Archive/delete user"],
        ["POST", "/t2.0/authentificationUtilization/updateUserStatus", "Activate or deactivate user"],
        ["POST", "/t2.0/authentificationUtilization/Department/list", "Departments for user form"],
    ]
)

add_heading("Role Map", 3)
add_header_table(
    ["Role ID", "Label", "Description"],
    [
        ["1", "Admin", "Full system access (not assignable via UI)"],
        ["2", "User", "Standard employee — can log daily activities"],
        ["3", "EL", "Executive Leader — manages multiple departments"],
        ["4", "FL", "Functional Leader — manages specific departments"],
    ]
)

doc.add_paragraph()

# ── 3.13 Reports Page ─────────────────────────────────────────────────────────
add_heading("3.13 Reports Page", 2)
add_info_table([
    ("File",    "src/pages/reports.tsx"),
    ("Route",   "/reports  (protected — appears unused in sidebar)"),
    ("Purpose", "Legacy daily task log report viewer with department/user/date filters. Superseded by Daily Logs page."),
    ("Note",    "This page is not linked in the current sidebar navigation. It may be a legacy or in-development page."),
])

doc.add_paragraph()

# ── 3.14 Sales Forward ────────────────────────────────────────────────────────
add_heading("3.14 Sales Forward Page", 2)
add_info_table([
    ("File",    "src/pages/salesForward.tsx"),
    ("Route",   "/sales-forward  (Sales dept only: deptID 5, 6, 9, 21)"),
    ("Purpose", "Sales call management. View scheduled calls, update status (Scheduled/Completed/No Show/Rescheduled/Cancelled), reschedule with reason, and view reschedule logs."),
    ("Access",  "Users in Sales departments only"),
])
add_heading("API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/sales/calls/list", "Paginated sales call list for current user"],
        ["POST", "/t2.0/authentificationUtilization/sales/calls/update-status", "Update call status"],
        ["POST", "/t2.0/authentificationUtilization/sales/calls/reschedule", "Reschedule a call with new datetime and reason"],
    ]
)
add_heading("Key Features", 3)
add_bullet("Status colour-coded dots (purple=Scheduled, green=Completed, red=Cancelled, etc.)")
add_bullet("Reschedule Logs dropdown per row — shows history of reschedules")
add_bullet("HeroUI DatePicker with timezone-aware parsing for scheduling")
add_bullet("Validation: cancellation statuses require a reason field")
add_bullet("Data filtered client-side to show only current user's calls")

doc.add_paragraph()

# ── 3.15 Sprint Planner ───────────────────────────────────────────────────────
add_heading("3.15 Sprint Planner Page", 2)
add_info_table([
    ("File",    "src/pages/sprint-planner.tsx"),
    ("Route",   "/sprint-planner  (Tech dept only: deptID 24)"),
    ("Purpose", "Create and view development sprints. Displays sprint cards with status, story points, and date range."),
    ("Access",  "Tech department users only"),
])
add_heading("API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/tech/list", "Fetch all sprints"],
        ["POST", "/t2.0/authentificationUtilization/tech/sprint", "Create new sprint"],
    ]
)
add_heading("Sprint Form Fields", 3)
add_bullet("Sprint Name, Project ID, Sprint Duration (DateRangePicker), Planned Points")

doc.add_paragraph()

# ── 3.16 Story Planner ────────────────────────────────────────────────────────
add_heading("3.16 Story Planner Page", 2)
add_info_table([
    ("File",    "src/pages/story-planner.tsx"),
    ("Route",   "/story-points  (admin or Tech dept)"),
    ("Purpose", "3-step sprint planning wizard: (1) Assign team members, (2) Add backlog stories with points, (3) Assign stories to team members."),
    ("Access",  "Admin or Tech department users"),
])
add_heading("3-Step Workflow", 3)
add_bullet("Step 1 — Select sprint → search and add team members → confirm team assignment")
add_bullet("Step 2 — Add story keys (e.g. TECH-201) with story points → view capacity bar → submit stories")
add_bullet("Step 3 — Assign each story to a team member with points worked")

add_heading("API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/tech/list", "Fetch sprints"],
        ["POST", "/t2.0/authentificationUtilization/users/read", "Fetch Tech dept users"],
        ["POST", "/t2.0/authentificationUtilization/tech/sprint/{id}/users", "Assign team members to sprint"],
        ["POST", "/t2.0/authentificationUtilization/tech/story", "Submit backlog stories"],
        ["POST", "/t2.0/authentificationUtilization/tech/story/{sprintId}/assign/{userId}", "Assign story to user"],
    ]
)

doc.add_paragraph()

# ── 3.17 Password Reset ───────────────────────────────────────────────────────
add_heading("3.17 Password Reset Page", 2)
add_info_table([
    ("File",    "src/pages/forgotPassword.tsx"),
    ("Route",   "/passwordHandler  (public)"),
    ("Purpose", "Allows users to set a new password using a reset token from email link. Validates password strength in real-time."),
])
add_heading("Password Validation Rules", 3)
add_bullet("Minimum 8 characters")
add_bullet("Contains at least one number")
add_bullet("Contains uppercase letter")
add_bullet("Contains lowercase letter")
add_bullet("Contains special symbol")
add_para("Each rule shows a green ✔ or red ✖ indicator in real-time as the user types.")

add_heading("API Calls", 3)
add_bullet("POST /t2.0/authentificationUtilization/resetPassword — sends {password, token} where token is parsed from URL query string")

doc.add_paragraph()

# ── 3.18 Logout ───────────────────────────────────────────────────────────────
add_heading("3.18 Logout Page", 2)
add_info_table([
    ("File",    "src/pages/logout.tsx"),
    ("Route",   "/logout  (public)"),
    ("Purpose", "Clears localStorage auth token and redirects to login. Shows a spinner during the 200ms transition."),
])
add_bullet("Uses setTimeout(200ms) to allow spinner animation before redirect")
add_bullet("Removes authUserLD from localStorage")
add_bullet("Redirects to / via window.location.href")

page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 4 – COMPONENT DOCUMENTATION
# ══════════════════════════════════════════════════════════════════════════════
add_heading("4. Component Documentation", 1, ORANGE)

# ── 4.1 Layout ────────────────────────────────────────────────────────────────
add_heading("4.1 Layout", 2)
add_info_table([
    ("File",        "src/components/layout.tsx"),
    ("Purpose",     "Main application shell for all protected pages. Renders Sidebar + Topbar + scrollable content area."),
    ("Used In",     "App.tsx via ProtectedLayout wrapper"),
])
add_heading("Structure", 3)
add_bullet("Full-height flex container (h-screen, overflow-hidden)")
add_bullet("Left: Sidebar (fixed width, scrollable)")
add_bullet("Right: Topbar (fixed 64px height) + main content (flex-1, overflow-y-auto, p-6)")
add_bullet("Uses useLocation() to pass currentPage to Sidebar for active link highlighting")

doc.add_paragraph()

# ── 4.2 Sidebar ───────────────────────────────────────────────────────────────
add_heading("4.2 Sidebar", 2)
add_info_table([
    ("File",    "src/components/sidebar.tsx"),
    ("Props",   "isOpen: boolean, toggleSidebar: () => void, currentPage?: string"),
    ("Purpose", "Navigation sidebar with role-based menu filtering, collapsible sub-menus, and active link highlighting."),
])
add_heading("Menu Structure", 3)
add_header_table(
    ["Menu Item", "Route", "Role Restriction"],
    [
        ["Dashboard", "/dashboard", "All"],
        ["Data Entry / Department & Forms", "/department-forms", "All"],
        ["Reports > Performance Insights", "/efficiency-report", "All"],
        ["Reports > My Data / User Data", "/daily-log", "All"],
        ["Reports > Goals / Goals Achieved", "/goals", "All"],
        ["Sales Forward", "/sales-forward", "Sales depts (5,6,9,21)"],
        ["Admin > Access Management", "/access-management", "Admin"],
        ["Admin > Department Management", "/department", "Admin"],
        ["Admin > Task Management", "/tasks", "Admin"],
        ["Admin > Target Management", "/target", "Admin"],
        ["Admin > Goal Management", "/Goal-management", "Admin"],
    ]
)
add_heading("Key Behaviours", 3)
add_bullet("Reads authUserLD from localStorage on mount and on storage events (cross-tab sync)")
add_bullet("Collapsible parent menus — only one expanded at a time (accordion behaviour)")
add_bullet("Active page highlighted with orange-50 background and orange-600 text")
add_bullet("Mobile: overlay + slide-in drawer; Desktop: always visible static sidebar")
add_bullet("Logo click navigates to /dashboard")

doc.add_paragraph()

# ── 4.3 Topbar ────────────────────────────────────────────────────────────────
add_heading("4.3 Topbar", 2)
add_info_table([
    ("File",    "src/components/topbar.tsx"),
    ("Props",   "toggleSidebar: () => void, title: string"),
    ("Purpose", "Top navigation bar showing user name, department, avatar, and logout dropdown."),
])
add_bullet("Hamburger menu button (mobile only) to toggle sidebar")
add_bullet("User name and department name displayed (department name has camelCase spacing applied)")
add_bullet("HeroUI Avatar with hover ring effect")
add_bullet("Dropdown: Profile (disabled) + Logout (navigates to /logout)")

doc.add_paragraph()

# ── 4.4 ProtectedRoute ────────────────────────────────────────────────────────
add_heading("4.4 ProtectedRoute", 2)
add_info_table([
    ("File",    "src/components/protectedRoute.tsx"),
    ("Purpose", "Route guard component. Redirects unauthenticated users to login and enforces role/department-based access."),
])
add_heading("Props", 3)
add_header_table(
    ["Prop", "Type", "Description"],
    [
        ["children", "JSX.Element (optional)", "Child component to render if access granted"],
        ["adminOnly", "boolean", "Restricts to userRole === 1 (Admin)"],
        ["salesOnly", "boolean", "Restricts to departmentID === 21"],
        ["HrOnly", "boolean", "Restricts to departmentID === 22"],
        ["TechOnly", "boolean", "Restricts to departmentID === 24"],
        ["adminOrTech", "boolean", "Allows Admin OR Tech dept users"],
    ]
)
add_heading("Logic Flow", 3)
add_bullet("No authUserLD in localStorage → redirect to /")
add_bullet("adminOrTech: checks userRole===1 OR departmentID===24")
add_bullet("adminOnly: checks userRole===1")
add_bullet("salesOnly/HrOnly/TechOnly: checks specific departmentID")
add_bullet("If children provided → render children; otherwise render <Outlet /> for nested routes")

doc.add_paragraph()

# ── 4.5 ReusableTable ─────────────────────────────────────────────────────────
add_heading("4.5 ReusableTable (table.tsx)", 2)
add_info_table([
    ("File",        "src/components/table.tsx"),
    ("Purpose",     "Highly configurable data table used across all management pages. Supports search, filter, sort, pagination, row selection, and custom cell rendering."),
    ("Used In",     "TaskManagement, TargetManagement, GoalManagement, AccessManagement, DailyLogs, Reports, SalesForward"),
])
add_heading("Key Props", 3)
add_header_table(
    ["Prop", "Type", "Description"],
    [
        ["data", "any[]", "Array of data objects to display"],
        ["columns", "TableColumn[]", "Column definitions with key, label, sortable, width, renderCell"],
        ["actions", "TableAction[]", "Row action buttons shown in a ⋮ dropdown"],
        ["totalRecords", "number", "Total record count for server-side pagination"],
        ["searchable", "boolean", "Show search input"],
        ["filterable", "boolean", "Show filter dropdowns"],
        ["filterOptions", "array", "Filter dropdown definitions with options"],
        ["selectable", "boolean", "Enable row checkboxes"],
        ["paginated", "boolean", "Show pagination controls"],
        ["onPageChange", "function", "Callback when page changes"],
        ["onRowsPerPageChange", "function", "Callback when rows-per-page changes"],
        ["onSearchChangeProp", "function", "Callback when search text changes"],
        ["onSelectionChange", "function", "Callback with full row data of selected rows"],
        ["getRowId", "function", "Function to extract unique row ID"],
        ["renderCell", "function", "Custom cell renderer override"],
    ]
)
add_heading("Built-in Cell Rendering", 3)
add_bullet("Boolean values → HeroUI Chip (success=active, danger=inactive)")
add_bullet("Status/active fields → colour-coded Chip")
add_bullet("Actions column → VerticalDotsIcon dropdown with action items")
add_bullet("Custom renderCell per column via column.renderCell property")

doc.add_paragraph()

# ── 4.6 EfficiencyTable ───────────────────────────────────────────────────────
add_heading("4.6 EfficiencyTable (table2.tsx)", 2)
add_info_table([
    ("File",    "src/components/table2.tsx"),
    ("Purpose", "Specialised efficiency report table with multiple column sets based on data type. Shows utilisation progress bars and colour-coded efficiency chips."),
    ("Props",   "data: any[], type: 'user' | 'department' | 'EL' | 'ELU' | 'goal'"),
    ("Used In", "Dashboard, Efficiency page"),
])
add_heading("Column Sets by Type", 3)
add_header_table(
    ["Type", "Columns Shown"],
    [
        ["user", "UserID, WorkDate, Target%, Utilization%, Allocated Hrs, Total Work Hrs, Efficiency Level"],
        ["department", "DeptID, DeptName, Avg Target%, Avg Utilization%, Avg Allocated Hrs, Avg Work Hrs, Efficiency, Avg Goal"],
        ["EL", "ELID, ELName, Avg Target%, Avg Utilization%, Avg Allocated Hrs, Avg Work Hrs, Efficiency, Avg Goal"],
        ["ELU", "UserID, UserName, Avg Target%, Avg Utilization%, Avg Allocated Hrs, Avg Work Hrs, Efficiency"],
        ["goal", "goalID, userID, workDate, departmentID, fixedGoal, achievedGoal"],
    ]
)

doc.add_paragraph()

# ── 4.7 DailyActivityLog ──────────────────────────────────────────────────────
add_heading("4.7 DailyActivityLog", 2)
add_info_table([
    ("File",    "src/components/DailyActivityLog.tsx"),
    ("Props",   "task: Task[], DeptId: number"),
    ("Purpose", "Core data entry form. Allows employees to log daily tasks, targets, and goals. Handles special department flows (Sales, HR/TA, PR tracking)."),
    ("Used In", "forms.tsx, activity-log.tsx"),
])
add_heading("Entry Types", 3)
add_bullet("TASK — log time spent on a department task (allocated time + time taken)")
add_bullet("TARGET — log target achievement (percentage/units achieved)")
add_bullet("GOAL — log goal achievement (achieved units vs fixed goal)")

add_heading("Special Department Flows", 3)
add_header_table(
    ["Dept ID(s)", "Special Behaviour"],
    [
        ["5, 6, 9, 36", "Sales departments: shows Sales Call scheduling modal (publisher, sales person, datetime, status)"],
        ["22", "HR/TA department: shows TA (Talent Acquisition) tracking modal"],
        ["14, 32, 31", "Uses monthly-targets/today API for target fetching instead of standard endpoint"],
        ["18", "Goal achieved units stored as string (not number) for special calculation"],
    ]
)
add_heading("Key API Calls", 3)
add_header_table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["POST", "/t2.0/authentificationUtilization/monthly-targets/today/{deptId}", "Special dept target fetch"],
        ["POST", "/t2.0/authentificationUtilization/departmentTargets/getTargetsByDepartment", "Standard target fetch"],
        ["POST", "/t2.0/authentificationUtilization/departmentGoals/getGoalsByDepartment", "Goal fetch for GOAL entry step"],
        ["POST", "/t2.0/authentificationUtilization/form/bulkWork", "Submit all activity entries in bulk"],
        ["POST", "/t2.0/authentificationUtilization/sales/calls/list", "Fetch sales calls (Sales depts)"],
        ["GET",  "/t2.0/authentificationUtilization/positions/list", "Fetch JD positions (HR dept)"],
    ]
)

doc.add_paragraph()

# ── 4.8 CustomDateRangePicker ─────────────────────────────────────────────────
add_heading("4.8 CustomDateRangePicker", 2)
add_info_table([
    ("File",    "src/components/CustomDateRangePicker.tsx"),
    ("Props",   "value: {startDate, endDate}, onChange: (range) => void  OR  datePick callback"),
    ("Purpose", "Date range picker with preset options (Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month) and a custom calendar picker."),
    ("Used In", "Dashboard, DailyLogs, Efficiency, Goals pages"),
])
add_bullet("Uses moment.js for date arithmetic")
add_bullet("Business-day aware: adjusts default range based on time of day (before/after 10:30 AM)")
add_bullet("Custom range via HeroUI DateRangePicker embedded in Popover")

doc.add_paragraph()

# ── 4.9 EmptyContainer & EmptyState ──────────────────────────────────────────
add_heading("4.9 EmptyContainer & EmptyState", 2)
add_info_table([
    ("Files",   "src/components/EmptyContainer.tsx, EmptyState.tsx"),
    ("Purpose", "Placeholder UI shown when no data is available. EmptyContainer is simpler; EmptyState supports action buttons and size variants."),
    ("Used In", "Department page, Forms page, various tables"),
])
add_bullet("EmptyContainer: floating icon decorations + title + description")
add_bullet("EmptyState: adds animated floating icons, size variants (sm/md/lg), optional action button")
add_bullet("Preset exports: EmptySearchState, EmptyDataState, EmptyProjectsState")

doc.add_paragraph()

# ── 4.10 primitives.ts ────────────────────────────────────────────────────────
add_heading("4.10 primitives.ts", 2)
add_info_table([
    ("File",    "src/components/primitives.ts"),
    ("Purpose", "Tailwind Variants (tv) utility for consistent heading and subtitle styling across pages."),
])
add_bullet("title() — variants: color (gradient options), size (sm/md/lg), fullWidth")
add_bullet("subtitle() — responsive subtitle text with optional fullWidth")
add_bullet("Used in every page for the page title heading")

page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 5 – FEATURE BREAKDOWN
# ══════════════════════════════════════════════════════════════════════════════
add_heading("5. Feature Breakdown", 1, ORANGE)

add_heading("5.1 Authentication", 2)
add_bullet("JWT-based authentication via POST /authenticate")
add_bullet("Token + full user profile stored in localStorage as authUserLD (JSON)")
add_bullet("Auto-redirect to /dashboard if token exists on login page load")
add_bullet("Forgot password flow: email → reset link → /passwordHandler?token=xxx → new password")
add_bullet("Password strength validation: length, numbers, uppercase, lowercase, symbols")
add_bullet("Logout: clears localStorage, redirects to /")
add_bullet("Session persistence: no expiry logic in frontend — token validity managed by backend")

add_heading("5.2 Role-Based Access Control (RBAC)", 2)
add_header_table(
    ["Feature", "Admin (1)", "EL (3)", "FL (4)", "User (2)"],
    [
        ["Dashboard", "Full company view", "EL scope", "FL scope", "Personal only"],
        ["Data Entry", "All depts", "All depts", "Assigned depts", "Own dept"],
        ["Daily Logs", "All users", "EL scope", "FL scope", "Own data"],
        ["Performance Insights", "All + filters", "EL scope", "FL scope", "Own data"],
        ["Goals Report", "All", "EL scope", "FL scope", "Own data"],
        ["Department Mgmt", "Full CRUD", "—", "—", "—"],
        ["Task Mgmt", "Full CRUD", "—", "—", "—"],
        ["Target Mgmt", "Full CRUD", "—", "—", "—"],
        ["Goal Mgmt", "Full CRUD", "—", "—", "—"],
        ["Access Mgmt", "Full CRUD", "—", "—", "—"],
        ["Sales Forward", "—", "—", "—", "Sales depts only"],
        ["Sprint/Story", "Yes", "—", "—", "Tech dept only"],
    ]
)

add_heading("5.3 Daily Activity Logging", 2)
add_bullet("Employees select a work date (max: today) and log multiple activities")
add_bullet("Each activity: task selection, setup count, allocated time, time taken, remarks")
add_bullet("Target tasks: enter percentage/units achieved instead of time")
add_bullet("Goal entries: enter achieved units vs fixed goal")
add_bullet("Leave types: None, Half Day, Full Day (Full Day submits empty activities with leaveType flag)")
add_bullet("Bulk submission: all entries sent in one POST /form/bulkWork call")
add_bullet("Sales departments: additional Sales Call scheduling modal")
add_bullet("Confirmation dialog for past-date submissions")

add_heading("5.4 Performance Analytics", 2)
add_bullet("Efficiency Level: High (target ≥100% AND time ≤ allocated), At Par (≥80% AND time ≤ allocated), Low (all others)")
add_bullet("Utilization %: (Time Taken / Standard Time) × 100, capped at 100% for Low efficiency")
add_bullet("Dashboard radial charts: Target %, Utilization %, Allocated Hrs, Work Hrs, Goal Efficiency")
add_bullet("Custom animated column chart for comparative bar visualisation")
add_bullet("Excel download of efficiency summary via blob API response")

add_heading("5.5 Department & Organisational Management", 2)
add_bullet("Departments: create with name, description, Executive Leader, Functional Leader")
add_bullet("Departments can be activated/deactivated (soft toggle) or archived (soft delete)")
add_bullet("Tasks: linked to departments, have frequency, standard time, dynamic flag, task type")
add_bullet("Targets: department KPIs with metric, value, unit, frequency, timing type")
add_bullet("Goals: higher-level department objectives with metric, unit, frequency")

add_heading("5.6 Sprint & Story Planning (Tech Dept)", 2)
add_bullet("Sprint creation: name, project ID, date range, planned story points")
add_bullet("Sprint status: PLANNED → ACTIVE → COMPLETED")
add_bullet("Story Planner: 3-step wizard (team assignment → backlog → story assignment)")
add_bullet("Capacity tracking: used points vs planned points with progress bar")
add_bullet("Story assignment: each story assigned to a team member with points worked")

add_heading("5.7 Sales Call Management", 2)
add_bullet("Sales users can view their scheduled calls")
add_bullet("Update call status: Scheduled, Completed, No Show, Rescheduled, Cancelled")
add_bullet("Reschedule: requires new datetime, rescheduled-by party, and reason")
add_bullet("Reschedule log history viewable per call in a dropdown")
add_bullet("Validation: cancellation statuses require a reason")

add_heading("5.8 UI Behaviours & Notifications", 2)
add_bullet("Toast notifications (HeroUI ToastProvider) for all CRUD operations — success, error, warning")
add_bullet("Loading states on all async operations (button spinners, skeleton loaders)")
add_bullet("Confirmation modals for all destructive actions (delete, deactivate)")
add_bullet("Responsive layout: sidebar collapses to overlay on mobile")
add_bullet("Dark mode support via Tailwind 'class' strategy (dark: variants throughout)")
add_bullet("Animated bar chart tooltips using Framer Motion AnimatePresence")
add_bullet("Lazy-loaded ApexCharts with Suspense fallback skeleton")
add_bullet("AbortController on dashboard API calls to prevent stale data on rapid filter changes")

page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 6 – API & DATA FLOW
# ══════════════════════════════════════════════════════════════════════════════
add_heading("6. API & Data Flow", 1, ORANGE)

add_heading("6.1 API Base Configuration", 2)
add_para("All API calls use the base path: /t2.0/authentificationUtilization/")
add_para("In development, Vite proxies this path to the backend server. In production (Vercel), vercel.json handles rewrites.")
add_para("Authentication: Bearer token sent in Authorization header for all protected endpoints.")
add_para("Content-Type: application/json for all POST/PUT requests.")

add_heading("6.2 Complete API Endpoint Reference", 2)
add_header_table(
    ["Category", "Method", "Endpoint (relative)", "Purpose"],
    [
        ["Auth", "POST", "authenticate", "Login — returns token + user profile"],
        ["Auth", "POST", "forgotPassword", "Send password reset email"],
        ["Auth", "POST", "resetPassword", "Reset password with token"],
        ["Auth", "POST", "updateUserStatus", "Activate/deactivate user account"],
        ["Users", "POST", "users/read", "List users with filters (dept, role, search, pagination)"],
        ["Users", "POST", "User/create", "Create new user"],
        ["Users", "PUT",  "User/update", "Update user details"],
        ["Users", "POST", "usersArchive", "Archive/delete user(s)"],
        ["Departments", "POST", "Department/list", "List departments with filters"],
        ["Departments", "POST", "Department/create", "Create department"],
        ["Departments", "POST", "Department/update/{id}", "Update department"],
        ["Departments", "POST", "Department/archive", "Archive department(s)"],
        ["Departments", "PUT",  "Department/status", "Toggle department status"],
        ["Departments", "GET",  "Department/taskTarget/{deptId}", "Get tasks+targets for a department"],
        ["Tasks", "POST", "departmentTasks/list", "Paginated task list"],
        ["Tasks", "POST", "departmentTasks/create", "Create task"],
        ["Tasks", "PUT",  "departmentTasks/update/{id}", "Update task"],
        ["Tasks", "PUT",  "departmentTasks/{id}/status", "Toggle task status"],
        ["Tasks", "POST", "departmentTasks/getTasksByDepartment", "Get tasks for a specific department"],
        ["Targets", "POST", "departmentTargets/list", "Paginated target list"],
        ["Targets", "POST", "departmentTargets/create", "Create target"],
        ["Targets", "PUT",  "departmentTargets/update/{id}", "Update target"],
        ["Targets", "PUT",  "departmentTargets/{id}/status", "Toggle target status"],
        ["Targets", "POST", "departmentTargets/getTargetsByDepartment", "Get targets for a department"],
        ["Targets", "POST", "monthly-targets/today/{deptId}", "Get today's monthly targets (special depts)"],
        ["Goals", "POST", "departmentGoals/list", "Paginated goal list"],
        ["Goals", "POST", "departmentGoals/create", "Create goal"],
        ["Goals", "PUT",  "departmentGoals/update/{id}", "Update goal"],
        ["Goals", "PUT",  "departmentGoals/{id}/status", "Toggle goal status"],
        ["Goals", "POST", "departmentGoals/getGoalsByDepartment", "Get goals for a department"],
        ["Activity", "POST", "form/bulkWork", "Submit bulk daily activity entries"],
        ["Activity", "POST", "form/list", "Paginated daily log list with filters"],
        ["Dashboard", "POST", "DashBoardAll", "All dashboard summary data"],
        ["Efficiency", "POST", "list-efficiency-summary", "Efficiency summary with filters"],
        ["Efficiency", "POST", "download-efficiency-summary", "Download efficiency report (Excel blob)"],
        ["Goal Data", "POST", "userGoalData/list", "User goal achievement records"],
        ["Sales", "POST", "sales/calls/list", "Sales call list"],
        ["Sales", "POST", "sales/calls/update-status", "Update call status"],
        ["Sales", "POST", "sales/calls/reschedule", "Reschedule a call"],
        ["Tech", "POST", "tech/list", "Sprint list"],
        ["Tech", "POST", "tech/sprint", "Create sprint"],
        ["Tech", "POST", "tech/sprint/{id}/users", "Assign users to sprint"],
        ["Tech", "POST", "tech/story", "Submit stories to sprint"],
        ["Tech", "POST", "tech/story/{sprintId}/assign/{userId}", "Assign story to user"],
        ["HR", "GET",  "positions/list", "JD positions list"],
    ]
)

add_heading("6.3 Request / Response Patterns", 2)
add_heading("Login Response Structure", 3)
add_para(
    "The authenticate endpoint returns a JSON object stored directly in localStorage. "
    "Key fields used throughout the app:"
)
add_header_table(
    ["Field", "Type", "Usage"],
    [
        ["token", "string", "JWT Bearer token sent in all authenticated requests"],
        ["userID", "number", "Current user's ID"],
        ["name", "string", "Display name in Topbar"],
        ["userRole", "number", "Role ID (1=Admin, 2=User, 3=EL, 4=FL)"],
        ["departmentID", "number | null", "User's primary department (null for Admin/EL)"],
        ["departmentName", "string", "Displayed in Topbar"],
        ["departments", "array", "All departments for FL users"],
        ["isHeExecutiveLeader", "boolean", "EL flag for dashboard data scoping"],
        ["isHeFunctionalLeader", "boolean", "FL flag for dashboard data scoping"],
    ]
)

add_heading("6.4 Error Handling Strategy", 2)
add_bullet("All API calls wrapped in try/catch blocks")
add_bullet("Errors displayed via addToast() with color='danger' and descriptive messages")
add_bullet("axios.isCancel() checked before showing error toasts (prevents false errors on AbortController cancellation)")
add_bullet("401 responses in DailyActivityLog: clears localStorage and redirects to login")
add_bullet("Form validation errors shown as warning toasts before API calls")
add_bullet("No global error boundary — errors are handled locally per component")

page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 7 – STATE MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════
add_heading("7. State Management", 1, ORANGE)

add_heading("7.1 Global State", 2)
add_para(
    "Taskly does not use Redux, Zustand, or any global state library. "
    "The only 'global' state is the authentication object stored in localStorage (key: authUserLD). "
    "This is read directly by every component that needs user context."
)
add_header_table(
    ["Storage", "Key", "Value", "Purpose"],
    [
        ["localStorage", "authUserLD", "JSON string of user profile + token", "Authentication state, user role, department, token"],
    ]
)

add_heading("7.2 Local State Patterns", 2)
add_para("All state is managed locally with React useState and useEffect hooks. Common patterns:")
add_header_table(
    ["Pattern", "Example", "Usage"],
    [
        ["List + loading", "const [data, setData] = useState([]); const [loading, setLoading] = useState(false)", "All data-fetching pages"],
        ["Form state object", "const [newTask, setNewTask] = useState({taskName:'', ...})", "All CRUD forms"],
        ["Modal open/close", "const [isModalOpen, setIsModalOpen] = useState(false)", "All modal-based forms"],
        ["Confirmation state", "const [deleteConfirm, setDeleteConfirm] = useState({open:false, id:null})", "Delete/toggle confirmations"],
        ["Pagination", "const [pageNumber, setPageNumber] = useState(1); const [pageSize, setPageSize] = useState(10)", "All paginated tables"],
        ["Filter state", "const [filterStatus, setFilterStatus] = useState('')", "Department/user/date filters"],
        ["Date range", "const [dateRange, setDateRange] = useState({startDate, endDate})", "Date-filtered pages"],
        ["Refresh trigger", "const [tableRefreshKey, setTableRefreshKey] = useState(0)", "Force re-fetch after mutations"],
    ]
)

add_heading("7.3 Custom Hook: useDashboardData", 2)
add_para(
    "The Dashboard page extracts all data-fetching logic into a custom hook useDashboardData(user, dateRange, refresh). "
    "This hook:"
)
add_bullet("Builds the API payload with useMemo based on user role and date range")
add_bullet("Fetches all dashboard data in a single API call (DashBoardAll)")
add_bullet("Transforms raw API response into typed state objects")
add_bullet("Uses AbortController to cancel requests on dependency changes")
add_bullet("Returns all state values for the Dashboard component to consume")

add_heading("7.4 Derived State with useMemo", 2)
add_para("The Dashboard page makes heavy use of useMemo to avoid redundant useEffect chains:")
add_bullet("ELSummaryFiltered — filtered from ELSummary based on elFilter")
add_bullet("FLSummaryFiltered — filtered from FLSummary based on flFilter")
add_bullet("departmentSummaryFiltered — filtered from departmentSummary based on selectedDepartment")
add_bullet("stats — maps STAT_DEFS to companySummary values")
add_bullet("user — parsed once from localStorage, never re-parsed")

add_heading("7.5 Data Lifecycle", 2)
add_header_table(
    ["Event", "State Change"],
    [
        ["Page load", "useEffect fires → API call → setState with response data"],
        ["Filter change", "useEffect dependency changes → new API call → setState"],
        ["Form submit (create)", "API call → append new item to existing state array OR increment refreshKey"],
        ["Form submit (edit)", "API call → map over state array, replace matching item"],
        ["Delete/archive", "API call → filter out deleted item from state array"],
        ["Status toggle", "API call → map over state array, update status field"],
        ["Logout", "localStorage.removeItem('authUserLD') → window.location.href = '/'"],
    ]
)

page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 8 – STYLING & UI SYSTEM
# ══════════════════════════════════════════════════════════════════════════════
add_heading("8. Styling & UI System", 1, ORANGE)

add_heading("8.1 CSS Framework", 2)
add_para("Tailwind CSS v4 via @tailwindcss/vite plugin. No separate PostCSS config needed for Tailwind v4.")
add_para("Global styles in src/styles/globals.css (base resets + Tailwind directives).")

add_heading("8.2 Design Tokens (tailwind.config.js)", 2)
add_header_table(
    ["Token", "Value", "Usage"],
    [
        ["primary.DEFAULT", "#FE5F00 (orange)", "Buttons, active nav links, accents"],
        ["primary.50–900", "Orange scale", "Backgrounds, hover states"],
        ["secondary", "#9b94ff (purple)", "Secondary buttons, badges"],
        ["danger", "#FF3232", "Error states, delete actions"],
        ["success", "#4CAF50", "Success states, active badges"],
        ["neutral", "#F3F4F6", "Neutral backgrounds"],
        ["font-sans", "Poppins (self-hosted)", "All text throughout the app"],
        ["animation.shine", "2.5s ease-in-out infinite", "Shine effect on elements"],
    ]
)

add_heading("8.3 Font Loading", 2)
add_para("Poppins font loaded from self-hosted WOFF2 files in public/fonts/:")
add_bullet("Poppins-Regular.woff2")
add_bullet("Poppins-Medium.woff2")
add_bullet("Poppins-Bold.woff2")
add_para("Defined as the primary sans-serif font in Tailwind config.")

add_heading("8.4 HeroUI Component Library", 2)
add_para(
    "HeroUI (@heroui/react) provides the complete component set. "
    "It is configured via the heroui() Tailwind plugin and HeroUIProvider in provider.tsx."
)
add_bullet("Components used: Button, Input, Select, Autocomplete, Modal, Drawer, Tabs, Tab, Card, Table, Pagination, Chip, Avatar, Dropdown, DatePicker, DateRangePicker, Switch, Checkbox, Radio, Spinner, Toast")
add_bullet("Dark mode: class-based (darkMode: 'class' in Tailwind config)")
add_bullet("HeroUI theme integrates with Tailwind's colour system")

add_heading("8.5 Responsive Design", 2)
add_bullet("Mobile-first approach with Tailwind responsive prefixes (sm:, md:, lg:)")
add_bullet("Sidebar: fixed overlay on mobile, static on lg+ screens")
add_bullet("Department cards: 1 col mobile → 2 sm → 3 md → 4 lg")
add_bullet("Dashboard grid: 1 col mobile → 3 col md")
add_bullet("Topbar hamburger menu visible only on mobile (lg:hidden)")

add_heading("8.6 Animations", 2)
add_bullet("Framer Motion: bar chart bar entrance animations (spring physics), tooltip AnimatePresence")
add_bullet("DarkVeil (OGL WebGL): animated noise/scanline background on login page")
add_bullet("Aurora.css: CSS aurora glow animation")
add_bullet("Tailwind shine animation: keyframe left: -100% → 150% over 2.5s")
add_bullet("HeroUI built-in transitions on modals, dropdowns, and interactive elements")
add_bullet("EmptyState: pulsing floating icons via Tailwind animate-pulse with staggered delays")

page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 9 – KEY WORKFLOWS
# ══════════════════════════════════════════════════════════════════════════════
add_heading("9. Key Workflows", 1, ORANGE)

add_heading("9.1 User Login Flow", 2)
steps = [
    ("1", "User navigates to / (login page)"),
    ("2", "App checks localStorage for authUserLD — if found, redirects to /dashboard"),
    ("3", "User enters email and password, clicks Sign In"),
    ("4", "POST /authenticate called with {username, password}"),
    ("5", "On success: token + profile stored in localStorage as authUserLD"),
    ("6", "900ms delay for UX, then navigate('/dashboard')"),
    ("7", "ProtectedRoute reads authUserLD — grants access to protected routes"),
    ("8", "Sidebar reads userRole from authUserLD to filter menu items"),
    ("9", "Dashboard fetches data scoped to user's role"),
]
add_header_table(["Step", "Action"], steps)

add_heading("9.2 Daily Activity Logging Flow", 2)
steps2 = [
    ("1", "User navigates to /department-forms"),
    ("2", "Department auto-selected from user profile (or manually selected by admin/EL/FL)"),
    ("3", "Tasks for the department fetched from API"),
    ("4", "User selects work date (max: today)"),
    ("5", "User selects entry type: TASK, TARGET, or GOAL"),
    ("6", "For TASK: select task, enter setup count, allocated time, time taken, remarks"),
    ("7", "For TARGET: select target, enter achieved units/percentage"),
    ("8", "For GOAL: select goal, enter achieved units"),
    ("9", "Click Add — entry added to local activities list"),
    ("10", "Repeat for multiple activities"),
    ("11", "Click Submit — POST /form/bulkWork with all activities"),
    ("12", "Success toast shown, activities list cleared"),
]
add_header_table(["Step", "Action"], steps2)

add_heading("9.3 Dashboard Interaction Flow", 2)
steps3 = [
    ("1", "User navigates to /dashboard"),
    ("2", "useDashboardData hook fires — POST /DashBoardAll with role-scoped payload"),
    ("3", "Company summary displayed in radial chart + stat cards"),
    ("4", "Admin: sees department filter, EL filter, FL filter dropdowns"),
    ("5", "User changes date range via CustomDateRangePicker"),
    ("6", "dateRange state updates → useMemo rebuilds payload → useEffect re-fetches"),
    ("7", "User filters by department → departmentSummaryFiltered recomputed via useMemo"),
    ("8", "User clicks on a user row → Drawer opens with detailed activity log"),
    ("9", "EL/FL users see their own summary + tabs for their departments/users"),
]
add_header_table(["Step", "Action"], steps3)

add_heading("9.4 Creating a New User (Admin Flow)", 2)
steps4 = [
    ("1", "Admin navigates to /access-management"),
    ("2", "Clicks 'Add New User' button"),
    ("3", "Modal opens with form: Full Name, Email, Password, Department, Role"),
    ("4", "Admin fills form and clicks 'Add User'"),
    ("5", "POST /User/create called with payload including roleID mapping"),
    ("6", "Success toast shown, page reloads to refresh user list"),
    ("7", "New user can now log in with provided credentials"),
]
add_header_table(["Step", "Action"], steps4)

add_heading("9.5 Sprint Planning Flow (Tech Dept)", 2)
steps5 = [
    ("1", "Tech user navigates to /story-points"),
    ("2", "Existing sprints loaded from POST /tech/list"),
    ("3", "User clicks on a sprint card → Team Assignment modal opens (Step 1)"),
    ("4", "User searches and selects team members, clicks Confirm"),
    ("5", "POST /tech/sprint/{id}/users called with selected member IDs"),
    ("6", "Step 2: User adds story keys (e.g. TECH-201) with story points"),
    ("7", "Capacity bar updates in real-time as stories are added"),
    ("8", "User clicks 'Next: Assign Tasks' → POST /tech/story"),
    ("9", "Step 3: User assigns each story to a team member with points worked"),
    ("10", "POST /tech/story/{sprintId}/assign/{userId} called per assignment"),
]
add_header_table(["Step", "Action"], steps5)

page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 10 – SETUP & RUNNING INSTRUCTIONS
# ══════════════════════════════════════════════════════════════════════════════
add_heading("10. Setup & Running Instructions", 1, ORANGE)

add_heading("10.1 Prerequisites", 2)
add_bullet("Node.js >= 18.x")
add_bullet("npm >= 9.x (or pnpm/yarn)")
add_bullet("Git")
add_bullet("Access to the backend API server (or a proxy configuration)")

add_heading("10.2 Installation", 2)
add_para("Clone the repository and install dependencies:")
p = doc.add_paragraph()
p.paragraph_format.left_indent = Inches(0.3)
run = p.add_run(
    "git clone <repository-url>\n"
    "cd <project-folder>\n"
    "npm install"
)
run.font.name = "Courier New"
run.font.size = Pt(9)
run.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

add_heading("10.3 Environment Variables", 2)
add_para(
    "The project uses Vite's proxy feature to forward API calls. "
    "No .env file is required for basic development. "
    "If the backend URL needs to be configured, add a proxy in vite.config.ts:"
)
p2 = doc.add_paragraph()
p2.paragraph_format.left_indent = Inches(0.3)
run2 = p2.add_run(
    "server: {\n"
    "  proxy: {\n"
    "    '/t2.0': {\n"
    "      target: 'https://your-backend-url.com',\n"
    "      changeOrigin: true,\n"
    "    }\n"
    "  }\n"
    "}"
)
run2.font.name = "Courier New"
run2.font.size = Pt(9)

add_heading("10.4 Running the Development Server", 2)
p3 = doc.add_paragraph()
p3.paragraph_format.left_indent = Inches(0.3)
run3 = p3.add_run("npm run dev")
run3.font.name = "Courier New"
run3.font.size = Pt(10)
run3.font.bold = True
add_para("The app will be available at http://localhost:3030 (or http://0.0.0.0:3030 for network access).")

add_heading("10.5 Building for Production", 2)
p4 = doc.add_paragraph()
p4.paragraph_format.left_indent = Inches(0.3)
run4 = p4.add_run("npm run build")
run4.font.name = "Courier New"
run4.font.size = Pt(10)
run4.font.bold = True
add_para("Output goes to the dist/ folder. TypeScript is compiled first (tsc), then Vite bundles the output.")

add_heading("10.6 Preview Production Build", 2)
p5 = doc.add_paragraph()
p5.paragraph_format.left_indent = Inches(0.3)
run5 = p5.add_run("npm run preview")
run5.font.name = "Courier New"
run5.font.size = Pt(10)

add_heading("10.7 Linting", 2)
p6 = doc.add_paragraph()
p6.paragraph_format.left_indent = Inches(0.3)
run6 = p6.add_run("npm run lint")
run6.font.name = "Courier New"
run6.font.size = Pt(10)
add_para("Runs ESLint with --fix flag. Configured with React, hooks, a11y, import, and prettier rules.")

add_heading("10.8 Deployment (Vercel)", 2)
add_bullet("vercel.json is present — configures SPA rewrites so all routes serve index.html")
add_bullet("Connect the repository to Vercel, set build command to 'npm run build', output directory to 'dist'")
add_bullet("The commented vite.config.ts section shows a production config for custom domain (taskly.tapmind.io) with WSS HMR")

page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  SECTION 11 – DEVELOPER NOTES
# ══════════════════════════════════════════════════════════════════════════════
add_heading("11. Developer Notes", 1, ORANGE)

add_heading("11.1 Known Issues & Limitations", 2)
add_header_table(
    ["Issue", "Location", "Notes"],
    [
        ["No token expiry handling", "All pages", "If JWT expires, API calls will silently fail or return 401. Only DailyActivityLog handles 401 by redirecting to login. Other pages do not."],
        ["window.location.reload() after user create/delete", "access-management.tsx", "Full page reload used instead of state update — causes flash and loses scroll position."],
        ["console.log statements in production", "Multiple pages", "Many debug console.log calls remain in production code (department.tsx, dashboard.tsx, etc.)"],
        ["Reports page not in sidebar", "reports.tsx", "The /reports route exists but is not linked in the sidebar navigation. May be legacy or incomplete."],
        ["JobManagement page commented out", "App.tsx, sidebar.tsx", "JD Management route and sidebar link are commented out — feature is incomplete."],
        ["story-planner.tsx truncated", "story-planner.tsx", "File appears to be 1 line in the workspace — may be incomplete or corrupted."],
        ["goals.tsx truncated", "goals.tsx", "File appears to be 1 line — may be incomplete or corrupted."],
        ["Hardcoded department IDs", "Multiple files", "Department IDs (5, 6, 9, 21, 22, 24, etc.) are hardcoded throughout. Should be constants or config."],
        ["No loading skeleton on most pages", "Most pages", "Only Dashboard has skeleton loaders. Other pages show empty tables during loading."],
        ["CustomDateRangePicker prop inconsistency", "CustomDateRangePicker.tsx", "Component accepts either datePick or onChange prop depending on usage — inconsistent API."],
        ["No form validation library", "All forms", "Validation is done manually with if-checks and toast messages. No Zod/Yup/React Hook Form used."],
        ["TypeScript any usage", "Multiple files", "Extensive use of any type reduces type safety. Many API response types are untyped."],
    ]
)

add_heading("11.2 Suggested Improvements", 2)
add_header_table(
    ["Area", "Suggestion"],
    [
        ["Auth", "Add token expiry check on app load and on API 401 responses globally (Axios interceptor)"],
        ["State", "Consider React Query (TanStack Query) for server state management — handles caching, loading, error states automatically"],
        ["Types", "Create typed interfaces for all API responses in src/types/ — eliminate any usage"],
        ["Constants", "Move hardcoded department IDs, role IDs, and API paths to a constants file"],
        ["Error Handling", "Add a global Axios response interceptor for 401/403 handling and network errors"],
        ["Forms", "Adopt React Hook Form + Zod for form validation — reduces boilerplate and improves UX"],
        ["Testing", "Add unit tests for utility functions and integration tests for key user flows"],
        ["Performance", "Memoize more components with React.memo; the DailyActivityLog component is very large and could be split"],
        ["Code Splitting", "More aggressive lazy loading — currently only ApexCharts is lazy loaded"],
        ["Logging", "Remove all console.log statements before production builds (ESLint no-console rule)"],
        ["Accessibility", "Add proper ARIA labels to all interactive elements; audit keyboard navigation"],
        ["Environment Config", "Use .env files for API base URL, feature flags, and environment-specific config"],
    ]
)

add_heading("11.3 Code Quality Observations", 2)
add_bullet("Architecture: Clean separation of pages and components. Layout/routing structure is well-organised.")
add_bullet("Performance: Dashboard uses excellent patterns (useMemo, useCallback, AbortController, lazy loading). Other pages could adopt similar patterns.")
add_bullet("Consistency: Some pages use axios, others use fetch() directly — should standardise on axios.")
add_bullet("Component size: DailyActivityLog.tsx is 2500+ lines — should be broken into smaller sub-components.")
add_bullet("Dead code: Several commented-out useEffect blocks and API calls remain in the codebase (dailyLogs.tsx, goals.tsx, efficiency.tsx).")
add_bullet("Naming: Mix of camelCase and PascalCase for page files (TaskManagement.tsx vs activity-log.tsx) — should standardise.")
add_bullet("Reusability: ReusableTable is well-designed and used consistently. EfficiencyTable (table2.tsx) could be merged or extended from ReusableTable.")
add_bullet("Security: Passwords are sent in plain text over HTTPS — ensure backend enforces HTTPS. No client-side password hashing (appropriate for web apps).")
add_bullet("localStorage: Storing the full user profile including token in localStorage is standard but consider HttpOnly cookies for higher security environments.")

add_heading("11.4 Assumptions Made During Documentation", 2)
add_bullet("The backend API is a separate service not included in this repository.")
add_bullet("The /t2.0/ prefix is proxied to the backend in development via Vite server config.")
add_bullet("story-planner.tsx and goals.tsx appear truncated in the workspace — documentation is based on available code and inferred from routing/sidebar context.")
add_bullet("Department IDs referenced in code (5=Sales, 6=Sales, 9=Sales, 21=Sales, 22=HR, 24=Tech) are inferred from conditional logic.")
add_bullet("The 'docs/' folder contains a static documentation site (GitHub Pages style) separate from this application.")

# ── Save ──────────────────────────────────────────────────────────────────────
doc.save("TASKLY_Documentation.docx")
print("Documentation generated: TASKLY_Documentation.docx")
