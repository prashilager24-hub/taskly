
// export default App;
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "@/components/protectedRoute"
import IndexPage from "@/pages/index";
import DashboardHome from "@/pages/home";
import ActivityLogPage from "@/pages/activity-log";
import DepartmentPage from "@/pages/subdepartment";
import TaskManagementPage from "@/pages/TaskManagement";
import ReportsPage from "@/pages/reports";
import History from "@/pages/History";
import AccessManagementPage from "@/pages/access-management";
import Efficiency from "./pages/efficiency";
import ResetPasswordPage from "./pages/forgotPassword";
import TargetManagement from "./pages/targetManagement";
import DarkVeil from "./bg"
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
import PrimaryDepartmentPage from "./pages/PrimaryDepartment";
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
        element={
          <>
            <DarkVeil
              speed={2.1}
              hueShift={211}
              noiseIntensity={0.17}
              scanlineFrequency={3.8}
              scanlineIntensity={0}
              warpAmount={0}
            />
            <IndexPage />
          </>
        }
      />

      {/* PROTECTED ROUTES WITH CONSTANT SIDEBAR + TOPBAR */}
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/activity-log" element={<ActivityLogPage />} />
        <Route path="/department" element={<ProtectedRoute adminOnly={true}><DepartmentPage /></ProtectedRoute>} />
        <Route path="/primaryDepartment" element={<ProtectedRoute adminOnly={true}><PrimaryDepartmentPage /></ProtectedRoute>} />
        <Route path="/daily-activity" element={<FormPage />} />
        <Route path="/department-forms" element={<Navigate to="/daily-activity" replace />} />
        <Route path="/tasks" element={<ProtectedRoute adminOnly={true}><TaskManagementPage /></ProtectedRoute>} />
        <Route path="/target" element={<ProtectedRoute adminOnly={true}><TargetManagement /></ProtectedRoute>} />
        <Route path="/daily-log" element={<DailyLogs />} />
        <Route path="/access-management" element={<ProtectedRoute adminOnly={true}><AccessManagementPage /></ProtectedRoute>} />
        <Route path="/efficiency-report" element={<Efficiency />} />
        <Route path="/sales-forward" element={<ProtectedRoute salesOnly={true}><SalesForward /></ProtectedRoute>} />
        <Route path="/Goal-management" element={<ProtectedRoute adminOrTech={true} ><GoalManagement /></ProtectedRoute>} />
        <Route path="/pms" element={<Navigate to="/dashboard?view=pms" replace />} />
        <Route path="/Entry-Approval" element={<ProtectedRoute  ><EntryApproval /></ProtectedRoute>} />
        <Route path="/User-History" element={<ProtectedRoute adminOnly={true}><History /></ProtectedRoute>} />
        <Route path="/Query-Report" element={<ProtectedRoute adminOnly={true}><QueryReport /></ProtectedRoute>} />



        <Route path="/goals" element={<ProtectedRoute ><Goals /></ProtectedRoute>} />
        <Route path="/support/:section" element={<HRFeedback />} />
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
