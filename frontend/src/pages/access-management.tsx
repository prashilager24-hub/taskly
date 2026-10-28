
import { PageTitle } from "@/components/page";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui";
import { Select, SelectItem } from "@/components/ui";
import AddNewRoleModal from "../components/accessRole";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Autocomplete, addToast, AutocompleteItem } from "@/components/ui";
import { title } from "@/components/primitives";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useDashboardStore } from "@/store/commonStore";
import axios from "axios";
import ReusableTable, { TableColumn, TableAction } from "@/components/table";
import { format } from "date-fns";

interface User {
    userID: number;
    userName: string;
    userEmail: string;
    departmentName: string;
    departmentID: number;
    role: string;
    roleID: number;
    newStatus: string;
    isActive: boolean;
    userCreateTime: string;
    feedbackResolverTeam: string;
}

interface Department {
    key: number;
    name: string;
    description: string;
    status: string;
}

export default function AccessManagementPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [editUser, setEditUser] = useState<User | null>(null);
    const [initialSnapshot, setInitialSnapshot] = useState("");
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [roleFilter, setRoleFilter] = useState(null);
    const [selectedRows, setSelectedRows] = useState<User[]>([]);  //  Fixed: was Task[]
    const [pageNumber, setPageNumber] = useState(1);
    const [totalRecords, settotalRecords] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [searchValue, setSearchValue] = useState("");
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [toggleConfirm, setToggleConfirm] = useState({
        open: false,
        user: null as User | null,
        newStatus: "" as "Active" | "Inactive" | ""
    });
    const [statusFilter, setStatusFilter] = useState("Active");

    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null; name: string }>({
        open: false,
        id: null,
        name: ""
    });

    const [users, setUsers] = useState<User[]>([]);
    const [usersAll, setUsersAll] = useState<User[]>([]);  // For storing all users without pagination
    const setAllUser = useDashboardStore((state) => state.setAllUser);

    const [appraisalForm, setAppraisalForm] = useState({
        reportingManager: "",
        elManager: "",
        cycle: ""
    });

    const [departmentList, setDepartmentList] = useState<Department[]>([]);

    // Fixed: added employeeID to initial state
    const [newUser, setNewUser] = useState({
        employeeID: "",
        name: "",
        email: "",
        password: "",
        department: "",
        role: "User",
        secondaryRole: "",
        feedbackResolverTeam: ""

    });

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    const authUserLD = localStorage.getItem("authUserLD");

    const userColumns: TableColumn[] = [
        { key: 'userID', label: 'ID', sortable: true, width: '80px' },
        { key: 'employeeID', label: 'Employee ID', sortable: true, width: '120px' },
        // {
        //     key: 'userCreateTime',
        //     label: 'Created At',
        //     sortable: true,
        //     renderCell: (item) =>
        //         item.userCreateTime
        //             ? format(new Date(item.userCreateTime), "dd MMM yyyy")
        //             : "—",
        // },


        { key: 'userName', label: 'Name', sortable: true },
        { key: 'userEmail', label: 'Email', sortable: true },
        { key: 'departmentName', label: 'Department', sortable: true },
        { key: 'reportingManagerName', label: 'Reporting Manager' },
        { key: 'elManagerName', label: 'EL Manager' },
        { key: 'appraisalCycle', label: 'Appraisal Cycle' },
        { key: 'role', label: 'Role', sortable: true },
        { key: 'newStatus', label: 'Status', sortable: true },
    ];

    const userActions: TableAction[] = [
        {
            key: 'edit',
            label: 'Edit',
            color: 'primary',
            onAction: (row) => {
                setEditUser(row);
                const deptId = Array.isArray(row.departmentID)
                    ? row.departmentID[0]
                    : row.departmentID;
                const userInit = {
                    employeeID: row.employeeID || "",
                    name: row.userName,
                    email: row.userEmail,
                    password: "",
                    department: deptId ? String(deptId) : "",
                    role: row.role,
                    secondaryRole: row.secondaryRole || "",
                    feedbackResolverTeam: row.feedbackResolverTeam || ""
                };
                const appraisalInit = {
                    reportingManager: String(row.reportingManagerId || ""),
                    elManager: String(row.elManagerId || ""),
                    cycle: row.appraisalCycle || ""
                };
                setNewUser(userInit);
                setAppraisalForm(appraisalInit);
                setInitialSnapshot(JSON.stringify({ user: userInit, appraisal: appraisalInit }));
                setIsEditMode(true);
                onOpen();
            }
        },
        {
            key: 'Delete',
            label: 'Delete',
            color: 'danger',
            onAction: (row) => {
                setDeleteConfirm({ open: true, id: row.userID, name: row.userName });
            }
        }
    ];

    const handleDeleteUser = async () => {
        try {
            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
            };

            const payload = { userIdList: [deleteConfirm.id] };

            await axios.post(
                "/t2.0/authentificationUtilization/usersArchive",
                payload,
                { headers }
            );

            addToast({
                title: "User Deleted",
                description: "The user has been deleted successfully.",
                color: "success",
            });

            setDeleteConfirm({ open: false, id: null, name: "" });
            window.location.reload();

        } catch (err) {
            console.error("Delete failed:", err);
            addToast({
                title: "Failed",
                description: "Failed to delete user",
                color: "danger",
            });
            setDeleteConfirm({ open: false, id: null, name: "" });
        }
    };

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const bodyData = {
                    searchText: "",
                    filter: "",
                    startDate: "",
                    endDate: "",
                    roleID: 1,
                    userID: 1,
                };

                const res = await axios.post(
                    "/t2.0/authentificationUtilization/Department/list?page=0&size=0",
                    bodyData,
                    { headers: { "Content-Type": "application/json" } }
                );

                const data = res.data.response.departments;

                const formatted: Department[] = data?.map((dept: any) => ({
                    key: dept.departmentID,
                    name: dept.departmentName,
                    description: dept.departmentDescription,
                    status: dept.newStatus,
                })) || [];

                setDepartmentList(formatted);

            } catch (err) {
                console.error("Error fetching department list:", err);
            }
        };

        fetchDepartments();
    }, []);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const body = {
                    filter: statusFilter,
                    searchText: searchValue,
                    departmentID: null,
                    roleID: Number(roleFilter)
                };

                const res = await axios.post(
                    `/t2.0/authentificationUtilization/users/read?page=${pageNumber}&size=${pageSize}`,
                    body,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
                        },
                    }
                );

                const usersData = res.data.response.users || [];

                const roleMap: Record<number, string> = {
                    1: "Root User",
                    3: "EL",
                    4: "FL",
                    2: "User",
                    5: "Intern",
                    6: "Executive",
                    7: "Manager",
                    23: "Lead",
                };

                const formatted: User[] = usersData.map((u: any) => {
                    const depts = Array.isArray(u.departments) ? u.departments : [];
                    const firstDeptID = depts.length > 0
                        ? depts[0].departmentID
                        : Array.isArray(u.departmentID)
                            ? u.departmentID[0]
                            : u.departmentID;
                    return {
                        userID: u.userID,
                        employeeID: u.employeeID,
                        userName: u.userName,
                        userEmail: u.userEmail,
                        departmentName: Array.isArray(u.departments) && u.departments.length > 0
                            ? u.departments.map((d: any) => d.departmentName).join(", ")
                            : u.departmentName || "N/A",
                        departmentID: firstDeptID,
                        roleID: u.roleID,
                        role: roleMap[u.roleID] || "User",
                        secondaryRoleID: u.secondaryRoleID,
                        secondaryRole: roleMap[u.secondaryRoleID] || "",
                        newStatus: u.newStatus,
                        isActive: u.newStatus === "Active",
                        userCreateTime: u.userCreateTime?.split(" ")[0] || "N/A",
                        reportingManagerName: u.reportingManagerName || "",
                        reportingManagerId: u.reportingManagerId || "",
                        elManagerId: u.elManagerId || "",

                        elManagerName: u.elManagerName,
                        appraisalCycle: u.appraisalCycle,
                        feedbackResolverTeam: u.feedbackresolverteam || "",
                    };
                });

                setUsers(formatted);
                settotalRecords(res.data.response.totalRecords);

            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };

        fetchUsers();
    }, [authUserLD, pageSize, pageNumber, searchValue, roleFilter, statusFilter]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const body = {
                    filter: "Active",
                    searchText: searchValue,
                    departmentID: null,
                    roleID: Number(roleFilter)
                };

                const res = await axios.post(
                    `/t2.0/authentificationUtilization/users/read?page=${0}&size=${0}`,
                    body,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
                        },
                    }
                );

                const usersData = res.data.response.users || [];

                const roleMap: Record<number, string> = {
                    1: "Root User",
                    3: "EL",
                    4: "FL",
                    2: "User",
                    5: "Intern",
                    6: "Executive",
                    7: "Manager",
                    23: "Lead",
                };

                const formatted: User[] = usersData.map((u: any) => {
                    const depts = Array.isArray(u.departments) ? u.departments : [];
                    const firstDeptID = depts.length > 0
                        ? depts[0].departmentID
                        : Array.isArray(u.departmentID)
                            ? u.departmentID[0]
                            : u.departmentID;
                    return {
                        userID: u.userID,
                        userName: u.userName,
                        userEmail: u.userEmail,
                        departmentName: Array.isArray(u.departments) && u.departments.length > 0
                            ? u.departments.map((d: any) => d.departmentName).join(", ")
                            : u.departmentName || "N/A",
                        departmentID: firstDeptID,
                        roleID: u.roleID,
                        secondaryRole: u.secondaryRoleID,
                        role: roleMap[u.roleID] || "User",
                        newStatus: u.newStatus,
                        isActive: u.newStatus === "Active",
                        userCreateTime: u.userCreateTime?.split(" ")[0] || "N/A",
                        feedbackResolverTeam: u.feedbackresolverteam || ""
                    };
                });

                setUsersAll(formatted);
                setAllUser(formatted);

            } catch (err) {
                console.error("Error fetching users:", err);
            }
        };

        fetchUsers();
    }, []);
    const handleAddUser = async () => {
        try {
            const headers = {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
            };

            const roleMap: Record<string, number> = {
                EL: 3,
                FL: 4,
                User: 2,
                "Root User": 1,
                Intern: 5,
                Executive: 6,
                Manager: 7,
                Lead: 23,
            };

            // ✅ All form fields included in payload
            const payload = {
                employeeID: newUser.employeeID,
                userName: newUser.name,
                userEmail: newUser.email,
                password: newUser.password,
                departmentID: newUser.department ? Number(newUser.department) : null,
                role: newUser.role,
                roleID: roleMap[newUser.role] ?? 2,
                secondaryRoleID: newUser.secondaryRole
                    ? roleMap[newUser.secondaryRole]
                    : null,
                reportingManagerId: appraisalForm.reportingManager ? Number(appraisalForm.reportingManager) : null,
                elManagerId: appraisalForm.elManager ? Number(appraisalForm.elManager) : null,
                appraisalCycle: appraisalForm.cycle,
                feedbackresolverteam: newUser.feedbackResolverTeam,
            };

            await axios.post(
                "/t2.0/authentificationUtilization/User/create",
                payload,
                { headers }
            );

            addToast({
                title: "Success",
                description: "User created successfully!",
                color: "success",
            });

            // ✅ Reset all form fields including appraisalForm
            setNewUser({ employeeID: "", name: "", email: "", password: "", department: "", role: "User", secondaryRole: "", feedbackResolverTeam: "" });
            setAppraisalForm({ reportingManager: "", elManager: "", cycle: "" });

            onOpenChange();
            window.location.reload();

        } catch (error) {
            console.error("Error creating user:", error);
            addToast({
                title: "Error",
                description: "Failed to create user",
                color: "danger",
            });
            onOpenChange();
        }
    };

    const handleToggleUserStatus = async () => {
        const user = toggleConfirm.user;
        const newStatus = toggleConfirm.newStatus;

        if (!user) return;

        try {
            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
            };

            const payload = {
                userStatus: newStatus === "Active" ? 1 : 0,
                userIdList: [user.userID]
            };

            await axios.post(
                "/t2.0/authentificationUtilization/updateUserStatus",
                payload,
                { headers }
            );

            setUsers(prev =>
                prev.map(u =>
                    u.userID === user.userID
                        ? { ...u, newStatus, isActive: newStatus === "Active" }
                        : u
                )
            );

            addToast({
                title: `User ${newStatus}`,
                description: `"${user.userName}" is now ${newStatus}.`,
                color: "success"
            });

            setSelectedRows([]);
            setToggleConfirm({ open: false, user: null, newStatus: "" });

        } catch (err) {
            console.error(err);
            addToast({
                title: "Error",
                description: "Failed to update user status.",
                color: "danger"
            });
        }
    };

    const handleUpdateUser = async () => {
        try {
            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
            };

            const roleMap: Record<string, number> = {
                "Root User": 1,
                "EL": 3,
                "FL": 4,
                "User": 2,
                "Intern": 5,
                "Executive": 6,
                "Manager": 7,
                "Lead": 23,
            };

            //  All form fields included in update payload
            const payload = {
                userID: editUser?.userID,
                employeeID: newUser.employeeID,
                userName: newUser.name,
                userEmail: newUser.email,
                departmentID:
                    newUser.department
                        ? Number(newUser.department)
                        : editUser?.departmentID
                            ? Number(editUser.departmentID)
                            : null,
                role: newUser.role,
                roleID: roleMap[newUser.role] ?? 2,
                secondaryRoleID: newUser.secondaryRole
                    ? roleMap[newUser.secondaryRole]
                    : null,
                reportingManagerId: appraisalForm.reportingManager ? Number(appraisalForm.reportingManager) : null,
                elManagerId: appraisalForm.elManager ? Number(appraisalForm.elManager) : null,
                appraisalCycle: appraisalForm.cycle,
                feedbackresolverteam: newUser.feedbackResolverTeam,
            };

            await axios.put(
                "/t2.0/authentificationUtilization/User/update",
                payload,
                { headers }
            );

            addToast({
                title: "Success",
                description: "User updated successfully!",
                color: "success",
            });

            setEditUser(null);
            setIsEditMode(false);
            setNewUser({ employeeID: "", name: "", email: "", password: "", department: "", role: "User", secondaryRole: "", feedbackResolverTeam: "" });
            setAppraisalForm({ reportingManager: "", elManager: "", cycle: "" });  // ✅ reset appraisal form too
            onOpenChange();

        } catch (err) {
            console.error(err);
            addToast({
                title: "Error",
                description: "Failed to update user",
                color: "danger",
            });
        }
    };
    const isDirty =
        !isEditMode ||
        JSON.stringify({ user: newUser, appraisal: appraisalForm }) !== initialSnapshot;
    return (
        <div>
            <AddNewRoleModal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} />
            <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <PageTitle title="Access Management" subtitle="Manage user roles, permissions, and access control" />
                <div className="flex gap-3">
                    <Button
                        variant="flat"
                        size="sm"
                        color="primary"
                        onClick={() =>
                            setIsRoleModalOpen(true)
                        }
                        className={`px-4 h-8 w-fit ${!authUserLD?.userRole == 1 ? "" : "opacity-0 pointer-events-none select-none"}`}
                        isDisabled={loading || !!authUserLD?.userRole && authUserLD.userRole !== 1}
                    >
                        Role Access
                    </Button>
                    <Button
                        size="sm"
                        color="primary"
                        onClick={() => {
                            setIsEditMode(false);
                            setEditUser(null);
                            setNewUser({ employeeID: "", name: "", email: "", password: "", department: "", role: "User", secondaryRole: "", feedbackResolverTeam: "" });
                            setAppraisalForm({ reportingManager: "", elManager: "", cycle: "" });
                            onOpen();
                        }}
                    >
                        Add New User
                    </Button>
                </div>
            </div>

            {selectedRows.length === 1 && (
                <div className="flex justify-between items-center bg-ink-100 dark:bg-ink-800 p-3 rounded mb-3 shadow">
                    <span className="font-semibold">{selectedRows.length} user selected</span>
                    <div className="flex gap-3">
                        <Button
                            color="danger"
                            onPress={() => {
                                const user = selectedRows[0];
                                setToggleConfirm({ open: true, user, newStatus: "Inactive" });
                            }}
                        >
                            Deactivate
                        </Button>
                        <Button
                            color="success"
                            variant="flat"
                            onPress={() => {
                                const user = selectedRows[0];
                                setToggleConfirm({ open: true, user, newStatus: "Active" });
                            }}
                        >
                            Activate
                        </Button>
                    </div>
                </div>
            )}

            <div className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900 overflow-hidden p-6">
                <ReusableTable
                    data={users}
                    columns={userColumns}
                    actions={userActions}
                    totalRecords={totalRecords}
                    searchable={true}
                    searchPlaceholder="Search users..."
                    searchKeys={['userName', 'userEmail', 'departmentName']}
                    filterable={true}
                    onRowsPerPageChange={(value) => setPageSize(value)}
                    onPageChange={(page) => setPageNumber(page)}
                    onSearchChangeProp={(value) => setSearchValue(value)}
                    filterOptions={[
                        {
                            key: 'newStatus',
                            label: 'Status',
                            options: [
                                { key: 'Active', label: 'Active' },
                                { key: 'Inactive', label: 'Inactive' },
                                { key: "Archived", label: "Archived" },
                                { key: "", label: "All" }
                            ]
                        },
                        {
                            key: "roleID",
                            label: "Role",
                            options: [
                                { key: 1, label: "Root User" },
                                { key: 3, label: "EL" },
                                { key: 4, label: "FL" },
                                { key: 2, label: "User" },
                                { key: 5, label: "Intern" },
                                { key: 6, label: "Executive" },
                                { key: 7, label: "Manager" },
                                { key: 23, label: "Lead" },
                                { key: 0, label: "All" }
                            ]
                        }
                    ]}
                    onFilterChange={(key, value) => {
                        if (key === "roleID") {
                            setRoleFilter(value);
                        }

                        if (key === "newStatus") {
                            setStatusFilter(value ? String(value) : "");
                            setPageNumber(1);
                        }
                    }}
                    selectable={true}
                    sortable={true}
                    paginated={true}
                    emptyContent="No users found"
                    onAdd={onOpen}
                    addButtonLabel="Add New User"
                    getRowId={(item) => item.userID}
                    onSelectionChange={(rows) => setSelectedRows(rows)}
                />
            </div>

            {/* Add / Edit User Modal */}
            <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
                <ModalContent>
                    {(onClose: () => void) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                {isEditMode ? "Edit User" : "Add New User"}
                            </ModalHeader>
                            <ModalBody>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Employee ID"
                                        placeholder="Enter employee ID"
                                        value={newUser.employeeID}
                                        onChange={(e) => setNewUser({ ...newUser, employeeID: e.target.value })}
                                        variant="bordered"
                                        isRequired
                                    />
                                    <Input
                                        label="Full Name"
                                        placeholder="Enter user's full name"
                                        value={newUser.name}
                                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                        variant="bordered"
                                        isRequired
                                    />
                                    <Input
                                        label="Email"
                                        type="email"
                                        autoComplete="off"
                                        placeholder="Enter user's email"
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        variant="bordered"
                                        isRequired
                                    />
                                    {/* ✅ Uncommented password field — required for create only */}
                                    {/* {!isEditMode && (
                                        <Input
                                            label="Password"
                                            type="password"
                                            placeholder="Enter password"
                                            value={newUser.password}
                                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                            variant="bordered"
                                            autoComplete="new-password"
                                            isRequired
                                        />
                                    )} */}
                                    <Autocomplete
                                        label="Department"
                                        placeholder="Search Department"
                                        selectedKey={newUser.department || null}
                                        onSelectionChange={(key) => {
                                            if (key === null && isEditMode) return;
                                            setNewUser((prev) => ({
                                                ...prev,
                                                department:
                                                    prev.role === "Root User"
                                                        ? null
                                                        : key
                                                            ? String(key)
                                                            : null,
                                            }));
                                        }}
                                        variant="bordered"
                                        isRequired={newUser.role !== "Root User"}
                                    >
                                        {departmentList
                                            .filter((d) => d.status === "Active" || String(d.key) === newUser.department)
                                            .map((dept) => (
                                                <AutocompleteItem key={String(dept.key)}>
                                                    {dept.name}
                                                </AutocompleteItem>
                                            ))}
                                    </Autocomplete>
                                    <Autocomplete
                                        label="Reporting Manager (Assessor 1)"
                                        placeholder="Search Manager"
                                        selectedKey={appraisalForm.reportingManager || null}
                                        onSelectionChange={(key) => {
                                            if (key === null && isEditMode) return;
                                            setAppraisalForm((prev) => ({
                                                ...prev,
                                                reportingManager: key ? String(key) : ""
                                            }));
                                        }}
                                        variant="bordered"
                                        isRequired={newUser.role !== "Root User"}
                                    >
                                        {usersAll.map((user) => (
                                            <AutocompleteItem key={String(user.userID)} value={user.userName}>
                                                {user.userName}
                                            </AutocompleteItem>
                                        ))}
                                    </Autocomplete>
                                    <Autocomplete
                                        label="EL / Dept Head (Assessor 2)"
                                        placeholder="Search EL"
                                        selectedKey={appraisalForm.elManager || null}
                                        onSelectionChange={(key) => {
                                            if (key === null && isEditMode) return;
                                            setAppraisalForm((prev) => ({
                                                ...prev,
                                                elManager: key ? String(key) : ""
                                            }));
                                        }}
                                        variant="bordered"
                                        isRequired={newUser.role !== "Root User"}
                                    >
                                        {usersAll

                                            .map((user) => (
                                                <AutocompleteItem key={String(user.userID)} value={user.userName}>
                                                    {user.userName}
                                                </AutocompleteItem>
                                            ))}
                                    </Autocomplete>
                                    <Autocomplete
                                        label="Appraisal Cycle"
                                        placeholder="Search Cycle"
                                        selectedKey={appraisalForm.cycle}
                                        onSelectionChange={(key) =>
                                            setAppraisalForm({
                                                ...appraisalForm,
                                                cycle: key ? String(key) : ""
                                            })
                                        }
                                        variant="bordered"
                                        isRequired={newUser.role !== "Root User"}
                                    >
                                        <AutocompleteItem key="APRIL">
                                            April Cycle (Apr–Mar)
                                        </AutocompleteItem>

                                        <AutocompleteItem key="OCTOBER">
                                            October Cycle (Oct–Sep)
                                        </AutocompleteItem>
                                    </Autocomplete>
                                    <Select
                                        label="Role"
                                        placeholder="Select role"
                                        selectedKeys={[newUser.role]}
                                        onSelectionChange={(keys) => setNewUser({ ...newUser, role: Array.from(keys)[0] as string })}
                                        variant="bordered"
                                        isRequired
                                    >
                                        <SelectItem key="Root User">Root User</SelectItem>
                                        <SelectItem key="EL">EL</SelectItem>
                                        <SelectItem key="FL">FL</SelectItem>
                                        <SelectItem key="User">User</SelectItem>
                                        <SelectItem key="Intern">Intern</SelectItem>
                                        <SelectItem key="Executive">Executive</SelectItem>
                                        <SelectItem key="Manager">Manager</SelectItem>
                                        <SelectItem key="Lead">Lead</SelectItem>
                                    </Select>
                                    <Select
                                        label="Secondary Role"
                                        placeholder="Select Secondary Role"
                                        selectedKeys={newUser.secondaryRole ? [newUser.secondaryRole] : []}
                                        onSelectionChange={(keys) =>
                                            setNewUser({
                                                ...newUser,
                                                secondaryRole: Array.from(keys)[0] as string
                                            })
                                        }
                                        variant="bordered"
                                    >
                                        <SelectItem key="EL">EL</SelectItem>
                                        <SelectItem key="FL">FL</SelectItem>
                                        <SelectItem key="User">User</SelectItem>
                                        <SelectItem key="Intern">Intern</SelectItem>
                                        <SelectItem key="Executive">Executive</SelectItem>
                                        <SelectItem key="Manager">Manager</SelectItem>
                                        <SelectItem key="Lead">Lead</SelectItem>
                                    </Select>
                                    <Select
                                        label="Feedback Resolver Team"
                                        placeholder="Select Feedback Resolver Team"
                                        selectedKeys={newUser.feedbackResolverTeam ? [newUser.feedbackResolverTeam] : []}
                                        onSelectionChange={(keys) =>
                                            setNewUser({
                                                ...newUser,
                                                feedbackResolverTeam: Array.from(keys)[0] as string
                                            })
                                        }
                                        variant="bordered"
                                    >
                                        <SelectItem key="HR">HR</SelectItem>
                                        <SelectItem key="L_D">L&D</SelectItem>

                                    </Select>
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button
                                    color="danger"
                                    variant="light"
                                    onPress={() => {
                                        setIsEditMode(false);
                                        setEditUser(null);
                                        setNewUser({ employeeID: "", name: "", email: "", password: "", department: "", role: "User", secondaryRole: "", feedbackResolverTeam: "" });
                                        setAppraisalForm({ reportingManager: "", elManager: "", cycle: "" });
                                        onOpenChange();
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={isEditMode ? handleUpdateUser : handleAddUser}
                                    isDisabled={
                                        (isEditMode && !isDirty) ||
                                        !newUser.name ||
                                        !newUser.email ||
                                        (
                                            newUser.role !== "Root User" &&
                                            (
                                                !newUser.department ||
                                                !appraisalForm.reportingManager ||
                                                !appraisalForm.elManager
                                            )
                                        )
                                    }
                                >
                                    {isEditMode ? "Update User" : "Add User"}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* Delete Confirm Modal */}
            <Modal isOpen={deleteConfirm.open} onOpenChange={() => setDeleteConfirm({ open: false, id: null, name: "" })}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Confirm Delete</ModalHeader>
                            <ModalBody>
                                <p>Are you sure you want to delete user <strong>{deleteConfirm.name}</strong>?</p>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="default" variant="light" onPress={() => setDeleteConfirm({ open: false, id: null, name: "" })}>
                                    Cancel
                                </Button>
                                <Button color="danger" onPress={handleDeleteUser}>Delete</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* Toggle Status Confirm Modal */}
            <Modal isOpen={toggleConfirm.open} onOpenChange={() => setToggleConfirm({ open: false, user: null, newStatus: "" })}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Confirm Action</ModalHeader>
                            <ModalBody>
                                <p>
                                    Are you sure you want to <strong>{toggleConfirm.newStatus}</strong> user <strong>{toggleConfirm.user?.userName}</strong>?
                                </p>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="default" variant="light" onPress={() => setToggleConfirm({ open: false, user: null, newStatus: "" })}>
                                    Cancel
                                </Button>
                                <Button
                                    color={toggleConfirm.newStatus === "Inactive" ? "danger" : "success"}
                                    onPress={handleToggleUserStatus}
                                >
                                    {toggleConfirm.newStatus}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}