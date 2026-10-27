import { useState } from "react";
import { Autocomplete, AutocompleteItem, Button, Popover, PopoverTrigger, PopoverContent } from "@/components/ui";

interface FilterOption {
    key: string | number;
    name: string;
}

interface Props {
    departmentList: FilterOption[];
    users: FilterOption[];
    efficiencyLevels: string[];
    filterStatus: string;
    selectedUser: string;
    userSearch: string;
    efficiencyFilter: string;
    onDepartmentChange: (key: string) => void;
    onUserChange: (key: string, userName: string) => void;
    onUserSearchChange: (value: string) => void;
    onEfficiencyChange: (value: string) => void;
    filteredUsers: FilterOption[];
}

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

export default function FilterDropdown({
    departmentList,
    users,
    efficiencyLevels,
    filterStatus,
    selectedUser,
    userSearch,
    efficiencyFilter,
    onDepartmentChange,
    onUserChange,
    onUserSearchChange,
    onEfficiencyChange,
    filteredUsers,
}: Props) {
    const [isOpen, setIsOpen] = useState(false);

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
                        aria-label="Filter by sub department"
                        placeholder="Filter by sub department"
                        className="w-full"
                        selectedKey={filterStatus}
                        onSelectionChange={(key) => {
                            onDepartmentChange(key as string);
                        }}
                    >
                        {departmentList
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .filter((ele) => (ele as any).status === "Active")
                            .map((ele) => (
                                <AutocompleteItem key={ele.key} value={ele.name}>
                                    {ele.name.replace(/([A-Z])/g, " $1").trim()}
                                </AutocompleteItem>
                            ))}
                    </Autocomplete>

                    <Autocomplete
                        aria-label="Filter by User"
                        placeholder="Filter by User"
                        className="w-full"
                        selectedKey={selectedUser}
                        inputValue={userSearch}
                        items={filteredUsers.sort((a, b) => a.name.localeCompare(b.name))}
                        onInputChange={(value) => {
                            onUserSearchChange(value as string);
                        }}
                        onSelectionChange={(key) => {
                            if (key) {
                                const found = filteredUsers.find((u) => String(u.key) === String(key));
                                if (found) {
                                    onUserChange(String(key), found.name);
                                }
                            }
                        }}
                    >
                        {(u) => (
                            <AutocompleteItem key={String(u.key)} textValue={u.name}>
                                {u.name}
                            </AutocompleteItem>
                        )}
                    </Autocomplete>

                    <Autocomplete
                        aria-label="Filter by Efficiency"
                        placeholder="Filter by Efficiency"
                        className="w-full"
                        selectedKey={efficiencyFilter}
                        onSelectionChange={(value) => {
                            onEfficiencyChange(value);
                        }}
                    >
                        {efficiencyLevels.map((ele) => (
                            <AutocompleteItem key={ele}>{ele}</AutocompleteItem>
                        ))}
                    </Autocomplete>
                </div>
            </PopoverContent>
        </Popover>
    );
}
