import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { addToast, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tabs, Tab, Chip } from "@/components/ui";
import { Input } from "@/components/ui";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
} from "@/components/ui";
import axios from "axios";
import { title } from "@/components/primitives";
import { Select, SelectItem } from "@/components/ui";
import { useMemo, useCallback } from "react";
import { RootNode } from "@/components/Hierarchy/RootNode";
import { buildFlow } from "@/components/Hierarchy/buildFlow.ts";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Node,
} from "reactflow";
import "reactflow/dist/style.css";

import { PrimaryDepartmentNode } from "@/components/Hierarchy/PrimaryDepartmentNode";
import { DepartmentNode } from "@/components/Hierarchy/DepartmentNode";
import { UserNode } from "@/components/Hierarchy/UserNode";
import { getLayoutedElements } from "@/components/Hierarchy/layout";
interface PrimaryDepartment {
    key: number;
    name: string;
    type: "BUSINESS" | "SUPPORT";
    goalCriteria: string;
    targetCriteria: string;
    active: boolean;
    createdAt?: string;
    updatedAt?: string;
}

// Confirmation Modal for Delete-like destructive actions
const ConfirmToggleModal = ({
    isOpen,
    onClose,
    onConfirm,
    name,
    active,
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    name: string;
    active?: boolean;
}) => (
    <Modal isOpen={isOpen} onOpenChange={onClose} size="sm">
        <ModalContent>
            <ModalHeader>{active ? "Deactivate Department" : "Activate Department"}</ModalHeader>
            <ModalBody>
                <p>
                    Are you sure you want to
                    <strong>{active ? " deactivate " : " activate "}</strong>
                    <b>{name}</b>?
                </p>
            </ModalBody>
            <ModalFooter>
                <Button variant="light" onPress={onClose}>
                    Cancel
                </Button>
                <Button
                    color={active ? "danger" : "success"}
                    onPress={() => {
                        onConfirm();
                        onClose();
                    }}
                >
                    {active ? "Deactivate" : "Activate"}
                </Button>
            </ModalFooter>
        </ModalContent>
    </Modal>
);

export default function PrimaryDepartmentPage() {
    const authUserLD = localStorage.getItem("authUserLD");
    const authToken = authUserLD ? JSON.parse(authUserLD).token : "";
    const [goalCriteria, setGoalCriteria] = useState<string>("DAILY");
    const [targetCriteria, setTargetCriteria] = useState<string>("DAILY");
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [term, setTerm] = useState("");
    const [primaryDepartmentName, setPrimaryDepartmentName] = useState("");
    const [primaryDepartmentList, setPrimaryDepartmentList] = useState<PrimaryDepartment[]>([]);
    const [selectedId, setSelectedId] = useState<number | "">("");
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState<"BUSINESS" | "SUPPORT">("BUSINESS");
    const [toggleConfirm, setToggleConfirm] = useState<{
        open: boolean;
        id?: number;
        name?: string;
        active?: boolean;
    }>({ open: false });
    const [hierarchyData, setHierarchyData] = useState<any[]>([]);
    const [hierarchyLoading, setHierarchyLoading] = useState(false);
    const [expandedDept, setExpandedDept] = useState<Set<number>>(new Set());

    const fetchHierarchy = async () => {
        try {
            setHierarchyLoading(true);
            const res = await axios.get(
                "/t2.0/authentificationUtilization/Department/hierarchy",
                { headers }
            );
            setHierarchyData(res.data?.data || []);
        } catch (err) {
            console.error("Error fetching department hierarchy:", err);
            addToast({
                title: "Error",
                description: "Failed to load department hierarchy",
                color: "danger",
            });
        } finally {
            setHierarchyLoading(false);
        }
    };

    const nodeTypes = useMemo(
        () => ({
            root: RootNode,
            primaryDepartment: PrimaryDepartmentNode,
            department: DepartmentNode,
            user: UserNode,
        }),
        []
    );

    const { nodes, edges } = useMemo(() => {
        const { nodes: rawNodes, edges: rawEdges } = buildFlow(hierarchyData, expandedDept);
        return getLayoutedElements(rawNodes, rawEdges, "TB");
    }, [hierarchyData, expandedDept]);

    const onNodeClick = useCallback((_event: any, node: Node) => {
        if (node.id.startsWith("dept-")) {
            const deptId = Number(node.id.replace("dept-", ""));
            setExpandedDept((prev) => {
                const next = new Set(prev);
                next.has(deptId) ? next.delete(deptId) : next.add(deptId);
                return next;
            });
        }
    }, []);
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
    };

    const fetchPrimaryDepartments = async () => {
        try {
            setLoading(true);
            const res = await axios.post(
                "/t2.0/authentificationUtilization/PrimaryDepartment/list",
                {},
                { headers }
            );

            const data = res.data?.data || [];

            const formatted: PrimaryDepartment[] = data.map((pd: any) => ({
                key: pd.primaryDepartmentId,
                name: pd.primaryDepartmentName,
                type: pd.type,
                goalCriteria: pd.goalCriteria || "DAILY",
                targetCriteria: pd.targetCriteria || "DAILY",
                active: pd.active,
                createdAt: pd.createdAt,
                updatedAt: pd.updatedAt,
            }));

            setPrimaryDepartmentList(formatted);
        } catch (err) {
            console.error("Error fetching departments:", err);
            addToast({
                title: "Error",
                description: "Failed to load departments",
                color: "danger",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrimaryDepartments();
    }, []);

    const resetForm = () => {
        setPrimaryDepartmentName("");
        setType("BUSINESS");
        setGoalCriteria("DAILY");
        setTargetCriteria("DAILY");
        setSelectedId("");
    };

    const handleOpenAddModal = () => {
        resetForm();
        onOpen();
    };

    const openEditModal = (pd: PrimaryDepartment) => {
        setSelectedId(pd.key);
        setPrimaryDepartmentName(pd.name);
        setGoalCriteria(pd.goalCriteria || "DAILY");
        setTargetCriteria(pd.targetCriteria || "DAILY");
        onOpen();
    };

    const handleCreate = async () => {
        const trimmedName = primaryDepartmentName.trim();

        if (!trimmedName) {
            addToast({
                title: "Error",
                description: "Department name is required",
                color: "danger",
            });
            return;
        }

        try {
            await axios.post(
                "/t2.0/authentificationUtilization/PrimaryDepartment/create",
                {
                    primaryDepartmentName: trimmedName,
                    type,
                    goalCriteria,
                    targetCriteria
                },
                { headers }
            );

            addToast({
                title: "Success",
                description: "Department created successfully",
                color: "success",
            });

            resetForm();
            fetchPrimaryDepartments();
        } catch (error: any) {
            const status = error?.response?.status;
            const message =
                status === 409
                    ? "A department with this name already exists"
                    : "Failed to create department";

            console.error("Error creating department:", error);
            addToast({ title: "Error", description: message, color: "danger" });
        }
    };

    const handleUpdate = async (id: number) => {
        const trimmedName = primaryDepartmentName.trim();

        try {
            // Empty name is intentionally sent as-is; backend skips blank updates
            await axios.post(
                `/t2.0/authentificationUtilization/PrimaryDepartment/update/${id}`,
                {
                    primaryDepartmentName: trimmedName,
                    type,
                    goalCriteria,
                    targetCriteria
                },
                { headers }
            );

            addToast({
                title: "Success",
                description: "Department updated successfully",
                color: "success",
            });

            resetForm();
            fetchPrimaryDepartments();
        } catch (error: any) {
            const status = error?.response?.status;
            const message = status === 404 ? "Department not found" : "Failed to update department";

            console.error("Error updating department:", error);
            addToast({ title: "Error", description: message, color: "danger" });
        }
    };

    const handleToggleStatus = async (id: number, isActive: boolean) => {
        try {
            await axios.post(
                "/t2.0/authentificationUtilization/PrimaryDepartment/status",
                { primaryDepartmentId: id, isActive },
                { headers }
            );

            addToast({
                title: "Success",
                description: `Department ${isActive ? "activated" : "deactivated"} successfully`,
                color: isActive ? "success" : "warning",
            });

            setPrimaryDepartmentList((prev) =>
                prev.map((pd) => (pd.key === id ? { ...pd, active: isActive } : pd))
            );
        } catch (error) {
            console.error("Error toggling department status:", error);
            addToast({
                title: "Error",
                description: "Failed to update department status",
                color: "danger",
            });
        }
    };

    const filteredList = primaryDepartmentList
        .filter((pd) => {
            if (!term.trim()) return true;
            const search = term.toLowerCase();
            return pd.name.toLowerCase().includes(search) || String(pd.key).includes(search);
        })
        .sort((a, b) => a.key - b.key);

    return (
        <div className="flex flex-col h-full">
            <Tabs
                aria-label="Department Views"
                color="primary"
                variant="underlined"
                className="mb-2"
                onSelectionChange={(key) => {
                    if (key === "hierarchy" && hierarchyData.length === 0) {
                        fetchHierarchy();
                    }
                }}
            >
                <Tab key="list" title="Departments">
                    {/* HEADER */}
                    <div className="flex justify-between items-center mb-4 h-12">
                        <div>
                            <h1 className={title({ size: "20px" })}>Department Management</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Manage top-level departments used to group departments
                            </p>
                        </div>

                        <Button size="sm" color="primary" onClick={handleOpenAddModal}>
                            Add Department
                        </Button>
                    </div>

                    {/* SEARCH */}
                    <Input
                        type="search"
                        placeholder="Search departments..."
                        value={term}
                        onValueChange={setTerm}
                        variant="bordered"
                        radius="lg"
                        className="max-w-md ml-[14px]"
                        startContent={
                            <svg
                                className="w-4 h-4 text-default-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        }
                    />
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 p-4">
                        {!loading && filteredList.length === 0 && (
                            <div className="col-span-full text-center text-sm text-gray-500 dark:text-gray-400 py-10">
                                No departments found.
                            </div>
                        )}

                        {filteredList.map((pd) => (
                            <div className="relative p-6 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-5">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {/* Avatar */}
                                        <div className="h-11 w-11 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg flex-shrink-0">
                                            {pd.name?.charAt(0).toUpperCase()}
                                        </div>

                                        {/* Name */}
                                        <div className="min-w-0">
                                            <h3
                                                className="text-sm font-semibold text-gray-900 dark:text-white"
                                                style={{
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: "vertical",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                {pd.name}
                                            </h3>

                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                ID: {pd.key}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Dropdown */}
                                    <Dropdown>
                                        <DropdownTrigger>
                                            <button
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-ellipsis-vertical-icon lucide-ellipsis-vertical"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                                            </button>
                                        </DropdownTrigger>

                                        <DropdownMenu
                                            aria-label="Actions"
                                            onAction={(key) => {
                                                if (key === "edit") openEditModal(pd);

                                                if (key === "toggle") {
                                                    setToggleConfirm({
                                                        open: true,
                                                        id: pd.key,
                                                        name: pd.name,
                                                        active: pd.active,
                                                    });
                                                }
                                            }}
                                        >
                                            <DropdownItem key="edit" className="text-blue-600">
                                                Edit
                                            </DropdownItem>

                                            <DropdownItem
                                                key="toggle"
                                                className={pd.active ? "text-red-600" : "text-green-600"}
                                            >
                                                {pd.active ? "Deactivate" : "Activate"}
                                            </DropdownItem>
                                        </DropdownMenu>
                                    </Dropdown>
                                </div>

                                {/* Status */}
                                <div className="flex items-center justify-between mb-4">
                                    <span
                                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${pd.active
                                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                            }`}
                                    >
                                        <span className="w-2 h-2 rounded-full bg-current" />
                                        {pd.active ? "Active" : "Inactive"}
                                    </span>

                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        Department
                                    </span>
                                </div>

                                <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

                                {/* Info Chips */}
                                <div className="flex flex-wrap gap-2">
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
                                        <i className="ti ti-target-arrow" />
                                        Goal: {pd.goalCriteria || "—"}
                                    </div>

                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium">
                                        <i className="ti ti-flag-3" />
                                        Target: {pd.targetCriteria || "—"}
                                    </div>

                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs font-medium">
                                        <i className="ti ti-category" />
                                        Type: {pd.type || "—"}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* MAIN LIST AREA */}
                </Tab>
                <Tab key="hierarchy" title="Hierarchy">
                    <div className="mt-4" style={{ height: "75vh" }}>
                        {hierarchyLoading && (
                            <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-10">
                                Loading hierarchy...
                            </div>
                        )}

                        {!hierarchyLoading && hierarchyData.length === 0 && (
                            <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-10">
                                No hierarchy data found.
                            </div>
                        )}

                        {!hierarchyLoading && hierarchyData.length > 0 && (
                            <div className="w-full h-full rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <ReactFlow
                                    nodes={nodes}
                                    edges={edges}
                                    nodeTypes={nodeTypes}
                                    onNodeClick={onNodeClick}
                                    fitView
                                    minZoom={0.1}
                                >
                                    <Background />
                                    <Controls />
                                    <MiniMap />
                                </ReactFlow>
                            </div>
                        )}
                    </div>
                </Tab>

            </Tabs>
            {/* =========================== */}
            {/*       ADD / EDIT MODAL      */}
            {/* =========================== */}
            <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>
                                {selectedId ? "Edit Department" : "Add New Department"}
                            </ModalHeader>

                            <ModalBody>
                                <div className="space-y-4">
                                    <Input
                                        label="Department Name"
                                        placeholder="Enter department name"
                                        value={primaryDepartmentName}
                                        onChange={(e) => setPrimaryDepartmentName(e.target.value)}
                                        variant="bordered"
                                        isRequired
                                    />
                                </div>
                                <div>
                                    <Select
                                        label="Department Type"
                                        selectedKeys={[type]}
                                        onSelectionChange={(keys) =>
                                            setType(Array.from(keys)[0] as "BUSINESS" | "SUPPORT")
                                        }
                                    >
                                        <SelectItem key="BUSINESS">
                                            Business
                                        </SelectItem>

                                        <SelectItem key="SUPPORT">
                                            Support
                                        </SelectItem>
                                    </Select>
                                </div>
                                <div>
                                    <Select
                                        label="Goal Criteria"
                                        selectedKeys={[goalCriteria]}
                                        onSelectionChange={(keys) => setGoalCriteria(Array.from(keys)[0] as string)}
                                    >
                                        <SelectItem key="DAILY">Daily</SelectItem>
                                        <SelectItem key="WEEKLY">Weekly</SelectItem>
                                        <SelectItem key="MONTHLY">Monthly</SelectItem>
                                        <SelectItem key="QUARTERLY">Quarterly</SelectItem>
                                        <SelectItem key="COMBINED">Combined</SelectItem>
                                    </Select>


                                </div>
                                <div>
                                    <Select
                                        label="Target Criteria"
                                        selectedKeys={[targetCriteria]}
                                        onSelectionChange={(keys) => setTargetCriteria(Array.from(keys)[0] as string)}
                                    >
                                        <SelectItem key="DAILY">Daily</SelectItem>
                                        <SelectItem key="WEEKLY">Weekly</SelectItem>
                                        <SelectItem key="MONTHLY">Monthly</SelectItem>
                                        <SelectItem key="QUARTERLY">Quarterly</SelectItem>
                                        <SelectItem key="COMBINED">Combined</SelectItem>
                                    </Select>
                                </div>
                            </ModalBody>

                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    Cancel
                                </Button>

                                <Button
                                    color="primary"
                                    onClick={() => {
                                        if (selectedId) {
                                            handleUpdate(selectedId);
                                        } else {
                                            handleCreate();
                                        }
                                        onClose();
                                    }}
                                >
                                    {selectedId ? "Update Department" : "Add Department"}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* ============================ */}
            {/*      ACTIVATE / DEACTIVATE    */}
            {/* ============================ */}
            <ConfirmToggleModal
                isOpen={toggleConfirm.open}
                onClose={() => setToggleConfirm({ open: false })}
                onConfirm={() => {
                    if (toggleConfirm.id !== undefined) {
                        handleToggleStatus(toggleConfirm.id, !toggleConfirm.active);
                    }
                }}
                name={toggleConfirm.name || ""}
                active={toggleConfirm.active}
            />
        </div>
    );
}