import React, { useState, useMemo, useCallback } from "react";
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Input,
    Button,
    Chip,
    Pagination,
    Select, SelectItem
} from "@/components/ui";
import { format } from "date-fns";

const SearchIcon = (props) => (
    <svg
        aria-hidden="true"
        fill="none"
        focusable="false"
        height="1em"
        role="presentation"
        viewBox="0 0 24 24"
        width="1em"
        {...props}
    >
        <path
            d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
        />
        <path
            d="M22 22L20 20"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
        />
    </svg>
);



const efficiencyColorMap = {
    High: "success",
    Medium: "warning",
    Low: "danger",
};

const sampleData = (cellValue) => {
    return format(new Date(cellValue), "dd MMM yyyy")
}

//  data coming from props
export default function EfficiencyTable({ data, type, onEdit, dashboard = false }) {
    const [filterValue, setFilterValue] = useState("");
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [sortDescriptor, setSortDescriptor] = useState({
        column: "UserName",
        direction: "ascending",
    });
    const [page, setPage] = useState(1);

    const hasSearchFilter = Boolean(filterValue);

    //  Use data prop instead of sampleData
    const filteredItems = useMemo(() => {
        let filtered = Array.isArray(data) ? [...data] : [];

        if (hasSearchFilter) {
            filtered = filtered.filter((item) => {
                const search = filterValue.toLowerCase();

                if (type === "department") {
                    return item.DepartmentName?.toLowerCase().includes(search);
                }

                if (type === "EL") {
                    return item.ELName?.toLowerCase().includes(search);
                }

                // default: user table
                return item.UserName?.toLowerCase().includes(search);
            });
        }


        return filtered;
    }, [filterValue, data]);
    const authUserLD = localStorage.getItem("authUserLD");
    const authUser = JSON.parse(authUserLD)
    const pages = Math.ceil(filteredItems.length / rowsPerPage);

    const items = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        return filteredItems.slice(start, end);
    }, [page, filteredItems, rowsPerPage]);

    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => {
            const first = a[sortDescriptor.column];
            const second = b[sortDescriptor.column];
            const cmp = first < second ? -1 : first > second ? 1 : 0;
            return sortDescriptor.direction === "descending" ? -cmp : cmp;
        });
    }, [sortDescriptor, items]);

    const columns = [
        { key: "UserID", label: "USER ID", sortable: true },
        { key: "UserName", label: "USER NAME", sortable: true },
        { key: "WorkDate", label: "WORK DATE", sortable: true },
        { key: "TargetAchievedPercent", label: "TARGET ACHIEVED %", sortable: true },
        // { key: "UtilizationPercent", label: "UTILIZATION %", sortable: true },
        { key: "AllocatedTimeHrs", label: "ALLOCATED TIME (hrs)", sortable: true },
        { key: "TotalTimeOfWork", label: "TOTAL TIME TAKEN (hrs)", sortable: true },
        // { key: "EfficiencyLevel", label: "EFFICIENCY LEVEL", sortable: true },


    ];
    const adminColumns = [
        { key: "ticketID", label: "TICKET ID" },
        { key: "title", label: "TITLE" },
        { key: "status", label: "STATUS" },
        { key: "openDate", label: "OPEN DATE" },
        { key: "achievedPerct", label: "ACHIEVED %" },
        { key: "actions", label: "ACTIONS" },
    ];
    const elUserColumns = [
        { key: "UserID", label: "USER ID", sortable: true },
        { key: "UserName", label: "USER NAME", sortable: true },
        { key: "AvgTargetPercent", label: "Target Achieved (Overall)", sortable: true },
        // { key: "AvgUtilizationPercent", label: "Utilization % (Average)", sortable: true },
        { key: "AvgAllocatedHrs", label: "Allocated hours per day (Average)", sortable: true },
        { key: "AvgTotalWork", label: "Working hours per day (Average)", sortable: true },
        // { key: "EfficiencyLevel", label: "Overall Efficiency", sortable: true },

        ...(dashboard
            ? [{ key: "AvgGoalEfficiency", label: "Average Goal", sortable: true }]
            : [])
    ];
    const depColumns = [
        { key: "DepartmentID", label: "ID", sortable: true },
        { key: "DepartmentName", label: "Department", sortable: true },
        { key: "AvgTargetPercent", label: "Target Achieved (Overall)", sortable: true },
        // { key: "AvgUtilizationPercent", label: "Utilization % (Average)", sortable: true },
        { key: "AvgAllocatedHrs", label: "Allocated hours per day (Average)", sortable: true },
        { key: "AvgTotalWork", label: "Working hours per day (Average)", sortable: true },
        // { key: "EfficiencyLevel", label: "Overall Efficiency", sortable: true },
        { key: "AvgGoalEfficiency", label: "Average Goal", sortable: true },

    ];
    const ELColumns = [
        { key: "ELID", label: "ID", sortable: true },
        { key: "ELName", label: "Executive Leader", sortable: true },

        { key: "AvgTargetPercent", label: "Target Achieved (Overall)", sortable: true },
        // { key: "AvgUtilizationPercent", label: "Utilization % (Average)", sortable: true },
        { key: "AvgAllocatedHrs", label: "Allocated hours per day (Average)", sortable: true },
        { key: "AvgTotalWork", label: "Working hours per day (Average)", sortable: true },
        // { key: "EfficiencyLevel", label: "Overall Efficiency", sortable: true },
        { key: "AvgGoalEfficiency", label: "Average Goal", sortable: true },


    ];
    const userColumns = authUser.userRole === 2 ? [
        { key: "UserID", label: "USER ID", sortable: true },


        { key: "WorkDate", label: "WORK DATE", sortable: true },

        { key: "TargetAchievedPercent", label: "TARGET ACHIEVED %", sortable: true },
        // { key: "UtilizationPercent", label: "UTILIZATION %", sortable: true },

        { key: "AllocatedTimeHrs", label: "ALLOCATED TIME (hrs)", sortable: true },
        { key: "TotalTimeOfWork", label: "TOTAL TIME TAKEN (hrs)", sortable: true },

        // { key: "EfficiencyLevel", label: "EFFICIENCY LEVEL", sortable: true },
    ] : [
        { key: "UserID", label: "USER ID", sortable: true },
        { key: "UserName", label: "USER NAME", sortable: true },
        { key: "DepartmentName", label: "Department", sortable: true },

        { key: "WorkDate", label: "WORK DATE", sortable: true },

        { key: "TargetAchievedPercent", label: "TARGET ACHIEVED %", sortable: true },
        // { key: "UtilizationPercent", label: "UTILIZATION %", sortable: true },

        { key: "AllocatedTimeHrs", label: "ALLOCATED TIME (hrs)", sortable: true },
        { key: "TotalTimeOfWork", label: "TOTAL TIME TAKEN (hrs)", sortable: true },
        { key: "GoalPercent", label: "GOAL %", sortable: true },

        // { key: "EfficiencyLevel", label: "EFFICIENCY LEVEL", sortable: true },
    ];

    const GoalColumns = [
        { key: "goalID", label: "GOAL ID", sortable: true },
        { key: "userID", label: "USER ID", sortable: true },
        { key: "workDate", label: "WORK DATE", sortable: true },
        { key: "departmentID", label: "DEPARTMENT ID", sortable: true },
        { key: "fixedGoal", label: "FIXED GOAL", sortable: true },
        { key: "achievedGoal", label: "ACHIEVED GOAL", sortable: true },
    ]


    const efficiencyColorMap = {
        High: "success",
        Medium: "warning",
        Low: "danger",
    };

    const renderCell = useCallback((item, columnKey) => {
        const normalizedKey =
            columnKey === "WorkDate" && item.workDate ? "workDate" :
                columnKey === "workDate" && item.WorkDate ? "WorkDate" :
                    columnKey;

        const cellValue = item[normalizedKey];

        switch (columnKey) {
            case "achievedPerct":
                return (
                    <span className="text-sm font-medium text-ink-900 dark:text-white">
                        {Number(cellValue || 0).toFixed(2)}%
                    </span>
                );
            case "actions":
                if ((item.status == "OPEN") || (item.status == "PAUSED")) {
                    return (

                        <Button
                            size="sm"
                            color="primary"
                            onPress={() => onEdit?.(item)}
                        >
                            Edit
                        </Button>
                    );
                }
            case "openDate":
                return (
                    <span className="text-sm text-ink-700 dark:text-ink-300">
                        {cellValue ? sampleData(cellValue) : "—"}
                    </span>
                );

            case "status":
                return (
                    <Chip
                        color={cellValue === "OPEN" ? "warning" : "success"}
                        size="sm"
                        variant="flat"
                    >
                        {cellValue}
                    </Chip>
                );
            case "UserID":
            case "ELID":
            case "DepartmentID":
                return (
                    <span className="text-sm font-medium text-ink-900 dark:text-white">
                        {cellValue}
                    </span>
                );

            case "UserName":
            case "ELName":
            case "DepartmentName":
                return (
                    <span className="text-sm font-semibold text-ink-900 dark:text-white">
                        {cellValue}
                    </span>
                );

            case "WorkDate":
            case "workDate":
                return (
                    <span className="text-sm text-ink-700 dark:text-ink-300">
                        {cellValue
                            ? sampleData(cellValue)
                            : "—"}
                    </span>
                );

            case "TargetAchievedPercent":
            case "AvgTargetPercent":
                return (
                    <span className="text-sm font-medium text-ink-900 dark:text-white">
                        {cellValue?.toFixed(2)}%
                    </span>
                );
            case "AvgGoalEfficiency":
                return (
                    <span
                        className="inline-flex px-2 py-1 text-xs font-semibold rounded-full 
                    bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    >
                        {cellValue}
                    </span>
                );

            case "UtilizationPercent":
            case "AvgUtilizationPercent":
                return (
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-ink-900 dark:text-white">
                            {cellValue?.toFixed(2)}%
                        </span>

                        <div className="w-full bg-ink-200 rounded-full h-1.5 dark:bg-ink-700">
                            <div
                                className={`h-1.5 rounded-full ${cellValue >= 80
                                    ? "bg-green-500"
                                    : cellValue >= 50
                                        ? "bg-yellow-500"
                                        : "bg-red-500"
                                    }`}
                                style={{ width: `${Math.min(cellValue ?? 0, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                );

            case "AllocatedTimeHrs":
            case "AvgAllocatedHrs":
            case "TotalTimeOfWork":
            case "AvgTotalWork":
                return (
                    <span
                        className="inline-flex px-2 py-1 text-xs font-semibold rounded-full 
                    bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    >
                        {cellValue?.toFixed(2)} hrs
                    </span>
                );

            case "EfficiencyLevel":
                return (
                    <Chip
                        className="capitalize border-none gap-1"
                        color={efficiencyColorMap[cellValue] || "default"}
                        size="sm"
                        variant="flat"
                    >
                        {cellValue}
                    </Chip>
                );

            // DEFAULT
            default:
                return cellValue;
        }
    }, []);



    const onRowsPerPageChange = useCallback((e) => {
        setRowsPerPage(Number(e.target.value));
        setPage(1);
    }, []);

    const onSearchChange = useCallback((value) => {
        setFilterValue(value || "");
        setPage(1);
    }, []);

    const indexedItems = useMemo(() => {
        return sortedItems.map((item, index) => ({
            ...item,
            _index: index,   // ← new index field
        }));
    }, [sortedItems]);


    const topContent = useMemo(() => (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between gap-3 items-end">
                {
                    !dashboard && (
                        <Input
                            isClearable
                            classNames={{ base: "w-full sm:max-w-[44%]", inputWrapper: "border-1" }}
                            placeholder="Search by user name..."
                            size="sm"
                            startContent={<SearchIcon className="text-default-300" />}
                            value={filterValue}
                            variant="bordered"
                            onClear={() => setFilterValue("")}
                            onValueChange={onSearchChange}
                        />
                    )
                }

            </div>

        </div>
    ), [filterValue, onSearchChange, onRowsPerPageChange, filteredItems.length, rowsPerPage]);

    const bottomContent = useMemo(() => (
        <div className="py-2 px-2 flex justify-between items-center">

            <span className="text-small text-default-400 flex items-center">

                Showing {(page - 1) * rowsPerPage + 1} to {Math.min(page * rowsPerPage, filteredItems.length)} of {filteredItems.length}
            </span>
            <div className="flex">
                {/* <label className="flex items-center ">
                    <span className="text-small text-default-400" style={{ width: "112px" }}>
                        Rows per page:
                    </span>

                    <Select size="sm"
                        className="w-20 mx-2"
                        defaultSelectedKeys={["10"]}
                        onChange={onRowsPerPageChange} value={rowsPerPage}>
                        <SelectItem key={5}>5</SelectItem >
                        <SelectItem key={10}>10</SelectItem >
                        <SelectItem key={15}>15</SelectItem >
                        <SelectItem key={20}>20</SelectItem >
                    </Select>
                </label> */}
                <Pagination showControls

                    color="default"
                    page={page}
                    total={pages}
                    variant="light"
                    onChange={setPage}
                />
            </div>

        </div>
    ), [page, pages, rowsPerPage, filteredItems.length]);

    return (
        <div className="w-full p-4">
            <Table
                aria-label="Efficiency report table"
                bottomContent={bottomContent}
                bottomContentPlacement="outside"
                classNames={{
                    wrapper: dashboard ? "" : "min-h-[400px]",
                    th: ["bg-ink-100", "dark:bg-ink-800", "text-default-500", "border-divider"],
                    td: ["py-3"],
                }}
                sortDescriptor={sortDescriptor}
                topContent={type == "admin" ? null : topContent}
                topContentPlacement="outside"
                onSortChange={setSortDescriptor}
            >
                <TableHeader columns={type == "admin" ? adminColumns :
                    type == "department" ? depColumns : type == "EL" ? ELColumns : type == "user" ? userColumns : type == "ELU" ? elUserColumns : type == "goal" ? GoalColumns : columns}>
                    {(column) => (
                        <TableColumn
                            key={column.key}
                            align={column.key === "EfficiencyLevel" ? "center" : "start"}
                            allowsSorting={column.sortable}
                        >
                            {column.label}
                        </TableColumn>
                    )}
                </TableHeader>
                <TableBody emptyContent={"No efficiency data found"} items={indexedItems}>
                    {(item) => (
                        <TableRow key={item._index}>
                            {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                        </TableRow>
                    )}
                </TableBody>

            </Table>
        </div>
    );
}
