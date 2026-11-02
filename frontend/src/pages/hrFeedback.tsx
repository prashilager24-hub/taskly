import { Navigate, useParams } from "react-router-dom";
import { showOnboarding } from "@/lib/onboarding";
import { hasModuleAccess } from "@/lib/permissions";
import AccessDenied from "@/components/AccessDenied";

import TasklyHRModules from "../HR - Modules Taskly/taskly-hr-modules/taskly-hr/src/TasklyHRModules";

// HR Support: /support/onboarding | /support/query | /support/engagement. Each page is its own access module.
const SECTIONS: { key: string; module: string }[] = [
  { key: "onboarding", module: "hr_onboarding" },
  { key: "query", module: "hr_query" },
  { key: "engagement", module: "hr_engagement" },
];

export default function HRFeedback() {
  const { section } = useParams();
  let user = null;
  try { user = JSON.parse(localStorage.getItem("authUserLD") || "null"); } catch { /* ignore */ }
  const open = (s: { key: string; module: string }) => hasModuleAccess(s.module) && (s.key !== "onboarding" || showOnboarding(user));

  const wanted = SECTIONS.find((s) => s.key === section);
  if (!wanted) return <Navigate to="/support/query" replace />;
  if (!open(wanted)) {
    // send them to the first HR Support page they can open
    const next = SECTIONS.find(open);
    return next ? <Navigate to={`/support/${next.key}`} replace /> : <AccessDenied module={wanted.module} />;
  }
  return <TasklyHRModules section={section} />;
}
