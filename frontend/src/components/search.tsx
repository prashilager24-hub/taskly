import { Autocomplete, AutocompleteItem } from "@heroui/react";

export default function SearchableSelect() {
    const users = [
        { id: 1, name: "Ravi" },
        { id: 2, name: "John" },
        { id: 3, name: "Arjun" }
    ];

    return (
        <Autocomplete
            label="Select User"
            placeholder="Search..."
            allowsCustomValue={false}
        >
            {users.map((user) => (
                <AutocompleteItem key={user.id} value={user.name}>
                    {user.name}
                </AutocompleteItem>
            ))}
        </Autocomplete>
    );
}
