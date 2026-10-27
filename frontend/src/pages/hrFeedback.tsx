import { useParams } from "react-router-dom";

import TasklyHRModules from "../HR - Modules Taskly/taskly-hr-modules/taskly-hr/src/TasklyHRModules";

// Support module (formerly HR Feedback): /support/onboarding | /support/query | /support/engagement
export default function HRFeedback() {
  const { section } = useParams();
  return <TasklyHRModules section={section} />;
}
