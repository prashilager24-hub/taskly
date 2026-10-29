
// export default App;
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/protectedRoute"
import IndexPage from "@/pages/index";
import DashboardHome from "@/pages/home";
import ActivityLogPage from "@/pages/activity-log";
import DepartmentsPage from "@/pages/departments";
import TaskManagementPage from "@/pages/TaskManagement";
import ReportsPage from "@/pages/reports";
import History from "@/pages/History";
import AccessManagementPage from "@/pages/access-management";
import NotificationsPage from "@/pages/notifications";
import { PmsIndex, PmsDashboardPage, PmsGoalPage, PmsFeedbackPage, PmsQuarterlyPage, PmsReportPage } from "@/pages/pmsPages";
import Efficiency from "./pages/efficiency";
import ResetPasswordPage from "./pages/forgotPassword";
import TargetManagement from "./pages/targetManagement";
import DailyLogs from "./pages/dailyLogs";
import Layout from "./components/layout";
import { Outlet } from "react-router-dom";
import Logout from "./pages/logout";
import EntryApproval from "./pages/EntryApproval";
import FormPage from "./pages/forms";
import SalesForward from "./pages/salesForward";

import GoalManagement from "./pages/goalManagement";
import Goals from "./pages/goals";
import QueryReport from "./pages/QueryReport";
import HRFeedback from "./pages/hrFeedback";

const ProtectedLayout = () => (
  <ProtectedRoute>
    <Layout>
      <Outlet />
    </Layout>
  </ProtectedRoute>
);

function App() {
  return (
    <Routes>

      {/* Public Route */}
      <Route
        path="/"
        element={<IndexPage />}
      />

      {/* PROTECTED ROUTES WITH CONSTANT SIDEBAR + TOPBAR */}
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<ProtectedRoute module="dashboard"><DashboardHome /></ProtectedRoute>} />
        <Route path="/activity-log" element={<ActivityLogPage />} />
        <Route path="/departments" element={<ProtectedRoute module="deptmgmt"><DepartmentsPage /></ProtectedRoute>} />
        <Route path="/department" element={<Navigate to="/departments?tab=sub" replace />} />
        <Route path="/primaryDepartment" element={<Navigate to="/departments?tab=primary" replace />} />
        <Route path="/daily-activity" element={<ProtectedRoute module="dataentry"><FormPage /></ProtectedRoute>} />
        <Route path="/department-forms" element={<Navigate to="/daily-activity" replace />} />
        <Route path="/tasks" element={<ProtectedRoute module="taskmgmt"><TaskManagementPage /></ProtectedRoute>} />
        <Route path="/target" element={<ProtectedRoute module="targetmgmt"><TargetManagement /></ProtectedRoute>} />
        <Route path="/daily-log" element={<ProtectedRoute module="mydata"><DailyLogs /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute module="notifications"><NotificationsPage /></ProtectedRoute>} />
        <Route path="/access-management" element={<ProtectedRoute module="accessmgmt"><AccessManagementPage /></ProtectedRoute>} />
        <Route path="/efficiency-report" element={<ProtectedRoute module="perf"><Efficiency /></ProtectedRoute>} />
        <Route path="/sales-forward" element={<ProtectedRoute module="salesfwd"><SalesForward /></ProtectedRoute>} />
        <Route path="/Goal-management" element={<ProtectedRoute module="goalmgmt"><GoalManagement /></ProtectedRoute>} />
        <Route path="/pms" element={<ProtectedRoute module="pms"><PmsIndex /></ProtectedRoute>} />
        <Route path="/pms/dashboard" element={<ProtectedRoute module="pms_dashboard"><PmsDashboardPage /></ProtectedRoute>} />
        <Route path="/pms/goal-setting" element={<ProtectedRoute module="pms_goals"><PmsGoalPage /></ProtectedRoute>} />
        <Route path="/pms/manager-feedback" element={<ProtectedRoute module="pms_feedback"><PmsFeedbackPage /></ProtectedRoute>} />
        <Route path="/pms/quarterly-review" element={<ProtectedRoute module="pms_quarterly"><PmsQuarterlyPage /></ProtectedRoute>} />
        <Route path="/pms/report" element={<ProtectedRoute module="pms_report"><PmsReportPage /></ProtectedRoute>} />
        <Route path="/Entry-Approval" element={<ProtectedRoute module="entryApproval"><EntryApproval /></ProtectedRoute>} />
        <Route path="/User-History" element={<ProtectedRoute module="userHistory"><History /></ProtectedRoute>} />
        <Route path="/Query-Report" element={<ProtectedRoute module="queryReport"><QueryReport /></ProtectedRoute>} />



        <Route path="/goals" element={<ProtectedRoute module="goals"><Goals /></ProtectedRoute>} />
        <Route path="/support/:section" element={<ProtectedRoute module="hrfeedback"><HRFeedback /></ProtectedRoute>} />
        <Route path="/support" element={<Navigate to="/support/query" replace />} />
        <Route path="/hr-feedback" element={<Navigate to="/support/query" replace />} />



      </Route>

      {/* Public */}
      <Route path="/logout" element={<Logout />} />
      <Route path="/passwordHandler" element={<ResetPasswordPage />} />

    </Routes>
  );
}


export default App;
