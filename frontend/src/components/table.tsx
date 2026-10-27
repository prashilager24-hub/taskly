import React from "react";
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Input,
    Button,
    DropdownTrigger,
    Dropdown,
    DropdownMenu,
    DropdownItem,
    Chip,
    Pagination,
    Select, SelectItem
} from "@/components/ui";

// Generic interfaces for reusable table
// export interface TableColumn {
//     key: string;
//     label: string;
//     sortable?: boolean;
//     width?: string;
// }
export interface TableColumn {
    key: string;
    label: string;
    sortable?: boolean;
    width?: string;
    renderCell?: (item: any) => React.ReactNode;
}


export interface TableAction {
    key: string;
    label: string;
    color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
    onAction: (item: any) => void;
}

export interface ReusableTableProps {
    data: any[];
    columns: TableColumn[];
    actions?: TableAction[];
    totalRecords: number;
    searchable?: boolean;
    onFilterChange?: (key: string, value: string | number) => void;
    searchPlaceholder?: string;
    onSearchFilterChange?: string;
    searchKeys?: string[];
    onSearchChangeProp?: (value: string) => void;
    filterable?: boolean;
    filterOptions?: { key: string; label: string; options: { key: string; label: string }[] }[];
    selectable?: boolean;
    sortable?: boolean;
    onPageChange?: (page: number) => void;
    paginated?: boolean;
    rowsPerPageOptions?: number[];
    defaultRowsPerPage?: number;
    emptyContent?: string;
    title?: string;
    onAdd?: () => void;
    addButtonLabel?: string;
    renderCell?: (item: any, columnKey: string) => React.ReactNode;
    getRowId?: (item: any) => string | number;
    onSelectionChange?: (selectedRows: any[]) => void; // NEW: Callback with full row data
}

// Utility functions
export function capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
}

// Icon components
interface IconProps {
    size?: number;
    width?: number;
    height?: number;
    strokeWidth?: number;
    className?: string;
}

export const PlusIcon: React.FC<IconProps> = ({ size = 24, width, height, ...props }) => {
    return (
        <svg
            aria-hidden="true"
            fill="none"
            focusable="false"
            height={size || height}
            role="presentation"
            viewBox="0 0 24 24"
            width={size || width}
            {...props}
        >
            <g
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
            >
                <path d="M6 12h12" />
                <path d="M12 18V6" />
            </g>
        </svg>
    );
};

export const VerticalDotsIcon: React.FC<IconProps> = ({ size = 24, width, height, ...props }) => {
    return (
        <svg
            aria-hidden="true"
            fill="none"
            focusable="false"
            height={size || height}
            role="presentation"
            viewBox="0 0 24 24"
            width={size || width}
            {...props}
        >
            <path
                d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                fill="currentColor"
            />
        </svg>
    );
};

export const SearchIcon: React.FC<IconProps> = (props) => {
    return (
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
};

export const ChevronDownIcon: React.FC<IconProps> = ({ strokeWidth = 1.5, ...otherProps }) => {
    return (
        <svg
            aria-hidden="true"
            fill="none"
            focusable="false"
            height="1em"
            role="presentation"
            viewBox="0 0 24 24"
            width="1em"
            {...otherProps}
        >
            <path
                d="m19.92 8.95-6.52 6.52c-.77.77-2.03.77-2.8 0L4.08 8.95"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeMiterlimit={10}
                strokeWidth={strokeWidth}
            />
        </svg>
    );
};

// Main reusable table component
export default function ReusableTable({
    data,
    columns,
    totalRecords,
    actions = [],
    searchable = true,
    searchPlaceholder = "Search by UserName",
    searchKeys = [],
    filterable = false,
    filterOptions = [],
    selectable = false,
    sortable = true,
    onFilterChange,
    paginated = true,
    rowsPerPageOptions = [10, 15, 20],
    defaultRowsPerPage = 10,
    onRowsPerPageChange,
    onPageChange,
    onSearchChangeProp,
    emptyContent = "No data found",
    title,
    onAdd,
    addButtonLabel = "Add New",
    renderCell,
    getRowId = (item) => String(item.id || item.taskID),
    onSelectionChange // NEW: Receive callback
}: ReusableTableProps) {
    const [filterValue, setFilterValue] = React.useState("");
    const debounceRef = React.useRef<NodeJS.Timeout | null>(null);
    const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set());
    const [filters, setFilters] = React.useState<Record<string, Set<string>>>({});
    const [rowsPerPage, setRowsPerPage] = React.useState(defaultRowsPerPage);
    const [sortDescriptor, setSortDescriptor] = React.useState<{
        column: string;
        direction: "ascending" | "descending";
    }>({
        column: columns[0]?.key || "",
        direction: "ascending",
    });
    const [page, setPage] = React.useState(1);
    const hasSearchFilter = Boolean(filterValue);
    // Track totalRecords changes



    // Filter data based on search and filters
    const filteredItems = React.useMemo(() => {
        let filtered = [...data];

        // Apply search filter
        // if (hasSearchFilter && searchKeys.length > 0) {
        //     filtered = filtered.filter((item) =>
        //         searchKeys.some((key) =>
        //             String(item[key] || "").toLowerCase().includes(filterValue.toLowerCase())
        //         )
        //     );
        // } else if (hasSearchFilter) {
        //     // If no search keys specified, search all string fields
        //     filtered = filtered.filter((item) =>
        //         Object.values(item).some((value) =>
        //             String(value || "").toLowerCase().includes(filterValue.toLowerCase())
        //         )
        //     );
        // }
        if (hasSearchFilter && searchKeys.length > 0) {
            // Filter only by specified keys
            filtered = filtered.filter((item) =>
                item != null && // ✅ ensure item is not undefined/null
                searchKeys.some((key) =>
                    String(item?.[key] ?? "").toLowerCase().includes(filterValue.toLowerCase())
                )
            );
        } else if (hasSearchFilter) {
            // If no search keys specified, search all string fields
            filtered = filtered.filter((item) =>
                item != null && // ✅ ensure item is not undefined/null
                Object.values(item ?? {}).some((value) =>
                    String(value ?? "").toLowerCase().includes(filterValue.toLowerCase())
                )
            );
        }


        // Apply additional filters
        Object.entries(filters).forEach(([filterKey, selectedValues]) => {
            if (
                selectedValues.size > 0 &&
                !selectedValues.has("all") &&
                !selectedValues.has("") &&
                !selectedValues.has("0")
            ) {
                filtered = filtered.filter((item) =>
                    selectedValues.has(String(item[filterKey]))
                );
            }
        });

        return filtered;
    }, [data, filterValue, filters, searchKeys, hasSearchFilter]);

    // Paginate data
    const paginatedItems = React.useMemo(() => {
        return filteredItems;
        // if (serverSidePagination) return filteredItems;


    }, [page, filteredItems, rowsPerPage, paginated]);


    // Sort data
    const sortedItems = React.useMemo(() => {
        if (!sortable) return paginatedItems;

        return [...paginatedItems].sort((a, b) => {
            const first = a?.[sortDescriptor.column];
            const second = b?.[sortDescriptor.column];

            let cmp = 0;

            if (first < second) cmp = -1;
            else if (first > second) cmp = 1;

            return sortDescriptor.direction === "descending"
                ? -cmp
                : cmp;
        });
    }, [sortDescriptor, paginatedItems, sortable]);

    const pages = Math.ceil(totalRecords / rowsPerPage);

    // NEW: Helper function to get full row data from selected keys
    const getSelectedRows = React.useCallback((keys: Set<string>) => {
        return data.filter(item => keys.has(String(getRowId(item))));
    }, [data, getRowId]);

    // Default cell renderer
    const defaultRenderCell = React.useCallback((item: any, columnKey: string) => {
        const cellValue = item[columnKey];

        if (columnKey === "actions" && actions.length > 0) {
            return (
                <div className="relative flex justify-end items-center gap-2">
                    <Dropdown className="bg-background border-1 border-default-200">
                        <DropdownTrigger>
                            <Button isIconOnly radius="full" size="sm" variant="light">
                                <VerticalDotsIcon className="text-default-400" />
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu>
                            {actions.map((action) => (
                                <DropdownItem
                                    key={action.key}
                                    color={action.color}
                                    onPress={() => action.onAction(item)}
                                >
                                    {action.label}
                                </DropdownItem>
                            ))}
                        </DropdownMenu>
                    </Dropdown>
                </div>
            );
        }

        // Handle boolean values
        if (typeof cellValue === "boolean") {
            return (
                <Chip
                    className="capitalize border-none gap-1 text-default-600"
                    color={cellValue ? "success" : "danger"}
                    size="sm"
                    variant="dot"
                >
                    {cellValue ? "active" : "inactive"}
                </Chip>
            );
        }

        // Handle status-like fields
        if (columnKey.toLowerCase().includes("status") || columnKey.toLowerCase().includes("active")) {
            const isActive = cellValue === true || cellValue === "active" || cellValue === "Active";
            return (
                <Chip
                    className="capitalize border-none gap-1 text-default-600"
                    color={isActive ? "success" : "danger"}
                    size="sm"
                    variant="dot"
                >
                    {String(cellValue)}
                </Chip>
            );
        }

        return String(cellValue || "");
    }, [actions]);

    const cellRenderer = renderCell || defaultRenderCell;

    // Event handlers

    const handleRowsPerPageChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = Number(e.target.value);
        setRowsPerPage(value);
        setPage(1);

        if (onRowsPerPageChange) {
            onRowsPerPageChange(value);
        }
    }, [onRowsPerPageChange]);



    // const onSearchChange = React.useCallback((value?: string) => {
    //     setFilterValue(value || "");
    //     setPage(1);
    // }, []);
    const onSearchChange = React.useCallback(
        (value?: string) => {
            const val = value || "";

            setFilterValue(val);
            setPage(1);

            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            debounceRef.current = setTimeout(() => {
                if (typeof onSearchChangeProp === "function") {
                    onSearchChangeProp(val);
                }
            }, 500); // 500ms debounce
        },
        [onSearchChangeProp]
    );

    // Top content with search and filters
    const topContent = React.useMemo(() => {
        return (
            <div className="flex flex-col gap-4">
                {title && (
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold">{title}</h2>
                        {onAdd && (
                            <Button
                                color="primary"
                                endContent={<PlusIcon />}
                                size="sm"
                                onPress={onAdd}
                            >
                                {addButtonLabel}
                            </Button>
                        )}
                    </div>
                )}

                <div className="flex justify-between gap-3 items-end">
                    {searchable && (
                        <Input
                            isClearable
                            classNames={{
                                base: "w-full sm:max-w-[44%]",
                                inputWrapper: "border-1",
                            }}
                            placeholder={searchPlaceholder}
                            size="sm"
                            startContent={<SearchIcon className="text-default-300" />}
                            value={filterValue}
                            variant="bordered"
                            onClear={() => setFilterValue("")}
                            onValueChange={onSearchChange}
                        />
                    )}

                    <div className="flex gap-3">
                        {filterable && filterOptions.map((filterOption) => (
                            <Dropdown key={filterOption.key}>
                                <DropdownTrigger className="hidden sm:flex">
                                    <Button
                                        endContent={<ChevronDownIcon className="text-small" />}
                                        size="sm"
                                        variant="flat"
                                    >
                                        {filterOption.label}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    disallowEmptySelection
                                    aria-label={`Filter by ${filterOption.label}`}
                                    closeOnSelect={false}
                                    selectedKeys={filters[filterOption.key] || new Set()}
                                    selectionMode="single"
                                    // onSelectionChange={(keys) => {
                                    //     const selectedArr = Array.from(keys).map(String);
                                    //     setFilters(prev => ({
                                    //         ...prev,
                                    //         [filterOption.key]: new Set(Array.from(keys).map(String))
                                    //     }));
                                    //     if (filterOption.key === "roleID" && onFilterChange) {
                                    //         onFilterChange("roleID", selectedArr[0] ?? null);
                                    //     }

                                    // }}
                                    onSelectionChange={(keys) => {
                                        const selectedArr = Array.from(keys).map(String);

                                        setFilters(prev => ({
                                            ...prev,
                                            [filterOption.key]: new Set(selectedArr)
                                        }));

                                        if (onFilterChange) {
                                            onFilterChange(
                                                filterOption.key,
                                                selectedArr[0] === "" ? "" : selectedArr[0]
                                            );
                                        }
                                    }}
                                >
                                    {filterOption.options.map((option) => (
                                        <DropdownItem key={option.key} className="capitalize">
                                            {option.label}
                                        </DropdownItem>
                                    ))}
                                </DropdownMenu>
                            </Dropdown>
                        ))}
                    </div>
                </div>

                {paginated && (
                    <div className="flex justify-between items-center">
                        <span className="text-default-400 text-small">
                            Total {filteredItems.length} items
                        </span>
                        {/* <label className="flex items-center text-default-400 text-small">
                            Rows per page:
                            <select
                                className="bg-transparent outline-none text-default-400 text-small ml-2"
                                value={rowsPerPage}
                                onChange={handleRowsPerPageChange}
                            >
                                {rowsPerPageOptions.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </label> */}
                    </div>
                )}
            </div>
        );
    }, [
        title,
        onAdd,
        addButtonLabel,
        searchable,
        searchPlaceholder,
        filterValue,
        onSearchChange,
        filterable,
        filterOptions,
        filters,
        paginated,
        filteredItems.length,
        rowsPerPage,
        rowsPerPageOptions,
        onRowsPerPageChange,
    ]);

    const startRecord = totalRecords === 0 ? 0 : (page - 1) * rowsPerPage + 1;

    const endRecord = Math.min(
        (page - 1) * rowsPerPage + sortedItems.length,
        totalRecords
    );

    // Bottom content with pagination
    const bottomContent = React.useMemo(() => {
        if (!paginated) return null;

        return (
            <div className="py-2 px-2 flex justify-between items-center">
                <span className="text-small text-default-400 flex items-center">

                    Showing {startRecord} to {endRecord} of {totalRecords}
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
                    <Pagination
                        showControls
                        classNames={{
                            cursor: "bg-foreground text-background",
                        }}
                        color="default"
                        page={page}
                        onChange={(newPage) => {
                            setPage(newPage);
                            if (onPageChange) onPageChange(newPage);
                        }}
                        total={pages}
                        variant="light"

                    />
                </div>

                {/* {selectable && (
                    <span className="text-small text-default-400">
                        {selectedKeys.size === 0
                            ? "No items selected"
                            : `${selectedKeys.size} of ${sortedItems.length} selected`}
                    </span>
                )} */}
            </div>
        );
    }, [paginated, page, pages, selectable, selectedKeys.size, sortedItems.length]);

    // Add actions column if actions are provided
    const tableColumns = React.useMemo(() => {
        const cols = [...columns];
        if (actions.length > 0 && !cols.find(col => col.key === "actions")) {
            cols.push({ key: "actions", label: "Actions" });
        }
        return cols;
    }, [columns, actions]);

    return (
        <Table
            isCompact
            removeWrapper
            aria-label="Data table"
            bottomContent={bottomContent}
            bottomContentPlacement="outside"
            selectedKeys={selectable ? selectedKeys : undefined}
            selectionMode={selectable ? "multiple" : "none"}
            sortDescriptor={sortable ? sortDescriptor : undefined}
            topContent={topContent}
            topContentPlacement="outside"
            onSelectionChange={
                selectable
                    ? (keys) => {
                        let newSelectedKeys: Set<string>;

                        if (keys === "all") {
                            newSelectedKeys = new Set(sortedItems.map((row) => String(getRowId(row))));
                        } else {
                            newSelectedKeys = new Set(Array.from(keys).map(String));
                        }

                        setSelectedKeys(newSelectedKeys);

                        // NEW: Call the callback with full row data
                        if (onSelectionChange) {
                            const selectedRows = getSelectedRows(newSelectedKeys);
                            onSelectionChange(selectedRows);
                        }
                    }
                    : undefined
            }
            onSortChange={sortable ? (descriptor) => setSortDescriptor({
                column: String(descriptor.column),
                direction: descriptor.direction as "ascending" | "descending"
            }) : undefined}
        >
            <TableHeader columns={tableColumns}>
                {(column: TableColumn) => (
                    <TableColumn
                        key={column.key}
                        align={column.key === "actions" ? "center" : "start"}
                        allowsSorting={sortable && column.sortable !== false}
                        width={column.width}
                    >
                        {column.label}
                    </TableColumn>
                )}
            </TableHeader>
            <TableBody emptyContent={emptyContent} items={sortedItems}>
                {(item: any) => (
                    <TableRow key={getRowId(item)}>
                        {(columnKey: React.Key) => (
                            // <TableCell>
                            //     {cellRenderer(item, String(columnKey))}
                            // </TableCell>
                            <TableCell>
                                {(() => {
                                    const col = columns.find(
                                        (c) => String(c.key) === String(columnKey)
                                    );

                                    if (col?.renderCell) {
                                        return col.renderCell(item);
                                    }

                                    return cellRenderer(item, String(columnKey));
                                })()}
                            </TableCell>


                        )}
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}