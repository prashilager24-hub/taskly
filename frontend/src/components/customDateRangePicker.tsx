import { useState, useCallback, useMemo } from "react";
import moment from "moment";
import {
    DateRangePicker,
    Popover,
    PopoverTrigger,
    PopoverContent,
    Button,
} from "@heroui/react";

import { today, getLocalTimeZone } from "@internationalized/date";

interface Props {
    datePick?: (range: { startDate: moment.Moment; endDate: moment.Moment }) => void;
}

const getEstOffset = (): number => {
    const currentTime = parseInt(moment().format("HHmm"), 10);
    return currentTime < 1030 ? 3 : 2;
};

const getDefaultRange = (estOffset: number) => ({
    start: moment().subtract(estOffset > 2 ? 8 : 7, "days"),
    end: moment().subtract(estOffset > 2 ? 2 : 1, "days"),
});

export default function CustomDateRangePicker({ datePick }: Props) {
    const estOffset = useMemo(() => getEstOffset(), []);
    const defaultRange = useMemo(() => getDefaultRange(estOffset), [estOffset]);

    const [range, setRange] = useState<{ start: moment.Moment; end: moment.Moment }>(defaultRange);
    const [showCalendar, setShowCalendar] = useState(false);

    const apply = useCallback(
        (start: moment.Moment, end: moment.Moment) => {
            setRange({ start, end });
            datePick?.({ startDate: start, endDate: end });
        },
        [datePick]
    );

    const label = useMemo(
        () => `${range.start.format("MMM D, YYYY")} - ${range.end.format("MMM D, YYYY")}`,
        [range.start, range.end]
    );

    const yesterday = useCallback(() => {
        const y = moment().subtract(estOffset > 2 ? 3 : 2, "days");
        apply(y, y);
    }, [estOffset, apply]);

    const last7Days = useCallback(() => {
        apply(
            moment().subtract(estOffset > 2 ? 8 : 7, "days"),
            moment().subtract(estOffset > 2 ? 2 : 1, "days")
        );
    }, [estOffset, apply]);

    const last30Days = useCallback(() => {
        apply(
            moment().subtract(estOffset > 2 ? 32 : 31, "days"),
            moment().subtract(estOffset > 2 ? 2 : 1, "days")
        );
    }, [estOffset, apply]);

    const thisMonth = useCallback(() => {
        apply(moment().startOf("month"), moment().endOf("month"));
    }, [apply]);

    const lastMonth = useCallback(() => {
        apply(
            moment().subtract(1, "month").startOf("month"),
            moment().subtract(1, "month").endOf("month")
        );
    }, [apply]);

    const handleCustomChange = useCallback(
        (value: { start: Date; end: Date } | null) => {
            if (!value) return;
            const s = moment(value.start.toString());
            const e = moment(value.end.toString());
            apply(s, e);
            setShowCalendar(false);
        },
        [apply]
    );

    return (
        <Popover placement="bottom-start">
            <PopoverTrigger>
                <Button variant="bordered" className="min-w-[240px] justify-start">
                    <i className="bx bx-calendar mr-2" />
                    {label}
                </Button>
            </PopoverTrigger>

            <PopoverContent className="p-0 w-60 shadow-md rounded-lg text-sm">
                <div className="flex flex-col">
                    <button className="hover:bg-gray-100 p-3 text-left" onClick={yesterday}>
                        Yesterday
                    </button>

                    <button className="hover:bg-gray-100 p-3 text-left" onClick={last7Days}>
                        Last 7 Days
                    </button>

                    <button className="hover:bg-gray-100 p-3 text-left" onClick={last30Days}>
                        Last 30 Days
                    </button>

                    <button className="hover:bg-gray-100 p-3 text-left" onClick={thisMonth}>
                        This Month
                    </button>

                    <button className="hover:bg-gray-100 p-3 text-left" onClick={lastMonth}>
                        Last Month
                    </button>

                    <div className="p-3">
                        <DateRangePicker
                            label="Custom"
                            size="sm"
                            maxValue={today(getLocalTimeZone())}
                            onChange={handleCustomChange}
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
