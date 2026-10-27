"use client";
import React from "react";
import {
    Card,
    CardBody,
    Button,
    Chip,
    Avatar,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Input,
    Textarea,
    Select,
    SelectItem,
    useDisclosure,
    addToast,
    Accordion, AccordionItem
} from "@/components/ui";
import axios from "axios";
import { useState, useEffect, useMemo } from "react";
import { set } from "date-fns";
import { de } from "date-fns/locale";
import { Archive } from "lucide-react";

export default function GoalSetting() {
    const authUserLD = localStorage.getItem("authUserLD");
    const authUser = authUserLD ? JSON.parse(authUserLD) : null;
    const [users, setUsers] = useState([
        {
            userID: "1",
            name: "Ravi Kumar",
            team: "TM-001 · Engineering · Q1 (Apr–Jun)",
            goals: [
                {
                    title: "Goal 1",
                    weight: 40,
                    desc: "",
                    category: "dev",
                    status: "Pending",
                }
            ]
        }
    ]); const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [selectedEmployee, setSelectedEmployee] = useState("1");
    const [selectedQuarter, setSelectedQuarter] = useState("Q1");
    const [goals, setGoals] = useState([]);

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
                `/t2.0/authentificationUtilization/departmentGoals/list?page=${0}&size=${0}`,
                body,
                { headers }
            )
            console.log("Fetched Goals:", data);
            const mapped: Goal[] = data.response.goals.map((g: any) => ({
                goalID: g.goalID,
                departmentID: g.departmentID,
                departmentName: g.departmentName,
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
                approvedByEL: g.approvedByEL,
                Archive: g.isDepartmentArchived

            }));
            const result = mapped.filter((ele) => {
                if (!ele.isActive) {
                    return false;
                } else if (ele.Archive) {
                    return false;
                } else {
                    return true;
                }
            });

            setGoals(result);

        };

        fetchGoals();
    }, []);

    const departmentList = useMemo(() => {
        if (!Array.isArray(goals)) return [];

        const Result = new Map();

        goals.forEach((g: any) => {
            if (!g?.departmentID) return;

            const key = g.departmentID;

            if (!Result.has(key)) {
                Result.set(key, {
                    departmentID: g.departmentID,
                    departmentName: g.departmentName,
                    goals: [g],
                });
            } else {
                Result.get(key).goals.push(g);
            }
        });
        console.log("Department Map:", Result);
        return Array.from(Result.values());
    }, [goals]);

    const colors = ['#378ADD', '#1D9E75', '#D85A30', '#D4537E', '#639922', '#BA7517'];
    const [activeDept, setActiveDept] = useState<number | null>(null);
    const dept = departmentList.find(d => d.departmentID === activeDept);
    const employeeOptions = users.map((u, i) => ({
        key: String(i + 1),
        label: `${u.name} (${u.team.split("·")[0].trim()})`,
    }));

    const totalWeight = users.reduce(
        (sum, u) => sum + u.goals.reduce((goalSum, g) => goalSum + Number(g.weight || 0), 0),
        0
    );

    const addGoal = () => {
        setUsers((prev) => {
            const updated = [...prev];
            const userIndex = updated.findIndex(
                (u) => u.userID === selectedEmployee
            );
            if (userIndex !== -1) {
                const user = updated[userIndex];
                user.goals.push({
                    title: "",
                    weight: 0,
                    desc: "",
                    category: "none",
                    status: "Pending",
                });
            }
            return updated;
        });
    };

    const removeGoal = (index) => {
        setUsers((prev) =>
            prev.map((u) => {
                if (u.userID === selectedEmployee) {
                    return {
                        ...u,
                        goals: u.goals.filter((_, i) => i !== index),
                    };
                }
                return u;
            })
        );
    };

    const updateGoal = (index, field, value) => {
        setUsers((prev) =>
            prev.map((u) => {
                if (u.userID === selectedEmployee) {
                    const updatedGoals = [...u.goals];
                    updatedGoals[index][field] = value;

                    return { ...u, goals: updatedGoals };
                }
                return u;
            })
        );
    };

    const currentUser = users.find(
        (u) => u.userID === selectedEmployee
    );

    const handleApprove = async (ids) => {
        try {
            await axios.put(`/t2.0/authentificationUtilization/departmentGoals/approve`, { goalIds: ids, userId: authUser.userID }, {
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
                }
            })
            addToast({
                title: "Success",
                description: "Goals acknowledged successfully.",
                color: "success",
            });
        }
        catch (err) {
            addToast({
                title: "Error",
                description: "Failed to acknowledge goals.",
                color: "danger",
            });
            console.log("Error approving goals:", err);
        }
    }

    return (
        <div className="p-6">

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-semibold">Goal Setting</h1>
                    <p className="text-sm text-default-500">
                        Set quarterly goals for employees (3–5 goals, total weight must equal 100%)
                    </p>
                </div>

                {/* <Button color="warning" variant="solid" onPress={onOpen}>
                    + Set Goals
                </Button> */}
            </div>

            {/* <div className="flex flex-col gap-6">
                {users.map((user, idx) => (
                    <Card key={idx} shadow="sm" radius="lg">
                        <CardBody>

                           
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <Avatar name={user.initials} color="primary" />
                                    <div>
                                        <h2 className="font-medium">{user.name}</h2>
                                        <p className="text-sm text-default-500">{user.team}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-default-500">
                                        {user.acknowledged}
                                    </span>

                                    <Button size="sm" variant="bordered">
                                        Toggle Ack
                                    </Button>

                                    <Button size="sm" color="danger" variant="bordered">
                                        Delete
                                    </Button>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-4">
                                {user.goals.map((goal, i) => (
                                    <Card key={i} className="bg-default-100" radius="md">
                                        <CardBody className="p-4">

                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-medium">{goal.title}</span>
                                                <span className="text-warning font-semibold">
                                                    {goal.percent}%
                                                </span>
                                            </div>

                                            {goal.tag && (
                                                <Chip size="sm" color="warning" variant="flat">
                                                    {goal.tag}
                                                </Chip>
                                            )}

                                            <p className="mt-2 font-medium">{goal.desc}</p>
                                            <p className="text-sm text-default-500">{goal.sub}</p>

                                            <Chip
                                                size="sm"
                                                color={
                                                    goal.status === "Acknowledged"
                                                        ? "success"
                                                        : "warning"
                                                }
                                                variant="flat"
                                                className="mt-2"
                                            >
                                                {goal.status === "Acknowledged"
                                                    ? "Acknowledged"
                                                    : "Pending"}
                                            </Chip>
                                        </CardBody>
                                    </Card>
                                ))}
                            </div>

                        </CardBody>
                    </Card>
                ))}
            </div> */}
            <div className="flex flex-col gap-6">
                <div className="flex min-h-[480px] border border-divider rounded-xl overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-104 shrink-0 border-r border-divider bg-default-50 p-2 flex flex-col gap-1">
                        <p className="text-[11px] text-default-400 uppercase tracking-widest px-3 py-2">
                            Departments
                        </p>
                        {departmentList
                            .filter((dept) => {
                                // EL (role 3) → multiple departments
                                if (authUser.userRole == 3) {
                                    return authUser.departments?.some(
                                        (ele) => ele.departmentID === dept.departmentID
                                    );
                                }

                                // Manager (role 2) → single department
                                if (authUser.userRole == 2) {
                                    return authUser.departmentID === dept.departmentID;
                                }
                                if (authUser.userRole == 4) {
                                    return authUser.departments?.some(
                                        (ele) => ele.departmentID === dept.departmentID
                                    );
                                }

                                // Admin or others → all
                                return true;
                            })
                            .map((dept, i) => (
                                <button
                                    key={dept.departmentID}
                                    onClick={() => setActiveDept(dept.departmentID)}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm w-full text-left transition-colors
        ${activeDept === dept.departmentID
                                            ? 'bg-default-100 text-foreground font-medium'
                                            : 'text-default-500 hover:bg-default-100 hover:text-foreground'
                                        }`}
                                >
                                    <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ background: colors[i % colors.length] }}
                                    />
                                    <span className="flex-1">{dept.departmentName}</span>
                                    <span className="text-[11px] bg-background border border-divider text-default-400 px-1.5 py-0.5 rounded-full">
                                        {dept.goals?.length ?? 0}
                                    </span>
                                </button>
                            ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-5 overflow-y-auto">
                        <div className="flex justify-between items-baseline mb-4">
                            <h3 className="text-base font-medium">{dept?.departmentName}</h3>
                            {dept?.goals?.length > 0 && (
                                <>

                                    <span className="text-sm text-default-400">{dept.goals.length} goals</span>
                                    {
                                        authUser.userRole === 3 && (
                                            <span>
                                                <Button onClick={() => handleApprove(dept.goals.map((g) => g.goalID))} color="success" variant="solid" size="sm">
                                                    Acknowledge All
                                                </Button>
                                            </span>
                                        )
                                    }

                                </>

                            )}
                        </div>

                        {Array.isArray(dept?.goals) && dept.goals.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {dept.goals.map((goal, j) => (
                                    <div
                                        key={j}
                                        className="bg-background border border-divider rounded-xl p-4 flex flex-col gap-3"
                                    >
                                        <p className="text-sm font-medium leading-snug">
                                            {goal.goalName || 'Untitled'}
                                        </p>

                                        <div className="flex gap-1.5 flex-wrap">
                                            {goal.isDynamic && (
                                                <Chip size="sm" color="warning" variant="flat">Dynamic</Chip>
                                            )}
                                            <Chip size="sm" color={goal.isActive ? 'success' : 'danger'} variant="flat">
                                                {goal.isActive ? 'Active' : 'Inactive'}
                                            </Chip>
                                        </div>

                                        <div className="flex flex-col divide-y divide-divider text-sm mt-auto">
                                            <div className="flex justify-between py-1.5">
                                                <span className="text-default-400">approvedByEL</span>
                                                <Chip
                                                    size="sm"
                                                    color={goal.approvedByEL ? 'success' : 'danger'}
                                                    variant="flat"
                                                >
                                                    <span className="font-medium">
                                                        {goal.approvedByEL ? 'Yes' : 'No'}
                                                    </span>
                                                </Chip>
                                            </div>
                                            <div className="flex justify-between py-1.5">
                                                <span className="text-default-400">Unit</span>
                                                <span className="font-medium">{goal.unit}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-48 text-default-400 text-sm">
                                No goals configured for this department
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl" scrollBehavior="inside">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col justify-between w-full gap-3">
                                <div className="flex justify-between w-full">
                                    <span>Goals</span>
                                    <span className="text-danger text-sm">
                                        Total weight: {totalWeight}%
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    {/* EMPLOYEE */}
                                    <Select
                                        label="Employee *"
                                        selectedKeys={[selectedEmployee]}
                                        onSelectionChange={(keys) =>
                                            setSelectedEmployee(String(Array.from(keys)[0]))
                                        }
                                        variant="bordered"
                                    >
                                        {allUser.map((emp) => (
                                            <SelectItem key={emp.userID}>{emp.userName}</SelectItem>
                                        ))}
                                    </Select>

                                    {/* QUARTER */}
                                    <Select
                                        label="Quarter *"
                                        selectedKeys={[selectedQuarter]}
                                        onSelectionChange={(keys) =>
                                            setSelectedQuarter(String(Array.from(keys)[0]))
                                        }
                                        variant="bordered"
                                    >
                                        <SelectItem key="Q1">Q1 (Apr–Jun)</SelectItem>
                                        <SelectItem key="Q2">Q2 (Jul–Sep)</SelectItem>
                                        <SelectItem key="Q3">Q3 (Oct–Dec)</SelectItem>
                                        <SelectItem key="Q4">Q4 (Jan–Mar)</SelectItem>
                                    </Select>
                                </div>
                            </ModalHeader>

                            <ModalBody>
                                {currentUser?.goals.map((goal, index) => (
                                    <div
                                        key={index}
                                        className="border rounded-xl p-4 mb-4 bg-default-100"
                                    >
                                        {/* HEADER */}
                                        <div className="flex justify-between mb-2">
                                            <span className="text-sm font-medium">
                                                Goal {index + 1}
                                            </span>

                                            {currentUser.goals.length > 1 && (
                                                <Button
                                                    size="sm"
                                                    color="danger"
                                                    variant="bordered"
                                                    onPress={() => removeGoal(index)}
                                                >
                                                    Remove
                                                </Button>
                                            )}
                                        </div>

                                        {/* ROW 1 */}
                                        <div className="grid grid-cols-2 gap-4 mb-3">
                                            <Input
                                                label="Goal Title"
                                                value={goal.title}
                                                onChange={(e) =>
                                                    updateGoal(index, "title", e.target.value)
                                                }
                                            />

                                            <Input
                                                label="Weight %"
                                                type="number"
                                                value={goal.weight}
                                                onChange={(e) =>
                                                    updateGoal(index, "weight", e.target.value)
                                                }
                                            />
                                        </div>

                                        {/* ROW 2 */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <Textarea
                                                label="Description"
                                                value={goal.desc}
                                                onChange={(e) =>
                                                    updateGoal(index, "desc", e.target.value)
                                                }
                                            />

                                            <Select
                                                selectedKeys={[goal.category]}
                                                onSelectionChange={(keys) =>
                                                    updateGoal(index, "category", Array.from(keys)[0])
                                                }
                                            >
                                                <SelectItem key="none">None</SelectItem>
                                                <SelectItem key="dev">Development</SelectItem>
                                                <SelectItem key="qa">QA</SelectItem>
                                            </Select>
                                        </div>
                                    </div>
                                ))}

                                {/* ADD BUTTON */}
                                <Button
                                    variant="bordered"
                                    onPress={addGoal}
                                    className="w-fit"
                                >
                                    + Add Goal
                                </Button>
                            </ModalBody>

                            <ModalFooter>
                                <Button variant="bordered" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button
                                    color="warning"
                                    onPress={() => {
                                        if (users[selectedEmployee]?.goals.length < 3) {
                                            addToast({
                                                title: "Error",
                                                description: "You have to set 3 goals atleast.",
                                                color: "danger",
                                            });
                                            return;
                                        }
                                        if (totalWeight !== 100) {
                                            addToast({
                                                title: "Error",
                                                description: "Total weight must be 100%.",
                                                color: "danger",
                                            }); return;
                                        }
                                        onClose();
                                    }}
                                >
                                    Save Goals
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}