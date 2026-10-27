import { useEffect, useState } from "react";
import { Card, CardBody, Chip, Spinner, Button } from "@/components/ui";
import * as XLSX from "xlsx";
import {
    computeQuarterlyGrade,
} from "../lib/pmsGrade";

const API_BASE =
    "https://taskly.tapmind.io/t2.0/authentificationUtilization";

export default function ReviewStatus({
    token,
    departmentID,
    userID,
    filterType,
    year,
    month,
    quarter,
}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [usersAll, setUsersAll] = useState<any[]>([]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch(
                    `${API_BASE}/users/read?page=0&size=0`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ filter: "", searchText: "", departmentID: 0 }),
                    }
                );
                const result = await res.json();
                setUsersAll(result?.response?.users || []);
            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };
        fetchUsers();
    }, []);

    // When a specific user is selected, narrow the lists to that user so the
    // panel (and the exported report) reflect only the selected employee.
    const reviewedUsers = (() => {
        const list = data?.reviewedUsers || [];
        if (!userID) return list;
        return list.filter((u) => String(u.userID) === String(userID));
    })();

    const nonReviewedUsers = (() => {
        const list = data?.nonReviewedUsers || [];
        if (!userID) return list;
        return list.filter((u) => String(u.userID) === String(userID));
    })();

    const downloadReviewedExcel = () => {
        if (!reviewedUsers.length) return;

        const rows = reviewedUsers.map((u) => {
            const ratings = u.managerRatings
                ? JSON.parse(u.managerRatings)
                : {};

            const user = usersAll.find((usr) => String(usr.userID) === String(u.userID));
            const reportingManager = usersAll.find((usr) => String(usr.userID) === String(user?.reportingManagerId));
            const elManager = usersAll.find((usr) => String(usr.userID) === String(user?.elManagerId));

            // Get assessor names from first non-empty rating
            let accessor1 = "";
            let accessor2 = "";
            for (const cat of Object.values(ratings) as any[]) {
                if (cat.assessor1 && !accessor1) {
                    const a1 = usersAll.find((usr) => String(usr.userID) === String(cat.assessor1Id));
                    accessor1 = a1?.userName || cat.assessor1Id || "";
                }
                if (cat.assessor2 && !accessor2) {
                    const a2 = usersAll.find((usr) => String(usr.userID) === String(cat.assessor2Id));
                    accessor2 = a2?.userName || cat.assessor2Id || "";
                }
                if (accessor1 && accessor2) break;
            }


            const gradeInfo = (() => {
                try {
                    const parsed =
                        typeof u.grade === "string"
                            ? JSON.parse(u.grade || "[]")
                            : u.grade;

                    return Array.isArray(parsed)
                        ? parsed[0] || {}
                        : parsed || {};
                } catch {
                    return {};
                }
            })();

            const managerAvgRating = Number(u.managerAvgRating ?? 0);
            const starRating = Number(gradeInfo.starRating || 0);

            // Recompute system grade + final rating with the exact quarterlyReview
            // logic (weighted target/goal, capped at 100, 95% system + 5% manager)
            // so the exported grade always matches the UI.
            const {
                systemGrade,
                finalScore: rawFinalRating,
                finalRatingPercent,
                grade,
                label,
            } = computeQuarterlyGrade({
                targetPercent: u.targetPercent,
                goalAchievement: u.goalAchievement,
                targetWeight: Number(gradeInfo.targetWeight ?? 40),
                goalWeight: Number(gradeInfo.goalWeight ?? 60),
                managerRating: managerAvgRating,
                starRating,
            });

            let explanation = "";
            if (finalRatingPercent > 100) {
                explanation = starRating > 0
                    ? `Final Rating ${finalRatingPercent.toFixed(1)}% (>100%) with ${starRating} star${starRating > 1 ? "s" : ""} → Grade ${grade} (${label}).`
                    : `Final Rating ${finalRatingPercent.toFixed(1)}% (>100%) → Grade ${grade} (${label}). Star rating not available in API, defaults to the base Exceeds tier.`;
            } else if (finalRatingPercent > 0) {
                explanation = `Final Rating ${finalRatingPercent.toFixed(1)}% → Grade ${grade} (${label}).`;
            }

            return {
                "Emp ID": u.empId ?? u.userID,
                "User ID": u.userID,
                "Name": u.userName,
                "Email": u.userEmail,
                "Department": user?.departmentName ?? "",
                "Reporting Manager": reportingManager?.userName ?? "",
                "EL Manager": elManager?.userName ?? "",
                "Accessor 1": accessor1,
                "Accessor 2": accessor2,
                "System Grade": systemGrade,
                "Manager Avg Rating": managerAvgRating,
                "Final Rating": Number((rawFinalRating).toFixed(2)),
                "Final Rating %": finalRatingPercent,
                "Stars": starRating,
                "Final Grade": grade > 0 ? grade.toFixed(1) : "",
                "Final Grade Label": label,
                "Final Grade Explanation": explanation,
                "Accountability": ratings.accountability?.assessor1 || ratings.accountability?.assessor2 || "",
                "Engagement": ratings.engagement?.assessor1 || ratings.engagement?.assessor2 || "",
                "Collaboration": ratings.collaboration?.assessor1 || ratings.collaboration?.assessor2 || "",
                "Innovation": ratings.innovation?.assessor1 || ratings.innovation?.assessor2 || "",
                "Communication": ratings.communication?.assessor1 || ratings.communication?.assessor2 || "",
                "Adaptability": ratings.adaptability?.assessor1 || ratings.adaptability?.assessor2 || "",
                "Goal Achievement": u.goalAchievement ?? "",
                "Target Percent": u.targetPercent ?? "",
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reviewed Users");
        XLSX.writeFile(wb, `reviewed_users_${data.periodLabel || "report"}.xlsx`);
    };

    useEffect(() => {
        const fetchReviewStatus = async () => {
            setLoading(true);

            try {
                const payload: Record<string, any> = {
                    filterType,
                };

                // Optional department
                if (departmentID) {
                    payload.departmentID = Number(departmentID);
                }

                // Optional single user
                if (userID) {
                    payload.userID = Number(userID);
                }

                // Monthly
                if (filterType === "monthly") {
                    if (month) {
                        payload.month = Number(month);
                    }

                    if (year && year !== "ALL") {
                        payload.year = String(year);
                    }
                }

                // Quarterly
                if (filterType === "quarterly") {
                    payload.quarter =
                        quarter && quarter !== "ALL"
                            ? quarter
                            : "all";

                    if (year && year !== "ALL") {
                        payload.year = String(year);
                    }
                }

                console.log(
                    "Review Status Payload:",
                    payload
                );

                const response = await fetch(
                    `${API_BASE}/userGoalData/review-status`,
                    {
                        method: "POST",
                        headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify(payload),
                    }
                );

                const result = await response.json();

                console.log(
                    "Review Status Response:",
                    result
                );

                if (!response.ok) {
                    throw new Error(
                        result?.message ||
                        `Review Status API failed: ${response.status}`
                    );
                }

                setData(result);

            } catch (error) {
                console.error(
                    "Review Status API Error:",
                    error
                );

                setData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchReviewStatus();

    }, [
        token,
        filterType,
        departmentID,
        userID,
        month,
        year,
        quarter,
    ]);


    return (
        <Card className="mb-6 border border-default-200 shadow-sm">
            <CardBody className="p-5">

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-semibold">
                            User Review Status
                        </h2>

                        {data?.periodLabel && (
                            <p className="text-xs text-default-500 mt-1">
                                Period: {data.periodLabel}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {reviewedUsers.length > 0 && (
                            <Button
                                size="sm"
                                color="primary"
                                variant="flat"
                                onPress={downloadReviewedExcel}
                            >
                                Download Report
                            </Button>
                        )}

                        {loading && (
                            <Spinner size="sm" />
                        )}
                    </div>
                </div>

                {/* Loading */}
                {loading && !data && (
                    <div className="py-8 flex justify-center">
                        <Spinner />
                    </div>
                )}

                {/* Data */}
                {data && !loading && (
                    <>
                        {/* Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">

                            <StatusCard
                                title="Total Users"
                                value={reviewedUsers.length + nonReviewedUsers.length}
                                color="primary"
                            />

                            <StatusCard
                                title="Reviewed"
                                value={reviewedUsers.length}
                                color="success"
                            />

                            <StatusCard
                                title="Non-Reviewed"
                                value={nonReviewedUsers.length}
                                color="danger"
                            />

                        </div>

                        {/* User lists */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                            <UserTable
                                title="Reviewed Users"
                                users={reviewedUsers}
                                color="success"
                            />

                            <UserTable
                                title="Non-Reviewed Users"
                                users={nonReviewedUsers}
                                color="danger"
                            />

                        </div>
                    </>
                )}

                {/* No data */}
                {!loading && !data && (
                    <div className="py-8 text-center text-default-500">
                        No review status data found.
                    </div>
                )}

            </CardBody>
        </Card>
    );
}


/* -------------------------------------------------------------------------- */
/* Status Card                                                                */
/* -------------------------------------------------------------------------- */

function StatusCard({
    title,
    value,
    color,
}) {
    return (
        <Card
            className={`border border-${color}-200 bg-${color}-50`}
            shadow="none"
        >
            <CardBody className="p-4">

                <p className="text-xs text-default-500">
                    {title}
                </p>

                <div className="flex items-center justify-between mt-1">
                    <p
                        className={`text-3xl font-bold text-${color}`}
                    >
                        {value}
                    </p>

                    <Chip
                        size="sm"
                        color={color}
                        variant="flat"
                    >
                        Users
                    </Chip>
                </div>

            </CardBody>
        </Card>
    );
}


/* -------------------------------------------------------------------------- */
/* User Table                                                                 */
/* -------------------------------------------------------------------------- */

function UserTable({
    title,
    users = [],
    color,
}) {
    return (
        <div className="border border-default-200 rounded-xl overflow-hidden">

            <div
                className={`px-4 py-3 bg-${color}-50 border-b border-${color}-200`}
            >
                <div className="flex items-center justify-between">

                    <p className="font-semibold text-sm">
                        {title}
                    </p>

                    <Chip
                        size="sm"
                        color={color}
                        variant="flat"
                    >
                        {users.length}
                    </Chip>

                </div>
            </div>

            {users.length === 0 ? (
                <div className="p-5 text-center text-sm text-default-400">
                    No users found.
                </div>
            ) : (
                <div className="max-h-64 overflow-auto">

                    {users.map((user, index) => (
                        <div
                            key={user.userID ?? index}
                            className="flex items-center justify-between px-4 py-3 border-b border-default-100 last:border-b-0"
                        >

                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                    {user.userName}
                                </p>

                                <p className="text-xs text-default-400 truncate">
                                    {user.userEmail}
                                </p>
                            </div>

                        </div>
                    ))}

                </div>
            )}

        </div>
    );
}