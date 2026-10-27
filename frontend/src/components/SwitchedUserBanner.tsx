import { Button } from "@/components/ui";
import { isSwitchedUser, getOriginalUser, switchBackToOriginal } from "./userSwitch";

interface Props {
    /** Called after switching back so the parent can reload / re-route */
    onSwitchBack: () => void;
}

export default function SwitchedUserBanner({ onSwitchBack }: Props) {
    if (!isSwitchedUser()) return null;

    const original = getOriginalUser();

    return (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-2 mb-4">
            <span>
                Viewing as a switched user
                {original?.userName ? ` — signed in as ${original.userName}` : ""}.
            </span>
            <Button
                size="sm"
                color="warning"
                variant="flat"
                onPress={() => {
                    switchBackToOriginal();
                    onSwitchBack();
                }}
            >
                Switch Back
            </Button>
        </div>
    );
}