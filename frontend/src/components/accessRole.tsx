import { useState, useEffect, useCallback } from "react";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Select,
    SelectItem,
    Alert
} from "@/components/ui";

const MODULES = [
    { id: "dashboard", label: "Dashboard", rootRequired: false, children: [] },
    {
        id: "reports",
        label: "Reports",
        rootRequired: false,
        children: [
            { id: "perf", label: "Performance insights" },
            { id: "mydata", label: "My data / User data" },
            { id: "goals", label: "Goals / Goals achieved" },
            { id: "entryApproval", label: "Entry Approval" },
        ],
    },
    { id: "dataentry", label: "Data entry / Dept & forms", rootRequired: false, children: [] },
    { id: "salesfwd", label: "Sales forward", rootRequired: false, children: [] },
    {
        id: "admin",
        label: "Admin",
        rootRequired: true,
        children: [
            { id: "accessmgmt", label: "Access management" },
            { id: "deptmgmt", label: "Department management" },
            { id: "taskmgmt", label: "Task management" },
            { id: "targetmgmt", label: "Target management" },
            { id: "goalmgmt", label: "Goal management" },
        ],
    },
    { id: "pms", label: "PMS", children: [] },
    { id: "hrfeedback", label: "HR Feedback", rootRequired: true, children: [] },
];

const TIER_ACTIONS: Record<string, string[]> = {
    none: [],
    basic: ["read"],
    createOnly: ["read", "create"],
    advanced: ["read", "create", "update"],
    root: ["read", "create", "update", "delete"],
    custom: [],
};

const ACTIONS = ["read", "create", "update", "delete"];

const existingRoles = [
    { key: "User", label: "User", roleID: 2 },
    { key: "ReportingManager", label: "Reporting Manager", roleID: 4 },
    { key: "El", label: "Executive Leader", roleID: 3 },
    { key: "RootUser", label: "Root User", roleID: 1 },
];

const PRESETS: Record<string, Record<string, string>> = {
    User: {
        dashboard: "basic",
        reports: "basic",
        perf: "basic",
        mydata: "basic",
        goals: "basic",
        entryApproval: "advanced",
        dataentry: "basic",
        salesfwd: "none",
        admin: "none",
        pms: "basic",
        hrfeedback: "none"
    },

    ReportingManager: {
        dashboard: "advanced",
        reports: "advanced",
        perf: "advanced",
        mydata: "advanced",
        goals: "advanced",
        entryApproval: "advanced",
        dataentry: "advanced",
        salesfwd: "basic",
        admin: "none",
        pms: "root",
        hrfeedback: "none"
    },

    El: {
        dashboard: "advanced",
        reports: "advanced",
        perf: "advanced",
        mydata: "advanced",
        goals: "advanced",
        entryApproval: "advanced",
        dataentry: "advanced",
        salesfwd: "advanced",
        admin: "none",
        pms: "root",
        hrfeedback: "none"
    },

    RootUser: {
        dashboard: "root",
        reports: "root",
        perf: "root",
        mydata: "root",
        goals: "root",
        entryApproval: "root",
        dataentry: "root",
        salesfwd: "root",
        admin: "root",
        pms: "root",
        hrfeedback: "root"
    },
};

interface RoleStaticData {
    roleName: string;
    roleDescription: string;
}

const ROLE_STATIC_DATA: Record<number, RoleStaticData> = {
    1: {
        roleName: "Admin",
        roleDescription: "Admin will have all access to all modules",
    },
    2: {
        roleName: "normalUser",
        roleDescription: "normalUser",
    },
    3: {
        roleName: "ExecutiveLeader",
        roleDescription: "ExecutiveLeader",
    },
    4: {
        roleName: "FunctionalLeader",
        roleDescription: "FunctionalLeader",
    },
};

type ModulePerms = Record<string, string[]>;

function buildInitialPerms(): ModulePerms {
    const state: ModulePerms = {};
    MODULES.forEach((m) => {
        state[m.id] = [];
        m.children.forEach((c) => { state[c.id] = []; });
    });
    return state;
}

function getTierOf(perms: string[]): "root" | "advanced" | "createOnly" | "basic" | "none" {
    if (perms.includes("delete")) return "root";
    if (perms.includes("update")) return "advanced";
    if (perms.includes("create")) return "createOnly";
    if (perms.includes("read")) return "basic";
    return "none";
}

// --- Tier Card ---
interface TierCardProps {
    tier: "basic" | "advanced" | "root";
    selected: boolean;
    onClick: () => void;
}

const TIER_META = {
    basic: {
        label: "Basic",
        title: "Read only",
        sub: "Can view data, reports and dashboards. No editing allowed.",
        badgeBg: "#E1F5EE",
        badgeColor: "#0F6E56",
        selectedBorder: "#1D9E75",
        dotBg: "#1D9E75",
        pillOn: "#E1F5EE",
        pillOnText: "#0F6E56",
        actions: ["read"],
    },
    createOnly: {
        label: "Intermediate",
        title: "Read + Create",
        sub: "Can view and create records but cannot update or delete.",
        badgeBg: "#E8F7F0",
        badgeColor: "#1B7F5E",
        selectedBorder: "#22A06B",
        dotBg: "#22A06B",
        pillOn: "#E8F7F0",
        pillOnText: "#1B7F5E",
        actions: ["read", "create"],
    },
    advanced: {
        label: "Advanced",
        title: "Read + Write",
        sub: "Can view, create and edit records but cannot delete.",
        badgeBg: "#E6F1FB",
        badgeColor: "#185FA5",
        selectedBorder: "#378ADD",
        dotBg: "#378ADD",
        pillOn: "#E6F1FB",
        pillOnText: "#185FA5",
        actions: ["read", "create", "update"],
    },
    root: {
        label: "Root",
        title: "Full access",
        sub: "Full CRUD access. Reserved for root/admin users only.",
        badgeBg: "#FAECE7",
        badgeColor: "#993C1D",
        selectedBorder: "#D85A30",
        dotBg: "#D85A30",
        pillOn: "#FAECE7",
        pillOnText: "#993C1D",
        actions: ["read", "create", "update", "delete"],
    },

    custom: {
        label: "Custom",
        title: "Custom access",
        sub: "Manually configure permissions for each module.",
        badgeBg: "#F4F4F5",
        badgeColor: "#52525B",
        selectedBorder: "#71717A",
        dotBg: "#71717A",
        pillOn: "#F4F4F5",
        pillOnText: "#52525B",
        actions: [], // dynamic
    },
};

const TierCard: React.FC<TierCardProps> = ({ tier, selected, onClick }) => {
    const meta = TIER_META[tier];
    return (
        <div
            onClick={onClick}
            style={{
                border: selected ? `2px solid ${meta.selectedBorder}` : "1px solid #e4e4e7",
                borderRadius: 12,
                padding: "14px 16px",
                cursor: "pointer",
                background: "white",
                position: "relative",
                transition: "transform 0.12s, border-color 0.12s",
                transform: selected ? "translateY(-2px)" : "none",
                flex: 1,
            }}
        >
            {/* Check dot */}
            <div
                style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: selected ? meta.dotBg : "transparent",
                    border: selected ? `1.5px solid ${meta.dotBg}` : "1.5px solid #d4d4d8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {selected && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </div>

            {/* Badge */}
            <span
                style={{
                    display: "inline-block",
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: meta.badgeBg,
                    color: meta.badgeColor,
                    marginBottom: 8,
                }}
            >
                {meta.label}
            </span>

            <div style={{ fontSize: 14, fontWeight: 500, color: "#18181b", marginBottom: 4 }}>{meta.title}</div>
            <div style={{ fontSize: 12, color: "#71717a", marginBottom: 12, lineHeight: 1.5 }}>{meta.sub}</div>

            {/* Permission pills */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {ACTIONS.map((a) => {
                    const on = meta.actions.includes(a);
                    return (
                        <span
                            key={a}
                            style={{
                                fontSize: 11,
                                padding: "2px 9px",
                                borderRadius: 20,
                                fontWeight: 500,
                                background: on ? meta.pillOn : "transparent",
                                color: on ? meta.pillOnText : "#a1a1aa",
                                border: on ? `0.5px solid ${meta.pillOnText}40` : "0.5px solid #e4e4e7",
                                textDecoration: on ? "none" : "line-through",
                            }}
                        >
                            {a}
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

// --- Action Button ---
interface ActionBtnProps {
    enabled: boolean;
    tier: "root" | "advanced" | "basic" | "none";
    locked: boolean;
    label: string;
    onClick: () => void;
}

function getActionStyle(enabled: boolean, tier: string, locked: boolean) {
    if (locked || !enabled) {
        return {
            background: "transparent",
            color: "#a1a1aa",
            border: "0.5px solid #e4e4e7",
            opacity: locked ? 0.4 : 1,
            cursor: locked ? "not-allowed" : "pointer",
        };
    }
    if (tier === "root") return { background: "#FAECE7", color: "#993C1D", border: "0.5px solid #F5C4B3" };
    if (tier === "advanced") return { background: "#E6F1FB", color: "#185FA5", border: "0.5px solid #B5D4F4" };
    return { background: "#E1F5EE", color: "#0F6E56", border: "0.5px solid #9FE1CB" };
}

const ActionBtn: React.FC<ActionBtnProps> = ({ enabled, tier, locked, label, onClick }) => (
    <button
        onClick={locked ? undefined : onClick}
        style={{
            fontSize: 11,
            padding: "3px 10px",
            borderRadius: 20,
            fontWeight: 500,
            cursor: locked ? "not-allowed" : "pointer",
            transition: "all 0.12s",
            ...getActionStyle(enabled, tier, locked),
        }}
    >
        {label}
    </button>
);

// --- Module Card ---
interface ModuleCardProps {
    mod: typeof MODULES[0];
    perms: ModulePerms;
    expanded: boolean;
    selectedTier: string;
    onToggleAction: (id: string, action: string) => void;
    onToggleExpand: (id: string) => void;
    onApplyTier: (id: string, tier: string) => void;
}

const ModuleCard: React.FC<ModuleCardProps> = ({
    mod, perms, expanded, selectedTier, onToggleAction, onToggleExpand, onApplyTier,
}) => {
    const modTier = getTierOf(perms[mod.id] || []);
    const hasChildren = mod.children.length > 0;

    const handleHeaderClick = () => {
        if (selectedTier && selectedTier !== "custom") {
            return;
        } else if (hasChildren) {
            onToggleExpand(mod.id);
        }
    };

    return (
        <div
            style={{
                background: "white",
                border: "0.5px solid #e4e4e7",
                borderRadius: 12,
                overflow: "hidden",
            }}
        >
            {/* Header row */}
            <div
                onClick={handleHeaderClick}
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                    cursor: "pointer",
                    transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#18181b" }}>{mod.label}</span>
                    {mod.rootRequired && (
                        <span style={{ fontSize: 10, background: "#FAECE7", color: "#993C1D", padding: "2px 7px", borderRadius: 20, fontWeight: 500 }}>
                            Root required
                        </span>
                    )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 4 }}>
                        {ACTIONS.map((a) => (
                            <ActionBtn
                                key={a}
                                label={a}
                                enabled={(perms[mod.id] || []).includes(a)}
                                tier={modTier}
                                locked={
                                    selectedTier !== "custom" ||
                                    (
                                        mod.rootRequired &&
                                        selectedTier !== "root" &&
                                        !perms[mod.id]?.includes("read")
                                    )
                                }
                                onClick={() => onToggleAction(mod.id, a)}
                            />
                        ))}
                    </div>
                    {hasChildren && (
                        <span
                            style={{
                                fontSize: 12,
                                color: "#a1a1aa",
                                transform: expanded ? "rotate(180deg)" : "none",
                                transition: "transform 0.2s",
                                display: "inline-block",
                            }}
                        >
                            ▾
                        </span>
                    )}
                </div>
            </div>

            {/* Children */}
            {hasChildren && expanded && (
                <div style={{ borderTop: "0.5px solid #f4f4f5", padding: "8px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                    {mod.children.map((child) => {
                        const childTier = getTierOf(perms[child.id] || []);
                        return (
                            <div
                                key={child.id}
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 8 }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 12 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d4d4d8", display: "inline-block" }} />
                                    <span style={{ fontSize: 12, color: "#71717a" }}>{child.label}</span>
                                </div>
                                <div style={{ display: "flex", gap: 4 }}>
                                    {ACTIONS.map((a) => (
                                        <ActionBtn
                                            key={a}
                                            label={a}
                                            enabled={(perms[child.id] || []).includes(a)}
                                            tier={childTier}
                                            locked={
                                                selectedTier !== "custom" ||
                                                (mod.rootRequired && !(perms[mod.id] || []).includes("read"))
                                            }
                                            onClick={() => onToggleAction(child.id, a)}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// --- Main Modal ---
export default function AddNewRoleModal({
    isOpen = true,
    onClose = () => { },
}: {
    isOpen?: boolean;
    onClose?: () => void;
}) {
    const [alert, setAlert] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const resetForm = () => {
        setPerms(buildInitialPerms());
        setSelectedTier("");
        setCopyFrom(new Set());
        setExpandedModules({});
    };

    const [roleName, setRoleName] = useState("");
    const [roleDescription, setRoleDescription] = useState("");
    const [roleId, setRoleId] = useState<number | null>(null); // for update
    const [copyFrom, setCopyFrom] = useState(new Set<string>([]));
    const [perms, setPerms] = useState<ModulePerms>(buildInitialPerms());
    const [selectedTier, setSelectedTier] = useState<string>("");
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

    // useEffect(() => {
    //     if (editRoleData) {
    //         setRoleId(editRoleData.id);
    //         setRoleName(editRoleData.roleName);
    //         setRoleDescription(editRoleData.roleDescription);
    //         setPerms(editRoleData.rolePrivileges); // already map format
    //     }
    // }, [editRoleData]);

    const handleToggleAction = useCallback((id: string, action: string) => {
        setPerms((prev) => {
            const current = [...(prev[id] || [])];

            if (current.includes(action)) {
                return { ...prev, [id]: current.filter((a) => a !== action) };
            } else {
                const next = new Set(current);

                if (selectedTier === "custom") {
                    next.add(action);
                } else {
                    next.add("read");

                    if (action === "delete") {
                        next.add("create");
                        next.add("update");
                    }

                    next.add(action);
                }

                return { ...prev, [id]: Array.from(next) };
            }
        });
    }, [selectedTier]);

    const handleApplyTier = useCallback((modId: string, tier: string) => {
        const mod = MODULES.find((m) => m.id === modId);
        if (!mod) return;

        if (mod.rootRequired && tier !== "root") return;

        if (tier === "custom") return;

        const actions = TIER_ACTIONS[tier] || [];

        setPerms((prev) => {
            const next = { ...prev, [modId]: [...actions] };
            mod.children.forEach((c) => {
                next[c.id] = [...actions];
            });
            return next;
        });

        if (mod.children.length > 0) {
            setExpandedModules((prev) => ({ ...prev, [modId]: true }));
        }
    }, []);

    const handleCopyFrom = useCallback((keys: Set<string>) => {
        setCopyFrom(keys);

        const selectedKey = Array.from(keys)[0];

        if (!selectedKey) {
            setRoleId(null);
            return;
        }

        setRoleId(Number(selectedKey));

        const selectedRole = existingRoles.find((r) => r.roleID === Number(selectedKey));

        if (!selectedRole) return;

        const preset = PRESETS[selectedRole.key];
        if (!preset) return;

        const next = buildInitialPerms();

        MODULES.forEach((m) => {
            const tier = preset[m.id] || "none";
            const actions = TIER_ACTIONS[tier] || [];
            next[m.id] = [...actions];
            m.children.forEach((c) => {
                next[c.id] = [...actions];
            });
        });

        setPerms(next);
    }, []);

    const handleToggleExpand = useCallback((id: string) => {
        setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
    }, []);

    const handleSelectTier = useCallback((tier: string) => {
        setSelectedTier((prev) => {
            const newTier = prev === tier ? "" : tier;

            if (!newTier) return "";

            if (newTier === "custom") return newTier;

            const next = buildInitialPerms();

            MODULES.forEach((m) => {
                const actions = TIER_ACTIONS[newTier] || [];

                if (m.rootRequired && newTier !== "root") {
                    next[m.id] = [];
                    m.children.forEach((c) => (next[c.id] = []));
                } else {
                    next[m.id] = [...actions];
                    m.children.forEach((c) => (next[c.id] = [...actions]));
                }
            });

            setPerms(next);

            return newTier;
        });
    }, []);

    const updateRole = async () => {
        if (!roleId) {
            setAlert({ type: "error", message: "Role ID missing" });
            return;
        }

        const staticData = ROLE_STATIC_DATA[roleId];

        if (!staticData) {
            setAlert({ type: "error", message: "Invalid role selected" });
            return;
        }

        const payload = {
            roleName: staticData.roleName,
            roleDescription: staticData.roleDescription,
            roleStatus: 1,
            isRoleArchived: 0,
            rolePrivileges: perms,
        };

        try {
            const res = await fetch(
                `/t2.0/authentificationUtilization/AMRole/update/${roleId}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );

            const data = await res.json();

            if (data.status) {
                setAlert({ type: "success", message: "Role updated successfully" });

                resetForm();
                setRoleId(null);
            } else {
                setAlert({ type: "error", message: data.message || "Update failed" });
            }
        } catch (err) {
            setAlert({ type: "error", message: "API error occurred" });
        }
};
    useEffect(() => {
        if (alert) {
            const t = setTimeout(() => setAlert(null), 3000);
            return () => clearTimeout(t);
        }
    }, [alert]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="4xl"
            scrollBehavior="inside"
            classNames={{
                base: "max-h-[90vh]",
                header: "border-b border-default-100 pb-3",
                footer: "border-t border-default-100 pt-3",
            }}
        >
            {alert && (
                <Alert
                    color={alert.type === "success" ? "success" : "danger"}
                    variant="flat"
                    className="mb-2"
                    onClose={() => setAlert(null)}
                >
                    {alert.message}
                </Alert>
            )}
            <ModalContent>
<ModalHeader className="flex items-center gap-2 text-lg font-semibold">
                        Add new role
                    </ModalHeader>

                <ModalBody className="gap-5 py-4">
                    {/* Copy from role */}
                    <Select
                        label="Copy permission from role"
                        labelPlacement="outside"
                        placeholder="Select an existing role..."
                        selectedKeys={copyFrom}
                        onSelectionChange={handleCopyFrom}
                        size="sm"
                        variant="bordered"
                        classNames={{
                            label: "text-xs font-semibold text-default-500 uppercase tracking-wide",
                        }}
                    >
                        {existingRoles.map((r) => (
                            <SelectItem key={r.roleID}>{r.label}</SelectItem>
                        ))}
                    </Select>

                    {/* Tier cards */}
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 500, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                            Choose access tier
                        </p>
                        <div style={{ display: "flex", gap: 10 }}>
                            {(["basic", "createOnly", "advanced", "root", "custom"] as const).map((tier) => (<TierCard
                                key={tier}
                                tier={tier}
                                selected={selectedTier === tier}
                                onClick={() => handleSelectTier(tier)}
                            />
                            ))}
                        </div>
                        {selectedTier === "custom" && (
                            <p style={{ fontSize: 12, color: "#71717a", marginTop: 8 }}>
                                Custom selected — configure permissions manually below.
                            </p>
                        )}

                        {selectedTier && selectedTier !== "custom" && (
                            <p style={{ fontSize: 12, color: "#71717a", marginTop: 8 }}>
                                {selectedTier} access applied to all modules.
                            </p>
                        )}
                    </div>

                    {/* Modules */}
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 500, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                            Module access configuration
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {MODULES.map((mod) => (
                                <ModuleCard
                                    key={mod.id}
                                    mod={mod}
                                    perms={perms}
                                    expanded={!!expandedModules[mod.id]}
                                    selectedTier={selectedTier}
                                    onToggleAction={handleToggleAction}
                                    onToggleExpand={handleToggleExpand}
                                    onApplyTier={handleApplyTier}
                                />
                            ))}
                        </div>
                    </div>
                </ModalBody>

                <ModalFooter className="gap-2">
                    <Button variant="light" onPress={onClose} className="font-medium">
                        Back
                    </Button>
                    <Button
                        color="warning"
                        className="text-white font-semibold px-6"
                        onPress={updateRole}
                    >
                        Save role
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}