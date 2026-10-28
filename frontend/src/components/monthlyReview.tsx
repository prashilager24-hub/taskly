import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import {
  Card, CardHeader, CardBody,
  Input, Select, SelectItem,
  Button, Chip, Avatar,
  Divider, Progress, Textarea,
  Tooltip,
  Autocomplete, AutocompleteItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  addToast
} from "@/components/ui";
import { format } from "date-fns";
import CustomDateRangePicker from "../components/customDateRangePicker";


const EMP_MAP = {
  "TM-001": { name: "Ravi Kumar", dept: "Engineering", color: "secondary" },
  "TM-002": { name: "Deepa Menon", dept: "Engineering", color: "primary" },
  "TM-003": { name: "Arjun Mehta", dept: "QA", color: "success" },
  "TM-004": { name: "Sana Iqbal", dept: "Product", color: "warning" },
  "TM-005": { name: "Farhan Ali", dept: "DevOps", color: "danger" },
};

const MONTHS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];
const FEEDBACK_CATS = ["Exceeds Expectations", "Meets Expectations", "Needs Improvement"];
const FEEDBACK_TYPES = ["Productivity", "Quality", "Ownership", "Communication"];
const STATUSES = ["On Track", "At Risk", "Delayed"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcScore = (t, u, g) =>
  Math.round(t * 0.25 + u * 0.25 + g * 0.5);

const getBand = (s) => {
  if (s > 80) return { label: "Top Performer", color: "success", variant: "flat" };
  if (s >= 60) return { label: "Good Performer", color: "success", variant: "bordered" };
  if (s >= 50) return { label: "Average Performer", color: "warning", variant: "flat" };
  return { label: "PIP", color: "danger", variant: "flat" };
};

const getRAG = (s) => {
  if (s >= 60) return { label: "On Track", color: "success" };
  if (s >= 30) return { label: "At Risk", color: "warning" };
  return { label: "PIP Required", color: "danger" };
};

const barColor = (s) =>
  s > 80 ? "success" : s >= 60 ? "success" : s >= 50 ? "warning" : "danger";

const initials = (name) =>
  name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

// ─── Default form ─────────────────────────────────────────────────────────────

const DEFAULT = {
  empId: "",
  month: "April",
  year: String(new Date().getFullYear()),
  target: "",
  goal: "",
  util: "",
  eff: "",
  effLabel: "",

  status: "On Track",
  feedbacks: [
    {
      feedbackCat: "",
      feedbackType: "",
      feedback: "",
    },
  ],
};

// ─── AutoTag ─────────────────────────────────────────────────────────────────

function AutoTag() {
  return (
    <Chip size="sm" variant="flat" color="default"
      classNames={{ base: "h-4 px-1", content: "text-[9px] font-bold  tracking-wider" }}>
      AUTO
    </Chip>
  );
}

// ─── LivePreview ──────────────────────────────────────────────────────────────

function LivePreview({ form }) {
  const t = parseFloat(form.target) || 0;
  const u = parseFloat(form.util) || 0;
  const g = parseFloat(form.goal) || 0;

  const hasData = t || u || g;

  const score = hasData
    ? calcScore(t, u, g)
    : null;
  const band = score !== null ? getBand(score) : null;
  const rag = score !== null ? getRAG(score) : null;
  const emp = EMP_MAP[form.empId];

  const scoreColorMap = { success: "#17c964", warning: "#f5a524", danger: "#f31260" };
  const scoreColor = band ? scoreColorMap[band.color] : "#d4d4d8";

  return (
    <Card className="sticky top-6 shadow-sm border border-divider" radius="lg">
      <CardHeader className="pb-0 pt-5 px-5 flex-col items-center gap-1">
        <p className="text-[10px] uppercase tracking-[.18em] text-default-400 ">Live Score</p>
        <span
          className="text-6xl font-black leading-none tracking-tighter transition-colors duration-300"
          style={{ color: scoreColor }}
        >
          {score !== null ? `${score}%` : "—"}
        </span>
        <div className="mt-2 min-h-[26px] flex justify-center">
          {band && (
            <Chip color={band.color} variant={band.variant} size="sm" className="font-semibold">
              {band.label}
            </Chip>
          )}
        </div>
      </CardHeader>

      <CardBody className="gap-3 pt-4 px-5 pb-5">
        {/* Progress bar */}
        <Progress
          value={score ?? 0}
          color={band ? barColor(score) : "default"}
          size="sm"
          radius="sm"
          className="mb-1"
          aria-label="score-bar"
        />

        <Divider />

        {/* Metric rows */}
        {[
          ["Target", form.target ? `${form.target}%` : "—"],
          ["Goal", form.goal ? `${form.goal}%` : "—"],
          ["Utilization", form.util ? `${form.util}%` : "—"],
        ].map(([lbl, val]) => (
          <div key={lbl} className="flex justify-between items-center py-1 border-b border-divider last:border-0">
            <span className="text-[11px]  text-default-400">{lbl}</span>
            <span className="text-sm font-semibold text-default-700">{val}</span>
          </div>
        ))}

        {/* RAG */}
        <div className="flex justify-between items-center py-1">
          <span className="text-[11px]  text-default-400">RAG Status</span>
          {rag ? (
            <Chip color={rag.color} variant="dot" size="sm" className="font-semibold text-xs">
              {rag.label}
            </Chip>
          ) : (
            <span className="text-default-300 text-sm">—</span>
          )}
        </div>
        <div className="bg-default-50 border border-divider rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-[.15em] text-default-400 mb-2">
            Live Score Calculation
          </p>

          <div className="flex flex-col gap-2">

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-default-600">
                Goal Achievement
              </span>

              <span className="text-[11px] text-default-400">
                50% Weightage
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-default-600">
                Target %
              </span>

              <span className="text-[11px] text-default-400">
                25% Weightage
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-default-600">
                Utilization %
              </span>

              <span className="text-[11px] text-default-400">
                25% Weightage
              </span>
            </div>

          </div>

          <div className="mt-3 pt-3 border-t border-divider">
            <p className="text-[11px] text-default-500 leading-relaxed">
              Final Live Score =
              <span className="font-semibold">
                {" "} (Goal × 50%)
              </span>
              {" + "}
              <span className="font-semibold">
                (Target × 25%)
              </span>
              {" + "}
              <span className="font-semibold">
                (Utilization × 25%)
              </span>
            </p>
          </div>
        </div>

        {/* Employee chip */}
        {emp && (
          <>
            <Divider />
            <div className="flex items-center gap-2">
              <Avatar
                name={initials(emp.name)}
                color={emp.color}
                size="sm"
                classNames={{ base: "text-white font-bold text-xs" }}
              />
              <div>
                <p className="text-sm font-bold text-default-800 leading-tight">{emp.name}</p>
                <p className="text-[11px]  text-default-400">{form.empId} · {emp.dept}</p>
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

// ─── ReviewCard ───────────────────────────────────────────────────────────────

function ReviewCard({ review, index, onDelete, usersAll }) {
  const emp = usersAll?.find(
    (u) => String(u.userID) === String(review.empId)
  ) || null;
  const score = calcScore(
    review.target,
    review.util,
    review.goal
  ); const band = getBand(score);
  const rag = getRAG(score);

  return (
    <Card className="mb-3 shadow-sm border border-divider hover:border-default-400 transition-colors" radius="lg">
      <CardBody className="p-5">
        {/* Top row */}
        <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Avatar
              name={initials(emp?.userName || "NA")}
              color="primary"
              size="md"
            />
            <div>
              <p className="font-bold text-default-800 text-sm leading-tight">
                {emp?.userName || "Unknown User"}
                <span className="ml-2 text-[11px] text-default-400">—{review.startDate} to {review.endDate} {review.month} {review.year} </span>
              </p>
              <p className="text-[11px] text-default-400 mt-0.5">
                {review.empId} · {emp?.departmentName || "N/A"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Chip color={band.color} variant={band.variant} size="sm" className="font-semibold text-xs">
              {band.label}
            </Chip>
            <Chip color={rag.color} variant="dot" size="sm" className="font-semibold text-xs">
              {rag.label}
            </Chip>
            <Tooltip content="Delete review" color="danger" placement="top">
              <Button
                isIconOnly size="sm" variant="light" color="danger"
                className="min-w-unit-6 w-6 h-6"
                onPress={() => onDelete(index)}
              >
                <span className="text-xs">✕</span>
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Metric grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {
            [
              ["Score", `${score}%`, band.color],
              ["Target", `${review.target}%`, null],
              ["Goal", `${review.goal}%`, null],
              ["Util", `${review.util}%`, null],
            ].map(([lbl, val, color]) => (
              <div key={lbl} className="bg-default-50 border border-divider rounded-xl p-2.5 text-center">
                <p className="text-[9px]  uppercase tracking-widest text-default-400 mb-1">{lbl}</p>
                <p className={`text-lg font-black leading-none ${color ? `text-${color}` : "text-default-800"}`}>
                  {val}
                </p>
              </div>
            ))}
        </div>

        {/* Progress */}
        <Progress
          value={score}
          color={barColor(score)}
          size="sm"
          radius="sm"
          aria-label="review-score-bar"
          className="mb-3"
        />

        {/* Feedback */}
        {Array.isArray(review.feedback) &&
          review.feedback.length > 0 ? (

          <div className="flex flex-col gap-3">

            {review.feedback.map((fb, idx) => (

              <div
                key={idx}
                className="bg-primary-50 border-l-[3px] border-primary-400 rounded-r-lg px-3.5 py-2.5"
              >

                <div className="flex items-center gap-1.5 mb-1.5">

                  {fb.feedbackType && (
                    <Chip
                      size="sm"
                      color="primary"
                      variant="flat"
                      classNames={{
                        content: "text-[10px] font-semibold"
                      }}
                    >
                      {fb.feedbackType}
                    </Chip>
                  )}

                  <span className="text-[11px] font-semibold text-primary-600">
                    {fb.feedbackCat}
                  </span>

                </div>

                <p className="text-sm text-default-600 leading-relaxed">
                  {fb.feedback}
                </p>

              </div>
            ))}
          </div>

        ) : (

          <p className="text-xs text-default-400 italic">
            No feedback available
          </p>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MonthlyReview() {
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onOpenChange: onDeleteOpenChange,
    onClose: onDeleteClose,
  } = useDisclosure();

  const [selectedDeleteId, setSelectedDeleteId] =
    useState(null);
  const openDeleteConfirm = (id) => {

    setSelectedDeleteId(id);

    onDeleteOpen();
  };
  const [form, setForm] = useState(DEFAULT);
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [userSummary, setUserSummary] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 3, 1).toISOString().split("T")[0], // April 1
    endDate: new Date().toISOString().split("T")[0], // today
  });
  const [reviews, setReviews] = useState([]);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const authUserLD = localStorage.getItem("authUserLD");
  const authUser = authUserLD ? JSON.parse(authUserLD) : null;
  const user = authUser;

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedFilterUser, setSelectedFilterUser] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [efficiencyFilter, setEfficiencyFilter] = useState("");

  const efficiencyLevels = ["High", "At Par", "Low"];

  const [departmentList, setDepartmentList] = useState([]);
  const [usersAll, setUsersAll] = useState([]);
  const filteredUsers = usersAll.filter((u) => {
    if (!filterStatus) return true;
    return String(u.departmentID) === String(filterStatus);
  });


  const set = (field) => (val) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  // For native Input onChange
  const setE = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const g = parseFloat(form.goal) || 0;
  const u = parseFloat(form.util) || 0;
  const t = parseFloat(form.target) || 0;
  const score = g || u || t ? calcScore(t, u, g) : null;
  const mandatory = score !== null && score < 50;

  function getEfficiencyLevel(target, goal, timeTaken, allocatedTime) {
    if (
      target >= 100 &&
      goal >= 80 &&
      timeTaken <= allocatedTime
    ) {
      return "High";
    }

    if (
      target >= 80 &&
      goal >= 50 &&
      timeTaken <= allocatedTime
    ) {
      return "At Par";
    }

    return "Low";
  }

  const selectedUser = useMemo(() => {
    if (!form.empId || usersAll.length === 0) return null;

    return usersAll.find(
      (u) => String(u.userID) === String(form.empId)
    );
  }, [form.empId, usersAll]);
  const selectedGoalSummary = useMemo(() => {
    if (!dashboardData?.userGoalSummary || !form.empId) return null;

    return dashboardData.userGoalSummary.find(
      (u) => String(u.UserID) === String(form.empId)
    );
  }, [dashboardData, form.empId]);

  const selectedSummary = useMemo(() => {
    if (!dashboardData?.userSummary || !form.empId) return null;

    return dashboardData.userSummary.find(
      (u) => String(u.UserID) === String(form.empId)
    );
  }, [dashboardData, form.empId]);



  const goalVal = selectedGoalSummary?.AvgGoalEfficiency?.toFixed(2) || "";
  const utilVal = selectedSummary?.AvgUtilizationPercent?.toFixed(2) || "";
  const targetVal = selectedSummary?.AvgTargetPercent?.toFixed(2) || "";
  const effPercent =
    selectedSummary?.AvgAllocatedHrs
      ? (
        (selectedSummary.AvgTotalWork /
          selectedSummary.AvgAllocatedHrs) * 100
      ).toFixed(2)
      : "";

  const effLabel =
    selectedSummary?.AvgAllocatedHrs
      ? getEfficiencyLevel(
        targetVal,  // ✅ use target here
        goalVal,
        selectedSummary?.AvgTotalWork || 0,
        selectedSummary?.AvgAllocatedHrs || 0
      )
      : "";

  const payload = useMemo(() => {


    const isEmployeeSelected = !!form.empId;
    console.log("Selected User:", selectedUser);
    const userToUse = isEmployeeSelected ? selectedUser : authUser;

    const base = {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,

      roleID: userToUse?.roleID || authUser.userRole,

      userID: userToUse?.userID || null,

      isHeExecutiveLeader: userToUse?.roleID === 3, // EL
      isHeFunctionalLeader: userToUse?.roleID === 4, // FL
    };

    // Role-based override (VERY IMPORTANT)
    if (!isEmployeeSelected) {
      if (authUser.userRole === 2) return base;

      if (authUser.isHeExecutiveLeader) {
        return { ...base, departmentID: null, elID: authUser.userID };
      }

      if (authUser.isHeFunctionalLeader) {
        return { ...base, departmentID: null, flID: authUser.userID };
      }
    }

    return base;
  }, [dateRange, form.empId, selectedUser]);

  // useEffect(() => {


  //   const controller = new AbortController();

  //   const fetchDashboard = async () => {
  //     setLoading(true);
  //     try {
  //       const res = await axios.post(
  //         "/t2.0/authentificationUtilization/DashBoardAll",
  //         payload,
  //         {
  //           headers: {
  //             "Content-Type": "application/json",
  //             Authorization: `Bearer ${authUser?.token ?? ""}`,
  //           },
  //           signal: controller.signal,
  //         }
  //       );
  //       console.log(res.data.userGoalSummary[0]["AvgGoalEfficiency"], "fghjhgfdghj")

  //       setDashboardData(res.data);
  //       setUserSummary(res.data.response.userSummary);

  //     } catch (err) {
  //       if (!axios.isCancel(err)) {
  //         console.error("Dashboard fetch error:", err);
  //       }
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchDashboard();

  //   return () => controller.abort();
  // }, [payload]);

  useEffect(() => {

    const controller = new AbortController();

    const fetchDashboard = async () => {

      setLoading(true);

      try {

        // ─────────────────────────────────────
        // EFFICIENCY SUMMARY API
        // ─────────────────────────────────────

        const bodyData = {

          departmentID:
            filterStatus
              ? Number(filterStatus)
              : null,

          startDate: dateRange.startDate,

          endDate: dateRange.endDate,

          userID:
            selectedFilterUser
              ? Number(selectedFilterUser)
              : null,

          groupBy: "day",

          isHeExecutiveLeader:
            false,

          efficiencyLevel:
            efficiencyFilter || null,
        };
        console.log(bodyData)

        const res = await axios.post(
          "/t2.0/authentificationUtilization/list-efficiency-summary",
          bodyData,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authUser?.token ?? ""}`,
            },
            signal: controller.signal,
          }
        );

        // ─────────────────────────────────────
        // GOAL API
        // ─────────────────────────────────────

        const goalBody = {

          departmentID:
            filterStatus
              ? Number(filterStatus)
              : null,

          userID:
            selectedFilterUser
              ? Number(selectedFilterUser)
              : null,

          startDate: dateRange.startDate,

          endDate: dateRange.endDate,

          roleID: user?.userRole,

          elID:
            user?.isHeExecutiveLeader
              ? user.userID
              : null,

          isHeExecutiveLeader:
            user?.isHeExecutiveLeader || false,

          searchText: "",
        };

        const goalRes = await axios.post(
          `/t2.0/authentificationUtilization/userGoalData/list?page=1&size=10`,
          goalBody,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authUser?.token ?? ""}`,
            },
            signal: controller.signal,
          }
        );

        // ─────────────────────────────────────
        // GOAL VALUE
        // ─────────────────────────────────────

        const avgGoal =
          goalRes?.data?.response?.avgPercent
            ? Number(goalRes.data.response.avgPercent).toFixed(2)
            : "0";

        // ─────────────────────────────────────
        // SUMMARY
        // ─────────────────────────────────────

        const summary = res.data.summary;

        console.log("Efficiency Summary:", summary);

        setDashboardData(res.data);

        setUserSummary(summary);

        // ─────────────────────────────────────
        // MAP VALUES TO FORM
        // ─────────────────────────────────────
        setForm((prev) => ({

          ...prev,

          // Goal API
          goal: avgGoal,

          // Efficiency Summary API
          target:
            summary?.AvgTargetPercent?.toFixed(2) || "",

          util:
            summary?.AvgUtilizationPercent?.toFixed(2) || "",

          eff:
            summary?.AvgAllocatedHrs
              ? (
                (summary.AvgTotalWork /
                  summary.AvgAllocatedHrs) * 100
              ).toFixed(2)
              : "",

          // THIS SHOULD COME FROM LIST SUMMARY API
          effLabel:
            summary?.EfficiencyLevel || "",

        }));

      } catch (err) {

        if (!axios.isCancel(err)) {

          console.error("Dashboard fetch error:", err);

        }

      } finally {

        setLoading(false);

      }
    };
    if (filterStatus) {
      fetchDashboard();

    }

    return () => controller.abort();

  }, [
    filterStatus,
    dateRange,
    selectedFilterUser,
    efficiencyFilter,
  ]);

  useEffect(() => {
    if (!selectedSummary || !selectedGoalSummary) return;

    setForm((prev) => ({
      ...prev,
      goal: goalVal,
      target: targetVal,
      util: utilVal,
      eff: effPercent,
      effLabel: effLabel,
    }));
  }, [selectedSummary, selectedGoalSummary]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const body = {
          filter: "",
          searchText: "",
          departmentID: filterStatus ? Number(filterStatus) : 0
        };

        const res = await axios.post(
          "/t2.0/authentificationUtilization/users/read?page=0&size=0",
          body,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
            },
          }
        );

        const usersData = res.data.response.users || [];

        const formatted = usersData.map((u) => ({
          userID: u.userID,
          userName: u.userName,
          departmentName: u.departmentName,
          departmentID: u.departmentID,
        }));

        setUsersAll(usersData);
        console.log("Users formatted:", formatted);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };

    fetchUsers();


  }, [filterStatus]);


  //fetch 
  // ─────────────────────────────────────────────
  // FETCH MONTHLY REVIEWS API CALL
  // ─────────────────────────────────────────────

  const fetchMonthlyReviews = async () => {

    if (!selectedFilterUser) return;

    try {

      setLoading(true);

      const response = await axios.get(
        `/t2.0/authentificationUtilization/monthly-reviews/${selectedFilterUser}/${form.year}`,
        {
          headers: {
            "Content-Type": "application/json",

            Authorization: `Bearer ${authUserLD
              ? JSON.parse(authUserLD).token
              : ""
              }`,
          },
        }
      );

      console.log(
        "Monthly Reviews Response:",
        response.data
      );

      // ─────────────────────────────
      // FORMAT API RESPONSE
      // ─────────────────────────────

      const formatted =
        (response.data || []).map((item) => ({

          id: item.id,

          empId: item.empId,

          month: item.month,

          target:
            Number(item.target || 0),

          goal:
            Number(item.goal || 0),

          util:
            Number(item.utilization || 0),

          eff:
            Number(item.efficiency || 0),

          effLabel:
            item.efficiencyLabel || "",


          year:
            item.year,

          feedback:
            item.feedback || [],

          accessor:
            item.accessor || [],

          status:
            item.status || "",

          startDate: item.startDate,

          endDate: item.endDate,

          ts:
            item.timestamp || Date.now(),

          createdAt:
            item.createdAt,

          updatedAt:
            item.updatedAt,
        }));

      console.log(
        "Formatted Monthly Reviews:",
        formatted
      );

      // ─────────────────────────────
      // UPDATE STATE
      // ─────────────────────────────

      setReviews(formatted);

    } catch (err) {

      console.error(
        "Fetch Monthly Reviews Error:",
        err
      );

      addToast({
        title: "Error",
        description:
          err?.response?.data?.message ||
          "Failed to fetch monthly reviews",
        color: "danger",
      });

    } finally {

      setLoading(false);
    }

  };

  useEffect(() => {

    fetchMonthlyReviews();

  }, [selectedFilterUser, form.year]);


  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const bodyData = {
          searchText: "",
          filter: "",
          startDate: "",
          endDate: "",
          roleID: user.userRole,
          userID: user.isHeExecutiveLeader ? Number(user.userID) : user?.userID || null,
        };

        const res = await fetch("/t2.0/authentificationUtilization/Department/list?page=0&size=0", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bodyData)
        });

        const resData = await res.json();
        const data = resData.response.departments;

        const formatted: Department[] = data?.map((dept: any) => ({
          key: dept.departmentID,
          name: dept.departmentName,
          description: dept.departmentDescription,
          status: dept.newStatus,
        })) || [];

        setDepartmentList(formatted);
        console.log("departmentlist", formatted);
      } catch (err) {
        console.error("Error fetching department list:", err);
      }
    };

    fetchDepartments();
  }, []);

  // const handleSave = () => {
  //   console.log("=== Handle Save Triggered ===");
  //   console.log("Form Data:", form);
  //   console.log("Goal:", goalVal, "Util:", utilVal, "Eff:", effPercent);
  //   const errs = {};

  //   if (!form.empId) errs.empId = true;
  //   if (!goalVal) errs.goal = true;
  //   if (!utilVal) errs.util = true;
  //   if (!effPercent) errs.eff = true;
  //   if (!form.feedbackCat) errs.feedbackCat = true;
  //   if (mandatory && !form.feedback.trim()) errs.feedback = true;

  //   console.log("Validation Errors:", errs);

  //   setErrors(errs);

  //   if (Object.keys(errs).length) {
  //     console.log("❌ Validation failed. Save aborted.");
  //     return;
  //   }

  //   const newEntry = {
  //     ...form,
  //     target: parseFloat(targetVal),
  //     goal: parseFloat(goalVal),
  //     util: parseFloat(utilVal),
  //     eff: parseFloat(form.eff),
  //     ts: Date.now(),
  //   };

  //   console.log(" Saving Entry:", newEntry);

  //   setReviews((prev) => {
  //     const updated = [newEntry, ...prev];
  //     console.log("Updated Reviews List:", updated);
  //     return updated;
  //   });

  //   setForm(DEFAULT);
  //   setErrors({});
  //   setSaved(true);

  //   console.log("✔️ Form reset & saved state updated");

  //   setTimeout(() => {
  //     setSaved(false);
  //     console.log("Saved flag reset");
  //   }, 2500);
  // };
  const handleSave = async () => {
    if (form.empId === "" || form.status === "") {

      addToast({
        title: "Error",
        description: "Please fill in all required fields",
        color: "danger",
      });
      return;
    }

    if (loading) return;

    console.log("=== Handle Save Triggered ===");

    const errs = {};



    // ─────────────────────────────
    // REQUEST BODY
    // ─────────────────────────────


    const requestBody = {

      empId: Number(form.empId),

      month: format(
        new Date(dateRange.startDate),
        "MMMM"
      ),

      year: Number(form.year),
      startDate: dateRange.startDate,

      endDate: dateRange.endDate,

      target:
        parseFloat(form.target || 0),

      goal:
        parseFloat(form.goal || 0),

      utilization:
        parseFloat(form.util || 0),

      efficiency:
        parseFloat(form.eff || 0),

      efficiencyLabel:
        form.effLabel || "",

      status:
        form.status || "On Track",

      // JSON ARRAY
      feedback:
        form.feedbacks,

      // JSON ARRAY
      accessor: [
        {
          accessorId:
            authUser.userID,

          accessorName:
            authUser.userName,

          role:
            authUser.roleName,

          timestamp:
            Date.now(),
        }
      ],

      timestamp:
        Date.now(),
    };


    console.log(
      "Monthly Review Payload:",
      requestBody
    );


    try {

      setLoading(true);

      const response = await axios.post(
        "/t2.0/authentificationUtilization/monthly-reviews",
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",

            Authorization: `Bearer ${authUserLD
              ? JSON.parse(authUserLD).token
              : ""
              }`,
          },
        }
      );

      console.log(
        "Monthly Review Saved:",
        response.data
      );

      // ─────────────────────────────
      // SUCCESS TOAST
      // ─────────────────────────────
      const clearData = () => {


        setForm({
          ...DEFAULT,

          // keep current month
          month: form.month,
          year: form.year,
        })
      };
      addToast({
        title: "Success",
        description:
          "Monthly review saved successfully",
        color: "success",
      });

      // ─────────────────────────────
      // OPTIONAL LOCAL STATE UPDATE
      // ─────────────────────────────

      const newEntry = {
        ...form,
        ts: Date.now(),
      };

      setReviews((prev) => [
        newEntry,
        ...prev,
      ]);

      // ─────────────────────────────
      // CLEAR FORM
      // ─────────────────────────────

      setForm({
        ...DEFAULT,

        // keep current month
        month: form.month,
        year: form.year,
      });

      setErrors({});

      setSelectedFilterUser("");

      setUserSearch("");

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2500);

    } catch (err) {

      console.error(
        "Monthly Review Save Error:",
        err
      );

      console.log(err?.response?.data);

      // ─────────────────────────────
      // ERROR TOAST
      // ─────────────────────────────

      addToast({
        title: "Error",
        description:
          err?.response?.data?.message ||
          "Failed to save monthly review",
        color: "danger",
      });

    } finally {

      setLoading(false);
    }
  };
  // ─────────────────────────────────────────────
  // DELETE MONTHLY REVIEW
  // ─────────────────────────────────────────────

  const handleDeleteReview = async (id) => {

    try {

      setLoading(true);

      await axios.delete(
        `/t2.0/authentificationUtilization/monthly-reviews/${id}`,
        {
          headers: {
            "Content-Type": "application/json",

            Authorization: `Bearer ${authUserLD
              ? JSON.parse(authUserLD).token
              : ""
              }`,
          },
        }
      );

      // ─────────────────────────────
      // REMOVE FROM UI
      // ─────────────────────────────

      setReviews((prev) =>
        prev.filter((item) => item.id !== id)
      );

      // ─────────────────────────────
      // SUCCESS TOAST
      // ─────────────────────────────

      addToast({
        title: "Success",
        description:
          "Monthly review deleted successfully",
        color: "success",
      });

    } catch (err) {

      console.error(
        "Delete Monthly Review Error:",
        err
      );

      addToast({
        title: "Error",
        description:
          err?.response?.data?.message ||
          "Failed to delete monthly review",
        color: "danger",
      });

    } finally {

      setLoading(false);
    }
  };

  const DateRangeDropdown = useCallback(
    ({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) => (
      <CustomDateRangePicker value={value} onChange={onChange} />
    ),
    []
  );

  return (
    <div className="pt-6 font-sans">

      {/* ── Header ── */}
      <div className=" mx-auto mb-7 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">

          <div>
            <h2 className="text-lg font-bold uppercase tracking-wide text-ink-900 dark:text-white">Manager's Feedback</h2>
            {/* <p className="text-[11px]   mt-0.5">Manager · Qualitative Feedback &amp; Taskly Metrics</p> */}
          </div>
        </div>
        {/* <div className="flex gap-2">
          <Chip color="primary" variant="flat" size="sm" className="font-semibold">April Cycle 2025–26</Chip>
          <Chip color="success" variant="dot" size="sm" className="font-semibold">Active</Chip>
        </div> */}
      </div>

      {/* ── Layout ── */}
      <div className=" mx-auto  gap-5 items-start">

        {/* ── LEFT ── */}
        <div className="flex flex-col gap-5">

          {/* Form Card */}
          <Card shadow="sm" radius="lg" className="border border-divider">
            <CardHeader className="px-6 pt-5 pb-0">
              <div className="flex items-center gap-2.5">
                <span className="w-[3px] h-4 bg-primary rounded-full block" />
                <p className="text-[11px] font-bold uppercase tracking-[.18em] text-default-500">New Feedback</p>
              </div>
            </CardHeader>

            <CardBody className="px-6 pt-5 pb-6 flex flex-col gap-4">

              {/* Row 1 — Employee + Month */}
              <p className="eyebrow">Who and when</p>
              <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {/* <Autocomplete
                  label="Employee"
                  placeholder="Search employee..."
                  selectedKey={form.empId}
                  onSelectionChange={(key) =>
                    set("empId")(key ? String(key) : "")
                  }
                  isInvalid={!!errors.empId}
                  errorMessage={errors.empId ? "Required" : ""}
                  size="sm"
                  radius="lg"
                  classNames={{ trigger: "bg-default-100 border-default-200" }}
                >
                  {usersAll.map((user) => (
                    <AutocompleteItem
                      key={String(user.userID)}
                      value={user.userName}
                    >
                      {user.userName}
                    </AutocompleteItem>
                  ))}
                </Autocomplete> */}
                <Autocomplete
                  label="Department"
                  labelPlacement="outside"
                  placeholder="Select department"
                  className="w-full"
                  selectedKey={filterStatus}
                  onSelectionChange={(key) => {
                    const dep = key as string;
                    setFilterStatus(dep);
                    setSelectedFilterUser("");
                    setUserSearch("");
                    // reset user dropdown when department changes
                  }}
                >
                  {departmentList
                    .filter((ele) => ele.status === "Active")
                    .map((ele) => (
                      <AutocompleteItem key={ele.key} value={ele.name}>
                        {ele.name.replace(/([A-Z])/g, " $1").trim()}
                      </AutocompleteItem>
                    ))}
                </Autocomplete>
                <Autocomplete
                  label="Reviewee"
                  labelPlacement="outside"
                  placeholder="Select reviewee"
                  className="w-full"
                  selectedKey={selectedFilterUser}
                  inputValue={userSearch}
                  onInputChange={(value) => {
                    const dep = value as string;
                    setUserSearch(dep);
                    if (!dep) setSelectedFilterUser("");
                  }}
                  onSelectionChange={(key) => {
                    if (key) {
                      const found = usersAll.find((u) => String(u.userID) === String(key));

                      if (found) {
                        setSelectedFilterUser(String(key));
                        setUserSearch(found.userName);

                        // 🔥 THIS IS THE MISSING LINE
                        set("empId")(String(key));
                      }
                    }
                  }}
                >
                  {filteredUsers.map((u) => (
                    <AutocompleteItem key={String(u.userID)} textValue={u.userName}>
                      {u.userName}
                    </AutocompleteItem>
                  ))}
                </Autocomplete>


                {/* <Select
                  label="Month"
                  isRequired
                  selectedKeys={new Set([form.month])}
                  onSelectionChange={(keys) => set("month")(Array.from(keys)[0] ?? "April")}
                  size="sm"
                  radius="lg"
                  classNames={{ trigger: "bg-default-100 border-default-200" }}
                >
                  {MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </Select> */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-secondary text-[10.5px] font-medium uppercase tracking-label text-ink-500 dark:text-ink-400">Review period</span>
                  <DateRangeDropdown value={dateRange} onChange={setDateRange} />
                </div>
                <Select
                  label="Year"
                  selectedKeys={
                    new Set([String(form.year)])
                  }
                  onSelectionChange={(keys) =>
                    set("year")(
                      Array.from(keys)[0] ?? String(new Date().getFullYear())
                    )
                  }
                  size="sm"
                  radius="lg"
                  isDisabled={true}

                  classNames={{
                    trigger:
                      "bg-default-100 border-default-200"
                  }}
                >
                  {Array.from(
                    { length: 5 },
                    (_, i) =>
                      String(new Date().getFullYear() - 2 + i)
                  ).map((year) => (
                    <SelectItem
                      key={year}
                      value={year}
                    >
                      {year}
                    </SelectItem>
                  ))}
                </Select>


              </div>

              {/* Info callout */}
              {/* <div className="flex items-center gap-2.5 bg-primary-50 border border-primary-200 rounded-xl px-3.5 py-2.5 my-4">
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <p className="text-xs text-primary-700">
                  Metrics below are <strong>auto-generated by Taskly</strong> from task entries — read-only in production.
                </p>
              </div> */}

              {/* Row 2 — Auto metrics */}
              {/* Row 2 — Auto metrics */}
              {/* <div className="grid grid-cols-2 gap-8 p-3">
                {[
                  ["target", "Target %"],
                  ["goal", "Goal Achievement"],
                  ["util", "Utilization %"],
                  ["eff", "Efficiency %"],
                ].map(([field, lbl]) => (

                  <Input
                    key={field}
                    type="text"

                    label={
                      <span className="flex items-center gap-1.5 py-2">
                        {lbl} <AutoTag />
                      </span>
                    }

                    value={

                      // GOAL %
                      field === "goal"
                        ? form.goal
                          ? `${form.goal}%`
                          : ""

                        // EFFICIENCY LEVEL
                        : field === "eff"
                          ? form.effLabel || ""

                          // OTHER %
                          : form[field]
                            ? `${form[field]}%`
                            : ""
                    }

                    isDisabled
                    size="sm"
                    radius="lg"

                    classNames={{

                      input:

                        // COLOR FOR EFFICIENCY LEVEL
                        field === "eff"
                          ? `
                font-semibold
                ${form.effLabel === "High" ? "text-success" : ""}
                ${form.effLabel === "At Par" ? "text-warning" : ""}
                ${form.effLabel === "Low" ? "text-danger" : ""}
              `
                          : "text-default-600",

                      inputWrapper:
                        "bg-default-100 border-default-200",
                    }}
                  />

                ))}
              </div> */}

              {/* Row 3 — Tasks + Status */}
              {/* <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number" min={0}
                  label={<span className="flex items-center gap-1.5">Tasks Completed <AutoTag /></span>}
                  placeholder="e.g. 24"
                  value={form.tasks}
                  onChange={setE("tasks")}
                  size="sm"
                  radius="lg"
                  classNames={{
                    input: " text-default-600",
                    inputWrapper: "bg-default-100 border-default-200",
                  }}
                />
                <Select
                  label={<span className="flex items-center gap-1.5">Status <AutoTag /></span>}
                  selectedKeys={new Set([form.status])}
                  onSelectionChange={(keys) => set("status")(Array.from(keys)[0] ?? "On Track")}
                  size="sm"
                  radius="lg"
                  classNames={{ trigger: "bg-default-100 border-default-200" }}
                >
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </Select>
              </div> */}

              <Divider />
              <p className="text-[10px]  uppercase tracking-[.15em] text-default-400 -mt-1">
                Manager Qualitative Assessment
              </p>

              {/* Row 4 — Feedback Cat + Type */}
              <div className="flex flex-col gap-4">

                {form.feedbacks.map((item, index) => (

                  <Card
                    key={index}
                    radius="lg"
                    shadow="none"
                    className="border border-divider"
                  >
                    <CardBody className="p-4 flex flex-col gap-4">

                      <div className="grid grid-cols-2 gap-4">

                        <Select
                          label="Feedback Category"
                          selectedKeys={
                            item.feedbackCat
                              ? new Set([item.feedbackCat])
                              : new Set()
                          }
                          onSelectionChange={(keys) => {

                            const updated =
                              [...form.feedbacks];

                            updated[index].feedbackCat =
                              Array.from(keys)[0] ?? "";

                            setForm((prev) => ({
                              ...prev,
                              feedbacks: updated,
                            }));
                          }}
                          size="sm"
                          radius="lg"
                        >
                          {FEEDBACK_CATS.map((c) => (
                            <SelectItem
                              key={c}
                              value={c}
                            >
                              {c}
                            </SelectItem>
                          ))}
                        </Select>

                        <Select
                          label="Feedback Type"
                          selectedKeys={
                            item.feedbackType
                              ? new Set([item.feedbackType])
                              : new Set()
                          }
                          onSelectionChange={(keys) => {

                            const updated =
                              [...form.feedbacks];

                            updated[index].feedbackType =
                              Array.from(keys)[0] ?? "";

                            setForm((prev) => ({
                              ...prev,
                              feedbacks: updated,
                            }));
                          }}
                          size="sm"
                          radius="lg"
                        >
                          {FEEDBACK_TYPES.map((t) => (
                            <SelectItem
                              key={t}
                              value={t}
                            >
                              {t}
                            </SelectItem>
                          ))}
                        </Select>

                      </div>

                      <Textarea
                        label="Detailed Feedback"
                        value={item.feedback}
                        onChange={(e) => {

                          const updated =
                            [...form.feedbacks];

                          updated[index].feedback =
                            e.target.value;

                          setForm((prev) => ({
                            ...prev,
                            feedbacks: updated,
                          }));
                        }}
                        minRows={3}
                        size="sm"
                        radius="lg"
                      />

                      <div className="flex justify-end">

                        {form.feedbacks.length > 1 && (

                          <Button
                            size="sm"
                            color="danger"
                            variant="flat"
                            onPress={() => {

                              const updated =
                                form.feedbacks.filter(
                                  (_, i) =>
                                    i !== index
                                );

                              setForm((prev) => ({
                                ...prev,
                                feedbacks: updated,
                              }));
                            }}
                          >
                            Remove
                          </Button>
                        )}

                      </div>

                    </CardBody>
                  </Card>
                ))}

                <Button
                  variant="flat"
                  color="primary"
                  onPress={() => {

                    setForm((prev) => ({
                      ...prev,
                      feedbacks: [
                        ...prev.feedbacks,
                        {
                          feedbackCat: "",
                          feedbackType: "",
                          feedback: "",
                        },
                      ],
                    }));
                  }}
                >
                  + Add Feedback
                </Button>

              </div>



              {/* Save */}
              <Button
                color="primary"
                radius="lg"
                size="md"
                className="w-full font-bold tracking-wide shadow-sm"
                onPress={handleSave}
              >
                Save Review
              </Button>

              {/* Saved toast inline */}
              {saved && (
                <div className="flex items-center justify-center gap-2 text-success-600 text-sm font-semibold animate-pulse">
                  <span>✓</span> Review saved successfully
                </div>
              )}
            </CardBody>
          </Card>

          {/* ── Reviews list ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-[.15em] text-default-500">
                Saved Reviews
              </p>
              {reviews.length > 0 && (
                <Chip size="sm" color="primary" variant="flat">
                  {reviews.length} record{reviews.length !== 1 ? "s" : ""}
                </Chip>
              )}
            </div>

            {reviews.length === 0 ? (
              <Card shadow="sm" radius="lg" className="border border-divider">
                <CardBody className="items-center py-10 gap-2">

                  <p className="text-sm text-default-400">No monthly reviews yet. Add one above.</p>
                </CardBody>
              </Card>
            ) : (
              reviews.map((r, i) => (
                <ReviewCard
                  key={r.ts + i}
                  review={r}
                  index={i}
                  onDelete={() => openDeleteConfirm(r.id)} usersAll={usersAll}   //  ADD THIS
                />
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT: Live Preview ── */}
        {/* <LivePreview form={form} /> */}
      </div>
      <Modal
        isOpen={isDeleteOpen}
        onOpenChange={onDeleteOpenChange}
        placement="center"
        backdrop="blur"
      >
        <ModalContent>

          {(onClose) => (

            <>
              <ModalHeader className="flex flex-col gap-1">
                Delete Review
              </ModalHeader>

              <ModalBody>

                <p className="text-sm text-default-600">
                  Are you sure you want to delete this
                  monthly review?
                </p>

                <p className="text-xs text-danger font-medium">
                  This action cannot be undone.
                </p>

              </ModalBody>

              <ModalFooter>

                <Button
                  variant="light"
                  onPress={onClose}
                >
                  Cancel
                </Button>

                <Button
                  color="danger"

                  onPress={async () => {

                    await handleDeleteReview(
                      selectedDeleteId
                    );

                    onDeleteClose();
                  }}
                >
                  Delete
                </Button>

              </ModalFooter>
            </>
          )}

        </ModalContent>
      </Modal>
    </div>
  );
}