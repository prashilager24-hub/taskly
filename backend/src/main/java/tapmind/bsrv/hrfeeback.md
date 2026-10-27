# HR Modules — Backend & Database Specification

> Derived from the front-end prototype at `src/HR - Modules Taskly/`.
> All routes are prefixed with `/api/hr/`. Auth via `Authorization: Bearer <jwt>` header (existing Taskly pattern).
> The `/api/users/read` endpoint already exists and is consumed by the Onboarding HR recipient picker.

---

## Database Schema

### 1. Onboarding Surveys

```sql
CREATE TABLE onboarding_surveys (
    id            VARCHAR(10)   PRIMARY KEY,        -- e.g. S-014
    employee_id   INT           NOT NULL,           -- FK → users.userID
    employee_name VARCHAR(100)  NOT NULL,
    department    VARCHAR(100)  NOT NULL,
    joined_date   DATE          NOT NULL,
    sent_on       DATE          NOT NULL,
    due_date      DATE          NOT NULL,
    status        ENUM('pending','submitted','no_response') NOT NULL DEFAULT 'pending',
    answers       JSON          DEFAULT NULL,        -- [8,6,9,8,9,9,8] or NULL
    feedback      TEXT          DEFAULT NULL,        -- Q8 open-ended
    created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2. Queries & Messages

```sql
CREATE TABLE queries (
    id              VARCHAR(10)  PRIMARY KEY,        -- e.g. Q-1042
    employee_id     INT          NOT NULL,           -- FK → users.userID
    employee_name   VARCHAR(100) NOT NULL,
    department      VARCHAR(100) NOT NULL,
    team            ENUM('HR','L&D')       NOT NULL,
    category        ENUM('Payroll','Leave','Policy','Benefits','Training','Certification','Nomination','Other') NOT NULL,
    subject         VARCHAR(200) NOT NULL,
    description     TEXT         NOT NULL,
    priority        ENUM('Low','Normal','High') NOT NULL DEFAULT 'Normal',
    raised_on       DATE         NOT NULL,
    age_hours       INT          NOT NULL DEFAULT 0, -- computed or updated via cron/job
    status          ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
    ratings         JSON         DEFAULT NULL,        -- [9,9,10,9,9,9] or NULL
    rating_comment  TEXT         DEFAULT NULL,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE query_messages (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    query_id    VARCHAR(10)  NOT NULL,               -- FK → queries.id
    author      VARCHAR(100) NOT NULL,                -- employee name or "HR Team" / "L&D Team"
    text        TEXT         NOT NULL,
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_query_messages_query_id (query_id)
);
```

### 3. Engagement Surveys & Responses

```sql
CREATE TABLE engagement_surveys (
    id        VARCHAR(10)  PRIMARY KEY,              -- e.g. E-03
    quarter   VARCHAR(100) NOT NULL,                  -- "Q2 FY26 — Jul to Sep 2026"
    months    JSON         NOT NULL,                  -- ["July","August","September"]
    sent_to   INT          NOT NULL,                  -- headcount at rollout time
    opens     DATE         NOT NULL,
    closes    DATE         NOT NULL,
    status    ENUM('collecting','closed') NOT NULL DEFAULT 'collecting',
    created_at DATETIME    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE engagement_responses (
    id              INT          AUTO_INCREMENT PRIMARY KEY,
    survey_id       VARCHAR(10)  NOT NULL,            -- FK → engagement_surveys.id
    respondent_id   INT          NOT NULL,            -- FK → users.userID
    respondent_name VARCHAR(100) NOT NULL,
    anonymous       BOOLEAN      NOT NULL DEFAULT FALSE,
    months          JSON         NOT NULL,             -- [8,9,7]  — one rating per month
    rest            JSON         NOT NULL,             -- [8,9]    — planning, approachability
    feedback        TEXT         DEFAULT NULL,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_engagement_responses_survey_id (survey_id),
    UNIQUE INDEX uq_one_response_per_person (survey_id, respondent_id)
);
```

---

## Module 1 — Onboarding Experience Survey

### View 1.1: Employee (`OnboardingEmployee`)

#### `GET /api/hr/onboarding/surveys/mine`

Returns the current employee's onboarding surveys.

```jsonc
// Response 200
{
  "surveys": [
    {
      "id": "S-014",
      "employee": "Ravikumar S",
      "dept": "Engineering",
      "joined": "14 Jul 2026",
      "sentOn": "12 Aug 2026",
      "due": "19 Aug 2026",
      "status": "pending", // "pending" | "submitted"
      "answers": [], // [] if pending
      "feedback": "",
      "score": null, // null if pending, else 8.1
    },
  ],
}
```

#### `POST /api/hr/onboarding/submit-survey`

Employee submits their onboarding survey.

```jsonc
// Request
{
  "surveyId": "S-014",
  "answers": [8, 6, 9, 8, 9, 9, 8],   // exactly 7 ints, each 1–10
  "feedback": "Laptop arrived three days late."
}

// Response 200
{
  "surveyId": "S-014",
  "overallScore": 8.1,
  "submittedAt": "2026-08-19T10:30:00"
}

// Side effects:
// - Sets status → "submitted"
// - Sends email to NOTIFY_LIST with subject "Onboarding Experience Survey submitted — {name}"
//   Body includes: overall score, process block avg, HR block avg, lowest rated question, Q8 feedback
```

---

### View 1.2: HR Console (`OnboardingHR`)

#### `GET /api/hr/onboarding/surveys`

Returns all onboarding surveys with filter support.

```jsonc
// Query params: ?status=all|pending|submitted&dateRange=90|30
// Response 200
{
  "surveys": [
    {
      "id": "S-014",
      "employee": "Ravikumar S",
      "dept": "Engineering",
      "joined": "14 Jul 2026",
      "sentOn": "12 Aug 2026",
      "due": "19 Aug 2026",
      "status": "pending",
      "answers": [],
      "feedback": "",
      "score": null,
      "hrBlockAvg": null, // null if not submitted
    },
  ],
}
```

#### `GET /api/hr/onboarding/scores`

Returns computed analytics from submitted surveys.

```jsonc
// Response 200
{
  "overallAvg": 7.4,
  "processBlockAvg": 7.0, // Q1–Q4 average
  "hrBlockAvg": 8.7, // Q5–Q7 average
  "responseRate": 60, // percentage
  "pending": 2,
  "scoresBelow6": 1,
  "submittedCount": 3,
  "distribution": [0, 0, 0, 0, 1, 1, 1, 4, 2, 1], // index 0 = rating 1
  "questionAverages": [6.5, 6.5, 8.0, 7.0, 8.5, 8.5, 8.0],
  "q8Feedback": [
    {
      "score": 9.1,
      "employee": "Karthik V",
      "dept": "Engineering",
      "feedback": "Buddy programme helped a lot.",
    },
    {
      "score": 7.4,
      "employee": "Divya M",
      "dept": "Ad Ops",
      "feedback": "Laptop arrived three days late.",
    },
  ],
}
```

#### `POST /api/hr/onboarding/send-survey`

HR sends onboarding survey to one or more new joiners.

```jsonc
// Request
{
  "recipients": ["Ravikumar S", "Meera K"],   // array of employee names
  "dueDate": "26 Aug 2026",
  "notifyList": "hr@tapmind.com; admin@tapmind.com"
}

// Response 201
{
  "sent": 2,
  "surveyIds": ["S-020", "S-021"]
}

// Side effects:
// - Creates onboarding_surveys rows with status = "pending"
// - Sends email to each recipient with survey link
// - Schedules reminder if not submitted by due date
```

---

### View 1.3: Admin (`OnboardingAdmin`)

#### `GET /api/hr/onboarding/admin`

Org-wide onboarding health metrics.

```jsonc
// Response 200
{
  "orgAvg": 7.4,
  "responseRate": 60,
  "lowestDept": {
    "dept": "Product",
    "avg": 5.8,
    "n": 1,
  },
  "highestDept": {
    "dept": "Engineering",
    "avg": 8.5,
    "n": 2,
  },
  "departmentBreakdown": [
    {
      "dept": "Engineering",
      "sent": 2,
      "responded": 2,
      "avg": 8.5,
      "below6": 0,
    },
    { "dept": "Ad Ops", "sent": 1, "responded": 1, "avg": 7.4, "below6": 0 },
    { "dept": "Product", "sent": 1, "responded": 1, "avg": 5.8, "below6": 1 },
    { "dept": "Sales", "sent": 1, "responded": 0, "avg": null, "below6": 0 },
  ],
  "notificationEmail": {
    "to": "admin@tapmind.com, hr@tapmind.com",
    "subject": "Onboarding Experience Survey submitted — Divya M",
    "body": "Divya M (Ad Ops, joined 01 Jul 2026) submitted the Onboarding Experience Survey. Overall 7.4/10 — process block 7.5, HR team block 8.7. Lowest rated: Smooth & coordinated (6/10).",
  },
}
```

---

## Module 2 — Query & HR Support

### View 2.1: Employee (`QueryEmployee`)

#### `GET /api/hr/queries/mine`

Returns the current employee's raised queries with threads.

```jsonc
// Response 200
{
  "queries": [
    {
      "id": "Q-1042",
      "employee": "Ravikumar S",
      "dept": "Engineering",
      "team": "HR",
      "category": "Payroll",
      "subject": "PF number not reflecting in portal",
      "priority": "Normal",
      "raisedOn": "17 Aug",
      "ageHrs": 48,
      "status": "in_progress",
      "ratings": [],
      "ratingComment": "",
      "supportScore": null,
      "thread": [
        {
          "who": "Ravikumar S",
          "at": "17 Aug, 10:22",
          "text": "My PF number is not showing...",
        },
        {
          "who": "HR Team",
          "at": "17 Aug, 14:05",
          "text": "Checked with the payroll vendor...",
        },
      ],
    },
  ],
}
```

#### `POST /api/hr/queries/raise`

Employee raises a new query.

```jsonc
// Request
{
  "team": "HR",
  "category": "Payroll",
  "subject": "PF number not reflecting in portal",
  "description": "My PF number is not showing in the payroll portal since joining. Payslip shows a blank UAN field.",
  "priority": "Normal"
}

// Response 201
{
  "id": "Q-1045",
  "team": "HR",
  "category": "Payroll",
  "subject": "PF number not reflecting in portal",
  "priority": "Normal",
  "raisedOn": "Today",
  "status": "open",
  "thread": [
    { "who": "Ravikumar S", "at": "Today, 14:22", "text": "My PF number is not showing..." }
  ]
}

// Side effects:
// - Creates query row + initial query_messages row
// - Sends notification email to the routed team
```

#### `POST /api/hr/queries/:id/rate`

Employee rates a resolved query (support survey).

```jsonc
// Request
{
  "ratings": [9, 9, 10, 9, 9, 9],     // exactly 6 ints, each 1–10
  "comment": "Answered same day with the policy clause attached."
}

// Response 200
{
  "queryId": "Q-1021",
  "status": "closed",
  "overallScore": 9.2
}

// Side effects:
// - Sets status → "closed"
// - Computes overall score
// - If score < 6 → flags to admin (adds to admin low-scoring review list)
// - If score < 6 → sends notification email to admin
```

---

### View 2.2: Resolver (`QueryResolver`)

#### `GET /api/hr/queries/queue`

Returns queries for the resolver's team with SLA stats.

```jsonc
// Query params: ?team=HR|L&D
// Response 200
{
  "team": "HR",
  "openCount": 2,
  "overdueCount": 1,
  "resolvedClosedCount": 4,
  "avgSupportScore": 7.5,
  "surveysCompleted": 3,
  "slaHours": 72,
  "queries": [
    {
      "id": "Q-1042",
      "employee": "Ravikumar S",
      "subject": "PF number not reflecting in portal",
      "category": "Payroll",
      "status": "in_progress",
      "ageHrs": 48,
      "overdue": false,
      "raisedOn": "17 Aug",
      "supportScore": null,
    },
  ],
}
```

#### `POST /api/hr/queries/:id/reply`

Resolver sends a reply to the employee.

```jsonc
// Request
{
  "text": "Checked with the payroll vendor — UAN activation is pending at their end. Will update by Thursday."
}

// Response 200
{
  "queryId": "Q-1042",
  "status": "in_progress",
  "thread": [
    { "who": "Ravikumar S", "at": "17 Aug, 10:22", "text": "My PF number..." },
    { "who": "HR Team", "at": "17 Aug, 14:05", "text": "Checked with the payroll vendor..." }
  ]
}

// Side effects:
// - Adds message to query_messages
// - Sets status → "in_progress" if currently "open"
// - Sends email + in-app notification to employee
```

#### `POST /api/hr/queries/:id/resolve`

Resolver marks query as resolved (triggers employee survey).

```jsonc
// Response 200
{
  "queryId": "Q-1042",
  "status": "resolved",
}

// Side effects:
// - Sets status → "resolved"
// - Sends support survey to employee (6-question survey + Q6 comment)
// - Email subject: "{team} Query Support Survey — {subject}"
```

#### `POST /api/hr/queries/:id/reassign`

Reassign query to the other team.

```jsonc
// Request (optional body — can reassign without reason)
{
  "reason": "This is an L&D training budget query, not HR payroll."
}

// Response 200
{
  "queryId": "Q-1042",
  "team": "L&D",                  // new team
  "status": "open"                // resets to open
}

// Side effects:
// - Updates queries.team → new team
// - Sets status → "open"
// - Adds system message to thread: "Reassigned from HR to L&D"
// - Sends notification email to new team
```

---

### View 2.3: Admin (`QueryAdmin`)

#### `GET /api/hr/queries/admin`

Org-wide query & support oversight across all teams.

```jsonc
// Response 200
{
  "avgSupportScore": 7.5,
  "totalRaised": 6,
  "totalResolved": 4,
  "totalOpen": 2,
  "slaBreached": 2,
  "scoresBelow6": 2,
  "questionAverages": [7.0, 6.5, 7.2, 7.8, 7.5, 7.0],
  "distribution": [0, 0, 1, 1, 0, 0, 1, 2, 1, 0],
  "byTeam": [
    {
      "team": "HR",
      "raised": 4,
      "resolved": 3,
      "avg": 7.8,
      "below6": 1,
    },
    {
      "team": "L&D",
      "raised": 2,
      "resolved": 1,
      "avg": 6.5,
      "below6": 1,
    },
  ],
  "lowScoring": [
    {
      "id": "Q-1012",
      "team": "L&D",
      "subject": "Training nomination rejected",
      "avg": 3.5,
      "weakest": "Support provided",
      "comment": "No reason was given for the rejection.",
    },
    {
      "id": "Q-0998",
      "team": "HR",
      "subject": "Reimbursement delay",
      "avg": 4.7,
      "weakest": "Response time",
      "comment": "Took three follow-ups to get a response.",
    },
  ],
}
```

---

## Module 3 — Employee Engagement Survey

### View 3.1: Employee (`EngagementEmployee`)

#### `GET /api/hr/engagement/surveys/open`

Returns engagement surveys currently open for the employee.

```jsonc
// Response 200
{
  "surveys": [
    {
      "id": "E-03",
      "quarter": "Q2 FY26 — Jul to Sep 2026",
      "months": ["July", "August", "September"],
      "closes": "25 Aug 2026",
      "status": "collecting",
      "submitted": false, // true if employee already responded
    },
  ],
}
```

#### `POST /api/hr/engagement/submit`

Employee submits engagement survey response.

```jsonc
// Request
{
  "surveyId": "E-03",
  "months": [8, 9, 7],              // exactly 3 ints (1–10), one per month
  "rest": [8, 9],                   // exactly 2 ints (1–10): planning, approachability
  "feedback": "More cross-team activities please.",
  "anonymous": true
}

// Response 200
{
  "recorded": true,
  "overallScore": 8.2
}

// Side effects:
// - Inserts into engagement_responses
// - UNIQUE constraint: one response per (survey_id, respondent_id)
// - Sends email to NOTIFY_LIST (with name hidden if anonymous)
```

---

### View 3.2: HR Console (`EngagementHR`)

#### `GET /api/hr/engagement/surveys`

Returns all engagement surveys with their responses.

```jsonc
// Query params: ?fy=fy26
// Response 200
{
  "surveys": [
    {
      "id": "E-03",
      "quarter": "Q2 FY26 — Jul to Sep 2026",
      "months": ["July", "August", "September"],
      "sentTo": 142,
      "opens": "12 Aug 2026",
      "closes": "25 Aug 2026",
      "status": "collecting",
      "responseCount": 4,
      "responseRate": 2,
      "responses": [
        {
          "by": "Divya M",
          "anonymous": true,
          "months": [8, 9, 7],
          "rest": [8, 9],
          "feedback": "Annual Day was excellent.",
        },
      ],
    },
  ],
}
```

#### `GET /api/hr/engagement/scores/:surveyId`

Returns computed scores for a specific engagement survey.

```jsonc
// Response 200
{
  "surveyId": "E-03",
  "quarter": "Q2 FY26 — Jul to Sep 2026",
  "quarterAvg": 7.6,
  "responseCount": 4,
  "sentTo": 142,
  "responseRate": 2,
  "monthLabels": ["July", "August", "September"],
  "monthAvgs": [7.3, 8.0, 6.5],
  "restAvgs": [7.3, 8.0], // [planning, approachability]
  "restLabels": ["Planning & execution", "HR approachability"],
  "commentCount": 3,
  "distribution": [0, 0, 0, 1, 0, 1, 2, 2, 3, 0],
  "comments": [
    {
      "score": 7.7,
      "feedback": "Annual Day was excellent. Announce dates earlier.",
      "by": "Anonymous",
    },
    {
      "score": 5.2,
      "feedback": "Activities clash with sprint demos every time.",
      "by": "Anonymous",
    },
    {
      "score": 8.7,
      "feedback": "More cross-team activities please.",
      "by": "Anonymous",
    },
  ],
}
```

#### `POST /api/hr/engagement/rollout`

HR rolls out a new engagement survey.

```jsonc
// Request
{
  "quarter": "Q3 FY26 — Oct to Dec 2026",
  "months": ["October", "November", "December"],
  "closes": "15 Jan 2027",
  "notifyList": "hr@tapmind.com"
}

// Response 201
{
  "id": "E-04",
  "quarter": "Q3 FY26 — Oct to Dec 2026",
  "sentTo": 142,
  "status": "collecting"
}

// Side effects:
// - Creates engagement_surveys row
// - Sends email to all active employees
```

---

### View 3.3: Admin (`EngagementAdmin`)

#### `GET /api/hr/engagement/admin`

Org-wide engagement performance with quarter-on-quarter trends.

```jsonc
// Response 200
{
  "latestQuarter": "Q2 FY26 — Jul to Sep 2026",
  "latestQuarterAvg": 7.6,
  "avgAcrossQuarters": 7.5,
  "avgResponseRate": 24,
  "detractorPct": 0, // % of responses scoring ≤ 5
  "notifyTo": "admin@tapmind.com, hr@tapmind.com",
  "quarterOnQuarter": [
    {
      "quarter": "Q2 FY26 — Jul to Sep 2026",
      "responseCount": 4,
      "sentTo": 142,
      "responseRate": 2,
      "activities": 8.0, // avg of month ratings
      "planning": 7.3, // rest[0] avg
      "approachability": 8.0, // rest[1] avg
    },
    {
      "quarter": "Q1 FY26 — Apr to Jun 2026",
      "responseCount": 3,
      "sentTo": 138,
      "responseRate": 2,
      "activities": 7.7,
      "planning": 7.3,
      "approachability": 8.0,
    },
  ],
  "emailPreview": {
    "to": "admin@tapmind.com, hr@tapmind.com",
    "subject": "Engagement Survey — Q2 FY26 — Jul to Sep 2026 (4 responses)",
    "body": "Average 7.6/10 from 4 of 142 employees. Weakest month: September. 3 written comments received. View the full breakdown in Taskly.",
  },
}
```

---

## Supporting Endpoint (existing)

### `POST /api/users/read`

Used by Onboarding HR to populate the multi-select recipient picker.

```jsonc
// Request
{
  "filter": "Active",
  "searchText": "",
  "departmentID": 0
}

// Response 200
{
  "response": {
    "users": [
      {
        "userID": 552,
        "userName": "Ravikumar S",
        "userEmail": "ravi@tapmind.com",
        "departmentName": "Engineering",
        "roleID": 2,
        "newStatus": "Active"
      }
    ],
    "totalRecords": 142
  }
}
```

---

## API Endpoint Summary

| #   | Method | Route                                 | View         | Module     |
| --- | ------ | ------------------------------------- | ------------ | ---------- |
| 1   | GET    | `/api/hr/onboarding/surveys/mine`     | 1.1 Employee | Onboarding |
| 2   | POST   | `/api/hr/onboarding/submit-survey`    | 1.1 Employee | Onboarding |
| 3   | GET    | `/api/hr/onboarding/surveys`          | 1.2 HR       | Onboarding |
| 4   | GET    | `/api/hr/onboarding/scores`           | 1.2 HR       | Onboarding |
| 5   | POST   | `/api/hr/onboarding/send-survey`      | 1.2 HR       | Onboarding |
| 6   | GET    | `/api/hr/onboarding/admin`            | 1.3 Admin    | Onboarding |
| 7   | GET    | `/api/hr/queries/mine`                | 2.1 Employee | Query      |
| 8   | POST   | `/api/hr/queries/raise`               | 2.1 Employee | Query      |
| 9   | POST   | `/api/hr/queries/:id/rate`            | 2.1 Employee | Query      |
| 10  | GET    | `/api/hr/queries/queue`               | 2.2 Resolver | Query      |
| 11  | POST   | `/api/hr/queries/:id/reply`           | 2.2 Resolver | Query      |
| 12  | POST   | `/api/hr/queries/:id/resolve`         | 2.2 Resolver | Query      |
| 13  | POST   | `/api/hr/queries/:id/reassign`        | 2.2 Resolver | Query      |
| 14  | GET    | `/api/hr/queries/admin`               | 2.3 Admin    | Query      |
| 15  | GET    | `/api/hr/engagement/surveys/open`     | 3.1 Employee | Engagement |
| 16  | POST   | `/api/hr/engagement/submit`           | 3.1 Employee | Engagement |
| 17  | GET    | `/api/hr/engagement/surveys`          | 3.2 HR       | Engagement |
| 18  | GET    | `/api/hr/engagement/scores/:surveyId` | 3.2 HR       | Engagement |
| 19  | POST   | `/api/hr/engagement/rollout`          | 3.2 HR       | Engagement |
| 20  | GET    | `/api/hr/engagement/admin`            | 3.3 Admin    | Engagement |
| 21  | POST   | `/api/users/read`                     | 1.2 HR       | Onboarding |

**Total: 21 endpoints** (13 GET + 8 POST)

---

## Status Flow Diagrams

### Onboarding Survey

```
HR sends  →  pending  →  Employee submits  →  submitted
                  └→  No response by due  →  no_response
```

### Query Lifecycle

```
Employee raises  →  open
Resolver replies  →  in_progress
Resolver resolves  →  resolved  →  Employee rates  →  closed
                    (if score < 6 → flagged to admin)
Employee reopens  →  open
Resolver reassigns  →  open (new team)
```

### Engagement Survey

```
HR rolls out  →  collecting  →  Employee submits  →  (stays collecting until closes)
HR closes  →  closed
```

---

## Field Constraints

| Field                          | Rules                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------- |
| Onboarding`answers`            | Array of exactly 7 ints, each 1–10                                               |
| Onboarding`feedback`           | Non-empty string, max 1000 chars                                                 |
| Query`ratings`                 | Array of exactly 6 ints, each 1–10                                               |
| Query`age_hours`               | Updated via cron job every hour, or computed as`DATEDIFF(NOW(), raised_on) * 24` |
| Engagement`months` (response)  | Array of exactly 3 ints, each 1–10                                               |
| Engagement`rest` (response)    | Array of exactly 2 ints, each 1–10                                               |
| Engagement response uniqueness | One response per`(survey_id, respondent_id)`                                     |
| SLA threshold                  | 72 hours (configurable, default for query overdue flag)                          |
