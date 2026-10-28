# Taskly API

Generated from the running Express app: 177 endpoints, 2026-10-28.

**Base URL** `http://localhost:8080/t2.0/authentificationUtilization` (the frontend proxies `/t2.0` to it). Paths below are relative to that base, except `/health` and `/api/*`.

**Auth** 🔒 = needs `Authorization: Bearer <JWT>`. The token comes from `POST /authenticate` then `POST /authenticate/verify-otp`, and is tied to one active session. A 401 carries `SESSION_REPLACED`, `SESSION_EXPIRED`, `SESSION_REVOKED` or `SESSION_INVALID`.

**Response shapes** Most endpoints return `{ success, message, data, timestamp }`. Ports of Java services keep the original Java bodies (`{ status, statusCode, message, response }` or raw objects) so the existing frontend works unchanged.

| Module | Endpoints | What it covers |
|---|---|---|
| Authentication & users | 24 | Sign-in with emailed OTP, sessions, password reset, users and roles (Access Management). |
| Departments | 11 | Primary departments and the sub departments under them, with hierarchy. |
| Tasks, targets & goals | 33 | Admin setup of what people log: tasks, targets and goals per department, plus monthly targets. |
| Daily Activity | 27 | Daily entries a user logs and the lists built from them. |
| Entry Approval | 3 | Entries waiting for the Executive Leader: approve and reject. |
| Dashboard & reports | 8 | Dashboard summaries, Performance Insights, User History, Query Report, exports and missing-log checks. |
| PMS | 7 | Monthly and quarterly performance reviews. |
| Support | 42 | Query & HR, Onboarding Experience, Employee Engagement and push subscriptions. |
| Sales & recruiting | 14 | Sales Forward calls, talent-acquisition calls, TAM accounts and job positions. |
| Admin | 3 | Admin task tickets. |
| Meta | 5 | Lookup lists used by forms. |

## Authentication & users

Sign-in with emailed OTP, sessions, password reset, users and roles (Access Management).

| Method | Path | Auth |
|---|---|---|
| GET | `/AMRole/:roleId` | 🔒 |
| POST | `/AMRole/archive` | 🔒 |
| POST | `/AMRole/create` | 🔒 |
| POST | `/AMRole/list` | 🔒 |
| POST | `/AMRole/status` | 🔒 |
| POST | `/AMRole/update/:id` | 🔒 |
| GET | `/api/users` | 🔒 |
| GET | `/api/users/:id` | 🔒 |
| GET | `/audit` | 🔒 |
| POST | `/authenticate` | public |
| POST | `/authenticate/resend-otp` | public |
| POST | `/authenticate/verify-otp` | public |
| POST | `/forgotPassword` | public |
| GET | `/health` | public |
| POST | `/logout` | 🔒 |
| POST | `/resetPassword` | public |
| POST | `/sendMailbulk` | 🔒 |
| POST | `/updateUserStatus` | 🔒 |
| POST | `/User/create` | 🔒 |
| POST | `/user/switch` | 🔒 |
| PUT | `/user/theme` | 🔒 |
| PUT | `/User/update` | 🔒 |
| POST | `/users/read` | 🔒 |
| POST | `/usersArchive` | 🔒 |

## Departments

Primary departments and the sub departments under them, with hierarchy.

| Method | Path | Auth |
|---|---|---|
| POST | `/Department/archive` | 🔒 |
| POST | `/Department/create` | 🔒 |
| GET | `/Department/hierarchy` | 🔒 |
| POST | `/Department/list` | 🔒 |
| POST | `/Department/status` | 🔒 |
| GET | `/Department/taskTarget/:departmentId` | 🔒 |
| POST | `/Department/update/:id` | 🔒 |
| POST | `/PrimaryDepartment/create` | 🔒 |
| POST | `/PrimaryDepartment/list` | 🔒 |
| POST | `/PrimaryDepartment/status` | 🔒 |
| POST | `/PrimaryDepartment/update/:id` | 🔒 |

## Tasks, targets & goals

Admin setup of what people log: tasks, targets and goals per department, plus monthly targets.

| Method | Path | Auth |
|---|---|---|
| PUT | `/departmentGoals/:goalID/status` | 🔒 |
| PUT | `/departmentGoals/approve` | 🔒 |
| POST | `/departmentGoals/create` | 🔒 |
| POST | `/departmentGoals/data/log` | 🔒 |
| POST | `/departmentGoals/data/read` | 🔒 |
| POST | `/departmentGoals/getGoalsByDepartment` | 🔒 |
| POST | `/departmentGoals/list` | 🔒 |
| GET | `/departmentGoals/pms` | 🔒 |
| POST | `/departmentGoals/pms` | 🔒 |
| PATCH | `/departmentGoals/pms/:id/status` | 🔒 |
| PUT | `/departmentGoals/update/:goalID` | 🔒 |
| PUT | `/departmentTargets/:targetID/status` | 🔒 |
| POST | `/departmentTargets/create` | 🔒 |
| POST | `/departmentTargets/efficiency/read` | 🔒 |
| POST | `/departmentTargets/getTargetsByDepartment` | 🔒 |
| POST | `/departmentTargets/list` | 🔒 |
| GET | `/departmentTargets/monthly/:departmentId` | 🔒 |
| PUT | `/departmentTargets/update/:targetID` | 🔒 |
| PUT | `/departmentTasks/:taskID/status` | 🔒 |
| POST | `/departmentTasks/create` | 🔒 |
| POST | `/departmentTasks/getTasksByDepartment` | 🔒 |
| GET | `/departmentTasks/leave/:userID` | 🔒 |
| POST | `/departmentTasks/leave/log` | 🔒 |
| POST | `/departmentTasks/list` | 🔒 |
| PUT | `/departmentTasks/update/:id` | 🔒 |
| POST | `/departmentTasks/work/log` | 🔒 |
| POST | `/departmentTasks/work/read` | 🔒 |
| POST | `/monthly-targets/today/:departmentId` | 🔒 |
| GET | `/tasks` | 🔒 |
| POST | `/tasks` | 🔒 |
| PUT | `/tasks` | 🔒 |
| GET | `/tasks/:id` | 🔒 |
| DELETE | `/tasks/:id` | 🔒 |

## Daily Activity

Daily entries a user logs and the lists built from them.

| Method | Path | Auth |
|---|---|---|
| POST | `/createSprintEntry` | 🔒 |
| POST | `/form/bulkCreate` | 🔒 |
| PATCH | `/form/bulkUpdate` | 🔒 |
| POST | `/form/bulkWork` | 🔒 |
| PUT | `/form/goal/update` | 🔒 |
| POST | `/form/list` | 🔒 |
| GET | `/form/revised-target` | 🔒 |
| PUT | `/form/revised-target` | 🔒 |
| GET | `/form/revised-target/:dailyTaskLogID` | 🔒 |
| GET | `/getSprintEntry` | 🔒 |
| GET | `/labels` | 🔒 |
| GET | `/sprintEntry/:id` | 🔒 |
| DELETE | `/sprintEntry/:id` | 🔒 |
| PATCH | `/sprintEntry/:id/manager-note` | 🔒 |
| POST | `/tech/list` | 🔒 |
| POST | `/tech/sprint` | 🔒 |
| POST | `/tech/sprint/:sprintId/users` | 🔒 |
| POST | `/tech/stories` | 🔒 |
| POST | `/tech/story` | 🔒 |
| POST | `/tech/story/:storyId/assign/:userId` | 🔒 |
| PUT | `/tech/story/:storyId/status` | 🔒 |
| PUT | `/updateSprint/:id` | 🔒 |
| POST | `/userGoalData/list` | 🔒 |
| POST | `/userGoalData/review-status` | 🔒 |
| GET | `/userGoalData/revised-goal` | 🔒 |
| PUT | `/userGoalData/revised-goal` | 🔒 |
| GET | `/userGoalData/revised-goal/:userGoalDataID` | 🔒 |

## Entry Approval

Entries waiting for the Executive Leader: approve and reject.

| Method | Path | Auth |
|---|---|---|
| POST | `/combined/approve` | 🔒 |
| POST | `/combined/list` | 🔒 |
| POST | `/combined/reject` | 🔒 |

## Dashboard & reports

Dashboard summaries, Performance Insights, User History, Query Report, exports and missing-log checks.

| Method | Path | Auth |
|---|---|---|
| GET | `/calculateAll` | 🔒 |
| POST | `/DashBoard` | 🔒 |
| POST | `/DashBoardAll` | 🔒 |
| POST | `/download-efficiency-summary` | 🔒 |
| POST | `/goal-efficiency/calculate` | 🔒 |
| POST | `/goal-efficiency/list` | 🔒 |
| POST | `/list-efficiency-summary` | 🔒 |
| GET | `/MissingData` | 🔒 |

## PMS

Monthly and quarterly performance reviews.

| Method | Path | Auth |
|---|---|---|
| POST | `/monthly-reviews` | 🔒 |
| GET | `/monthly-reviews/:empId/:year` | 🔒 |
| DELETE | `/monthly-reviews/:id` | 🔒 |
| GET | `/quarterly-review/all` | 🔒 |
| POST | `/quarterly-review/create` | 🔒 |
| GET | `/quarterly-review/employee/:empId` | 🔒 |
| PUT | `/quarterly-review/update/:id` | 🔒 |

## Support

Query & HR, Onboarding Experience, Employee Engagement and push subscriptions.

| Method | Path | Auth |
|---|---|---|
| GET | `/hrFeedback/engagement/admin` | 🔒 |
| POST | `/hrFeedback/engagement/rollout` | 🔒 |
| GET | `/hrFeedback/engagement/scores/:surveyId` | 🔒 |
| POST | `/hrFeedback/engagement/submit` | 🔒 |
| GET | `/hrFeedback/engagement/surveys` | 🔒 |
| GET | `/hrFeedback/engagement/surveys/list` | 🔒 |
| GET | `/hrFeedback/engagement/surveys/open` | 🔒 |
| GET | `/hrFeedback/onboarding/:userId` | 🔒 |
| GET | `/hrFeedback/onboarding/admin` | 🔒 |
| GET | `/hrFeedback/onboarding/scores` | 🔒 |
| POST | `/hrFeedback/onboarding/send` | 🔒 |
| POST | `/hrFeedback/onboarding/send-survey` | 🔒 |
| POST | `/hrFeedback/onboarding/submit` | 🔒 |
| POST | `/hrFeedback/onboarding/submit-survey` | 🔒 |
| GET | `/hrFeedback/onboarding/surveys` | 🔒 |
| GET | `/hrFeedback/onboarding/surveys/list` | 🔒 |
| GET | `/hrFeedback/onboarding/surveys/mine` | 🔒 |
| POST | `/hrFeedback/push/broadcast` | 🔒 |
| PATCH | `/hrFeedback/push/notifications/:id/read` | 🔒 |
| GET | `/hrFeedback/push/notifications/:userId` | 🔒 |
| POST | `/hrFeedback/push/notifications/:userId/read-all` | 🔒 |
| POST | `/hrFeedback/push/send` | 🔒 |
| POST | `/hrFeedback/push/subscribe` | 🔒 |
| POST | `/hrFeedback/push/unsubscribe` | 🔒 |
| GET | `/hrFeedback/push/vapid-public-key` | public |
| GET | `/hrFeedback/queries` | 🔒 |
| POST | `/hrFeedback/queries` | 🔒 |
| GET | `/hrFeedback/queries/:id/messages` | 🔒 |
| PATCH | `/hrFeedback/queries/:id/status` | 🔒 |
| POST | `/hrFeedback/queries/messages` | 🔒 |
| POST | `/hrFeedback/query/:id/rate` | 🔒 |
| POST | `/hrFeedback/query/:id/reassign` | 🔒 |
| POST | `/hrFeedback/query/:id/reopen` | 🔒 |
| POST | `/hrFeedback/query/:id/reply` | 🔒 |
| POST | `/hrFeedback/query/:id/resolve` | 🔒 |
| GET | `/hrFeedback/query/admin` | 🔒 |
| GET | `/hrFeedback/query/mine` | 🔒 |
| GET | `/hrFeedback/query/queue` | 🔒 |
| POST | `/hrFeedback/query/raise` | 🔒 |
| GET | `/hrFeedback/surveys` | 🔒 |
| GET | `/hrFeedback/surveys/:id/responses` | 🔒 |
| POST | `/hrFeedback/surveys/respond` | 🔒 |

## Sales & recruiting

Sales Forward calls, talent-acquisition calls, TAM accounts and job positions.

| Method | Path | Auth |
|---|---|---|
| POST | `/positions/create` | 🔒 |
| GET | `/positions/list` | 🔒 |
| PUT | `/positions/update` | 🔒 |
| POST | `/sales/calls/create` | 🔒 |
| POST | `/sales/calls/list` | 🔒 |
| POST | `/sales/calls/reschedule` | 🔒 |
| POST | `/sales/calls/update-status` | 🔒 |
| POST | `/ta/calls/create` | 🔒 |
| POST | `/ta/calls/list` | 🔒 |
| POST | `/ta/calls/reschedule` | 🔒 |
| POST | `/ta/calls/update-status` | 🔒 |
| POST | `/tam/create` | 🔒 |
| GET | `/tam/list` | 🔒 |
| PUT | `/tam/update` | 🔒 |

## Admin

Admin task tickets.

| Method | Path | Auth |
|---|---|---|
| POST | `/adminTickets/create` | 🔒 |
| GET | `/adminTickets/list` | 🔒 |
| PUT | `/adminTickets/update` | 🔒 |

## Meta

Lookup lists used by forms.

| Method | Path | Auth |
|---|---|---|
| GET | `/api/meta/approval-statuses` | public |
| GET | `/api/meta/leave-types` | public |
| GET | `/api/meta/products` | public |
| GET | `/api/meta/task-statuses` | public |
| GET | `/api/meta/task-types` | public |
