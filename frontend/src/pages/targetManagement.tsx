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
import ReusableTable, { TableColumn, TableAction } from "@/components/table"
import { title } from "@/components/primitives";
import { format } from "date-fns";

interface Task {
    taskID: number;
    departmentID: number;
    taskName: string;
    standardTimeMins: number;
    frequency: string;
    isDynamic: boolean;
    description: string;
    isActive: boolean;
    createdAt: string;
    modifiedAt: string;
}

const TargetManagement: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState("");

    const [departmentList, setDepartmentList] = useState<any[]>([])
    const [SelectedTask, setSelectedTask] = useState([])
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Task[]>([]);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [toggleStatusValue, setToggleStatusValue] = useState<boolean | null>(null);
    const [tableRefreshKey, setTableRefreshKey] = useState(0);
    const [pageNumber, setPageNumber] = useState(1)
    const [totalRecords, settotalRecords] = useState(0)
    const [filterStatus, setFilterStatus] = useState(
        ""
    );
    const [pageSize, setPageSize] = useState(10)
    const [searchValue, setSearchValue] = useState("")
    const [target, setTarget] = useState<Task[]>([

    ]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTarget, setNewTarget] = useState({
        targetId: -1,
        targetName: '',
        targetMetric: '',
        metricValue: '',
        unit: '',
        frequency: 'Monthly',
        timingType: 'Ongoing',
        isDynamic: false,
        description: '',
        isActive: true,
        roleID: '',
    });
    const handleAddTarget = async () => {
        if (
            !newTarget.targetName ||
            !newTarget.targetMetric ||
            !newTarget.metricValue ||
            !newTarget.unit ||
            !newTarget.frequency ||
            !newTarget.timingType ||
            newTarget.isDynamic === null ||
            !newTarget.description ||
            !filterStatus
        ) {
            addToast({
                title: "Missing Required Fields",
                description: "Please fill all mandatory fields before submitting.",
                color: "warning",
            });
            return;
        }

        try {
            const payload = {
                departmentID: Number(filterStatus),
                targetName: newTarget.targetName,
                targetMetric: newTarget.targetMetric,
                metricValue: newTarget.metricValue,
                unit: Number(newTarget.unit),
                frequency: newTarget.frequency,
                timingType: newTarget.timingType,
                isDynamic: newTarget.isDynamic,
                description: newTarget.description,
                isActive: true,
                roleID: Number(newTarget.roleID),
            };

            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ''}`
            };

            const { data } = await axios.post(
                "/t2.0/authentificationUtilization/departmentTargets/create",
                payload,
                { headers }
            );

            addToast({
                title: "Target Created",
                description: "New target added successfully.",
                color: "success",
            });

            setTarget((prev) => [...prev, data.data]);
            setIsModalOpen(false);
            setNewTarget({
                targetId: -1,
                targetName: '',
                targetMetric: '',
                metricValue: '',
                unit: '',
                frequency: 'Monthly',
                timingType: 'Ongoing',
                isDynamic: false,
                description: '',
                isActive: true,
                roleID: '',
            })
            setTableRefreshKey(prev => prev + 1);
        } catch (error: any) {
            console.error("Error creating target:", error);
            addToast({
                title: "Failed",
                description: error?.response?.data?.message,
                color: "danger",
            });
            setNewTarget({
                targetId: -1,
                targetName: '',
                targetMetric: '',
                metricValue: '',
                unit: '',
                frequency: 'Monthly',
                timingType: 'Ongoing',
                isDynamic: false,
                description: '',
                isActive: true,
                roleID: '',
            })
            setIsModalOpen(false);
        }
    };

    const handleEditTarget = async (id) => {
        try {
            const payload = {
                departmentID: Number(filterStatus),
                targetName: newTarget.targetName,
                targetMetric: newTarget.targetMetric,
                metricValue: newTarget.metricValue,
                unit: Number(newTarget.unit),
                frequency: newTarget.frequency,
                timingType: newTarget.timingType,
                isDynamic: newTarget.isDynamic,
                description: newTarget.description,
                isActive: newTarget.isActive,
                roleID: Number(newTarget.roleID),
            };

            const headers = {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${authUserLD ? JSON.parse(authUserLD).token : ""}`,
            };

            const { data } = await axios.put(
                `/t2.0/authentificationUtilization/departmentTargets/update/${id}`,
                payload,
                { headers }
            );

            addToast({
                title: "Target Updated",
                description: "Your target has been updated successfully.",
                color: "success",
            });

            // update local list
            setTarget((prev) =>
                prev.map((t) => (t.targetID === id ? data.data : t))
            );
            setNewTarget({
                targetId: -1,
                targetName: '',
                targetMetric: '',
                metricValue: '',
                unit: '',
                frequency: 'Monthly',
                timingType: 'Ongoing',
                isDynamic: false,
                description: '',
                isActive: true,
                roleID: '',
            })
            setIsModalOpen(false);
        } catch (error: any) {
            console.error("Error Updating target:", error);
            addToast({
                title: "Failed",
                description:
                    error?.response?.data?.message,
                color: "danger",
            });
            setNewTarget({
                targetId: -1,
                targetName: '',
                targetMetric: '',
                metricValue: '',
                unit: '',
                frequency: 'Monthly',
                timingType: 'Ongoing',
                isDynamic: false,
                description: '',
                isActive: true,
                roleID: '',
            })
            setIsModalOpen(false);
        }
    };



    const authUserLD = localStorage.getItem("authUserLD");
    const authUser = authUserLD ? JSON.parse(authUserLD) : null;
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // Table configuration
    const targetColumns = [
        {
            key: "createdAt",
            label: "Created At",
            sortable: true,
            renderCell: (item) =>
                item.createdAt
                    ? format(new Date(item.createdAt), "dd MMM yyyy")
                    : "—",
        }, { key: 'departmentID', label: 'Department ID', sortable: true },     // ✅ Added
        // { key: 'departmentName', label: 'Department Name', sortable: true }, // ✅ Added
        { key: 'targetName', label: 'Target Name', sortable: true },
        { key: 'targetMetric', label: 'Metric', sortable: true },
        { key: 'unit', label: 'Unit', sortable: true },
        { key: 'frequency', label: 'Frequency', sortable: true },
        { key: 'timingType', label: 'Timing Type', sortable: true },
        { key: 'isDynamic', label: 'Dynamic', sortable: true },
        { key: 'isActive', label: 'Status', sortable: true },
    ];



    const taskActions: TableAction[] = [
        {
            key: 'edit',
            label: 'Edit',
            color: 'primary',
            onAction: (row) => {
                console.log("EDIT TASK:", row.taskID, row);
                setIsEditing(true);
                setSelectedTask(row);
                setNewTarget({
                    targetId: row.targetID,
                    targetName: row.targetName || "",
                    targetMetric: row.targetMetric || "",
                    metricValue: row.metricValue || "",
                    unit: row.unit || "",
                    frequency: row.frequency || "Monthly",
                    timingType: row.timingType || "Ongoing",
                    isDynamic: row.isDynamic ?? false,
                    description: row.description || "",
                    isActive: row.isActive ?? true,
                    roleID: row.roleID ? String(row.roleID) : "",
                });

                setFilterStatus(String(row.departmentID || ""));
                setIsModalOpen(true)
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

                const { data } = await axios.post(
                    "/t2.0/authentificationUtilization/Department/list?page=0&size=0",
                    bodyData,
                    { headers: { "Content-Type": "application/json" } }
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
        const fetchTarget = async () => {
            try {
                const bodyData = {
                    searchText: searchValue,
                    filter: "",
                    startDate: "",
                    endDate: ""
                };

                const { data } = await axios.post(
                    `/t2.0/authentificationUtilization/departmentTargets/list?page=${pageNumber}&size=${pageSize}`,
                    bodyData,
                    { headers: { "Content-Type": "application/json" } }
                );

                const targets: Target[] = data.response.targets.map((t: any) => ({
                    targetID: t.targetID,
                    departmentID: t.departmentID,
                    departmentName: t.departmentName || "", // Safe fallback
                    targetName: t.targetName,
                    targetMetric: t.targetMetric,
                    metricValue: t.metricValue || "", // Handle possible empty string
                    unit: t.unit || "", //  Include Unit
                    frequency: t.frequency,
                    timingType: t.timingType, //  Include Timing Type
                    isDynamic: t.isDynamic,
                    description: t.description || "", // Include Description
                    isActive: t.isActive,
                    createdAt: t.createdAt ? t.createdAt.split("T")[0] : "",
                    modifiedAt: t.modifiedAt ? t.modifiedAt.split("T")[0] : "",
                    roleID: t.roleID,
                }));

                console.log(targets, "hhh")
                setTarget(targets);
                settotalRecords(data.response.totalRecords);
            } catch (err) {
                console.error("Error fetching target:", err);
            }
        };
        fetchTarget();

    }, [authUserLD, pageSize, pageNumber, searchValue, tableRefreshKey]);

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

                `/t2.0/authentificationUtilization/departmentTargets/${row.targetID}/status?isActive=${newStatus}`,
                {},
                { headers }
            );

            setTarget((prev) =>
                prev.map((t) =>
                    t.targetID === row.targetID ? { ...t, isActive: newStatus } : t
                )
            );

            addToast({
                title: newStatus ? "Target Activated" : "Target Deactivated",
                description: `"${row.targetName}" updated successfully.`,
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


    return (
        <div>

            <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <PageTitle title="Target Management" subtitle="Manage and monitor all company Target" />
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
                        color="primary" onPress={() => {
                            setIsEditing(false);

                            setSelectedDepartment("");
                            setIsModalOpen(true);
                        }}

                    >
                        Add New Target
                    </Button>
                </div>
            </div>

            {/* target Table */}
            {selectedRows.length > 0 && (
                <div className="flex justify-between items-center bg-ink-100 dark:bg-ink-800 p-3 rounded mb-3 shadow">
                    <span className="font-semibold">
                        {selectedRows.length} task(s) selected
                    </span>

                    <div className='flex gap-3'>

                        <Button
                            color="danger"
                            variant='flat'

                            onPress={() => {
                                if (selectedRows.length !== 1) {
                                    addToast({
                                        title: "Select exactly one task",
                                        description: "You can activate/deactivate only one task at a time.",
                                        color: "warning",
                                    });
                                    return;
                                }
                                setToggleStatusValue(false);
                                setConfirmOpen(true);
                            }}
                        >
                            Deactivate
                        </Button>

                        <Button
                            color="success"
                            variant="flat"
                            onPress={() => {
                                if (selectedRows.length !== 1) {
                                    addToast({
                                        title: "Select exactly one task",
                                        description: "You can activate/deactivate only one task at a time.",
                                        color: "warning",
                                    });
                                    return;
                                }
                                setToggleStatusValue(true);
                                setConfirmOpen(true);
                            }}
                        >
                            Activate
                        </Button>

                    </div>

                </div>
            )}

            <div className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900 overflow-hidden p-6">
                <ReusableTable
                    key={tableRefreshKey}
                    data={target}
                    columns={targetColumns}
                    actions={taskActions}
                    totalRecords={totalRecords}
                    searchable={true}
                    searchPlaceholder="Search target..."
                    searchKeys={['targetName', 'description']}
                    filterable={true}
                    onRowsPerPageChange={(value) => {
                        setPageSize(value)

                    }}
                    onPageChange={(page) => {
                        setPageNumber(page)
                    }}
                    onSearchChangeProp={(value) => {
                        setSearchValue(value);
                        // console.log("Search in parent:", value);
                    }}
                    filterOptions={[
                        {
                            key: 'frequency',
                            label: 'Frequency',
                            options: [
                                { key: 'Daily', label: 'Daily' },
                                { key: 'Weekly', label: 'Weekly' },
                                { key: 'Monthly', label: 'Monthly' },
                                { key: 'Dynamic', label: 'Dynamic' },
                                { key: 'Not Daily', label: 'Not Daily' }
                            ]
                        }
                        ,
                        {
                            key: 'isActive',
                            label: 'Status',
                            options: [
                                { key: 'true', label: 'Active' },
                                { key: 'false', label: 'Inactive' }
                            ]
                        }
                    ]}
                    selectable={true}
                    sortable={true}
                    paginated={true}
                    emptyContent="No target found"
                    onAdd={() => setIsModalOpen(true)}
                    addButtonLabel="Add New Task"
                    getRowId={(item) => item.targetID} // ✅ FIXED
                    onSelectionChange={(rows) => setSelectedRows(rows)}
                />
            </div>

            {/* Create / edit canvas */}
            <Drawer
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
            >
                <DrawerContent>
                    {(onClose: () => void) => (
                        <>
                            <DrawerHeader className="flex flex-col gap-1">{isEditing ? "Edit Task" : "Add New Target"}</DrawerHeader>
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
                                        label={<span>Target Name</span>}
                                        placeholder="Enter target name"
                                        value={newTarget.targetName}
                                        onChange={(e) => setNewTarget({ ...newTarget, targetName: e.target.value })}
                                    />

                                    <Input
                                        isRequired
                                        label={<span>Target Metric</span>}
                                        placeholder="Enter target metric (e.g., LeadsGenerated)"
                                        value={newTarget.targetMetric}
                                        onChange={(e) => setNewTarget({ ...newTarget, targetMetric: e.target.value })}
                                    />

                                    <Input
                                        isRequired
                                        label={<span>Metric Value</span>}
                                        placeholder="Enter metric value"
                                        value={newTarget.metricValue}
                                        onChange={(e) => setNewTarget({ ...newTarget, metricValue: e.target.value })}
                                    />

                                    <Input
                                        isRequired
                                        type="number"
                                        label={<span>Unit</span>}
                                        placeholder="Enter target unit (e.g., 500)"
                                        value={newTarget.unit}
                                        onChange={(e) => setNewTarget({ ...newTarget, unit: e.target.value })}
                                    />

                                    <Select
                                        isRequired
                                        label={<span>Frequency</span>}
                                        selectedKeys={[newTarget.frequency]}
                                        onSelectionChange={(keys) =>
                                            setNewTarget({ ...newTarget, frequency: Array.from(keys)[0] })
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
                                        selectedKeys={[newTarget.roleID]}
                                        onSelectionChange={(keys) =>
                                            setNewTarget({ ...newTarget, roleID: Array.from(keys)[0] })
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

                                    <Select
                                        isRequired
                                        label={<span>Timing Type</span>}
                                        selectedKeys={[newTarget.timingType]}
                                        onSelectionChange={(keys) =>
                                            setNewTarget({ ...newTarget, timingType: Array.from(keys)[0] })
                                        }
                                    >
                                        <SelectItem key="Ongoing">Ongoing</SelectItem>
                                        <SelectItem key="Fixed">Fixed</SelectItem>
                                    </Select>

                                    <Select
                                        isRequired
                                        label={<span>Is Dynamic</span>}
                                        selectedKeys={[newTarget.isDynamic.toString()]}
                                        onSelectionChange={(keys) =>
                                            setNewTarget({ ...newTarget, isDynamic: Array.from(keys)[0] === "true" })
                                        }
                                    >
                                        <SelectItem key="true">Yes</SelectItem>
                                        <SelectItem key="false">No</SelectItem>
                                    </Select>

                                    <Textarea
                                        isRequired
                                        label={<span>Description</span>}
                                        placeholder="Enter description"
                                        value={newTarget.description}
                                        onChange={(e) => setNewTarget({ ...newTarget, description: e.target.value })}
                                    />
                                </div>
                            </DrawerBody>

                            <DrawerFooter>
                                <Button color="danger" variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={() => {
                                        isEditing ? handleEditTarget(newTarget.targetId) : handleAddTarget();
                                    }}
                                >
                                    {isEditing ? "Update Target" : "Add Target"}
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
                            <ModalHeader>{toggleStatusValue ? "Activate Task" : "Deactivate Task"}</ModalHeader>
                            <ModalBody>
                                {selectedRows[0] && (
                                    <p>
                                        Are you sure you want to{" "}
                                        <b>{toggleStatusValue ? "activate" : "deactivate"}</b>{" "}
                                        task <b>"{selectedRows[0].taskName}"</b>?
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

export default TargetManagement;