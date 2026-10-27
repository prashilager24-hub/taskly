import {
    Select,
    SelectItem,
    Autocomplete,
    AutocompleteItem,
    Card,
    CardBody,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    Button
} from "@/components/ui";

import axios from "axios";
import { format } from "date-fns";
import { useEffect, useState, useMemo, useCallback } from "react";
import CustomDateRangePicker from "../components/CustomDateRangePicker";


const QUARTERS = [
    "ALL",
    "Q1",
    "Q2",
    "Q3",
    "Q4",
];

const YEARS = [
    "ALL",
    "2024",
    "2025",
    "2026",
    "2027",
];

// =========================
export default function DashboardFilters({
    reviews,
    setReviews,
    monthly,
    isReport = false,
    onFiltersChange

}) {

    const authUserLD =
        localStorage.getItem("authUserLD");

    const authUser =
        authUserLD
            ? JSON.parse(authUserLD)
            : null;
    const storedRole =
        localStorage.getItem("roles");

    const roleData =
        storedRole
            ? JSON.parse(storedRole)
            : null;

    const permissions =
        roleData?.rolePrivileges
            ? JSON.parse(roleData.rolePrivileges)
            : {};

    const pmsPermissions =
        permissions?.pms || [];

    const isPmsReadOnly =
        pmsPermissions.length === 1 &&
        pmsPermissions.includes("read");
    // =========================
    // STATES
    // =========================

    const [departmentList, setDepartmentList] =
        useState([]);

    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), 3, 1).toISOString().split("T")[0], // April 1
        endDate: new Date().toISOString().split("T")[0], // today
    });

    const [usersAll, setUsersAll] =
        useState([]);


    const HIDDEN_ROLES = [2, 4, 5, 6, 7, 23];

    const shouldHideDropdown = HIDDEN_ROLES.includes(authUser?.userRole);

    const rawDeptID = authUser?.departmentID;
    const isDeptArray = Array.isArray(rawDeptID);

    const [selectedDepartment, setSelectedDepartment] = useState(
        shouldHideDropdown
            ? isDeptArray
                ? ""
                : rawDeptID?.toString() || ""
            : ""
    );

    const [selectedUser, setSelectedUser] = useState(
        shouldHideDropdown
            ? authUser?.userID?.toString() || ""
            : ""
    );

    const [selectedQuarter,
        setSelectedQuarter] =
        useState("ALL");

    const [selectedYear,
        setSelectedYear] =
        useState<string>("ALL");

    const [userSearch,
        setUserSearch] =
        useState("");

    const [loading,
        setLoading] =
        useState(false);

    // =========================
    // FETCH DEPARTMENTS
    // =========================

    useEffect(() => {

        if (
            shouldHideDropdown &&
            authUser
        ) {

            if (isDeptArray) {
                setSelectedDepartment(
                    String(rawDeptID[0])
                );
            } else {
                setSelectedDepartment(
                    String(rawDeptID || authUser.departmentID)
                );
            }

            setSelectedUser(
                String(authUser.userID)
            );
        }

    }, [
        shouldHideDropdown,
        isDeptArray,
        rawDeptID,
        authUser
    ]);

    useEffect(() => {
        const month = dateRange?.endDate
            ? new Date(dateRange.endDate).getMonth() + 1
            : "";

        const year =
            selectedYear !== "ALL"
                ? Number(selectedYear)
                : dateRange?.endDate
                    ? new Date(dateRange.endDate).getFullYear()
                    : "";

        onFiltersChange?.({
            departmentID: selectedDepartment,
            userID: selectedUser,
            quarter: selectedQuarter,
            year,
            month,
        });
    }, [
        selectedDepartment,
        selectedUser,
        selectedQuarter,
        selectedYear,
        dateRange,
        onFiltersChange,
    ]);

    useEffect(() => {

        const fetchDepartments = async () => {

            try {

                const bodyData = {
                    searchText: "",
                    filter: "",
                    startDate: "",
                    endDate: "",

                    roleID: isReport
                        ? 1
                        : authUser?.userRole,

                    userID: isReport
                        ? 1
                        : authUser?.isHeExecutiveLeader
                            ? Number(authUser.userID)
                            : authUser?.userID,
                };

                const res = await fetch(
                    "/t2.0/authentificationUtilization/Department/list?page=0&size=0",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify(bodyData),
                    }
                );

                const resData =
                    await res.json();

                const data =
                    resData.response.departments;

                const formatted =
                    data?.map((dept) => ({
                        key:
                            dept.departmentID,
                        name:
                            dept.departmentName,
                        status:
                            dept.newStatus,
                    })) || [];

                setDepartmentList(formatted);

            } catch (err) {

                console.error(
                    "Department Fetch Error",
                    err
                );
            }
        };

        fetchDepartments();

    }, []);

    // =========================
    // FETCH USERS
    // =========================

    useEffect(() => {

        if (!selectedDepartment)
            return;

        const fetchUsers = async () => {

            try {

                const body = {
                    filter: "",
                    searchText: "",
                    departmentID:
                        Number(
                            selectedDepartment
                        ),
                };

                const res =
                    await axios.post(
                        "/t2.0/authentificationUtilization/users/read?page=0&size=0",
                        body,
                        {
                            headers: {
                                "Content-Type":
                                    "application/json",

                                Authorization:
                                    `Bearer ${authUser?.token}`,
                            },
                        }
                    );

                const usersData =
                    res.data.response.users || [];
                console.log("Fetched Users Data:", usersData);
                setUsersAll(usersData);

            } catch (err) {

                console.error(
                    "Users Fetch Error",
                    err
                );
            }
        };

        fetchUsers();

    }, [selectedDepartment]);

    // =========================
    // FETCH QUARTERLY REVIEW API
    // =========================

    // Fetch all quarterly reviews on initial load
    const fetchAllQuarterlyReviews = async () => {
        try {
            setLoading(true);

            const response = await axios.get(
                "/t2.0/authentificationUtilization/quarterly-review/all",
                {
                    params: {
                        quarter: selectedQuarter,
                        year: selectedYear,
                    },
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authUser?.token}`,
                    },
                }
            );

            setReviews(response.data || []);
        } catch (err) {
            console.error("All Quarterly Reviews Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch quarterly reviews for selected employee
    const fetchQuarterlyReviews = async () => {
        if (!selectedUser) return;

        try {
            setLoading(true);

            const response = await axios.get(
                `/t2.0/authentificationUtilization/quarterly-review/employee/${selectedUser}`,
                {
                    params: {
                        quarter: selectedQuarter,
                        year: selectedYear,
                    },
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authUser?.token}`,
                    },
                }
            );

            setReviews(response.data || []);
        } catch (err) {
            console.error("Employee Quarterly Reviews Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    };

    // Initial load: fetch all reviews.
    // After an employee is selected: fetch that employee's reviews.
    useEffect(() => {
        if (monthly) {
            if (selectedUser) {
                fetchMonthlyReviews();
            }
            return;
        }

        if (selectedUser) {
            fetchQuarterlyReviews();
        } else {
            if (authUser.userID === 1 || authUser.departmentID === 16) {
                fetchAllQuarterlyReviews();
            }
        }
    }, [
        monthly,
        selectedUser,
        selectedQuarter,
        selectedYear,
        dateRange,
    ]);

    // =========================
    // FILTERED USERS
    // =========================

    const filteredUsers =
        useMemo(() => {

            if (!selectedDepartment)
                return [];

            // return usersAll.filter(
            //     (u) =>
            //         String(
            //             u.departmentID
            //         ) ===
            //         String(
            //             selectedDepartment
            //         )
            // );
            return usersAll.filter((u) =>
                (u.departments ?? []).some(
                    (d) => String(d.departmentID) === String(selectedDepartment)
                ) || String(u.departmentID) === String(selectedDepartment)
            );

        }, [
            usersAll,
            selectedDepartment,
        ]);


    const fetchMonthlyReviews = async () => {

        try {

            setLoading(true);

            const response = await axios.get(
                `/t2.0/authentificationUtilization/monthly-reviews/${selectedUser}/${selectedYear}`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authUser?.token}`,
                    },
                }
            );

            const data = (response.data || []).map((item) => ({

                id: item.id,

                // employee
                employeeName: userSearch || "",
                employeeEmail: "",

                // header
                quarter: item.month,
                quarterYear: item.year,

                // metrics
                targetPercent: Number(item.target || 0),

                goalAchievement: Number(item.goal || 0),

                utilizationPercent: Number(item.utilization || 0),

                efficiencyPercent: Number(item.efficiency || 0),

                // rating
                finalRating:
                    Number(item.efficiency || 0) / 10,

                systemGrade:
                    Number(item.efficiency || 0) / 10,

                // labels
                efficiencyLabel:
                    item.efficiencyLabel || "",

                status:
                    item.status || "",

                // review data
                feedback:
                    item.feedback || [],

                managerRatings: {},

                // dates
                startDate: item.startDate,
                endDate: item.endDate,

                // misc
                accessor: item.accessor || [],
                timestamp: item.timestamp,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            }));

            setReviews(data);

        } catch (err) {

            console.error(
                "Monthly Review Fetch Error",
                err
            );

        } finally {

            setLoading(false);
        }
    };

    const DateRangeDropdown = useCallback(
        ({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) => (
            <Dropdown placement="bottom-start">
                <DropdownTrigger>
                    <Button variant="flat" size="sm" className="w-[100%] justify-between bg-ink-200 dark:bg-ink-700 h-[57px]">
                        {value.startDate && value.endDate
                            ? `${format(new Date(value.startDate), "dd MMM yyyy")} → ${format(new Date(value.endDate), "dd MMM yyyy")}`
                            : "Select Date Range"}
                    </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Date range" closeOnSelect={false} className="p-0">
                    <DropdownItem key="calendar" className="p-0">
                        <CustomDateRangePicker value={value} onChange={onChange} />
                    </DropdownItem>
                </DropdownMenu>
            </Dropdown>
        ),
        []
    );

    return (

        <Card className="border border-default-200 shadow-sm mb-6">

            <CardBody>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {shouldHideDropdown && isDeptArray && (
                        <Select
                            label="Department"
                            placeholder="Select Department"
                            selectedKeys={
                                selectedDepartment
                                    ? [selectedDepartment]
                                    : []
                            }
                            onSelectionChange={(keys) => {
                                const selected = Array.from(keys)[0];
                                if (selected) {
                                    setSelectedDepartment(String(selected));
                                    setSelectedUser("");
                                    setUserSearch("");
                                    setReviews([]);
                                }
                            }}
                        >
                            {rawDeptID.map((deptId) => (
                                <SelectItem key={String(deptId)}>
                                    {departmentList.find(d => String(d.key) === String(deptId))?.name || String(deptId)}
                                </SelectItem>
                            ))}
                        </Select>
                    )}

                    {!shouldHideDropdown && (<>

                        {/* DEPARTMENT */}

                        < Autocomplete
                            isDisabled={isPmsReadOnly}
                            label="Department"
                            placeholder="Select Department"
                            selectedKey={
                                selectedDepartment
                            }
                            onSelectionChange={(key) => {

                                const deptId = String(key);

                                setSelectedDepartment(deptId);

                                // clear selected user
                                setSelectedUser("");

                                // clear displayed user search text
                                setUserSearch("");

                                // clear reviews also
                                setReviews([]);
                            }}
                        >

                            {departmentList
                                .filter(
                                    (d) =>
                                        d.status ===
                                        "Active"
                                )
                                .map((dept) => (

                                    <AutocompleteItem
                                        key={dept.key}
                                    >
                                        {dept.name}
                                    </AutocompleteItem>

                                ))}

                        </Autocomplete>

                        {/* USER */}

                        <Autocomplete
                            isDisabled={isPmsReadOnly}
                            label="Employee"
                            placeholder="Select Employee"
                            selectedKey={
                                selectedUser
                            }
                            inputValue={
                                userSearch
                            }
                            onInputChange={(value) => {

                                setUserSearch(
                                    value
                                );

                                if (!value) {
                                    setSelectedUser(
                                        ""
                                    );
                                }
                            }}
                            onSelectionChange={(key) => {

                                if (key) {

                                    const found =
                                        usersAll.find(
                                            (u) =>
                                                String(
                                                    u.userID
                                                ) ===
                                                String(
                                                    key
                                                )
                                        );

                                    if (found) {

                                        setSelectedUser(
                                            String(
                                                key
                                            )
                                        );

                                        setUserSearch(
                                            found.userName
                                        );
                                    }
                                }
                            }}
                        >

                            {filteredUsers.map(
                                (u) => (

                                    <AutocompleteItem
                                        key={String(
                                            u.userID
                                        )}
                                    >
                                        {u.userName}
                                    </AutocompleteItem>

                                )
                            )}

                        </Autocomplete>
                    </>
                    )}

                    {/* QUARTER */}

                    {!monthly ? (<Select
                        label="Quarter"
                        selectedKeys={
                            new Set([
                                selectedQuarter,
                            ])
                        }
                        onSelectionChange={(keys) => {

                            setSelectedQuarter(
                                Array.from(
                                    keys
                                )[0]
                            );
                        }}
                    >

                        {QUARTERS.map((q) => (

                            <SelectItem
                                key={q}
                            >
                                {q}
                            </SelectItem>

                        ))}

                    </Select>
                    ) : (<DateRangeDropdown value={dateRange} onChange={setDateRange} />

                    )}
                    {/* YEAR */}

                    <Select
                        label="Year"
                        selectedKeys={
                            selectedYear
                                ? [selectedYear]
                                : []
                        }
                        onSelectionChange={(keys) => {

                            const selected =
                                [...keys][0];

                            if (selected) {

                                setSelectedYear(
                                    String(selected)
                                );
                            }
                        }}
                    >

                        {YEARS.map((year) => (

                            <SelectItem
                                key={String(year)}
                            >
                                {String(year)}
                            </SelectItem>

                        ))}

                    </Select>

                </div>

            </CardBody>

        </Card >
    );
}