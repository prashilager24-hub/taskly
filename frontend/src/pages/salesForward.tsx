import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui";
import { Modal, ModalContent, ModalHeader, ModalBody, DatePicker, ModalFooter, Chip, addToast, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, user } from "@/components/ui";
import { Input } from "@/components/ui";
import { parseZonedDateTime } from "@internationalized/date";
import axios from "axios";
import { Select, SelectItem } from "@/components/ui";
import ReusableTable, { TableColumn, TableAction } from "@/components/table"


const SalesForward: React.FC = () => {

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [duration, setDuration] = useState(null)
    const [selectedRows, setSelectedRows] = useState<Task[]>([]);
    const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
    const [editData, setEditData] = useState<any>(null);
    const [salesData, setSalesData] = useState([])
    const [pageNumber, setPageNumber] = useState(1)
    const [totalRecords, settotalRecords] = useState(0)
    const [selectedCall, setSelectedCall] = useState<any>(null);
    const [pageSize, setPageSize] = useState(10)
    const [searchValue, setSearchValue] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false);
    const authUserLD = localStorage.getItem("authUserLD");
    const user = JSON.parse(authUserLD)
    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);



    const schedule = [
        { name: "SCHEDULED", value: "SCHEDULED" },
        { name: "COMPLETED", value: "COMPLETED" },
        { name: "NO SHOW", value: "NO_SHOW" },
        { name: "RESCHEDULED", value: "RESCHEDULED" },
        { name: "CANCELLED BY PUBLISHER", value: "CANCELLED_BY_PUBLISHER" },
        { name: "CANCELLED BY INTERNAL", value: "CANCELLED_BY_INTERNAL" },


    ];
    const cancelledOptions = [
        { name: "PUBLISHER", value: "PUBLISHER" },
        { name: "INTERNAL", value: "INTERNAL" },

    ];

    const convertToZonedFormat = (isoString) => {
        if (!isoString) return null;

        const d = new Date(isoString);

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");

        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");

        // Detect timezone automatically (e.g. "Asia/Kolkata", "UTC", etc.)
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        return parseZonedDateTime(`${year}-${month}-${day}T${hours}:${minutes}[${zone}]`);
    };

    const handleEdit = (row) => {
        const zoned = convertToZonedFormat(row._rawDate);

        setEditData({
            ...row,
            reason: "",
            originalISO: row._rawDate
        });

        setDuration(zoned);  // THIS stores the real DatePicker value
        setIsSalesModalOpen(true);
    };


    const normalizeISO = (iso) => new Date(iso).toISOString();

    //validation for the edit modal
    const validate = () => {
        if (
            editData.status === "CANCELLED_BY_PUBLISHER" ||
            editData.status === "CANCELLED_BY_INTERNAL"
        ) {
            if (!editData.reason || editData.reason.trim() === "") {
                addToast({
                    title: "Reason required",
                    description: "Please provide a reason for cancellation.",
                    color: "danger",
                });
                return false;
            }
        }
        return true;
    };

    const handleSaveChanges = async () => {

        try {
            if (!validate()) return
            if (!editData) return;

            const callID = editData.CallID;

            // New value from DatePicker
            const newDateISO = duration?.toDate().toISOString();

            // Old raw ISO
            const oldISO = editData.originalISO;

            // Normalize both to comparable format
            const normalizedNew = normalizeISO(newDateISO);
            const normalizedOld = normalizeISO(oldISO);

            const dateChanged = normalizedNew !== normalizedOld;



            let response;


            // RESCHEDULE CALL
            if (editData.status == "RESCHEDULED") {
                response = await axios.post(
                    "/t2.0/authentificationUtilization/sales/calls/reschedule",
                    {
                        userID: user.userID,
                        callID,
                        newDatetime: normalizedNew,
                        rescheduledBy: editData.cancelledBy,
                        reason: editData.reason || "",
                    }
                );
            }
            else {
                response = await axios.post(
                    "/t2.0/authentificationUtilization/sales/calls/update-status",
                    {
                        userID: user.userID,
                        callID,
                        newDatetime: normalizedNew,
                        status: editData.status,
                    }
                );

            }

            addToast({
                title: "Rescheduled",
                description: "Call rescheduled successfully",
                color: "success",
            });


            setSalesData(prev =>
                prev.map(item =>
                    item.CallID === callID
                        ? {
                            ...item,
                            ...response.data,
                            ScheduledDatetime: formatDateTime(response.data.scheduledDatetime),
                        }
                        : item
                )
            );

            setIsSalesModalOpen(false);

        } catch (error) {
            console.error(error);
            addToast({
                title: "Error",
                description: "Unable to update call",
                color: "danger",
            });
        }
    };

    // Table configuration
    const salesColumns: TableColumn[] = [
        { key: 'CallID', label: 'Call ID', sortable: true },
        { key: 'ScheduledDatetime', label: 'Scheduled Date/Time', sortable: true },
        { key: 'CreaterUserID', label: 'Creator User ID', sortable: true },
        { key: 'SalesUserID', label: 'Sales User', sortable: true },
        { key: 'PublisherName', label: 'Publisher Name' },
        {
            key: "status",
            label: "Status",
            renderCell: (row) => {

                const colorMap = {
                    SCHEDULED: "bg-brand-500",
                    RESCHEDULED: "bg-amber-500",
                    COMPLETED: "bg-emerald-500",
                    NO_SHOW: "bg-brand-500",
                    CANCELLED_BY_PUBLISHER: "bg-rose-500",
                    CANCELLED_BY_INTERNAL: "bg-ink-600",
                };

                const dotColor = colorMap[row.status] || "bg-ink-400";

                return (
                    <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                        <span className="capitalize text-xs">{row.status.replaceAll("_", " ")}</span>
                    </div>
                );
            }
        }




        ,
        {
            key: 'RescheduleLogs',
            label: 'Reschedule Logs',
            renderCell: (row) => (
                <Dropdown>
                    <DropdownTrigger>
                        <Button size="sm" variant="flat">
                            View Logs
                        </Button>
                    </DropdownTrigger>

                    <DropdownMenu aria-label="Reschedule Logs">
                        {row.RescheduleLogs?.map((log, index) => (
                            <DropdownItem key={index} textValue={`Log ${index + 1}`}>
                                <div className="text-xs space-y-1">
                                    <div><strong>Old:</strong> {formatDateTime(log.OldDatetime)}</div>
                                    <div><strong>New:</strong> {formatDateTime(log.NewDatetime)}</div>
                                    <div><strong>By:</strong> {log.RescheduledBy}</div>
                                    <div><strong>Reason:</strong> {log.Reason}</div>
                                </div>
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </Dropdown>
            )

        },
        {
            key: 'Edit',
            label: 'Edit',
            renderCell: (row) => (
                <Button variant="flat"
                    size="sm"
                    color="secondary"
                    onPress={() => handleEdit(row)}>
                    Edit
                </Button>
            )
        }


    ];

    const salesActions: TableAction[] = [
        {
            key: 'edit',
            label: 'Update',
            color: 'primary',
            onAction: (row) => {
                setSelectedCall(row);
                setIsModalOpen(true);
            }
        }
    ];

    const formatDateTime = (iso) => {
        if (!iso) return "";
        const d = new Date(iso);
        return d.toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const body = {
                    userID: user.userID,

                }
                const result = await axios.post(
                    `/t2.0/authentificationUtilization/sales/calls/list?page=${pageNumber}&size=${pageSize}`, body,
                    { headers: { "Content-Type": "application/json" } }
                );

                const formattedData = result.data.calls.map((item) => ({
                    ...item,
                    _rawDate: item.ScheduledDatetime,   // keep raw untouched
                    ScheduledDatetime: formatDateTime(item.ScheduledDatetime) // for UI table only
                }));
                const filtered = formattedData.filter((ele) => {
                    if (ele.SalesUserID == user.userID) {

                        return ele
                    }
                })
                settotalRecords(result.data.totalRecords)
                setSalesData(filtered);
            } catch (err) {
                console.error("Error fetching sales calls:", err);
            }
        };

        fetchData();
    }, [pageNumber, pageSize]);

    return (
        <div>

            {/* Tasks Table */}
            {selectedRows.length > 0 && (
                <div className="flex justify-between items-center bg-ink-100 dark:bg-ink-800 p-3 rounded mb-3 shadow">
                    <span className="font-semibold">
                        {selectedRows.length} task(s) selected
                    </span>



                </div>
            )}

            <div className="border border-ink-200 bg-white dark:border-white/10 dark:bg-ink-900 overflow-hidden p-6">
                <ReusableTable
                    data={salesData}
                    columns={salesColumns}
                    // actions={salesActions}
                    totalRecords={totalRecords}
                    searchable={true}
                    filterable={true}
                    onRowsPerPageChange={(value) => {
                        setPageSize(value)

                    }}
                    onPageChange={(page) => setPageNumber(page)}
                    onSearchChangeProp={(value) => setSearchValue(value)}
                    filterOptions={[]}
                    selectable={false}
                    sortable={true}
                    paginated={true}
                    emptyContent="No calls found"
                    onAdd={() => setIsModalOpen(true)}
                    addButtonLabel="Add Call"
                    getRowId={(item) => item.CallID}
                    onSelectionChange={(rows) => setSelectedRows(rows)}
                />

            </div>

            {/* SALES CALL MODAL */}
            <Modal isOpen={isSalesModalOpen} onOpenChange={setIsSalesModalOpen} size="lg">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>Update Sales Call</ModalHeader>


                            <ModalBody>

                                {editData ? (
                                    <div className="flex flex-col gap-4">

                                        <Input
                                            label="Call ID"
                                            value={String(editData.CallID)}
                                            isDisabled
                                        />

                                        <Input
                                            label="Publisher Name"
                                            value={editData.PublisherName || ""}
                                            onChange={(e) =>
                                                setEditData({ ...editData, PublisherName: e.target.value })
                                            }
                                        />

                                        <Input
                                            label="Sales User ID"
                                            value={String(editData.SalesUserID)}
                                            onChange={(e) =>
                                                setEditData({ ...editData, SalesUserID: e.target.value })
                                            }
                                        />


                                        <DatePicker
                                            hideTimeZone
                                            showMonthAndYearPickers
                                            value={duration}
                                            onChange={(newValue) => {
                                                console.log("NEW DATE:", newValue);
                                                setDuration(newValue);
                                            }}
                                            label="Event Date"
                                            variant="bordered"
                                        />




                                        <Select
                                            label="Status"
                                            selectedKeys={[editData.status]}
                                            onSelectionChange={(keys) =>
                                                setEditData({ ...editData, status: Array.from(keys)[0] })
                                            }
                                        >
                                            {schedule.map((s) => (
                                                <SelectItem key={s.value}>{s.name}</SelectItem>
                                            ))}
                                        </Select>
                                        {
                                            editData.status === "RESCHEDULED" &&
                                            <Select
                                                label="Cancelled By"
                                                selectedKeys={[editData.cancelledBy]}
                                                onSelectionChange={(keys) =>
                                                    setEditData({ ...editData, cancelledBy: Array.from(keys)[0] })
                                                }
                                            >
                                                {cancelledOptions.map((s) => (
                                                    <SelectItem key={s.value}>{s.name}</SelectItem>
                                                ))}
                                            </Select>
                                        }

                                        <Input
                                            label="Reason"
                                            value={String(editData.reason)}
                                            onChange={(e) =>
                                                setEditData({ ...editData, reason: e.target.value })
                                            }
                                        />


                                    </div>
                                ) : (
                                    <p>No Data Found</p>
                                )}

                            </ModalBody>



                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>Cancel</Button>

                                <Button
                                    color="primary"
                                    onPress={() => handleSaveChanges()}
                                >
                                    Submit
                                </Button>

                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>



        </div>
    );

};

export default SalesForward;