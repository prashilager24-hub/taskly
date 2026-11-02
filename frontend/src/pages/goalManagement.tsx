import { PageTitle } from "@/components/page";
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, addToast, Autocomplete, AutocompleteItem } from "@/components/ui";
import { Input } from "@/components/ui";
import axios from "axios";
import { Select, SelectItem } from "@/components/ui";
// import { addToast } from "@/components/ui" // Commented out
import { Textarea } from "@/components/ui";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { TableAction } from "@/components/table"
import { Check } from 'lucide-react';
import DepartmentSplit, { TypeTag, targetText } from "@/components/DepartmentSplit";
import { title } from "@/components/primitives";

interface Goal {
    goalID: number;
    departmentID: number;
    goalName: string;
    goalMetric: string;
    metricValue: string;
    unit: string;
    frequency: string;
    timingType: string;
    isDynamic: boolean;
    description: string;
    isActive: boolean;
    createdAt: string;
    modifiedAt: string;
    departmentName?: string;
    approvedByEL?: boolean;
}


/** departmentId: shown inside that sub department (Department Management), without the page title */
const GoalManagement: React.FC<{ departmentId?: number }> = ({ departmentId }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState("");

    const [departmentList, setDepartmentList] = useState<any[]>([])
    const [SelectedTask, setSelectedTask] = useState([])
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Goal[]>([]);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [toggleStatusValue, setToggleStatusValue] = useState<boolean | null>(null);
    const [tableRefreshKey, setTableRefreshKey] = useState(0);
    const [filterStatus, setFilterStatus] = useState(
        ""
    );
    const [goals, setGoals] = useState<Goal[]>([]);


    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newGoal, setNewGoal] = useState({
        goalId: -1,
        goalName: "",
        goalMetric: "",
        metricValue: "",
        unit: "",
        liveAccounts: 0,
        frequency: "Monthly",
        timingType: "MonthEnd",
        isDynamic: false,
        description: "",
        isActive: true,
        roleID: "",
    });
    const resetGoalForm = () => {
        setNewGoal({
            goalId: -1,
            goalName: "",
            goalMetric: "",
            metricValue: "",
            unit: "",
            liveAccounts: 0,
            frequency: "Monthly",
            timingType: "MonthEnd",
            isDynamic: false,
            description: "",
            isActive: true,
            roleID: "",
        });

        setIsEditing(false);
        setFilterStatus("");
    };

    const handleAddGoal = async () => {
        if (
            !filterStatus ||
            !newGoal.goalName ||
            !newGoal.goalMetric ||
            !newGoal.metricValue ||
            !newGoal.unit ||
            !newGoal.frequency
        ) {
            addToast({
                title: "Missing Required Fields",
                description: "Please fill all mandatory fields.",
                color: "warning",
            });
            return;
        }

        const payload = {
            departmentID: Number(filterStatus),
            goalName: newGoal.goalName,
            goalMetric: newGoal.goalMetric,
            metricValue: newGoal.metricValue,
            unit: newGoal.unit,
            liveAccounts: newGoal.liveAccounts,
            frequency: newGoal.frequency,
            timingType: newGoal.timingType,
            isDynamic: newGoal.isDynamic,
            description: newGoal.description,
            roleID: Number(newGoal.roleID),
        };
        const headers = {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
        };
        await axios.post(
            "/t2.0/authentificationUtilization/departmentGoals/create",
            payload,
            { headers }
        );

        addToast({
            title: "Goal Created",
            description: "Department goal created successfully.",
            color: "success",
        });

        resetGoalForm();
        setIsModalOpen(false);
        setTableRefreshKey((p) => p + 1);
    };


    const handleEditGoal = async (goalID: number) => {
        const payload = {
            departmentID: Number(filterStatus),
            goalName: newGoal.goalName,
            goalMetric: newGoal.goalMetric,
            metricValue: newGoal.metricValue,
            unit: newGoal.unit,
            liveAccounts: newGoal.liveAccounts,
            frequency: newGoal.frequency,
            timingType: newGoal.timingType,
            isDynamic: newGoal.isDynamic,
            description: newGoal.description,
            isActive: newGoal.isActive,
            roleID: Number(newGoal.roleID),
        };
        const headers = {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
        };
        await axios.put(
            `/t2.0/authentificationUtilization/departmentGoals/update/${goalID}`,
            payload,
            { headers }
        );

        addToast({
            title: "Goal Updated",
            description: "Department goal updated successfully.",
            color: "success",
        });

        resetGoalForm();
        setIsModalOpen(false);
        setTableRefreshKey((p) => p + 1);
    };





    const authUserLD = localStorage.getItem("authUserLD");
    const authUser = authUserLD ? JSON.parse(authUserLD) : null;
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // Table configuration

    const taskActions: TableAction[] = [
        {
            key: 'edit',
            label: 'Edit',
            color: 'primary',
            onAction: (row: Goal) => {
                setIsEditing(true);

                setNewGoal({
                    goalId: row.goalID,
                    goalName: row.goalName,
                    goalMetric: row.goalMetric,
                    metricValue: row.metricValue,
                    unit: row.unit,
                    liveAccounts: row.liveAccounts,
                    frequency: row.frequency,
                    timingType: row.timingType,
                    isDynamic: row.isDynamic,
                    description: row.description,
                    isActive: row.isActive,
                    roleID: row.roleID ? String(row.roleID) : "",
                });

                setFilterStatus(String(row.departmentID));
                setIsModalOpen(true);
            }

        },

    ];
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
                const headers = {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
                };
                const { data } = await axios.post(
                    "/t2.0/authentificationUtilization/Department/list?page=0&size=0",
                    bodyData,
                    { headers }
                );

                const formatted = data.response.departments?.map((dept: any) => ({
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


    useEffect(() => {
        const fetchGoals = async () => {
            const body = {
                departmentId: 0,
                searchText: "",
                filter: "",
                startDate: "",
                endDate: "",
            };

            const headers = {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
            };
            const { data } = await axios.post(
                `/t2.0/authentificationUtilization/departmentGoals/list?page=0&size=0`,
                body,
                { headers }
            );

            console.log("Fetched Goals:", data);
            const mapped: Goal[] = data.response.goals.map((g: any) => ({
                goalID: g.goalID,
                departmentID: g.departmentID,
                goalName: g.goalName,
                goalMetric: g.goalMetric,
                metricValue: g.metricValue,
                unit: g.unit,
                frequency: g.frequency,
                // timingType: g.timingType,
                isDynamic: g.isDynamic,
                // description: g.description,
                isActive: g.isActive,
                liveAccounts: g.liveAccounts,
                roleID: g.roleID,
                departmentName: g.departmentName,
                approvedByEL: g.approvedByEL,

            }));

            setGoals(mapped);
        };

        fetchGoals();
    }, [tableRefreshKey]);

    const handleToggleStatus = async () => {
        if (selectedRows.length !== 1 || toggleStatusValue === null) return;

        const row = selectedRows[0];
        const newStatus = toggleStatusValue;

        try {
            const headers = {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
            };

            await axios.put(
                `/t2.0/authentificationUtilization/departmentGoals/${row.goalID}/status?isActive=${newStatus}`,
                {},
                { headers }
            );

            setGoals((prev) =>
                prev.map((g) =>
                    g.goalID === row.goalID ? { ...g, isActive: newStatus } : g
                )
            );

            addToast({
                title: newStatus ? "Goal Activated" : "Goal Deactivated",
                description: `"${row.goalName}" updated successfully.`,
                color: "success",
            });


            setSelectedRows([]);
        } catch (err) {
            console.error(err);
            addToast({
                title: "Error",
                description: "Failed to update target status.",
                color: "danger",
            });
        }

        setConfirmOpen(false);
        setTableRefreshKey((prev) => prev + 1);
    };


    const openAdd = (dept = "") => {
        resetGoalForm();
        setIsEditing(false);
        setSelectedDepartment(dept);
        setFilterStatus(dept);
        setIsModalOpen(true);
    };

    // Executive Leaders acknowledge goals, one at a time or all pending in a department
    const canAcknowledge = authUser?.userRole === 3;
    const acknowledge = async (ids: number[]) => {
        try {
            await axios.put("/t2.0/authentificationUtilization/departmentGoals/approve", { goalIds: ids, userId: authUser.userID },
                { headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${authUser?.token ?? ""}` } });
            addToast({ title: "Goals acknowledged", color: "success" });
            setTableRefreshKey((p) => p + 1);
        } catch {
            addToast({ title: "Could not acknowledge goals", color: "danger" });
        }
    };

    // people see the departments they work in or lead; Super Admin sees all
    const inScope = (deptId: number) => {
        const mine = (authUser?.departments ?? []).some((x: any) => x.departmentID === deptId);
        if (authUser?.userRole === 3 || authUser?.userRole === 4) return mine;
        if (authUser?.userRole === 2) return authUser?.departmentID === deptId;
        return true;
    };
    const visibleGoals = goals.filter((g) => inScope(Number(g.departmentID)));
    // every active department, plus the ones an item names that the list did not return
    const splitDepartments = [
        ...departmentList.filter((d) => inScope(Number(d.key))).filter((d) => String(d.status ?? "Active") === "Active").map((d) => ({ id: Number(d.key), name: d.name })),
        ...visibleGoals.filter((i: any) => i.departmentName).map((i: any) => ({ id: Number(i.departmentID), name: i.departmentName })),
    ];

    return (
        <div>

            {departmentId == null && (
            <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <PageTitle title="Goal Management" subtitle="Manage and monitor all department goals" />
                <div className="flex justify-end m-3 gap-3">
                    <Button variant="flat"
                        size="sm"
                        color="primary"
                        className={`px-4 h-8 w-fit ${!authUserLD?.departmentID
                            ? ""
                            : "opacity-0 pointer-events-none select-none"
                            }`}
                        isDisabled={loading || !!authUserLD?.departmentID} >
                        Download All
                    </Button>
                    <Button
                        size="sm"
                        color="primary" onPress={() => openAdd()}
                    >
                        Add New Goal
                    </Button>
                </div>
            </div>
            )}

            <DepartmentSplit<any>
                lockedDepartment={departmentId}
                noun="goal"
                items={visibleGoals}
                departments={splitDepartments}
                deptOf={(g) => Number(g.departmentID)}
                isActive={(g) => !!g.isActive}
                idOf={(g) => g.goalID}
                searchText={(g) => `${g.goalName} ${g.goalMetric ?? ""}`}
                flagCount={(list) => list.filter((g) => g.isActive && !g.approvedByEL).length}
                flagLabel="not acknowledged"
                summaryExtra={(list) => { const w = list.filter((g) => !g.approvedByEL).length; return `${list.length - w} acknowledged · ${w} waiting`; }}
                headerExtra={(list) => {
                    const pending = list.filter((g) => g.isActive && !g.approvedByEL);
                    return canAcknowledge && pending.length > 0 ? (
                        <Button size="sm" variant="bordered" startContent={<Check size={14} />} onPress={() => acknowledge(pending.map((g) => g.goalID))}>Acknowledge {pending.length} pending</Button>
                    ) : null;
                }}
                columns={[
                    { label: "Goal", cell: (g) => <span className="font-semibold text-ink-900 dark:text-white">{g.goalName || "Untitled"}</span>, className: "min-w-[220px] max-w-[360px] whitespace-normal break-words" },
                    { label: "Measured by", cell: (g) => g.goalMetric || "—" },
                    { label: "Target", cell: (g) => targetText(g.metricValue, g.unit), className: "whitespace-nowrap text-ink-900 dark:text-white" },
                    { label: "How often", cell: (g) => g.frequency || "—" },
                    { label: "Type", cell: (g) => <TypeTag dynamic={g.isDynamic} /> },
                    {
                        label: "Acknowledged", cell: (g) => g.approvedByEL
                            ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400"><Check size={13} /> Acknowledged</span>
                            : canAcknowledge && g.isActive
                                ? <button type="button" onClick={() => acknowledge([g.goalID])} className="text-xs font-bold uppercase tracking-wide text-brand-600 hover:underline">Acknowledge</button>
                                : <span className="text-xs font-semibold text-amber-600">Waiting</span>,
                    },
                ]}
                onAdd={(id) => openAdd(String(id))}
                onEdit={(g) => taskActions[0].onAction(g)}
                onToggle={(g) => { setSelectedRows([g]); setToggleStatusValue(!g.isActive); setConfirmOpen(true); }}
            />

            {/* Create / edit canvas */}
            <Drawer
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
            >
                <DrawerContent>
                    {(onClose: () => void) => (
                        <>
                            <DrawerHeader>
                                {isEditing ? "Edit Goal" : "Add New Goal"}
                            </DrawerHeader>

                            <DrawerBody>
                                <div className="space-y-4">
                                    <div className="mb-6 flex flex-col sm:flex-row gap-4">
                                        <Autocomplete
                                            aria-label="Filter by Department"
                                            placeholder="Filter by Department"
                                            className="max-w-xs"
                                            selectedKey={filterStatus}
                                            onSelectionChange={(key) => setFilterStatus(key as string)}
                                        >
                                            {departmentList
                                                .filter((ele) => ele.status === "Active")
                                                .map((ele) => (
                                                    <AutocompleteItem key={ele.key} value={ele.name}>
                                                        {ele.name.replace(/([A-Z])/g, " $1").trim()}
                                                    </AutocompleteItem>
                                                ))}
                                        </Autocomplete>
                                    </div>
                                    <Input
                                        isRequired
                                        label={<span> Name</span>}
                                        placeholder="Enter goal name"
                                        value={newGoal.goalName}
                                        onChange={(e) => setNewGoal({ ...newGoal, goalName: e.target.value })}
                                    />

                                    <Input
                                        isRequired
                                        label={<span>Goal Metric</span>}
                                        placeholder="Enter goal metric (e.g., LeadsGenerated)"
                                        value={newGoal.goalMetric}
                                        onChange={(e) => setNewGoal({ ...newGoal, goalMetric: e.target.value })}
                                    />

                                    <Input
                                        isRequired
                                        label={<span>Metric Value</span>}
                                        placeholder="Enter metric value"
                                        value={newGoal.metricValue}
                                        onChange={(e) => setNewGoal({ ...newGoal, metricValue: e.target.value })}
                                    />

                                    <Input
                                        isRequired
                                        type="number"
                                        label={<span>Unit</span>}
                                        placeholder="Enter goal unit (e.g., 500)"
                                        value={newGoal.unit}
                                        onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
                                    />

                                    <Select
                                        isRequired
                                        label={<span>Frequency</span>}
                                        selectedKeys={[newGoal.frequency]}
                                        onSelectionChange={(keys) =>
                                            setNewGoal({ ...newGoal, frequency: Array.from(keys)[0] })
                                        }
                                    >
                                        <SelectItem key="Daily">Daily</SelectItem>
                                        <SelectItem key="Weekly">Weekly</SelectItem>
                                        <SelectItem key="Monthly">Monthly</SelectItem>
                                        <SelectItem key="Quarterly">Quarterly</SelectItem>
                                    </Select>

                                    <Select
                                        isRequired
                                        label={<span>Role</span>}
                                        selectedKeys={[newGoal.roleID]}
                                        onSelectionChange={(keys) =>
                                            setNewGoal({ ...newGoal, roleID: Array.from(keys)[0] })
                                        }
                                    >
                                        <SelectItem key="1">Root User</SelectItem>
                                        <SelectItem key="2">User</SelectItem>
                                        <SelectItem key="3">EL</SelectItem>
                                        <SelectItem key="4">FL</SelectItem>
                                        <SelectItem key="5">Intern</SelectItem>
                                        <SelectItem key="6">Executive</SelectItem>
                                        <SelectItem key="7">Manager</SelectItem>
                                        <SelectItem key="23">Lead</SelectItem>
                                    </Select>
                                    {
                                        filterStatus == 12 && (
                                            <Input
                                                isRequired
                                                type="number"
                                                label={<span>Live Accounts</span>}
                                                placeholder="Live Accounts "
                                                value={newGoal.liveAccounts}
                                                onChange={(e) => setNewGoal({ ...newGoal, liveAccounts: e.target.value })}
                                            />
                                        )
                                    }


                                    {/* <Select
                                        isRequired
                                        label={<span>Timing Type</span>}
                                        selectedKeys={[newGoal.timingType]}
                                        onSelectionChange={(keys) =>
                                            setNewGoal({ ...newGoal, timingType: Array.from(keys)[0] })
                                        }
                                    >
                                        <SelectItem key="Ongoing">Ongoing</SelectItem>
                                        <SelectItem key="Fixed">Fixed</SelectItem>
                                    </Select> */}

                                    {/* <Select
                                        isRequired
                                        label={<span>Is Dynamic</span>}
                                        selectedKeys={[newGoal.isDynamic.toString()]}
                                        onSelectionChange={(keys) =>
                                            setNewGoal({ ...newGoal, isDynamic: Array.from(keys)[0] === "true" })
                                        }
                                    >
                                        <SelectItem key="true">Yes</SelectItem>
                                        <SelectItem key="false">No</SelectItem>
                                    </Select> */}

                                    {/* <Textarea
                                        isRequired
                                        label={<span>Description</span>}
                                        placeholder="Enter description"
                                        value={newGoal.description}
                                        onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                                    /> */}
                                </div>
                            </DrawerBody>

                            <DrawerFooter>
                                <Button color="danger" variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={() => {
                                        isEditing ? handleEditGoal(newGoal.goalId) : handleAddGoal();
                                    }}
                                >
                                    {isEditing ? "Update Goal" : "Add Goal"}
                                </Button>

                            </DrawerFooter>
                        </>
                    )}
                </DrawerContent>
            </Drawer>


            <Modal isOpen={confirmOpen} onOpenChange={setConfirmOpen}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{toggleStatusValue ? "Activate Goal" : "Deactivate Goal"}</ModalHeader>
                            <ModalBody>
                                {selectedRows[0] && (
                                    <p>
                                        Are you sure you want to{" "}
                                        <b>{toggleStatusValue ? "activate" : "deactivate"}</b>{" "}
                                        goal <b>"{selectedRows[0].goalName}"</b>?
                                    </p>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button
                                    variant='flat'
                                    color={toggleStatusValue ? "success" : "danger"}
                                    onPress={handleToggleStatus}
                                >
                                    {toggleStatusValue ? "Activate" : "Deactivate"}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>


        </div>
    );
};

export default GoalManagement;