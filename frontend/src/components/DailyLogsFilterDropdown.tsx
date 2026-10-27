import { useState } from "react";
import { Autocomplete, AutocompleteItem, Button, Popover, PopoverTrigger, PopoverContent } from "@/components/ui";

const FilterIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
        <path
            d="M4 5h16M7 12h10M10 19h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

interface FilterOption {
    key: number | string;
    name: string;
    status?: string;
    roleID?: number;
    userID?: number;
    reportingManagerID?: number;
    functionalLeaderID?: number;
}

interface User {
    userID: number;
    userName: string;
    roleID?: number;
    reportingManagerID?: number;
    executiveLeaderID?: number;
    functionalLeaderID?: number;
}

interface Props {
    user: any;
    departmentList: FilterOption[];
    users: User[];
    ELList: User[];
    taskTargetList: { id: number | string; name: string; type: string }[];
    filterStatus: string;
    selectedUser: string;
    isTarget: true | false | null;
    taskIDFilter: number | string;
    onFilterStatusChange: (dep: string) => void;
    onSelectedUserChange: (key: string) => void;
    onIsTargetChange: (val: true | false | null) => void;
    onElFilterChange: (key: any) => void;
    onTaskIDFilterChange: (key: any) => void;
}

export default function DailyLogsFilterDropdown({
    user,
    departmentList,
    users,
    ELList,
    taskTargetList,
    filterStatus,
    selectedUser,
    isTarget,
    taskIDFilter,
    onFilterStatusChange,
    onSelectedUserChange,
    onIsTargetChange,
    onElFilterChange,
    onTaskIDFilterChange,
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [userSearch, setUserSearch] = useState("");

    const filteredUsers = users.filter((u) =>
        u.userName.toLowerCase().includes(userSearch.toLowerCase())
    );

    const showFilters = ![2, 5, 6, 23, 4].includes(user.userRole);

    return (
        <Popover isOpen={isOpen} onOpenChange={setIsOpen} placement="bottom-start">
            <PopoverTrigger>
                <Button
                    variant="flat"
                    size="sm"
                    color="primary"
                    className="px-6 gap-2"
                    startContent={<FilterIcon className="w-5 h-5" />}
                >
                    Filter
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-4 w-[420px] mr-4">
                <div className="flex flex-col gap-3 w-full">
                    <Autocomplete
                        aria-label="Type"
                        placeholder="Type"
                        className="w-full"
                        selectedKey={
                            isTarget === null
                                ? "ALL"
                                : isTarget
                                    ? "TARGET"
                                    : "TASK"
                        }
                        defaultSelectedKey="ALL"
                        onSelectionChange={(key) => {
                            if (key === "ALL") return onIsTargetChange(null);
                            onIsTargetChange(key === "TARGET");
                        }}
                    >
                        <AutocompleteItem key="ALL" value="null" textValue="All">All</AutocompleteItem>
                        <AutocompleteItem key="TARGET" value="true" textValue="Target">Target</AutocompleteItem>
                        <AutocompleteItem key="TASK" value="false" textValue="Task">Task</AutocompleteItem>
                    </Autocomplete>

                    {showFilters && (
                        <Autocomplete
                            aria-label="EL select"
                            placeholder="Select EL"
                            isDisabled={user.userRole === 3}
                            className="w-full"
                            onSelectionChange={(key) => onElFilterChange(key)}
                        >
                            {ELList.sort((a, b) => a.userName.localeCompare(b.userName))
                                .filter((u) => {
                                    if (user.userRole === 4) {
                                        return u.userID === user.reportingManagerID;
                                    }
                                    return u.roleID === 3;
                                })
                                .map((u) => (
                                    <AutocompleteItem
                                        key={u.userID}
                                        value={u.userID}
                                        textValue={u.userName.replace(/([A-Z])/g, " $1").trim()}
                                    >
                                        {u.userName.replace(/([A-Z])/g, " $1").trim()}
                                    </AutocompleteItem>
                                ))}
                        </Autocomplete>
                    )}

                    {showFilters && !user.departmentID && (
                        <Autocomplete
                            aria-label="filter by sub department"
                            placeholder="filter by sub department"
                            className="w-full"
                            selectedKey={filterStatus}
                            onSelectionChange={(key) => {
                                const dep = key as string;
                                onFilterStatusChange(dep);
                                onSelectedUserChange("");
                                setUserSearch("");
                            }}
                        >
                            {departmentList.sort((a, b) => a.name.localeCompare(b.name))
                                .filter((ele) => {
                                    if (user.userRole == 4 && ele.status === "Active") {
                                        return ele.functionalLeaderID == user.userID;
                                    }
                                    return ele.status === "Active";
                                })
                                .map((ele) => (
                                    <AutocompleteItem key={ele.key} value={ele.name} textValue={ele.name.replace(/([A-Z])/g, " $1").trim()}>
                                        {ele.name.replace(/([A-Z])/g, " $1").trim()}
                                    </AutocompleteItem>
                                ))}
                        </Autocomplete>
                    )}

                    {showFilters && (
                        <Autocomplete
                            aria-label="Task/Target"
                            placeholder="Task / Target"
                            className="w-full"
                            isDisabled={!filterStatus}
                            selectedKey={taskIDFilter}
                            onSelectionChange={(key) => onTaskIDFilterChange(key)}
                        >
                            {taskTargetList.map((item) => (
                                <AutocompleteItem key={item.id} value={item.id} textValue={item.name.replace(/([A-Z])/g, " $1").trim()}>
                                    {item.name.replace(/([A-Z])/g, " $1").trim()}
                                </AutocompleteItem>
                            ))}
                        </Autocomplete>
                    )}

                    {showFilters && (
                        <Autocomplete
                            aria-label="filter by User"
                            placeholder="Filter by User"
                            className="w-full"
                            selectedKey={selectedUser}
                            inputValue={userSearch}
                            onInputChange={(value) => {
                                setUserSearch(value as string);
                            }}
                            onSelectionChange={(key) => {
                                if (key) {
                                    const found = users.find((u) => String(u.userID) === String(key));
                                    if (found) {
                                        onSelectedUserChange(String(key));
                                        setUserSearch(found.userName);
                                    }
                                }
                            }}
                        >
                            {filteredUsers.sort((a, b) => a.userName.localeCompare(b.userName)).map((ele: User) => (
                                <AutocompleteItem key={String(ele.userID)} textValue={ele.userName}>
                                    {ele.userName}
                                </AutocompleteItem>
                            ))}
                        </Autocomplete>
                    )}

                    {showFilters && (
                        <div className="flex justify-end">
                            <Button color="danger" size="sm" onPress={() => setIsOpen(false)}>
                                Close
                            </Button>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
