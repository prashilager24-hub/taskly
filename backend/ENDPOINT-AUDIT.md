# Utilization / Work-Data / Efficiency Endpoint Audit

Repository root: `/home/ubuntu/docker/java/Utilization/authentificationUtilization/authentificationUtilization/authentificationUtilization`
Source root: `src/main/java/tapmind/bsrv/`
Audit date: 2026-09-28 · No code was modified.

---

## 0. Scope reconciliation — the "26 endpoints" claim

The brief asked for 26 endpoints. A verbatim scan of every `@*Mapping` annotation in `controller/` does **not** yield 26 scoped endpoints.

Scoped controllers and their mapping counts (class-level `@RequestMapping` included in `active`):

| Controller | File | Active mappings | Commented mappings |
|---|---|---|---|
| `UserWorkDataController` | `controller/UserWorkDataController.java` | 5 | 1 |
| `UserGoalDataController` | `controller/UserGoalDataController.java` | 2 | 0 |
| `CombinedWorkDataController` | `controller/CombinedWorkDataController.java` | 3 | 0 |
| `DashBoardController` | `controller/DashBoardController.java` | 3 | 0 |
| `EfficiencyReportController` | `controller/EfficiencyReportController.java` | 2 | 2 |
| `EfficiencyUtilizationController` | `controller/EfficiencyUtilizationController.java` | 1 | 1 |
| `GoalEfficiencyController` | `controller/GoalEfficiencyController.java` | 2 | 0 |
| **Total** | | **18** | **4** |

> **Correction to earlier working notes:** a previous pass recorded "25 total / 7 commented". That was wrong. Re-verified by direct scan: **18 active + 4 commented = 22 mapping declarations** across the seven scoped controllers. The 4 commented declarations are `UserWorkDataController.java:84-93` (`POST /form/download`), `EfficiencyReportController.java:19-33` (`POST /report`), `EfficiencyReportController.java:35-49` (`POST /update`), `EfficiencyUtilizationController.java:17-27` (`GET calculate`).

No other controller in the project contains a mapping that belongs to the utilization/work-data/efficiency/goal-efficiency/dashboard surface. The remaining 32 controllers (JWT auth, department, goal, task, target, review, sales calls, TAM, sprints, engagement, onboarding, queries, notifications) are a different functional area and are not audited here.

**This audit therefore covers all 18 verified active endpoints, plus the 4 commented-out declarations documented in §2. The 8-endpoint gap in the original 26 cannot be substantiated from the codebase.**

---

## 1. Cross-cutting findings (apply to all 18 endpoints)

### 1.1 Every endpoint is unauthenticated — CRITICAL

`WebSecurityConfig.java:53-58`:

```java
.authorizeRequests()
.requestMatchers("/t2.0/authentificationUtilization/authenticate",
"/t2.0/authentificationUtilization/**", "/health")
.permitAll()
// All other requests need to be authenticated
.anyRequest().authenticated()
```

All 18 scoped mappings sit under `/t2.0/authentificationUtilization/**` and are therefore `permitAll`. No token is required. `WebSecurityConfig.java:62-63` sets `SessionCreationPolicy.STATELESS`, and `JwtAuthenticationFilter.java:83` always calls `chain.doFilter(...)` regardless of token validity, so a missing/expired/invalid token is indistinguishable from a valid one for these routes.

### 1.2 Method-level security is not enabled at all — CRITICAL

`WebSecurityConfig.java:8` **imports** `EnableGlobalMethodSecurity`, but the class declaration at `WebSecurityConfig.java:22-24` is annotated only:

```java
@Configuration
@EnableWebSecurity
public class WebSecurityConfig {
```

A tree-wide grep for `@PreAuthorize|@Secured|@RolesAllowed|@PostAuthorize|@PreFilter` across `tapmind/bsrv` returns **no matches**, and `EnableMethodSecurity` appears nowhere. Method security is therefore inert, and since no annotation exists it would be inert regardless.

### 1.3 No current-user derivation — CRITICAL

Not one of the seven scoped controllers, nor `UserWorkDataService`, `UserGoalDataService`, `CombinedWorkDataService`, `DashBoardService`, `EfficiencyReportService`, `EfficiencyServiceImpl`, `GoalEfficiencyService`, or `GoalEfficiencyReportService` reads `SecurityContextHolder`, `Authentication`, `getPrincipal()`, `@AuthenticationPrincipal`, or `HttpServletRequest`. `SecurityContextHolder` is used only in `controller/QueryController.java:25`, `controller/EngagementController.java:22`, `controller/OnboardingController.java:22`, `controller/PushController.java:24`.

Consequence: `userID`, `departmentID`, `eLID`, `roleID` and `isHeExecutiveLeader` are **caller-supplied request fields** in every scoped endpoint. Combined with §1.1–§1.2 there is no authentication, no authorization, and no ownership check. Any unauthenticated caller can read or mutate any user's work data, goals, and approvals by changing one JSON field.

### 1.4 CSRF disabled, CORS unrestricted

- `WebSecurityConfig.java:48` — `http.csrf().disable()`.
- `DashBoardController.java:22` — `@CrossOrigin` with no origin restriction, on the controller that returns company-wide efficiency aggregates.

### 1.5 JWT token and request noise written to stdout

- `JwtAuthenticationFilter.java:50` — `System.out.println("jwtToken"+jwtToken);` prints the **raw bearer token** to stdout on every authenticated request. This is a credential leak into logs.
- `JwtAuthenticationFilter.java:61` — `LOGGER.info("JWT Token does not begin with Bearer String")` fires at INFO for every unauthenticated request.
- `EfficiencyReportController.java:54` — `System.out.println(filter.getIsExecutiveLeader())`.
- `EfficiencyReportService.java:923-936` — 14-line `System.out.println` "TAM TARGET DEBUG" block emitted **per row** for department 23.
- `EfficiencyReportService.java:1468-1472` — `System.out.println("Dept=" + ...)` per department.
- `EfficiencyServiceImpl.java:86-89` — 4-line `println` separator block **per user-day row**.

### 1.6 Input validation is essentially absent

| DTO | Constraints present |
|---|---|
| `UserWorkDataRequestDTO.java` | none (no `@NotNull`, `@Min`, `@Valid`) |
| `UserWorkDataRequestDTOList.java:13-14` | `@NotEmpty` — but the type is **never used**; the controller binds a raw `List` |
| `UserWorkDataFilterRequestDTO.java` | none |
| `UserWorkAndGoalRequest.java` | none |
| `UserGoalDataRequestDTO.java` | none |
| `UserGoalDataFilterRequestDTO.java` | none |
| `ReviewStatusFilterDTO.java` | none |
| `CombinedWorkFilterRequestDTO.java` | none |
| `BulkApprovalRequestDTO.java` | none |
| `RejectEntryRequestDTO.java` | none — `type` is a free-text `String` |
| `DashBoardFilter.java` | none (comment says `startDate`/`endDate` "Required" — not enforced) |
| `EfficiencySummaryFilterRequest.java` | none |
| `GoalEfficiencyFilterRequestDTO.java` | none |
| `GoalEfficiencyRequestDTO.java` | none |
| `GoalAchievementUpdateRequest.java:11-21` | `@NotNull` × 4 — **the only validated DTO in the set** |

Only `PUT /form/goal/update` is guarded, and only because it is the one endpoint that applies `@Valid` (`UserWorkDataController.java:106`).

### 1.7 N+1 query pattern

`EfficiencyReportService.listEfficiencySummary` runs three enrichment passes over every result row, each issuing one or more round trips:

- `EfficiencyReportService.java:1139` → `attachLeaveType` → 1 query/row (`:461`)
- `EfficiencyReportService.java:1140` → `attachGoalPercent` → 1–3 queries/row (`:592`, `:598`, `:629`, `:639`, `:649`, `:681`)
- `EfficiencyReportService.java:1141` → `attachTargetAchievedPercent` → 1–2 queries/row (`:827`, `:874`) plus `tamAccountRepository.findAllByCreatedByUserIDAndStatus` per row (`:900-901`)

For a 31-day month across 200 users that is roughly 25,000+ single-row queries inside one `GET`/`POST`. `DashBoardService` duplicates the same design (`attachGoalPercent`, `DashBoardService.java:321`; `attachTargetAchievedPercent`, `:425`; `attachLeaveType`, `:818`).

---

## 2. Commented-out declarations (not reachable)

| # | Method | Path | Location | Notes |
|---|---|---|---|---|
| C-1 | `UserWorkDataController.list` | `POST /form/download` | `UserWorkDataController.java:84-93` | Would have called `UserWorkDataService.listAllDownload` (`:333`), which is the **only** caller of `AsyncReportService.generateCsvAndSendEmail` (`:342`). Verified by grep: with C-1 commented, the whole async CSV + email path is dead code. |
| C-2 | `EfficiencyReportController.getEfficiencyReport` | `POST /report` | `EfficiencyReportController.java:19-33` | Would have called `EfficiencyReportService.getEfficiencyAndUtilization` (`:208`). |
| C-3 | `EfficiencyReportController.updateEfficiencySummary` | `POST /update` | `EfficiencyReportController.java:35-49` | Would have called `EfficiencyReportService.updateEfficiencySummaryForDept28` (`:377`). |
| C-4 | `EfficiencyUtilizationController.calculateAndSaveEfficiencyUtilization(LocalDate)` | `GET calculate` | `EfficiencyUtilizationController.java:17-27` | Per-date variant; superseded by `GET calculateAll`. |

Dormant-code hazards inside C-2/C-3 (not currently exploitable, but live if re-enabled):

- `EfficiencyReportService.java:218-219` builds table names by string concatenation from a DB value: `String dailyTaskTable = departmentName + "_DailyTaskLog";` / `String efficiencyTable = departmentName + "_EfficiencySummary";` then interpolates them at `:224` and `:261` with no identifier quoting. The value comes from `DepartmentRepository.java:186-187` (`findDepartmentNameByID`), so it is not directly attacker-controlled, but any department name containing a backtick or SQL metacharacter would be injected.
- `EfficiencyReportService.java:326-374` vs `:377-442`: `calculateEfficiencySummaryForDept28` derives the table from `departmentName` (`:333-334`) but `updateEfficiencySummaryForDept28` **hardcodes** `AgencyOperationsCuration_DailyTaskLog` (`:387`) and `AgencyOperationsCuration_EfficiencySummary` (`:424`) while still validating `departmentName != null` at `:379-382`. The lookup is dead validation; department 28 is assumed to be that one department.
- The two methods also disagree on grade thresholds — `≥90 High / ≥70 Medium / else Low` (`:357-361`) versus `>100 High / ≥90 At Par / ≥70 Medium / else Low` (`:413-421`).
- `EfficiencyReportService.java:282-284` hardcodes an 8-hour utilization divisor: `totalAllocated.divide(BigDecimal.valueOf(8), 2, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))`.
- `EfficiencyReportService.java:298` compares `request.getUserId() == 0` on a boxed `Integer` — NPE if the client omits `userId`.

---

## 3. Endpoint catalogue

Base URL: `http://<host>:4032` (`application.yaml:5-6`; no `context-path` is configured, so paths are absolute).

---

### UTIL-01 — `POST /t2.0/authentificationUtilization/form/bulkCreate`

`UserWorkDataController.java:22-26`

```java
@PostMapping("/bulkCreate")
public List<UserWorkDataResponseDTO> bulkCreate(
    @RequestBody List<UserWorkDataRequestDTO> requestList) {
  return userWorkDataService.bulkCreateUserWorkData(requestList);
}
```

| Aspect | Detail |
|---|---|
| Request | Raw JSON **array** of `UserWorkDataRequestDTO` (`UserWorkDataRequestDTO.java:13-32`): `dailyTaskLogID, taskID, userID, workDate, setUp, allocatedTime, timeTakenToWork, isForTarget, overAllTime, remarks, units, departmentID, achivedUnits, totalUnitValues, targetID, totalTimePerSetup, isHalfDayLeave, leaveType, taskMeta` |
| Response | Bare `List<UserWorkDataResponseDTO>` (`UserWorkDataResponseWrapperDTO.java:48-79`) — **not** a `ResponseEntity`, so status/body shape is fixed at 200 and cannot signal partial failure |
| Validation | **None** — no `@Valid`, and `UserWorkDataRequestDTO` carries no constraints (§1.6) |
| Auth | None (§1.1–§1.3) |
| Transaction | `UserWorkDataService.java:187` `@Transactional` on `bulkUpsertUserGoalData`; `bulkCreateUserWorkData` at `:58` is **not** annotated — it will run without a transaction, so a mid-list failure leaves a partially written table |
| Service | `UserWorkDataService.bulkCreateUserWorkData` (`:58`) |

**Defects**

1. **Unvalidated mass insert.** Every element is persisted as supplied. `userID`/`departmentID` are never checked against `DepartmentUser`, so rows can be attributed to any user in any department.
2. **No transaction on the bulk path** (`UserWorkDataService.java:58` has no `@Transactional`).
3. **No ownership check** — the entire mass-insert surface is unauthenticated (§1.3).

---

### UTIL-02 — `POST /t2.0/authentificationUtilization/form/bulkWork`

`UserWorkDataController.java:28-60`

| Aspect | Detail |
|---|---|
| Request | `UserWorkAndGoalRequest.java:8-17` — `leaveType, userID, departmentID, workDate, activities[], goals[]` |
| Response | `200` with a plain JSON **string**: `"Full day leave saved"` (`:50`), `"Saved"` (`:59`), or `400` with `"UserID, DepartmentID and WorkDate are required for FULL_DAY leave"` (`:38-39`) |
| Validation | Manual and only for the `FULL_DAY` branch (`:34-36`). The normal branch validates nothing |
| Auth | None |

Behaviour:

- `FULL_DAY` branch (`:32-51`): builds a synthetic `UserWorkDataRequestDTO` with only `userID`, `departmentID`, `workDate`, `leaveType` (`:43-47`) and persists a single row via `bulkCreateUserWorkData` (`:49`).
- Normal branch (`:53-58`): persists `activities` via `bulkCreateUserWorkData` and `goals` via `bulkUpsertUserGoalData`.

**Defects**

1. **Two-phase write with no transaction.** Activities and goals are saved in two independent service calls (`:54`, `:57`). A failure in the goals call leaves activities committed — the client receives a non-2xx exception but the activities are already persisted.
2. **`FULL_DAY` leave rows are fabricated from unvalidated input.** No check that the user exists, belongs to the department, is not already on leave, or that the date is not in the past.
3. **Silent partial success.** If `activities` is null/empty *and* `goals` is null/empty, the method still returns `"Saved"` (`:59`) having written nothing.
4. `leaveType` comparison is `"FULL_DAY".equalsIgnoreCase(request.getLeaveType())` (`:32`) — null-safe, but the `isHalfDayLeave` field on `UserWorkDataRequestDTO.java:30` is never set, so half-day leave is never recorded through this endpoint.

---

### UTIL-03 — `POST /t2.0/authentificationUtilization/form/list`

`UserWorkDataController.java:63-82`

| Aspect | Detail |
|---|---|
| Request | `UserWorkDataFilterRequestDTO.java:13-21` — `userID, roleID, departmentID, startDate, endDate, isForTarget, taskID, eLID` |
| Query params | `page`, `size`, `sortBy` (all `required = false`) |
| Response | `UserWorkDataResponseWrapperDTO.java:15-38` — `status, statusCode, message, response{ userWorkDataList, totalRecords, totalPages, currentPage, pageSize, avgAllocatedHrs, avgTotalWork }` |
| Branching | Paginated when `page > 0 && size > 0` (`:73`), otherwise **full unpaginated list** via `listAll` (`:78`) |
| Services | `UserWorkDataService.listPaginated` (`:461`, `@Transactional(readOnly = true)` at `:460`), `listAll` (`:292`, `@Transactional(readOnly = true)` at `:291`) |
| Auth | None |

**Defects**

1. **Unbounded result set.** Omitting `page`/`size` returns every matching row with no limit — an unauthenticated memory-exhaustion and data-exfiltration vector.
2. **`sortBy` is a client-controlled sort key** passed straight through (`:68`, `:74`); the underlying `Pageable` construction in `UserWorkDataService` is not validated in the controller layer.
3. **Full-day leave and weekends are excluded only from the averages, not the list.** `UserWorkDataRepository.java:155-159`:

```sql
-- REMOVE FULL DAY
AND (u.LeaveType IS NULL OR u.LeaveType != 'FULL_DAY')

-- REMOVE WEEKENDS
AND DAYOFWEEK(u.WorkDate) NOT IN (1,7)
```

This filtering appears **only** in `findOverallAverages` (`:134-173`); `findFilteredWorkData` (`:26-37`) and `findFilteredWorkDataPaginated` (`:47-78`) return leave and weekend rows.
4. **Department 42 special case in the paged query** — `UserWorkDataRepository.java:53-71` overrides the date filter entirely:

```sql
AND (
    (
        :departmentID = 42
        AND :startDate IS NULL
        AND :endDate IS NULL
        AND LOWER(TRIM(u.remarks)) = 'pending'
        AND u.workDate <= CURRENT_DATE
    )
    OR
    (
        NOT (
            :departmentID = 42
            AND :startDate IS NULL
            AND :endDate IS NULL
        )
        AND (:startDate IS NULL OR u.workDate >= :startDate)
        AND (:endDate IS NULL OR u.workDate <= :endDate)
    )
)
```

For department 42 with no dates, the "pending" queue is returned and **all other work data for that department is suppressed**. The business rule is embedded in a JPQL string keyed on a magic department number.
5. The average denominator is calendar days in the inner query (`UserWorkDataRepository.java:139-170`: `GROUP BY u.UserID, DATE(u.WorkDate)` then `AVG(daily_allocated)`), so users with fewer entries in the range get a **higher** average — the divisor is the count of days they have rows for, not the days in the range.
6. `UserWorkDataRepository.java:29-35` repeats the `(:param = 0) OR (:param IS NULL)` pattern seven times per query; on MySQL these defeat index usage.

---

### UTIL-04 — `PATCH /t2.0/authentificationUtilization/form/bulkUpdate`

`UserWorkDataController.java:95-102`

| Aspect | Detail |
|---|---|
| Request | `UserWorkAndGoalRequest` |
| Response | `200` with the string `"Updated Successfully"` (`:101`) |
| Service | `UserWorkDataService.bulkUpdateWorkAndGoals` (`:633`, `@Transactional` at `:632`) → `updateActivities` (`:651`), `updateGoals` (`:686`) |
| Auth | None |

**Defects**

1. **No existence check is visible at the controller**, and no ownership check anywhere — any caller can rewrite any `dailyTaskLogID` / `userGoalDataID`.
2. **Unvalidated ids.** The DTO carries `dailyTaskLogID` (`UserWorkDataRequestDTO.java:13`) and `userGoalDataID` (`UserGoalDataRequestDTO.java:12`) with no `@NotNull`/range constraints.
3. **Blind overwrite** — `PATCH` semantics on a payload that carries full replacement values; partial payloads overwrite with `null`.

---

### UTIL-05 — `PUT /t2.0/authentificationUtilization/form/goal/update`

`UserWorkDataController.java:104-111`

| Aspect | Detail |
|---|---|
| Request | `GoalAchievementUpdateRequest.java:9-22` — `userId` `@NotNull`, `goalId` `@NotNull`, `achievedGoal` `@NotNull`, `workDate` `@NotNull`, `comment` optional |
| Response | `UserGoalDataResponseDTO.java:15-34` |
| Service | `UserGoalDataService.updateGoal` (`:1100`, `@Transactional` at `:1099`) |
| Auth | None |

**This is the only endpoint in the set with request validation** (`UserWorkDataController.java:106` applies `@Valid`).

**Defects**

1. **`achievedGoal` has no `@PositiveOrZero`** (`GoalAchievementUpdateRequest.java:18`) — negative achieved goals are accepted, which will produce negative percentages in every downstream `AchievedGoal / FixedGoal` ratio (`UserGoalDataRepository.java:132-135`, `EfficiencyReportService.java:481-482`).
2. **No authorization on the target row.** `userId` in the body is the only identity used; nothing binds it to the caller (§1.3), so any caller can set any user's achieved goal.
3. `userId`/`goalId` are `Long` here but `Integer` in `UserGoalData.java` and in every repository signature (`UserGoalDataRepository.java:18-24`) — an implicit narrowing conversion.

---

### UTIL-06 — `POST /t2.0/authentificationUtilization/userGoalData/list`

`UserGoalDataController.java:19-35`

| Aspect | Detail |
|---|---|
| Request | `UserGoalDataFilterRequestDTO.java:12-25` — `userID, departmentID, goalID, eLID, fLID, isHeExecutiveLeader, startDate, endDate, goalStartDate, goalEndDate, roleID` |
| Response | `UserGoalDataResponseWrapperDTO.java:13-32` — `status, statusCode, message, response{ userGoalDataList, avgPercent, currentPage, pageSize, totalRecords, totalPages, monthlyAvgBreakdown }` |
| Branching | Paginated when `page > 0 && size > 0` (`:28`), else full list via `listAll` (`:31`) |
| Services | `UserGoalDataService.listPaginated` (`:467`, `@Transactional(readOnly = true)` at `:466`), `listAll` (`:616`, `@Transactional(readOnly = true)` at `:615`) |
| Auth | None |

**Defects**

1. **Unbounded result set** when `page`/`size` are omitted (same class of issue as UTIL-03).
2. **`eLID` / `fLID` / `roleID` are ignored by the service.** `UserGoalDataFilterRequestDTO` exposes them (`UserGoalDataFilterRequestDTO.java:15-18, 24-25`) and `UserGoalDataFilterRequestDTO` is converted via `UserGoalDataService.getFilterDetails` (`:596`) into a `DashBoardFilter` that carries `flID`/`roleID`, but the `findFilteredWithRelations` queries they feed accept only `executiveLeaderID` (`UserGoalDataRepository.java:119-126`, `:281-288`). A caller filtering by functional leader receives unfiltered data.
3. **The `AVG` query treats zero-fixed goals as 0% rather than excluding them** — `UserGoalDataRepository.java:128-146`:

```java
@Query("""
        SELECT
            AVG(
                CASE
                    WHEN ug.fixedGoal > 0
                    THEN (ug.achievedGoal * 100.0) / ug.fixedGoal
                    ELSE 0
                END
            )
        FROM UserGoalData ug
        WHERE ...
        """)
Double getAverageAchievedPercentage(...)
```

Every row with `fixedGoal <= 0` contributes a hard `0` to the average, dragging the reported `avgPercent` down. This same pattern is duplicated in the native SQL at `EfficiencyReportService.java:475-493` and `EfficiencyServiceImpl.java:225-243`, `:312-330`.
4. **Three near-identical "achieved percentage" queries with three different formulas** for the same business number:
   - `getAverageAchievedPercentage` (`:145-146`) — mean of per-row ratios, non-native.
   - `getAverageAchievedPercentageForSD` (`:148-191`, native) — ratio of sums, guarded by `WHEN COALESCE(SUM(fixedGoal),0) = 0 THEN 0`.
   - `getAverageAchievedPercentageForSDAndSDA` (`:193-236`, native) — byte-identical to the previous one despite the different name.
5. **Department-22 native query contradicts the Java implementation and the name.** `UserGoalDataRepository.java:238-266`:

```sql
SELECT ROUND(
    AVG(
        CASE
            WHEN ug.AchievedGoal < 40 THEN
                (ug.FixedGoal * 100.0)
                / NULLIF(ug.AchievedGoal, 0)
            ELSE
                GREATEST(
                    100 -
                    (
                        FLOOR((ug.AchievedGoal - 40) / 10) * 10
                    ),
                    0
                )
        END
    ),
    2
)
FROM UserGoalData ug
WHERE (:userID IS NULL OR ug.UserID = :userID)
  AND (:departmentID IS NULL OR ug.DepartmentID = :departmentID)
AND CAST(ug.modifiedAt AS DATE) BETWEEN :startDate AND :endDate
```

The `WHEN AchievedGoal < 40` branch computes `FixedGoal * 100 / AchievedGoal` — the **inverse** ratio — and clamps nothing, so it can exceed 100 arbitrarily. Every other implementation of the same rule (`EfficiencyReportService.java:560-578`, `EfficiencyServiceImpl.java:436-450`, `DashBoardService` dept-22 helper) returns a flat `100` in that branch. Also note this query filters on `modifiedAt`, not `workDate`.
6. `sumAchivedUnitsByTaskIdRange` (`UserWorkDataRepository.java:527-528`) — note the typo `Achived` in the method name is preserved consistently; no functional issue, but it appears in `EfficiencyReportService.java:1640-1660`.

---

### UTIL-07 — `POST /t2.0/authentificationUtilization/userGoalData/review-status`

`UserGoalDataController.java:37-45`

| Aspect | Detail |
|---|---|
| Request | `ReviewStatusFilterDTO.java:11-20` — `departmentID, filterType, quarter, month, year` — all plain types, **no validation** |
| Response | `ReviewStatusSummaryDTO.java:12-43` |
| Service | `UserGoalDataService.getReviewStatusSummary` (`:1116`) — note: **not** `@Transactional` |
| Auth | None |

Repository queries feeding it:

`UserGoalDataRepository.java:393-406`
```java
@Query("""
        SELECT ug.userID, u.name, u.userEmail, COUNT(ug)
        FROM UserGoalData ug
        JOIN ug.user u
        WHERE (:departmentID IS NULL OR ug.departmentID = :departmentID)
          AND ug.workDate BETWEEN :startDate AND :endDate
          AND ug.approvedByEL = true
        GROUP BY ug.userID, u.name, u.userEmail
        ORDER BY u.name
    """)
```

`UserGoalDataRepository.java:408-421`
```java
@Query("""
        SELECT ug.userID, u.name, u.userEmail, COUNT(ug)
        FROM UserGoalData ug
        JOIN ug.user u
        WHERE (:departmentID IS NULL OR ug.departmentID = :departmentID)
          AND ug.workDate BETWEEN :startDate AND :endDate
          AND (ug.approvedByEL IS NULL OR ug.approvedByEL = false)
        GROUP BY ug.userID, u.name, u.userEmail
        ORDER BY u.name
    """)
```

**Defects**

1. **`departmentID` is optional and silently widens the query.** `(:departmentID IS NULL OR ...)` — omitting it returns review status for every department in the company, unauthenticated.
2. **NULL vs false asymmetry.** The reviewed query requires `approvedByEL = true` (`:399`); the non-reviewed query accepts `NULL OR false` (`:414`). A row with `approvedByEL IS NULL` is counted as *not* reviewed. Given `UserGoalData` permits null `approvedByEL` (and `findByUserAndDepartmentAndDatesWithCommentFilter` at `:323` explicitly matches NULL), this is the intended grouping, but it means the two `COUNT`s are not complements of a single partition if any other state ever appears.
3. **`totalUsers` is derived, not queried** — `reviewedCount + nonReviewedCount` semantics depend entirely on the NULL handling above; a user with goals in two departments is counted once per group.
4. **Missing `@Transactional(readOnly = true)`** on `UserGoalDataService.getReviewStatusSummary` (`:1116`) while the sibling read methods have it (`:466`, `:615`) — inconsistent session/flush behaviour, and `loadAssessorNames` (`:1193`) issues further per-id lookups (`:1242`, `:1259`) inside the same call.
5. `ReviewStatusFilterDTO.filterType`, `quarter`, `year` are raw `String`s with no enum/whitelist; `year` is a `String` here but `Integer` in `QuarterlyReviewRepository.findReviewedEmpIdsByQuarterAndYear` (`:33`), so every call parses it.
6. `QuarterlyReviewRepository.findReviewedSummaryByQuartersAndYear` (`:35-59`) uses `MAX(qr.systemGrade)`, `MAX(qr.managerAvgRating)`, `MAX(qr.finalRating)` etc. across a multi-quarter `GROUP BY` — so for a quarter-range filter it reports the **best** value per employee, not an average or a period-end value, while `COUNT(qr)` reports how many reviews back that maximum.

---

### UTIL-08 — `POST /t2.0/authentificationUtilization/combined/list`

`CombinedWorkDataController.java:20-28`

| Aspect | Detail |
|---|---|
| Request | `CombinedWorkFilterRequestDTO.java:8-12` — `userID, departmentID, startDate, endDate, entryType` (`entryType` documented as "TASK, TARGET, GOAL — null means all", unenforced) |
| Query params | `page` default `1`, `size` default `10` (`:23-24`) |
| Response | `CombinedWorkResponseWrapperDTO.java:10-144` |
| Service | `CombinedWorkDataService.getCombinedData` (`:32`, `@Transactional(readOnly = true)` at `:31`) → `buildDailySummary` (`:257`) |
| Auth | None |

**Defects**

1. **`entryType` is unvalidated free text** used to branch aggregation; an unexpected value silently changes which entry types are aggregated.
2. **Default `page = 1` is likely off-by-one** if `buildDailySummary` (`:257`) applies 0-based paging internally — needs verification against the service body; flagged because the DTO meta (`CombinedWorkResponseWrapperDTO.java:20-25`) reports `currentPage` back to the caller and no `totalPages` cap is visible at the controller.
3. Response DTO exposes `approvedByEL` and `commentForRejection` (`CombinedWorkResponseWrapperDTO.java:87-89`) — i.e. internal EL-review state is returned to any unauthenticated caller.
4. `GoalSummaryDTO` (`:42-54`) and `WorkEntryDTO` (`:56-71`) are declared but the `DailyWorkSummaryDTO` nests `CombinedEntryDTO` (`:39`) — dead DTOs increase serialization surface confusion.

---

### UTIL-09 — `POST /t2.0/authentificationUtilization/combined/approve`

`CombinedWorkDataController.java:30-40`

| Aspect | Detail |
|---|---|
| Request | `BulkApprovalRequestDTO.java:10-14` — `departmentID, taskEntryIDs[], goalEntryIDs[]` — no validation, both lists may be null |
| Response | `200` `{"status": true, "message": "Entries approved successfully"}` (`:36-39`) |
| Service | `CombinedWorkDataService.approveEntries` (`:457`, `@Transactional` at `:456`) |
| Queries | `UserWorkDataRepository.java:490-498` and `UserGoalDataRepository.java:360-368` |

```java
@Modifying
@Transactional
@Query("""
        UPDATE UserWorkData u
        SET u.approvedByEL = true
        WHERE u.dailyTaskLogID IN :ids
    """)
int approveTaskEntries(@Param("ids") List<Integer> ids);
```

```java
@Modifying
@Transactional
@Query("""
        UPDATE UserGoalData g
        SET g.approvedByEL = true
        WHERE g.userGoalDataID IN :ids
    """)
int approveGoalEntries(@Param("ids") List<Integer> ids);
```

**Defects — this is the highest-severity endpoint in the set**

1. **No authorization whatsoever.** The field named `approvedByEL` ("approved by Executive Leader") is settable by any unauthenticated caller. There is no check that the caller is an EL, and no check that the target rows belong to `departmentID` (which is in the request body but is **not** part of either UPDATE).
2. **`departmentID` is accepted and discarded.** Neither `approveTaskEntries` nor `approveGoalEntries` filters on department, so the field has no effect — the endpoint accepts input that looks like a scope limit but does not enforce it.
3. **IDOR by construction.** `dailyTaskLogID` / `userGoalDataID` are raw sequential integers with no ownership predicate. Any caller can approve any row in the system by ID.
4. **Return value discarded.** Both `int` row counts are ignored by the service, so a request naming non-existent IDs still returns `status: true`.
5. **Bulk `IN` list is unbounded** — no `@Size` cap on either list, enabling a single request to rewrite the whole table.
6. `@Transactional` is declared on both the repository methods and the service (`CombinedWorkDataService.java:456`); the inner ones will not actually create a new transaction, which is correct, but the duplication signals uncertainty about the boundary.

---

### UTIL-10 — `POST /t2.0/authentificationUtilization/combined/reject`

`CombinedWorkDataController.java:42-52`

| Aspect | Detail |
|---|---|
| Request | `RejectEntryRequestDTO.java:8-12` — `id` (`Integer`, no `@NotNull`), `type` (`String`, comment says "Task / Goal", **unenforced**), `comment` |
| Response | `200` `{"status": true, "message": "Entry rejected successfully"}` |
| Service | `CombinedWorkDataService.rejectEntry` (`:475`, `@Transactional` at `:474`) |
| Queries | `UserWorkDataRepository.java:500-509`, `UserGoalDataRepository.java:370-379` |

```java
@Modifying
@Transactional
@Query("""
        UPDATE UserWorkData u
        SET u.commentForRejection = :comment
        WHERE u.dailyTaskLogID = :id
    """)
int rejectTaskEntry(@Param("id") Integer id, @Param("comment") String comment);
```

```java
@Modifying
@Transactional
@Query("""
        UPDATE UserGoalData g
        SET g.commentForRejection = :comment
        WHERE g.userGoalDataID = :id
    """)
int rejectGoalEntry(@Param("id") Integer id, @Param("comment") String comment);
```

**Defects**

1. **Same IDOR as UTIL-09**, and here there is not even a `departmentID` field to create a false impression of scoping.
2. **`type` is a stringly-typed discriminator.** Any value other than the expected two either silently no-ops or throws; there is no `@Pattern` and no explicit error branch visible.
3. **`comment` has no length limit** and is written straight into a `TEXT` column — unbounded payload.
4. **Both UPDATEs ignore the affected-row count**, so rejecting a non-existent id returns `status: true`.
5. **Reject does not clear `approvedByEL`.** `findByUserAndDepartmentAndDatesWithCommentFilter` (`UserGoalDataRepository.java:323`) and `findByUserAndDepartmentPaginatedWithCommentFilter` (`:344`) match `(u.approvedByEL IS NULL OR u.approvedByEL = false)`, so a previously-approved row that is then commented remains `approvedByEL = true` and disappears from the review queue while still carrying a rejection comment.

---

### UTIL-11 — `POST /t2.0/authentificationUtilization/DashBoard`

`DashBoardController.java:28-34`

| Aspect | Detail |
|---|---|
| Request | `DashBoardFilter.java:14-31` — `departmentID, elID, startDate, endDate, userID, roleID, flID, goalStartDate, goalEndDate, isHeExecutiveLeader, isHeFunctionalLeader, departmentType` |
| Response | `List<Map<String,Object>>` (`ResponseEntity.ok`, `:33`) — **untyped map**, no response DTO |
| Service | `DashBoardService.listEfficiencySummary` (`:598`, `@Transactional(readOnly = true)` at `:597`) |
| Auth | None |

Note the class-level mapping is `"/t2.0/authentificationUtilization/"` (`DashBoardController.java:21`) with a leading slash, so the effective path contains a double slash: `/t2.0/authentificationUtilization//DashBoard`. Spring's `PathPatternParser` (Boot 3 default) collapses this, but under `AntPathMatcher` it does not — a latent routing inconsistency across the three controllers that use this same base (`DashBoardController.java:21`, `EfficiencyReportController.java:12`, `EfficiencyUtilizationController.java:9`).

**Defects**

1. **`departmentType` is stringly-typed** — `DashBoardFilter.java:31` documents `"business"`, `"support"`, `"all"` and `getDepartmentTypeOrDefault()` (`:34-36`) defaults to `"all"`, but the value is concatenated into SQL by `DashBoardService.buildDepartmentFilter` (`:148`) and `buildDepartmentFilterForDeptTable` (`:157`). This is the closest thing to a SQL-injection vector in the scoped set: the string reaches a SQL fragment unparameterized.
2. **Hierarchy switches are client-controlled booleans.** `isHeExecutiveLeader` / `isHeFunctionalLeader` (`DashBoardFilter.java:25, 28`) select the aggregation level (`getELSummary` `:1150`, `getFLSummary` `:1207`, `getCompanySummary` `:929`) with no server-side role check.
3. **Hard-coded user and department special cases in the calculation path**, e.g. `EfficiencyServiceImpl.java:115` (`isAprMayJun` with no year guard), `EfficiencyReportService.java:660` (users 130/97/118), `:670-672` (user 158, dept 42, Apr–Jun 2026), `:1612` (`List.of(153, 154, 155, 130, 97, 118)`), `:1684` (users 157/124), `UserGoalDataService.java:68` (`GOAL_EQUALS_TARGET_USERS`), `DashBoardService.java:38` (same map). These are per-person business rules compiled into shared service code.
4. **Response is an untyped `List<Map<String,Object>>`** — no schema, and the maps are built with mixed `BigDecimal`/`String`/`Integer` values depending on the branch taken.

---

### UTIL-12 — `POST /t2.0/authentificationUtilization/DashBoardAll`

`DashBoardController.java:36-42`

| Aspect | Detail |
|---|---|
| Request | `DashBoardFilter` |
| Response | `Map<String,Object>` |
| Service | `DashBoardService.listEfficiencySummaryNewData` (`:690`, `@Transactional(readOnly = true)` at `:689`) |
| Auth | None |

**Defects** — same class as UTIL-11. Additionally this service calls `getUserEfficiencySummary` (`:173`) and the three enrichment helpers, so it inherits the N+1 pattern of §1.7 and the hard-coded user/department/month rules of §4.1.

---

### UTIL-13 — `POST /t2.0/authentificationUtilization/DashBoardAll/download/excel`

`DashBoardController.java:44-56`

| Aspect | Detail |
|---|---|
| Request | `DashBoardFilter` |
| Response | `200`, `Content-Disposition: attachment; filename=Efficiency-Summary.xlsx`, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (`:50-55`) |
| Service | `DashBoardService.downloadEfficiencySummaryExcel` (`@Transactional(readOnly = true)` at `:3267`) |
| Auth | None |

**Defects**

1. **Fixed filename, no sanitisation** (`:51`) — acceptable as-is since it is a constant, but it means concurrent downloads cannot be distinguished and the client name can never reflect the requested period.
2. **No row cap.** The export serialises whatever `listEfficiencySummaryNewData` returns into a single in-memory `XSSFWorkbook`; an unbounded range is an OOM vector, unauthenticated.
3. **Workbook built entirely in memory** — `new XSSFWorkbook()` with no streaming SXSSF and no `setCompressTempFiles`; large exports are a heap risk.

---

### UTIL-14 — `POST /t2.0/authentificationUtilization/list-efficiency-summary`

`EfficiencyReportController.java:51-75`

| Aspect | Detail |
|---|---|
| Request | `EfficiencySummaryFilterRequest.java:14-38` — `startDate, endDate, userID, groupBy, departmentID, eLID, query, isHeExecutiveLeader, history, efficiencyLevel, isQuarterly, filters[]` where each `Filter` is `{field, operator, value}` (`:43-50`) |
| Response | `Map<String,Object>` — `{data, summary}` (`:1261-1263`, `:1749-1753`) or `{status:false, message}` (`:1783-1785`) |
| Services | `EfficiencyReportService.listEfficiencySummaryEl` (`:1761`) when `isHeExecutiveLeader && !hasDeptID` (`:61-63`), else `listEfficiencySummary` (`:965`) |
| Auth | None |
| Errors | `500` with `{"status": false, "message": e.getMessage()}` (`:72-73`) — raw exception message leaked to the client |

Main query construction: `EfficiencyReportService.java:970-1136`. Filters are appended at `:1034` (dates), `:1040` (user), `:1045` (department), `:1050-1056` (EL subquery), `:1061` (efficiency level), and `:1099-1105` (dynamic).

**Defects**

1. **SQL injection via `operator` — CRITICAL.** `EfficiencyReportService.java:1099-1105`:

```java
if ("contains".equalsIgnoreCase(f.getOperator())) {
  sql.append(" AND ").append(column).append(" LIKE ? ");
  params.add("%" + f.getValue() + "%");
} else {
  sql.append(" AND ").append(column).append(" ").append(f.getOperator()).append(" ? ");
  params.add(f.getValue());
}
```

`column` is safely whitelisted (`:1069-1097`), but `f.getOperator()` is concatenated **raw** into the statement. `EfficiencySummaryFilterRequest.Filter.operator` (`:47`) has no validation, no enum, and no whitelist anywhere in the class. A request such as `{"filters":[{"field":"Name","operator":"= 1 OR 1=1 -- ","value":"x"}]}` injects arbitrary SQL. This is the single most severe code-level defect in the audit.

2. **`groupBy: "week"` and `groupBy: "month"` are unconditionally broken — CRITICAL.** The week branch (`:982-994`) and month branch (`:998-1010`) do **not** select `e.WorkDate`, but four downstream consumers require it:
   - `attachLeaveType` → `row.get("WorkDate")` (`:456-459`)
   - `attachGoalPercent` → `row.get("WorkDate")` (`:583-586`)
   - `attachTargetAchievedPercent` → `row.get("WorkDate")` (`:819-822`)
   - quarterly grouping → `row.get("WorkDate")` (`:1533-1536`)

   All four do `LocalDate.parse(dateObj.toString())` on a `null`, throwing `NullPointerException`. Since `listEfficiencySummary` calls the first three unconditionally at `:1139-1141`, **any request with `groupBy` of `week` or `month` returns HTTP 500**.

3. **`UserName` / `DepartmentName` matching is `LIKE '%value%'`** (`:1099-1101`). The `%` and `_` wildcards inside `f.getValue()` are not escaped, so a user can craft a filter that matches everything, and the query cannot use an index.

4. **EL filter passes a String into an integer comparison** — `EfficiencyReportService.java:1085`: `params.add(f.getValue())` binds the raw `String` value into `d3.ExecutiveLeaderID = ?` (`:1082`). This relies on MySQL implicit coercion; a non-numeric value silently matches nothing (or, in non-strict mode, coerces to `0`).

5. **Quarterly breakdown NPE** — `EfficiencyReportService.java:1557`:
   ```java
   BigDecimal target = new BigDecimal(row.get("TargetAchievedPercent").toString());
   ```
   Unguarded `null` dereference.

6. **Inconsistent divisors in `computeRowAverages`** — `EfficiencyReportService.java:104-113`. `AvgTargetPercent` divides by `targetCount` (only rows with target > 0, or *all* rows for department 54 — `:92-97`), while `AvgUtilizationPercent`, `AvgAllocatedHrs` and `AvgTotalWork` all divide by `count` (`:109-113`). A user with 5 target days and 20 non-target days gets their utilization averaged over 20 days but their target averaged over 5. The same split is repeated in `averageOfMaps` (`:165-174`) and again in the monthly breakdown (`:1572-1586`). **This is the single most consequential business-logic defect in the endpoint**, because department 54 is granted an explicit exemption at `:94` that no other department receives.

7. **Grade thresholds are score-averaged, not re-derived.** `levelToScore` (`:51-59`) maps High/At Par/Low → 3/2/1, averages, and re-thresholds at `≥2.5 High`, `≥1.5 At Par` (`:116`, `:177`). This is not equivalent to recomputing the level from the averaged metrics, and it silently changes the reported grade of every department/EL/company row.

8. **Efficiency-level rollup uses `MAX`, not a rule** — `EfficiencyReportService.java:989` and `:1005` select `MAX(e.EfficiencyLevel)`. `MAX()` on a string is a lexicographic comparison, so `"Low" > "High" > "At Par"` alphabetically. For `groupBy` week/month the reported `EfficiencyLevel` is effectively `"Low"` whenever any Low day exists.

9. **`DepartmentID` is stripped from the summary but every other level's identity is lost too** — `:1372-1373` removes `_score` and `DepartmentID`, so the EL/company summary rows are returned with no identifying key at all.

10. **`history` mode changes the goal basis mid-response** — `:1383-1490` recomputes `AvgGoalPercent` from `dashBoardService.getAverageSum` per department and merges those values into the summary via `summaryRow.putAll(deptGoalMap)` (`:1520`), so the summary map silently gains dynamically-named keys like `"36"` and `"13"`. The response shape is request-dependent.

11. **Broad `try/catch` that swallows errors** — `:1515-1518` catches `Exception`, calls `e.printStackTrace()`, and sets `avgGoalPercent = ZERO`. A genuine failure is indistinguishable from a genuine zero.

12. **Debug logging inside the row loop** — `:923-936` (`TAM TARGET DEBUG`) and `:1468-1472`.

---

### UTIL-15 — `POST /t2.0/authentificationUtilization/download-efficiency-summary`

`EfficiencyReportController.java:77-94`

| Aspect | Detail |
|---|---|
| Request | `EfficiencySummaryFilterRequest` |
| Response | `200`, `Content-Disposition: attachment; filename=Efficiency_Summary.xlsx` (`:86-87`). Note: **no `Content-Type` is set** — unlike UTIL-13 |
| Errors | `500` with an **empty body** (`:92` `ResponseEntity.internalServerError().build()`) — the caller cannot tell why it failed |
| Service | `EfficiencyReportService.downloadEfficiencySummaryExcel` (`:1866`, `@Transactional(readOnly = true)` at `:1865`) |

Dispatch: `:1869-1871` — `writeELExcel` when `isHeExecutiveLeader`, else `writeNormalExcel`.

**Defects**

1. **Guaranteed NPE on the EL path — CRITICAL.** `writeELExcel` reads a summary that does not exist:
   ```java
   // EfficiencyReportService.java:1920-1921
   Map<String, Object> summary = (Map<String, Object>) data.get("summary");
   writeSingleMap(summarySheet, summary, summaryRow);
   ```
   but `listEfficiencySummaryEl` builds its response as only `status` and `departments` (`:1857-1858`) — there is no `"summary"` key. `writeSingleMap` then dereferences it at `:1954`:
   ```java
   for (Map.Entry<String, Object> entry : map.entrySet()) {
   ```
   → `NullPointerException` → caught at `EfficiencyReportController.java:90` → **HTTP 500 with an empty body**. **Every EL-mode Excel download fails.** The self-admitted TODO at `:1852-1855` documents that the summary section was never implemented.

2. **No `Content-Type` header** (`:85-88`) → clients must sniff the type.

3. **Empty error body** (`:92`) — the exception is only `printStackTrace`d to stdout.

4. **NPE when `startDate`/`endDate` are absent.** `EfficiencyReportService.java:1936` and `:1942` call `Date.valueOf(filter.getStartDate())` unconditionally; `EfficiencySummaryFilterRequest` has no `@NotNull` (§1.6) and the service's own date filters are optional (`:1030-1037`). Any request omitting a date fails in `writeDateRange`.

5. **`Date.valueOf(null)` also breaks the EL data path** — `:1779`, `:1780`, `:1807`, `:1808`, `:1824`, `:1825` all use `filter.getStartDate()`/`getEndDate()` with no null guard, whereas the non-EL path correctly guards at `:1030-1037`.

6. **Column headers are taken from the first row's `keySet()`** — `EfficiencyReportService.java:1968-1973`:
   ```java
   Map<String, Object> firstRow = dataList.get(0);
   int col = 0;
   for (String key : firstRow.keySet()) {
     headerRow.createCell(col++).setCellValue(key);
   }
   ```
   `dataList` is a `List<Map<String,Object>>` built by `queryForList` and then mutated by three enrichment passes. The map type is a driver-specific `LinkedCaseInsensitiveMap`, so **header order and value order depend on the JDBC driver's internal hash order**, and the values are written by iterating `rowData.values()` (`:1979`) assuming value order matches key order. Any row whose key insertion order differs from `firstRow`'s silently misaligns its columns.

7. **Everything is stringified** — `:1957` and `:1980` both do `value.toString()`. Numeric cells lose their type, so Excel cannot sum or sort them.

8. **Sheet name is the department name** — `EfficiencyReportService.java:1911` `workbook.createSheet(deptName)`. Department names are DB-sourced and unvalidated; names exceeding 31 characters, containing `[]:*?/\`, or duplicating an existing sheet name will throw `IllegalArgumentException`, aborting the whole download.

9. **Full in-memory workbook** with no row limit, as UTIL-13.

---

### UTIL-16 — `GET /t2.0/authentificationUtilization/calculateAll`

`EfficiencyUtilizationController.java:29-39`

| Aspect | Detail |
|---|---|
| Request | **No parameters at all** |
| Response | `200` with the string `" Efficiency and Utilization summary calculated and saved successfully."` (`:33`) or `500` with `" Error calculating efficiency/utilization: " + e.getMessage()` (`:36-37`) |
| Service | `EfficiencyServiceImpl.calculateAndSaveDailyEfficiency` (`:53`, `@Transactional` at `:52`) |
| Auth | None |

**This endpoint recomputes and rewrites the entire `EfficiencyUtilizationSummary` table on every call. It is unauthenticated, takes no arguments, and is therefore callable by anyone at any rate.**

Procedure: truncate (`:55`) → iterate every `UserWorkData` group (`:58-365`) → TA/TAM accounts (`:368-398`) → department 22 (`:400-462`).

**Defects**

1. **Unauthenticated full-table rewrite.** `truncateTable()` (`EfficiencyUtilizationSummaryRepository.java:29-32`):
   ```java
   @Modifying
   @Transactional
   @Query(value = "TRUNCATE TABLE EfficiencyUtilizationSummary", nativeQuery = true)
   void truncateTable();
   ```
   is called at `EfficiencyServiceImpl.java:55` inside the method-level `@Transactional` (`:52`). `TRUNCATE` performs an **implicit commit** in MySQL, so the enclosing transaction is silently broken at that point. Any exception later in the run (e.g. the `ClassCastException` risks below) leaves the table **empty or partially rebuilt** with no rollback. Every consumer of the summary (UTIL-11 through UTIL-15) reads from this table, so one failed call wipes reporting data company-wide.
2. **No concurrency control.** The method is not guarded by a lock, schedule, or idempotency check. Two concurrent `calculateAll` calls interleave `TRUNCATE` + `save`, producing duplicate or lost rows. `EfficiencyUtilizationSummary` has **no unique constraint** (`EfficiencyUtilizationSummary.java:17` — `@Table(name = "EfficiencyUtilizationSummary")` with no `uniqueConstraints`), and `saveSummary` (`:828-841`) does a non-atomic find-then-save, so a race yields duplicate `(UserID, DepartmentID, WorkDate)` rows that double-count every average.
3. **Utilization divisor assumptions are hard-coded and inconsistent** — `EfficiencyServiceImpl.java:82-110`:
   ```java
   Set<Integer> SPECIAL_HOURS_DEPTS = Set.of(3, 4, 14, 23, 31, 32, 48);
   ...
   if (departmentId == 48) {
     STANDARD_TIME = Boolean.TRUE.equals(isHalfDayLeave) ? BigDecimal.valueOf(20.0) : BigDecimal.valueOf(40.0);
   } else if (Boolean.TRUE.equals(isHalfDayLeave)) {
     STANDARD_TIME = isSpecialDept ? BigDecimal.valueOf(3.5) : BigDecimal.valueOf(4.0);
   } else {
     STANDARD_TIME = isSpecialDept ? BigDecimal.valueOf(7.0) : BigDecimal.valueOf(8.0);
   }
   ```
   and the ratio at `:143-147`:
   ```java
   utilization = BigDecimal.valueOf(timeTaken)
       .divide(STANDARD_TIME, 2, RoundingMode.HALF_UP)
       .multiply(BigDecimal.valueOf(100));
   ```
   Four different divisor regimes (40/20, 7/3.5, 8/4) are reported as a single "Utilization %" column, and department 48's units are clearly a different measure from the hours used everywhere else. No holiday calendar, no `DayType` check, and no working-day lookup — a fixed constant is the entire denominator.
4. **Utilization is capped only in one direction** — `EfficiencyServiceImpl.java:351-354`:
   ```java
   if ("Low".equalsIgnoreCase(efficiency) && utilization.compareTo(BigDecimal.valueOf(100)) > 0) {
     utilization = BigDecimal.valueOf(100);
   }
   ```
   A `High` or `At Par` row can report utilization far above 100%.
5. **Grade thresholds** — `EfficiencyServiceImpl.java:334-349`:
   ```java
   if (targetPercent >= 100 && goalPercent >= 80 && timeTaken <= allocatedTime) {
     efficiency = "High";
   } else if (targetPercent >= 80 && goalPercent >= 50 && timeTaken <= allocatedTime) {
     efficiency = "At Par";
   } else {
     efficiency = "Low";
   }
   ```
   Note `timeTaken <= allocatedTime` uses the raw `double` values from the query, not the rounded `BigDecimal`s, and `targetPercent` is the already-clamped `targetAchievedPercent` (`:149`).

6. **`goalPercent` is permanently 0 for most departments — CRITICAL.** `EfficiencyServiceImpl.java:309-331`:
   ```java
   } else {

     // existing generic logic
     String goalSql = """
           SELECT
                       COALESCE(
                           ROUND(
                               AVG(
                                   CASE
                                       WHEN ug.FixedGoal > 0
                                       THEN (ug.AchievedGoal * 100.0) / ug.FixedGoal
                                       ELSE 0
                                   END
                               ),
                               2
                           )
                       ) AS GoalPercent
                   FROM UserGoalData ug
                   WHERE ug.UserID = ?
                     AND ug.WorkDate = ?
           """;
   }
   ```
   The `goalSql` string is **constructed and then never executed** — there is no `jdbcTemplate.queryForList(goalSql, ...)` call, and `goalPercent` was initialised to `0` at `:195`. Combined with the thresholds at `:334-349` (`goalPercent >= 80` for High, `>= 50` for At Par), **every department other than 7, 19, 72, 31, 32 and 14 is permanently graded `Low`**, regardless of actual goal attainment. This silently corrupts the `EfficiencyLevel` column for the majority of the organisation on every run of this endpoint.

7. **`isAprMayJun` has no year guard** — `EfficiencyServiceImpl.java:115`:
   ```java
   boolean isAprMayJun = workDate.getMonthValue() >= 4 && workDate.getMonthValue() <= 6;
   ```
   The inverted-TAT target rule at `:119-134` therefore applies to April–June of **every year** in the table, not the 2026 window used elsewhere in the codebase (`EfficiencyReportService.java:671-672`, `:945-946`).

8. **Department 19 double-sums** — `EfficiencyServiceImpl.java:206-209` selects `SUM(... GoalID = 67 ...)` and `SUM(... GoalID = 68 ...)` with `COALESCE(...,0)`, then `:270` does `goalPercent = percent67.add(percent68)`. A single goal can therefore contribute above 100% if both `fixedGoal` values are small. The same additive pattern is at `EfficiencyReportService.java:615`.

9. **TA summaries are hard-coded to department 23 and a single date** — `EfficiencyServiceImpl.java:370-398`:
   ```java
   LocalDate workDate = account.getLiveDate();
   ...
   saveSummary(userId, 23, workDate, 0.0, 0.0, targetAchievedPercent, efficiency, targetAchievedPercent);
   ```
   Every live TAM account writes a summary row attributed to **department 23** regardless of the account's real department, on **one** date (`liveDate`), and passes the target percentage **as the utilization percentage** (`:397`). `allocatedTimeHrs` and `totalTimeOfWork` are both `0.0`, so any average including these rows divides work hours by zero-row users.

10. **`achievedGoal` is used as a day count for the department-22 TAT rule** — `EfficiencyServiceImpl.java:432`:
    ```java
    long days = achievedGoal.longValue();
    ```
    The dept-22 "days to close" rule (`:436-450`) is therefore driven by the achieved-goal *value*, not by any date arithmetic. Contrast `EfficiencyReportService.java:560-578`, where the same rule is applied to `ug.AchievedGoal` too — so the two implementations agree, but both are reading a business-meaning mismatch. The nearby `calculateTATPercent` (`:793-816`) is written as a days-based helper and is **never called**.

11. **Department-22 history is keyed on `ModifiedAt`, not `WorkDate`** — `EfficiencyServiceImpl.java:400-420`:
    ```sql
    SELECT
        ug.UserID,
        ug.WorkDate,
        DATE(ug.ModifiedAt) AS modifiedDate,
        ...
    FROM UserGoalData ug
    WHERE ug.DepartmentID = 22
      AND ug.ModifiedAt IS NOT NULL
      AND ug.UserID IN (
          SELECT DISTINCT jp.CreatedByUserID
          FROM JobPositions jp
          WHERE jp.Status = 'CLOSED'
      )
    ```
    The summary row is written against `modifiedDate` (`:427`), so editing a goal from January moves its January summary into today's date — the reporting history is not stable.

12. **Blind casts that can abort the whole run** — `EfficiencyServiceImpl.java:62-64`:
    ```java
    Integer userId = ((Number) row[0]).intValue();
    Integer departmentId = ((Number) row[1]).intValue();
    LocalDate workDate = ((java.sql.Date) row[2]).toLocalDate();
    ```
    and `:426` `Integer userId = (Integer) row.get("UserID");`. `calculateAll` processes the entire company in one transaction, so a single unexpected column type or null aborts the rebuild after the truncate.

13. **Debug output per row** — `:86-89`.

14. **The whole calculation is a synchronous, unbounded, unauthenticated POST-equivalent.** For a company with a few thousand daily rows this is a long-running DB-bound loop holding a transaction open.

---

### UTIL-17 — `POST /t2.0/authentificationUtilization/goal-efficiency/calculate`

`GoalEfficiencyController.java:18-25`

| Aspect | Detail |
|---|---|
| Request | `GoalEfficiencyRequestDTO.java:8-13` — `userID, departmentID, fromDate, toDate, saveResult` — no validation |
| Response | `GoalEfficiencyResponseWrapperDTO.java:7-11` → `GoalEfficiencyResponseDTO.java:10-16` |
| Service | `GoalEfficiencyService.calculate` (`:28`, `@Transactional` at `:27`) |
| Auth | None |

Dispatch — `GoalEfficiencyService.java:33-45`:
```java
switch (req.getDepartmentID()) {
    case 36 -> goalPercentage = calculateDept36(req.getUserID(), req.getFromDate(), req.getToDate());
    case 13 -> goalPercentage = calculateDept13(req.getUserID(), req.getFromDate(), req.getToDate());
    case 21 -> goalPercentage = calculateDept21Sales(req.getUserID(), req.getFromDate(), req.getToDate());
    default -> throw new RuntimeException("Unsupported department");
}
```

**Defects**

1. **NPE on missing `departmentID` — HIGH.** `GoalEfficiencyService.java:33` switches on a boxed `Integer`; `null` throws `NullPointerException` before reaching the `default` branch, so the caller gets a stack trace rather than the intended `"Unsupported department"` message (`:44`).
2. **`RuntimeException` leaks as HTTP 500** — there is no `@ControllerAdvice` mapping this to a 4xx, and no handler in the controller (`:22-24`).
3. **Only 3 of N departments are supported.** Every other department gets `"Unsupported department"`. The same three-way restriction exists in `GoalEfficiencyReportService.calcDept36` / `calcDept13` / `calcDept21Sales` / `calcGeneral` (`:49`, `:81`, `:113`, `:149`).
4. **`calculateDept13` average is biased low — HIGH.** `GoalEfficiencyService.java:110-125`:
   ```java
   for (UserGoalData g : list) {
     if (g.getFixedGoal().compareTo(BigDecimal.ZERO) == 0) continue;
     BigDecimal pct = g.getAchievedGoal()
             .divide(g.getFixedGoal(), 4, RoundingMode.HALF_UP)
             .multiply(BigDecimal.valueOf(100));
     total = total.add(pct);
   }

   return total.divide(
           BigDecimal.valueOf(list.size()),
           2,
           RoundingMode.HALF_UP
   );
   ```
   Rows with `fixedGoal == 0` are **excluded from the numerator** (`:111`) but **still counted in the denominator** (`list.size()`, `:122`). With 1 real goal at 100% and 9 zero-goal rows, the result is `10.00`, not `100.00`. *(Correcting an earlier note: `calculateDept36` and `calculateDept13` do honour `userID` — they call `findByUserIDAndWorkDateBetween(userID, from, to)` at `:77` and `:104`. The only defect here is the divisor.)*
5. **`saveResult` will fail on the second identical call — HIGH.** `GoalEfficiencyService.java:153-165` does a blind `save()` with no existence check:
   ```java
   GoalEfficiency ge = new GoalEfficiency();
   ge.setUserID(req.getUserID());
   ge.setDepartmentID(req.getDepartmentID());
   ge.setFromDate(req.getFromDate());
   ge.setToDate(req.getToDate());
   ge.setGoalPercentage(percentage);
   goalEfficiencyRepository.save(ge);
   ```
   while the entity declares — `GoalEfficiency.java:10-15`:
   ```java
   @Table(
       name = "GoalEfficiency",
       uniqueConstraints = {
           @UniqueConstraint(columnNames = {"UserID","FromDate","ToDate"})
       }
   )
   ```
   `DepartmentID` is **not** part of the unique key, so (a) repeating a call for the same user+range throws `DataIntegrityViolationException` → 500, and (b) saving for a *different* department with the same user+range collides. Unauthenticated, so a caller can also pollute another user's stored results by writing rows under their `userID`.
6. **`fromDate`/`toDate` are unchecked** — no ordering check (`from <= to`). A reversed range silently yields `0.00` via the empty-result guards at `:88` / `:106` / `:143`.
7. **`userID = null` silently returns `0`** — `findByUserIDAndWorkDateBetween(null, ...)` matches nothing, so the endpoint reports `0.00%` rather than rejecting the request.
8. **Department 21 is unrelated to goal data** — `calculateDept21Sales` (`:132-148`) computes `completed / scheduled` sales calls, completely different from the goal-ratio semantics of departments 36 and 13, yet all three are exposed under one endpoint with one response field named `goalPercentage`.
9. **Rounding asymmetry** — dept 36 and 13 use scale 2 with `HALF_UP` (`:91`, `:122`); dept 21 uses scale 2 (`:146`). Consistent, but `calculateDept13` computes each ratio at scale **4** (`:115`) and only rounds the final average, so results differ from a per-row-rounded average.

---

### UTIL-18 — `POST /t2.0/authentificationUtilization/goal-efficiency/list`

`GoalEfficiencyController.java:27-31`

| Aspect | Detail |
|---|---|
| Request | `GoalEfficiencyFilterRequestDTO.java:11-17` — `userID, departmentID, ELID, isHeExecutiveLeader, startDate, endDate` |
| Response | `Map<String,Object>` (untyped) |
| Service | `GoalEfficiencyReportService.listGoalEfficiency` (`:22`, `@Transactional(readOnly = true)` at `:21`) |
| Repository | `GoalEfficiencyRepository.java:6-8` — **inherits only `JpaRepository`; no custom queries** |
| Auth | None |

**Defects**

1. **The persisted results are never queried.** `GoalEfficiencyRepository` has no `@Query` and no derived finder (`:6-8`). `listGoalEfficiency` therefore recomputes from `UserGoalData` / `SalesCallSchedule` on every request, and the `GoalEfficiency` table written by UTIL-17 (`:164`) is **read by nothing**. Whatever `saveResult` persists is dead storage.
2. **Untyped `Map` response** (`:30`) — no schema, and the same endpoints return different shapes depending on which of the four calculation branches (`calcDept36` `:49`, `calcDept13` `:81`, `calcDept21Sales` `:113`, `calcGeneral` `:149`) is taken.
3. **`ELID` and `isHeExecutiveLeader` are declared** (`GoalEfficiencyFilterRequestDTO.java:13-14`) but `resolveDepartments` (`:179`) governs department selection, and the same three-department restriction applies. A caller supplying an `ELID` gets silently ignored rather than an error.
4. **No pagination** — unlike UTIL-03/UTIL-06 there is no page/size, and `calcGeneral` (`:149`) iterates the full department list. Unbounded response size, unauthenticated.
5. **`startDate`/`endDate` are optional** with no `@NotNull`, and unlike `listEfficiencySummary` (`:1030-1037`) there is no guard before date binding, so the nullability behaviour depends on each branch.

---

## 4. Cross-service business-logic defects

### 4.1 Hard-coded business rules compiled into shared code

The following per-user / per-department / per-month overrides are scattered through shared service methods rather than configuration:

| Rule | Location |
|---|---|
| `SPECIAL_HOURS_DEPTS = {3,4,14,23,31,32,48}` (7h/3.5h divisor) | `EfficiencyServiceImpl.java:82` |
| `TAT_DEPTS = {7,14,23,31,32,16,26,20,38,18,25,19,42,43,44,45,46}` | `EfficiencyServiceImpl.java:112` |
| Departments 59/60/61 get −10% over-achievement penalty | `UserWorkDataRepository.java:383-384` |
| Department 42 "pending" queue overrides the date filter | `UserWorkDataRepository.java:53-71` |
| Department 54 target-average exemption | `EfficiencyReportService.java:92-97` |
| Department 7 goal = hardcoded 100 | `EfficiencyReportService.java:622-625`; `EfficiencyServiceImpl.java:198-200` |
| Departments 19 / 37 / 21 / 22 bespoke goal formulas | `EfficiencyReportService.java:496-578` |
| Departments 36 / 13 / 21 only; all else throws | `GoalEfficiencyService.java:33-45` |
| Department 22 / 31 / 32 / 14 / 72 April–June inversion | `EfficiencyServiceImpl.java:273-307` |
| Users 130/97/118 → `GoalPercent = TargetAchievedPercent` | `EfficiencyReportService.java:660-667` |
| User 158 (dept 42), Apr–Jun 2026 only | `EfficiencyReportService.java:670-679`, `:951-956` |
| Users 153/154/155 monthly override | `EfficiencyReportService.java:1612-1678` |
| Users 157/124 (dept 22) monthly override | `EfficiencyReportService.java:1684-1743` |
| User 117 special task weights (31/48 at 0.70, 94/95 at 0.35 from 2026-06-06) | `EfficiencyReportService.java:1638-1656` |
| User 155 uses TaskID 21, others use 65 | `EfficiencyReportService.java:1658` |
| TAM percentile decay, 7-day grace then −5%/day | `EfficiencyServiceImpl.java:776-791`; `EfficiencyReportService.java:906-909` |
| Dept-23 TaskID 92 scoring `rounded >= 90 ? 100 : 10 + rounded` | `EfficiencyReportService.java:881-888` |
| Dept-23 TaskID 93 scoring `100 - rounded` | `EfficiencyReportService.java:890-897` |
| `GOAL_EQUALS_TARGET_USERS` | `UserGoalDataService.java:68`; `DashBoardService.java:38` |

The Apr–Jun windows are variously guarded by year (`:671-672`, `:945-946`, `:953-954`) and not (`:115`, `:1616-1617`), so the same "April–June rule" is 2026-only in one endpoint and all-years in another.

### 4.2 Leave and working-day handling

- **Full-day leave is excluded by string match, not by flag.** `EfficiencyReportService.java:1167-1175` and `:1829-1834`:
  ```java
  Object lt = row.get("LeaveType");
  if (lt == null) return true;
  return !lt.toString().trim().equalsIgnoreCase("FULL_DAY");
  ```
  `UserWorkData.LeaveType` is a free-text column with no enum, so `"full_day"`, `"Full Day"` and `"FULL-DAY "` are all treated as a working day. `isHalfDayLeave` (a boolean) is used only by `EfficiencyServiceImpl.java:72-80` for the divisor, never for exclusion.
- **Working days = weekdays only.** `EfficiencyServiceImpl.java:753-774` and `EfficiencyReportService.java:689-699` both count Mon–Fri with **no holiday calendar**:
  ```java
  if (day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY) count++;
  ```
  Public holidays are counted as working days, inflating TAM percentages.
- **A different weekend exclusion exists in SQL** — `UserWorkDataRepository.java:159` `AND DAYOFWEEK(u.WorkDate) NOT IN (1,7)`. `DAYOFWEEK` returns `1` = Sunday and `7` = Saturday, so this is correct, but it is a third independent implementation of the same rule.
- **Department 22 uses `ModifiedAt` instead of `WorkDate`** for its history window (`UserGoalDataRepository.java:260`, `EfficiencyServiceImpl.java:404`), so report boundaries shift whenever a goal is edited.

### 4.3 Grade thresholds — five mutually inconsistent definitions

| Thresholds | Location |
|---|---|
| `target ≥ 100 && goal ≥ 80 && timeTaken ≤ allocated` → High; `target ≥ 80 && goal ≥ 50` → At Par | `EfficiencyServiceImpl.java:334-349` |
| `target ≥ 90` → High; `≥ 75` → At Par (TAM) | `EfficiencyServiceImpl.java:382-387`, `:454-459` |
| `target ≥ 100` → High; `target ≥ 80 && util ≥ 80` → At Par; `target ≥ 80 && util ≥ 50` → Low (monthly) | `EfficiencyReportService.java:1589-1597` |
| `avgScore ≥ 2.5` → High; `≥ 1.5` → At Par (rollup) | `EfficiencyReportService.java:116`, `:177` |
| `effPct > 100` → High; `≥ 90` → At Par; `≥ 70` → Medium; else Low (dept 28, dormant) | `EfficiencyReportService.java:413-421` |
| `≥ 90` → High; `≥ 70` → Medium; else Low (dept 28, dormant) | `EfficiencyReportService.java:357-361` |

Only the first is used to populate `EfficiencyUtilizationSummary.EfficiencyLevel`, which is what every read endpoint serves. The rest apply to different, non-overlapping surfaces.

### 4.4 Transaction boundaries

| Concern | Finding |
|---|---|
| `calculateAll` | `EfficiencyServiceImpl.java:52` `@Transactional` wrapping a native `TRUNCATE` (`:55`) → implicit commit breaks the transaction; a mid-run failure leaves the summary table empty (§ UTIL-16) |
| `bulkCreateUserWorkData` | `UserWorkDataService.java:58` — **no `@Transactional`**, so a partial list is committed |
| `bulkWork` | Two independent service calls (`UserWorkDataController.java:54`, `:57`) — no cross-boundary atomicity |
| `listEfficiencySummary` | `EfficiencyReportService.java:964` `@Transactional(readOnly = true)` but issues thousands of queries (§1.7) — a very long read transaction |
| `getReviewStatusSummary` | `UserGoalDataService.java:1116` — **no `@Transactional`**, inconsistent with siblings (`:466`, `:615`) |
| `approveEntries` / `rejectEntry` | `CombinedWorkDataService.java:456`, `:474` — transactional, but see the authorization defects (UTIL-09/10) |
| Repository `@Transactional` | `UserWorkDataRepository.java:491`, `:501`; `UserGoalDataRepository.java:361`, `:371`; `EfficiencyUtilizationSummaryRepository.java:30` — declarative `@Transactional` on Spring Data repository interfaces, which is a documented anti-pattern; it also cannot create a *new* transaction inside an existing one |

---

## 5. Defect summary by severity

### Critical

| # | Endpoint(s) | Defect |
|---|---|---|
| C1 | all 18 | No authentication — `permitAll` on `/t2.0/authentificationUtilization/**` (`WebSecurityConfig.java:53-56`) |
| C2 | all 18 | Method security not enabled (`WebSecurityConfig.java:8` import unused; no annotations tree-wide) |
| C3 | all 18 | No current-user derivation — `userID`/`departmentID` are caller-supplied |
| C4 | UTIL-09 | Unauthenticated bulk approval of any work/goal entry by raw ID |
| C5 | UTIL-10 | Unauthenticated rejection of any work/goal entry by raw ID; `type` unenforced |
| C6 | UTIL-16 | Unauthenticated, unparameterised full-table recompute via `TRUNCATE` inside `@Transactional` |
| C7 | UTIL-14 | **SQL injection** via unvalidated `filters[].operator` concatenated into the query (`EfficiencyReportService.java:1103`) |
| C8 | UTIL-14 | `groupBy: week\|month` always 500 (NPE) — `WorkDate` not selected (`:982-1010`) but required at `:456`, `:583`, `:819`, `:1533` |
| C9 | UTIL-15 | EL-mode Excel download always 500 — `data.get("summary")` is `null` (`:1920-1921` → `:1954`) |
| C10 | UTIL-16 | `goalPercent` is dead-coded to 0 for all departments outside {7,19,72,31,32,14} (`:309-331`) → those departments are permanently `Low` |

### High

| # | Endpoint(s) | Defect |
|---|---|---|
| H1 | UTIL-14 | Inconsistent average divisors: target ÷ `targetCount`, utilization/allocated/work ÷ `count` (`:104-113`, `:165-174`, `:1572-1586`) |
| H2 | UTIL-14 | `MAX(e.EfficiencyLevel)` is a lexicographic string max (`:989`, `:1005`) |
| H3 | UTIL-14 | Grade rollup averages 3/2/1 scores and re-thresholds — not equivalent to recomputing (`:116`, `:177`) |
| H4 | UTIL-17 | `switch` on `Integer` `departmentID` → NPE instead of the intended error (`:33-45`) |
| H5 | UTIL-17 | `calculateDept13` divides by `list.size()` after skipping zero-goal rows (`:110-125`) |
| H6 | UTIL-17 | Blind `save()` against unique key `(UserID, FromDate, ToDate)` → 500 on repeat (`:153-165`; `GoalEfficiency.java:10-15`) |
| H7 | UTIL-16 | No concurrency control + no unique constraint on `EfficiencyUtilizationSummary` → duplicate rows double-count every average |
| H8 | UTIL-03, UTIL-06 | Unbounded result set when `page`/`size` omitted |
| H9 | UTIL-01 | Unvalidated, non-transactional mass insert |
| H10 | UTIL-15 | Column headers/value order derived from `LinkedCaseInsensitiveMap.keySet()`/`values()` (`:1968-1981`) — silent column misalignment |

### Medium

| # | Endpoint(s) | Defect |
|---|---|---|
| M1 | UTIL-14, UTIL-15 | Null `startDate` → `Date.valueOf(null)` NPE (`:1779`, `:1936`) — the non-EL path guards at `:1030-1037`, the EL path does not |
| M2 | UTIL-14 | `TargetAchievedPercent.toString()` unguarded NPE (`:1557`) |
| M3 | UTIL-14 | EL filter binds a `String` into an `Integer` column (`:1085` vs `:1082`) |
| M4 | UTIL-14 | `LIKE '%value%'` with unescaped `%`/`_` (`:1099-1101`) |
| M5 | UTIL-14 | `try/catch (Exception)` + `printStackTrace` silently converts failures to `0` (`:1515-1518`) |
| M6 | UTIL-16 | `isAprMayJun` has no year guard (`:115`) — Apr–Jun of every year |
| M7 | UTIL-16 | Four inconsistent utilization divisor regimes incl. dept 48 at 40/20 (`:82-110`) |
| M8 | UTIL-16 | Utilization capped at 100 only for `Low` rows (`:351-354`) |
| M9 | UTIL-16 | TAM rows hard-coded to department 23, one date, and target% passed as utilization% (`:370-398`) |
| M10 | UTIL-16 | Dept-22 rule reads `achievedGoal` as a day count (`:432`); `calculateTATPercent` (`:793-816`) is dead code |
| M11 | UTIL-16 | Dept-22 history keyed on `ModifiedAt` (`:404`, `:427`) — history is unstable |
| M12 | all | N+1: 3 enrichment passes × 1–3 queries/row (`EfficiencyReportService.java:1139-1141`) |
| M13 | UTIL-06 | Dept-22 native query returns the **inverse** ratio for `AchievedGoal < 40` and filters on `modifiedAt` (`UserGoalDataRepository.java:238-266`) |
| M14 | UTIL-06 | Three near-identical "achieved percentage" queries with two different formulas (`UserGoalDataRepository.java:145`, `:186`, `:231`) |
| M15 | UTIL-06 | `eLID`/`fLID`/`roleID` accepted by the DTO but unsupported by the queries |
| M16 | UTIL-07 | `departmentID` optional → company-wide review status returned unauthenticated (`UserGoalDataRepository.java:397`, `:412`) |
| M17 | UTIL-07 | Missing `@Transactional(readOnly = true)` (`UserGoalDataService.java:1116`) |
| M18 | UTIL-07 | `MAX(...)` rollup reports best-of-N across a quarter range (`QuarterlyReviewRepository.java:35-59`) |
| M19 | UTIL-10 | Rejecting an already-approved row leaves `approvedByEL = true` while adding a comment (`UserGoalDataRepository.java:323`, `:344`) |
| M20 | UTIL-18 | `GoalEfficiencyRepository` has no queries — persisted results are never read |
| M21 | UTIL-15 | No `Content-Type` on the download (`EfficiencyReportController.java:85-88`); `500` with an empty body (`:92`) |
| M22 | UTIL-15 | Sheet name from DB department name — invalid/duplicate/long names throw (`EfficiencyReportService.java:1911`) |
| M23 | UTIL-15, UTIL-13 | All values stringified (`:1957`, `:1980`); full in-memory `XSSFWorkbook`, no row cap |
| M24 | UTIL-02 | Activities and goals saved in two non-atomic calls (`UserWorkDataController.java:54`, `:57`) |
| M25 | UTIL-05 | `achievedGoal` has no `@PositiveOrZero` (`GoalAchievementUpdateRequest.java:18`) |

### Low / hygiene

| # | Detail | Location |
|---|---|---|
| L1 | Raw JWT printed to stdout | `JwtAuthenticationFilter.java:50` |
| L2 | INFO log on every unauthenticated request | `JwtAuthenticationFilter.java:61` |
| L3 | 14-line debug block per row | `EfficiencyReportService.java:923-936` |
| L4 | `println` per row / per department / per request | `EfficiencyServiceImpl.java:86-89`; `EfficiencyReportService.java:1468-1472`; `EfficiencyReportController.java:54` |
| L5 | `@CrossOrigin` unrestricted on the dashboard controller | `DashBoardController.java:22` |
| L6 | Deprecated `authorizeRequests()`/`and()` chain | `WebSecurityConfig.java:53, 59` |
| L7 | Unused import | `WebSecurityConfig.java:8` |
| L8 | `@Transactional` declared on Spring Data repository interfaces | `UserWorkDataRepository.java:491`, `:501`; `UserGoalDataRepository.java:361`, `:371`; `EfficiencyUtilizationSummaryRepository.java:30` |
| L9 | Double-slash base path from trailing-slash `@RequestMapping` | `DashBoardController.java:21`; `EfficiencyReportController.java:12`; `EfficiencyUtilizationController.java:9` |
| L10 | Response contracts are untyped `Map`/`List<Map>` for 6 of 18 endpoints | UTIL-11, 12, 14, 15, 18; `GoalEfficiencyController.java:30` |
| L11 | Dead DTOs | `CombinedWorkResponseWrapperDTO.java:42-71` |
| L12 | Dead code: `calculateTATPercent` | `EfficiencyServiceImpl.java:793-816` |
| L13 | Dead code: `listAllDownload` + the entire async CSV/email path | `UserWorkDataService.java:333`, `:342`; `AsyncReportService.java:51` |
| L14 | Dead code: `getEfficiencyAndUtilization`, `calculateEfficiencySummaryForDept28`, `updateEfficiencySummaryForDept28` | `EfficiencyReportService.java:208`, `:326`, `:377` |
| L15 | Dormant table-name interpolation from a DB value | `EfficiencyReportService.java:218-219`, `:224`, `:261` |
| L16 | Dormant dept-28 methods disagree on table source and thresholds | `EfficiencyReportService.java:333-334` vs `:387`, `:424`; `:357-361` vs `:413-421` |
| L17 | `EfficiencyReportRequest.frequncy` typo, unused | `EfficiencyReportRequest.java:15` |
| L18 | `Integer == 0` on a boxed value | `EfficiencyReportService.java:298` |
| L19 | Unused DTO type | `UserWorkDataRequestDTOList.java:11` |
| L20 | `isHalfDayLeave` never set by the leave endpoint | `UserWorkDataController.java:43-47` |

---

## 6. Recommended remediation order

1. **Close the authentication hole** — remove `/t2.0/authentificationUtilization/**` from `permitAll` (`WebSecurityConfig.java:55`) and enable method security properly (`@EnableMethodSecurity`) on the seven controllers.
2. **Derive the caller from the JWT**, never from the request body. Replace every `userID`/`departmentID` source with `Authentication.getPrincipal()` (pattern already available at `controller/OnboardingController.java:22-24`).
3. **Add ownership predicates to UTIL-09/UTIL-10.** Both UPDATEs must be scoped by a department/user the caller actually leads, and the affected-row count must be checked.
4. **Whitelist `filters[].operator`** (`EfficiencyReportService.java:1103`) — an enum or a `Set.of("=", ">", "<", ">=", "<=", "contains")` check before interpolation. This is a one-line fix for the highest-severity code defect.
5. **Fix `groupBy: week|month`** by selecting a representative `WorkDate` (`MIN(e.WorkDate)`) alongside the aggregates, or by making the enrichment passes null-safe.
6. **Fix the EL Excel path** (`EfficiencyReportService.java:1920-1921`) — either populate `"summary"` in `listEfficiencySummaryEl` or skip the summary sheet.
7. **Execute or delete the dead `goalSql`** (`EfficiencyServiceImpl.java:309-331`) and re-grade the affected departments.
8. **Remove `TRUNCATE`** (`EfficiencyServiceImpl.java:55`) in favour of a keyed `DELETE`, and add `@Lock`/a schedule guard around `calculateAll`. Add a unique constraint on `EfficiencyUtilizationSummary (UserID, DepartmentID, WorkDate)`.
9. **Make the average denominators consistent** (`EfficiencyReportService.java:104-113`, `:165-174`, `:1572-1586`) — pick one denominator, apply it everywhere, and move the department-54 exemption out of the shared helper into a documented parameter.
10. **Extract the hard-coded rules** (§4.1) into configuration tables. The current state is untestable and unreviewable.
11. **Fix `calculateDept13`'s divisor** (`GoalEfficiencyService.java:122`) to use the count of rows actually summed, and make `saveResult` (`GoalEfficiencyService.java:164`) an update-or-insert on the full unique key.
12. **Replace the N+1 enrichment passes** with set-based queries keyed on `(UserID, WorkDate)`.
13. **Add bean validation** to every scoped DTO (§1.6) and drop the stringly-typed `entryType`, `type`, `groupBy`, `departmentType`, and `operator` fields in favour of enums.
14. **Remove `System.out.println` and the raw-token log** (`JwtAuthenticationFilter.java:50`).
