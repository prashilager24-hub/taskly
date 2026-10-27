# Taskly — HR Modules

Nine role components across three modules, plus a shared UI layer and the
question sets. Question wording is taken from `Survey Questions.docx`.

## File map

```
src/
  lib/
    scale.js          1-10 scale labels (Very Poor … Excellent)
    questions.js      ALL survey questions — single source of truth
    metrics.js        avg, one, pct, surveyScore, queryScore, engAvg
    sampleData.js     seed records — replace with your API layer
  components/
    ui.jsx            Pill, Card, Screen, Field, Btn, Scale, ScaleLegend,
                      Distribution, QuestionAverages, EmailPreview, Thread,
                      ContextBar, THead, Empty, OpenPoint
  modules/
    onboarding/
      OnboardingEmployee.jsx   1.1 my surveys · 1.2 survey form
      OnboardingHR.jsx         1.3 console · 1.4 send · 1.5 scores
      OnboardingAdmin.jsx      1.6 onboarding health
    query/
      QueryEmployee.jsx        2.1 raise · 2.2 my queries · 2.3 support survey
      QueryResolver.jsx        2.4 queue · 2.5 detail
      QueryAdmin.jsx           2.6 query & support oversight
    engagement/
      EngagementEmployee.jsx   3.0 open surveys · 3.1 survey form
      EngagementHR.jsx         3.2 console · 3.3 rollout · 3.4 scores
      EngagementAdmin.jsx      3.5 engagement performance
  TasklyHRModules.jsx   DEMO SHELL — delete once routed properly
```

## Wiring

Every component is presentational. It takes data in and calls handlers out;
none of them fetch. Mount each on its own route behind the right permission.

```jsx
<Route path="/hr/onboarding"       element={<OnboardingEmployee ... />} />
<Route path="/hr/onboarding/admin" element={<OnboardingHR ... />} />
```

### Handler contracts

| Component | Handler | Payload |
|---|---|---|
| OnboardingEmployee | `onSubmit(id, answers, feedback)` | `answers` = 7 ints 1-10, index-aligned to `ONB_QUESTIONS`; `feedback` = Q8 |
| OnboardingHR | `onSend(joinerName, dueDate)` | creates a pending survey |
| QueryEmployee | `onRaise({ team, category, subject, desc, priority })` | `team` is `"HR"` or `"L&D"` |
| QueryEmployee | `onRate(id, ratings, comment)` | `ratings` = 6 ints 1-10, aligned to `QUERY_QUESTIONS(team)` |
| QueryResolver | `onReply(id, text)` / `onResolve(id)` | resolve triggers the support survey |
| EngagementEmployee | `onSubmit(id, months, rest, feedback, anonymous)` | `months` = 3 ints, `rest` = 2 ints |
| EngagementHR | `onRollout({ quarter, months, closes })` | `months` = 3 labels |

Admin components are read-only and take data only.

### Email triggers

The dark toast in the demo shell stands in for the notification. Fire the real
mail from your API at these points:

- Onboarding survey sent → to the joiner
- Onboarding survey submitted → to HR + Admin
- Query raised → to the routed team
- Query replied → to the employee
- Query resolved → to the employee, carrying the support survey link
- Support survey submitted → to HR + Admin, flag if the average is below 6
- Engagement survey rolled out → to all employees
- Engagement window closed → summary to HR + Admin

## Styling

Tailwind core utilities only — no custom config needed. Orange accent
(`orange-500` / `orange-50`), greys, near-black. Icons from `lucide-react`.

## Status field reference

- Onboarding survey: `pending` → `submitted`, or `no_response` past due
- Query: `open` → `in_progress` → `resolved` → `closed`
  (`resolved` = resolver is done; `closed` = employee submitted the survey)
- Engagement survey: `collecting` → `closed`

## Open decisions still marked in the code

`OpenPoint` blocks flag two unresolved items. Remove them once decided.

1. **Engagement cadence** — quarterly with three month sub-ratings (as built,
   per the document) vs a survey after each event (the original brief).
   `EngagementHR.jsx`.
2. **Query survey length** — six ratings on every ticket closure, or Q6 per
   ticket plus the full six quarterly. `QueryEmployee.jsx`.

Also outstanding: whether the open-text questions stay mandatory, whether L&D
queries get the same survey, whether month labels carry the activity name, and
the anonymity default on the engagement survey.
