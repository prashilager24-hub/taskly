import { Navigate, useParams } from "react-router-dom";
import { showOnboarding } from "@/lib/onboarding";

import TasklyHRModules from "../HR - Modules Taskly/taskly-hr-modules/taskly-hr/src/TasklyHRModules";

// Support module (formerly HR Feedback): /support/onboarding | /support/query | /support/engagement
export default function HRFeedback() {
  const { section } = useParams();
  let user = null;
  try { user = JSON.parse(localStorage.getItem("authUserLD") || "null"); } catch { /* ignore */ }
  if (section === "onboarding" && !showOnboarding(user)) return <Navigate to="/support/query" replace />;
  return <TasklyHRModules section={section} />;
}
