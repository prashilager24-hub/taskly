import { useState, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { CalendarDate } from "@internationalized/date";
import "react-day-picker/dist/style.css";
import { useDashboardStore } from "@/store/commonStore";
interface Props {
    value?: CalendarDate;
    onChange: (date: CalendarDate) => void;
}

export default function CustomDatePicker({ value, onChange }: Props) {
    const dateModification = useDashboardStore((state) => state.dateModification);
    const [selected, setSelected] = useState<Date | undefined>(
        value
            ? new Date(value.year, value.month - 1, value.day)
            : undefined
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pastDate = new Date(today);

    const day = today.getDay();

    let daysToSubtract = 4;

    // If Monday → go back to Friday
    // if (day === 1) {
    //     daysToSubtract = 4;
    // }

    // // If Sunday → go back to Friday
    // if (day === 0) {
    //     daysToSubtract = 2;
    // }

    // // If Saturday → go back to Thursday
    // if (day === 6) {
    //     daysToSubtract = 1;
    // }


    pastDate.setDate(today.getDate() - daysToSubtract);

    return (
        <div className="border rounded-lg p-3 bg-white dark:bg-ink-900 shadow-sm w-fit">
            <DayPicker
                mode="single"
                selected={selected}
                onSelect={(date) => {
                    if (!date) return;

                    setSelected(date);

                    onChange(
                        new CalendarDate(
                            date.getFullYear(),
                            date.getMonth() + 1,
                            date.getDate()
                        )
                    );
                }}
                disabled={
                    // dateModification
                    //     ? [{ before: pastDate }, { after: today }]
                    //     : [{ after: today }]
                    { after: today }
                }
            />

            {selected && (
                <div className="text-xs text-ink-600 dark:text-ink-300 mt-2 text-center">
                    Selected: {format(selected, "dd MMM yyyy")}
                </div>
            )}
        </div>
    );
}


// import { useState, useCallback } from "react";
// import { DayPicker } from "react-day-picker";
// import { format } from "date-fns";
// import { CalendarDate } from "@internationalized/date";
// import "react-day-picker/dist/style.css";
// import { useDashboardStore } from "@/store/commonStore";

// interface Props {
//     value?: CalendarDate;
//     onChange: (date: CalendarDate) => void;
// }

// export default function CustomDatePicker({ value, onChange }: Props) {
//     const dateModification = useDashboardStore((state) => state.dateModification);
//     const [selected, setSelected] = useState<Date | undefined>(
//         value ? new Date(value.year, value.month - 1, value.day) : undefined
//     );

//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     const pastDate = new Date(today);
//     pastDate.setDate(today.getDate() - 4);

//     const handleSelect = useCallback(
//         (date: Date | undefined) => {
//             if (!date) return;

//             setSelected(date);
//             onChange(
//                 new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
//             );
//         },
//         [onChange]
//     );

//     const disabled = dateModification
//         ? [{ before: pastDate }, { after: today }]
//         : [{ after: today }];

//     return (
//         <div className="border rounded-lg p-3 bg-white dark:bg-ink-900 shadow-sm w-fit">
//             <DayPicker
//                 mode="single"
//                 selected={selected}
//                 onSelect={handleSelect}
//                 disabled={disabled}
//             />
//             {selected && (
//                 <div className="text-xs text-ink-600 dark:text-ink-300 mt-2 text-center">
//                     Selected: {format(selected, "dd MMM yyyy")}
//                 </div>
//             )}
//         </div>
//     );
// }

