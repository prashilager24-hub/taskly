import { Navigate, Route } from "react-router-dom";
import HubShell from "@/peoplehub/HubShell";
import { ModulePage } from "@/peoplehub/ModulePage";
import { MODULES, type ModuleId } from "@/peoplehub/modules/registry";
import { HrmsDashboard } from "@/peoplehub/views/HrmsDashboard";
import { Reports } from "@/peoplehub/views/HrmsReports";
import { IdCard } from "@/peoplehub/views/IdCard";
import { InterviewStages } from "@/peoplehub/views/InterviewStages";
import { OfferLetter } from "@/peoplehub/views/OfferLetter";
import { PmsDashboard, TargetGoals } from "@/peoplehub/views/TargetGoals";
import { Worklog } from "@/peoplehub/views/Worklog";
import { FinanceVariablePay, MyVariablePay, TeamVariablePay, VariablePayEligibility, VariablePayPolicy } from "@/peoplehub/views/VariablePay";

/** Hand-built People Hub screens; every other /hub page is drawn from its config in modules/registry (sample data) */
const CUSTOM: Record<string, React.ReactNode> = {
  "dashboard/hrms": <HrmsDashboard />,
  "dashboard/pms": <PmsDashboard />, // real data (same figures as Target & Goals)
  "taskly/goals": <TargetGoals />, // real data: targets and goals from Taskly
  "taskly/worklog": <Worklog />,
  // Variable Pay: real data, the appraisal way (send → A1 → A2 → Finance Head → paid)
  "variable-pay/my": <MyVariablePay />,
  "variable-pay/team": <TeamVariablePay />,
  "variable-pay/finance": <FinanceVariablePay />,
  "variable-pay/policy": <VariablePayPolicy />,
  "variable-pay/eligibility": <VariablePayEligibility />,
  "hrms/reports": <Reports />,
  "talent/interview-stages": <InterviewStages />,
  "talent/offer-letter": <OfferLetter />,
  "assets/id-card": <IdCard />,
};

/** The People Hub routes, placed inside the signed-in layout: /hub/<module>/<page> */
export const peopleHubRoutes = (
  <Route path="/hub" element={<HubShell />}>
    <Route index element={<Navigate to="/hub/dashboard/pms" replace />} />
    {Object.entries(CUSTOM).map(([path, el]) => <Route key={path} path={path} element={el} />)}
    {(Object.keys(MODULES) as ModuleId[]).map((id) => <Route key={String(id)} path={String(id)} element={<ModulePage key={String(id)} id={id} />} />)}
    <Route path="*" element={<Navigate to="/hub/dashboard/pms" replace />} />
  </Route>
);
