// import { useEffect, useState, useMemo } from "react";
// import axios from "axios";
// import {
//     Dropdown,
//     DropdownTrigger,
//     DropdownMenu,
//     DropdownItem,
//     Autocomplete,
//     AutocompleteItem,
//     Button,
//     addToast,
// } from "@/components/ui";
// import { switchToUser } from "./userSwitch";

// /* ─── Types ─────────────────────────────────────────────────────────────────── */

// interface Department {
//     key: number;
//     name: string;
//     status: string;
// }

// interface SimpleUser {
//     userID: number;
//     userName: string;
//     roleID?: number;
//     /** EL records carry the list of departments they manage */
//     departments?: {
//         departmentID: number;
//         departmentName: string;
//         executiveLeaderID?: number | null;
//         functionalLeaderID?: number | null;
//     }[] | null;
//     /** FL / normal-user records carry their own department */
//     departmentID?: number | null;
//     /** Points to the Executive Leader (elManager) */
//     elManagerId?: number | null;
//     /** Points to the Functional Leader / Reporting Manager */
//     reportingManagerId?: number | null;
// }

// interface Props {
//     currentUser: any;
//     onSwitched: () => void;
// }

// /* ─── Icon ──────────────────────────────────────────────────────────────────── */

// const FilterIcon = (props: React.SVGProps<SVGSVGElement>) => (
//     <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
//         <path
//             d="M4 5h16M7 12h10M10 19h4"
//             fill="none"
//             stroke="currentColor"
//             strokeWidth="2"
//             strokeLinecap="round"
//             strokeLinejoin="round"
//         />
//     </svg>
// );

// /* ─── Component ─────────────────────────────────────────────────────────────── */

// export default function SwitchUserFilter({ currentUser, onSwitched }: Props) {
//     const [isOpen, setIsOpen] = useState(false);
//     const [departmentList, setDepartmentList] = useState<Department[]>([]);
//     const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);

//     // Cascade selection states
//     const [selectedDepartment, setSelectedDepartment] = useState<string>("");
//     const [selectedEL, setSelectedEL] = useState<string>("");
//     const [selectedFL, setSelectedFL] = useState<string>("");
//     const [selectedUser, setSelectedUser] = useState<string>("");

//     // Final target – whichever level was last picked
//     const [selectedTargetUser, setSelectedTargetUser] = useState<string>("");

//     const [switching, setSwitching] = useState(false);
//     const [loading, setLoading] = useState(false);

//     /* ── 1. Fetch Departments (once on open) ─────────────────────────────────── */

//     useEffect(() => {
//         if (!isOpen || departmentList.length) return;
//         const controller = new AbortController();
//         (async () => {
//             try {
//                 const res = await axios.post(
//                     "/t2.0/authentificationUtilization/Department/list?page=0&size=0",
//                     {
//                         searchText: "",
//                         filter: "",
//                         startDate: "",
//                         endDate: "",
//                         roleID: currentUser.userRole,
//                         userID: currentUser.isHeExecutiveLeader
//                             ? Number(currentUser.userID)
//                             : currentUser?.userID ?? null,
//                     },
//                     { headers: { "Content-Type": "application/json" }, signal: controller.signal }
//                 );
//                 const depts = res.data.response.departments ?? [];
//                 setDepartmentList(
//                     depts
//                         .filter((d: any) => d.newStatus === "Active")
//                         .map((d: any) => ({
//                             key: d.departmentID,
//                             name: d.departmentName,
//                             status: d.newStatus,
//                         }))
//                 );
//             } catch (err) {
//                 if (!axios.isCancel(err)) console.error("Dept fetch error:", err);
//             }
//         })();
//         return () => controller.abort();
//     }, [isOpen, currentUser, departmentList.length]);

//     /* ── 2. Fetch ALL users (no roleID filter) – once on open ────────────────── */

//     useEffect(() => {
//         if (!isOpen || allUsers.length) return;
//         const controller = new AbortController();
//         setLoading(true);
//         (async () => {
//             try {
//                 const res = await axios.post(
//                     "/t2.0/authentificationUtilization/users/read?page=0&size=0",
//                     { filter: "", searchText: "", departmentID: 0 },
//                     {
//                         headers: {
//                             "Content-Type": "application/json",
//                             Authorization: `Bearer ${currentUser?.token ?? ""}`,
//                         },
//                         signal: controller.signal,
//                     }
//                 );
//                 const users: SimpleUser[] = (res.data.response.users ?? []).map((u: any) => ({
//                     userID: u.userID,
//                     userName: u.userName,
//                     roleID: u.roleID,
//                     departments: u.departments,
//                     departmentID: u.departmentID,
//                     elManagerId: u.elManagerId,       // ← EL Manager
//                     reportingManagerId: u.reportingManagerId, // ← FL / Reporting Manager
//                 }));
//                 setAllUsers(users);
//             } catch (err) {
//                 if (!axios.isCancel(err)) console.error("Users fetch error:", err);
//             } finally {
//                 setLoading(false);
//             }
//         })();
//         return () => controller.abort();
//     }, [isOpen, currentUser, allUsers.length]);




//     /* ── 3. Categorise by roleID ─────────────────────────────────────────────── */
//     const selectedDeptDetails = useMemo(() => {
//         if (!selectedDepartment) return null;
//         console.log("Finding department details for:", selectedDepartment, "from allUsers:", allUsers);
//         return allUsers
//             // .flatMap(user => user.departments ?? [])
//             .find(
//                 d => d.departmentID === Number(selectedDepartment)
//             );
//     }, [selectedDepartment, allUsers]);

//     /* ── 4. Cascading filtered lists ─────────────────────────────────────────── */

//     /**
//      * DEPARTMENT → EL
//      * ELs don't have a single departmentID; they carry a `departments[]` array.
//      * Match any EL whose departments list includes the selected departmentID.
//      */
//     const filteredFLs = useMemo(() => {
//         if (!selectedDeptDetails?.reportingManagerId ||
//             selectedDeptDetails.reportingManagerId === 0)
//             return [];

//         return allUsers.filter(
//             u => u.userID === selectedDeptDetails?.reportingManagerId
//         );
//     }, [allUsers, selectedDeptDetails]);

//     /**
//      * EL → FL  (using `elManagerId`)
//      * FL's `elManagerId` field points to the Executive Leader.
//      * Also match `departmentID` to keep it scoped to the selected department.
//      *
//      * Example: Brijesh HN (FL, dept 49, elManagerId: 149)
//      *          → appears under Naveen (EL, userID: 149) + Operations (dept 49)
//      */
//     const filteredELs = useMemo(() => {
//         if (!selectedDeptDetails?.elManagerId) return [];

//         return allUsers.filter(
//             u => u.userID === selectedDeptDetails?.elManagerId
//         );
//     }, [allUsers, selectedDeptDetails]);
//     /**
//      * FL → USER  (using `reportingManagerId`)
//      * Normal user's `reportingManagerId` field points to the Functional Leader.
//      * Also match `departmentID` to keep it scoped.
//      *
//      * Example: Kancharia (user, dept 18, reportingManagerId: 86)
//      *          → appears under Brijesh HN (FL, userID: 86) + MIS (dept 18)
//      */
//     const filteredUsers = useMemo(() => {
//         if (!selectedDepartment) return [];

//         const deptId = Number(selectedDepartment);

//         console.log("Selected Department:", deptId);
//         console.log("Selected EL:", selectedEL);
//         console.log("Selected FL:", selectedFL);

//         // Users in selected department
//         let users = allUsers.filter(u => u.departmentID === deptId);

//         console.log("Department Users:", users);

//         // FL selected
//         if (selectedFL) {
//             const filtered = users.filter(
//                 u => u.reportingManagerId === Number(selectedFL)
//             );

//             console.log("Users after FL filter:", filtered);

//             return filtered;
//         }

//         // EL selected
//         if (selectedEL) {
//             const filtered = users.filter(
//                 u => {
//                     console.log("Filtering users by EL:", selectedEL, "User elManagerId:", u.elManagerId);
//                     return u.elManagerId === Number(selectedEL);
//                 }
//             );

//             console.log("Users after EL filter:", filtered);

//             return filtered;
//         }

//         console.log("Users without EL/FL filter:", users);

//         return users;
//     }, [allUsers, selectedDepartment, selectedEL, selectedFL]);

//     /* ── 5. Selection handlers – each resets everything downstream ───────────── */

//     const handleDepartmentChange = (key: React.Key | null) => {
//         const val = key ? String(key) : "";
//         setSelectedDepartment(val);
//         setSelectedEL("");
//         setSelectedFL("");
//         setSelectedUser("");
//         setSelectedTargetUser("");
//     };

//     const handleELChange = (key: React.Key | null) => {
//         const val = key ? String(key) : "";
//         setSelectedEL(val);
//         setSelectedFL("");
//         setSelectedUser("");
//         // Can switch directly to this EL
//         setSelectedTargetUser(val);
//     };

//     const handleFLChange = (key: React.Key | null) => {
//         const val = key ? String(key) : "";
//         setSelectedFL(val);
//         setSelectedUser("");
//         // Can switch directly to this FL
//         setSelectedTargetUser(val);
//     };

//     const handleUserChange = (key: React.Key | null) => {
//         const val = key ? String(key) : "";
//         setSelectedUser(val);
//         // Switch to this normal user
//         setSelectedTargetUser(val);
//     };

//     /* ── 6. Reset / Switch ───────────────────────────────────────────────────── */

//     const resetAndClose = () => {
//         setSelectedDepartment("");
//         setSelectedEL("");
//         setSelectedFL("");
//         setSelectedUser("");
//         setSelectedTargetUser("");
//         setIsOpen(false);
//     };

//     const handleSwitch = async () => {
//         if (!selectedTargetUser) {
//             addToast({
//                 title: "Select a user",
//                 description:
//                     "Pick a Department → EL Manager → Reporting Manager → User (stop at any level to switch).",
//                 color: "warning",
//             });
//             return;
//         }
//         setSwitching(true);
//         try {
//             await switchToUser(Number(selectedTargetUser), currentUser.token);
//             addToast({
//                 title: "Switched",
//                 description: "You are now viewing as the selected user.",
//                 color: "success",
//             });
//             resetAndClose();
//             onSwitched();
//         } catch (err: any) {
//             addToast({
//                 title: "Switch failed",
//                 description:
//                     err?.response?.data?.message || "Could not switch to that user.",
//                 color: "danger",
//             });
//         } finally {
//             setSwitching(false);
//         }
//     };

//     /* ── 7. Helper: human-readable name ──────────────────────────────────────── */

//     const formatName = (name: string) => name.replace(/([A-Z])/g, " $1").trim();

//     /* ── 8. Render ───────────────────────────────────────────────────────────── */

//     return (
//         <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
//             <DropdownTrigger>
//                 <Button
//                     variant="flat"
//                     size="sm"
//                     color="secondary"
//                     className="px-4 h-8 gap-2 w-fit"
//                     startContent={<FilterIcon className="w-4 h-4" />}
//                 >
//                     Switch User
//                 </Button>
//             </DropdownTrigger>

//             <DropdownMenu aria-label="Switch user filter" closeOnSelect={false}>
//                 {/* ── Level 1: Department ──────────────────────────────────── */}
//                 <DropdownItem
//                     key="department"
//                     className="!bg-transparent hover:!bg-transparent"
//                 >
//                     <Autocomplete
//                         aria-label="Department"
//                         placeholder="Select Department"
//                         className="max-w-xs"
//                         selectedKey={selectedDepartment || undefined}
//                         onSelectionChange={handleDepartmentChange}
//                         isDisabled={loading}
//                     >
//                         {departmentList.map((d) => (
//                             <AutocompleteItem
//                                 key={String(d.key)}
//                                 textValue={d.name}
//                             >
//                                 {formatName(d.name)}
//                             </AutocompleteItem>
//                         ))}
//                     </Autocomplete>
//                 </DropdownItem>

//                 {/* ── Level 2: EL Manager (filtered by department) ─────────── */}
//                 <DropdownItem
//                     key="el"
//                     className="!bg-transparent hover:!bg-transparent"
//                 >
//                     <Autocomplete
//                         aria-label="EL Manager"
//                         placeholder="EL Manager"
//                         className="max-w-xs"
//                         selectedKey={selectedEL || undefined}
//                         onSelectionChange={handleELChange}
//                         isDisabled={loading}
//                     >
//                         {filteredELs.map((u) => (
//                             <AutocompleteItem
//                                 key={String(u.userID)}
//                                 textValue={u.userName}
//                             >
//                                 {formatName(u.userName)}
//                             </AutocompleteItem>
//                         ))}
//                     </Autocomplete>
//                 </DropdownItem>

//                 {/* ── Level 3: Reporting Manager / FL (filtered by dept + EL) */}
//                 <DropdownItem
//                     key="fl"
//                     className="!bg-transparent hover:!bg-transparent"
//                 >
//                     <Autocomplete
//                         aria-label="Reporting Manager"
//                         placeholder="Reporting Manager"
//                         className="max-w-xs"
//                         selectedKey={selectedFL || undefined}
//                         onSelectionChange={handleFLChange}
//                         isDisabled={loading}
//                     >
//                         {filteredFLs.map((u) => (
//                             <AutocompleteItem
//                                 key={String(u.userID)}
//                                 textValue={u.userName}
//                             >
//                                 {formatName(u.userName)}
//                             </AutocompleteItem>
//                         ))}
//                     </Autocomplete>
//                 </DropdownItem>

//                 {/* ── Level 4: User (filtered by dept + reporting manager) ─── */}
//                 <DropdownItem
//                     key="user"
//                     className="!bg-transparent hover:!bg-transparent"
//                 >
//                     <Autocomplete
//                         aria-label="User"
//                         placeholder="User"
//                         className="max-w-xs"
//                         selectedKey={selectedUser || undefined}
//                         onSelectionChange={handleUserChange}
//                         isDisabled={
//                             loading
//                         }
//                     >
//                         {filteredUsers.map((u) => (
//                             <AutocompleteItem
//                                 key={String(u.userID)}
//                                 textValue={u.userName}
//                             >
//                                 {u.userName}
//                             </AutocompleteItem>
//                         ))}
//                     </Autocomplete>
//                 </DropdownItem>

//                 {/* ── Switch Button ─────────────────────────────────────────── */}
//                 <DropdownItem
//                     key="go"
//                     className="!bg-transparent hover:!bg-transparent"
//                 >
//                     <div className="flex justify-end pt-1">
//                         <Button
//                             color="primary"
//                             size="sm"
//                             isLoading={switching}
//                             onPress={handleSwitch}
//                         >
//                             Switch
//                         </Button>
//                     </div>
//                 </DropdownItem>
//             </DropdownMenu>
//         </Dropdown>
//     );
// }

import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
    Autocomplete,
    AutocompleteItem,
    Button,
    addToast,
} from "@/components/ui";
import { switchToUser } from "./userSwitch";

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface Department {
    key: number;
    name: string;
    status: string;
}

interface SimpleUser {
    userID: number;
    userName: string;
    roleID?: number;
    /** EL records carry the list of departments they manage */
    departments?: {
        departmentID: number;
        departmentName: string;
        executiveLeaderID?: number | null;
        functionalLeaderID?: number | null;
    }[] | null;
    /** FL / normal-user records carry their own department */
    departmentID?: number | null;
    /** Points to the Executive Leader (elManager) */
    elManagerId?: number | null;
    /** Points to the Functional Leader / Reporting Manager */
    reportingManagerId?: number | null;
}

interface Props {
    currentUser: any;
    onSwitched: () => void;
}

/* ─── Component ─────────────────────────────────────────────────────────────── */

export default function SwitchUserFilter({ currentUser, onSwitched }: Props) {
    const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);

    // Cascade selection states (disabled — only direct user selection is active now)
    // const [selectedDepartment, setSelectedDepartment] = useState<string>("");
    // const [selectedEL, setSelectedEL] = useState<string>("");
    // const [selectedFL, setSelectedFL] = useState<string>("");
    const [selectedUser, setSelectedUser] = useState<string>("");
    const [userSearch, setUserSearch] = useState<string>("");

    // Final target – whichever level was last picked
    const [selectedTargetUser, setSelectedTargetUser] = useState<string>("");

    const [switching, setSwitching] = useState(false);
    const [loading, setLoading] = useState(false);

    /* ── 1. Fetch Departments (once on open) ─────────────────────────────────── */
    /*
    useEffect(() => {
        if (!isOpen || departmentList.length) return;
        const controller = new AbortController();
        (async () => {
            try {
                const res = await axios.post(
                    "/t2.0/authentificationUtilization/Department/list?page=0&size=0",
                    {
                        searchText: "",
                        filter: "",
                        startDate: "",
                        endDate: "",
                        roleID: currentUser.userRole,
                        userID: currentUser.isHeExecutiveLeader
                            ? Number(currentUser.userID)
                            : currentUser?.userID ?? null,
                    },
                    { headers: { "Content-Type": "application/json" }, signal: controller.signal }
                );
                const depts = res.data.response.departments ?? [];
                setDepartmentList(
                    depts
                        .filter((d: any) => d.newStatus === "Active")
                        .map((d: any) => ({
                            key: d.departmentID,
                            name: d.departmentName,
                            status: d.newStatus,
                        }))
                );
            } catch (err) {
                if (!axios.isCancel(err)) console.error("Dept fetch error:", err);
            }
        })();
        return () => controller.abort();
    }, [isOpen, currentUser, departmentList.length]);
    */

    /* ── 2. Fetch ALL users (no roleID filter) – once on open ────────────────── */

    useEffect(() => {
        if (allUsers.length) return;
        const controller = new AbortController();
        setLoading(true);
        (async () => {
            try {
                const res = await axios.post(
                    "/t2.0/authentificationUtilization/users/read?page=0&size=0",
                    { filter: "", searchText: "", departmentID: 0 },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${currentUser?.token ?? ""}`,
                        },
                        signal: controller.signal,
                    }
                );
                const users: SimpleUser[] = (res.data.response.users ?? []).map((u: any) => ({
                    userID: u.userID,
                    userName: u.userName,
                    roleID: u.roleID,
                    departments: u.departments,
                    departmentID: u.departmentID,
                    elManagerId: u.elManagerId,       // ← EL Manager
                    reportingManagerId: u.reportingManagerId, // ← FL / Reporting Manager
                }));
                setAllUsers(users);
            } catch (err) {
                if (!axios.isCancel(err)) console.error("Users fetch error:", err);
            } finally {
                setLoading(false);
            }
        })();
        return () => controller.abort();
    }, [currentUser, allUsers.length]);

    /* ── 3. Categorise by roleID ─────────────────────────────────────────────── */
    /*
    const selectedDeptDetails = useMemo(() => {
        if (!selectedDepartment) return null;
        console.log("Finding department details for:", selectedDepartment, "from allUsers:", allUsers);
        return allUsers
            // .flatMap(user => user.departments ?? [])
            .find(
                d => d.departmentID === Number(selectedDepartment)
            );
    }, [selectedDepartment, allUsers]);
    */

    /* ── 4. Cascading filtered lists ─────────────────────────────────────────── */

    /**
     * DEPARTMENT → EL
     * ELs don't have a single departmentID; they carry a `departments[]` array.
     * Match any EL whose departments list includes the selected departmentID.
     */
    /*
    const filteredFLs = useMemo(() => {
        if (!selectedDeptDetails?.reportingManagerId ||
            selectedDeptDetails.reportingManagerId === 0)
            return [];

        return allUsers.filter(
            u => u.userID === selectedDeptDetails?.reportingManagerId
        );
    }, [allUsers, selectedDeptDetails]);
    */

    /**
     * EL → FL  (using `elManagerId`)
     * FL's `elManagerId` field points to the Executive Leader.
     * Also match `departmentID` to keep it scoped to the selected department.
     *
     * Example: Brijesh HN (FL, dept 49, elManagerId: 149)
     *          → appears under Naveen (EL, userID: 149) + Operations (dept 49)
     */
    /*
    const filteredELs = useMemo(() => {
        if (!selectedDeptDetails?.elManagerId) return [];

        return allUsers.filter(
            u => u.userID === selectedDeptDetails?.elManagerId
        );
    }, [allUsers, selectedDeptDetails]);
    */

    /**
     * FL → USER  (using `reportingManagerId`)
     * Normal user's `reportingManagerId` field points to the Functional Leader.
     * Also match `departmentID` to keep it scoped.
     *
     * Example: Kancharia (user, dept 18, reportingManagerId: 86)
     *          → appears under Brijesh HN (FL, userID: 86) + MIS (dept 18)
     */
    /*
    const filteredUsers = useMemo(() => {
        if (!selectedDepartment) return [];

        const deptId = Number(selectedDepartment);

        console.log("Selected Department:", deptId);
        console.log("Selected EL:", selectedEL);
        console.log("Selected FL:", selectedFL);

        // Users in selected department
        let users = allUsers.filter(u => u.departmentID === deptId);

        console.log("Department Users:", users);

        // FL selected
        if (selectedFL) {
            const filtered = users.filter(
                u => u.reportingManagerId === Number(selectedFL)
            );

            console.log("Users after FL filter:", filtered);

            return filtered;
        }

        // EL selected
        if (selectedEL) {
            const filtered = users.filter(
                u => {
                    console.log("Filtering users by EL:", selectedEL, "User elManagerId:", u.elManagerId);
                    return u.elManagerId === Number(selectedEL);
                }
            );

            console.log("Users after EL filter:", filtered);

            return filtered;
        }

        console.log("Users without EL/FL filter:", users);

        return users;
    }, [allUsers, selectedDepartment, selectedEL, selectedFL]);
    */

    // Only user selection is active now — search across all fetched users directly.
    const filteredUsers = allUsers;

    /* ── 5. Selection handlers – each resets everything downstream ───────────── */

    /*
    const handleDepartmentChange = (key: React.Key | null) => {
        const val = key ? String(key) : "";
        setSelectedDepartment(val);
        setSelectedEL("");
        setSelectedFL("");
        setSelectedUser("");
        setSelectedTargetUser("");
    };

    const handleELChange = (key: React.Key | null) => {
        const val = key ? String(key) : "";
        setSelectedEL(val);
        setSelectedFL("");
        setSelectedUser("");
        // Can switch directly to this EL
        setSelectedTargetUser(val);
    };

    const handleFLChange = (key: React.Key | null) => {
        const val = key ? String(key) : "";
        setSelectedFL(val);
        setSelectedUser("");
        // Can switch directly to this FL
        setSelectedTargetUser(val);
    };
    */

    const handleUserChange = (key: React.Key | null) => {
        const val = key ? String(key) : "";
        setSelectedUser(val);
        const found = allUsers.find((u) => String(u.userID) === val);
        if (found) setUserSearch(found.userName);
        setSelectedTargetUser(val);
    };

    /* ── 6. Reset / Switch ───────────────────────────────────────────────────── */

    const resetAndClose = () => {
        setSelectedUser("");
        setUserSearch("");
        setSelectedTargetUser("");
    };

    const handleSwitch = async () => {
        if (!selectedTargetUser) {
            addToast({
                title: "Select a user",
                description: "Pick a user to switch to.",
                color: "warning",
            });
            return;
        }
        setSwitching(true);
        try {
            await switchToUser(Number(selectedTargetUser), currentUser.token);
            addToast({
                title: "Switched",
                description: "You are now viewing as the selected user.",
                color: "success",
            });
            resetAndClose();
            onSwitched();
        } catch (err: any) {
            addToast({
                title: "Switch failed",
                description:
                    err?.response?.data?.message || "Could not switch to that user.",
                color: "danger",
            });
        } finally {
            setSwitching(false);
        }
    };

    /* ── 7. Helper: human-readable name ──────────────────────────────────────── */

    // const formatName = (name: string) => name.replace(/([A-Z])/g, " $1").trim();

    /* ── 8. Render ───────────────────────────────────────────────────────────── */

    return (
        <div className="flex items-center gap-2">
            <Autocomplete
                aria-label="Switch user"
                placeholder="Search user to switch"
                className="max-w-xs"
                selectedKey={selectedUser || undefined}
                inputValue={userSearch}
                onInputChange={(value) => {
                    const dep = value as string;
                    setUserSearch(dep);
                    if (!dep) {
                        setSelectedUser("");
                        setSelectedTargetUser("");
                    }
                }}
                onSelectionChange={handleUserChange}
                isDisabled={loading}
            >
                {filteredUsers.sort((a, b) => a.userName.localeCompare(b.userName)).map((u) => (
                    <AutocompleteItem key={String(u.userID)} textValue={u.userName}>
                        {u.userName}
                    </AutocompleteItem>
                ))}
            </Autocomplete>

            <Button
                color="primary"
                size="sm"
                isLoading={switching}
                onPress={handleSwitch}
            >
                Switch
            </Button>
        </div>
    );
}