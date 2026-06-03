"use client";

import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";

interface DateRangePickerProps {
    from: Date;
    to: Date;
    onChange: (range: { from: Date; to: Date }) => void;
    className?: string;
}

const short = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Compact single-button replacement for the two From/To pickers: shows the window and opens a range calendar. */
export function DateRangePicker({ from, to, onChange, className }: DateRangePickerProps) {
    const [open, setOpen] = useState(false);
    const [range, setRange] = useState<DateRange | undefined>({ from, to });

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (next) setRange({ from, to }); // reflect the current window each time it opens
            }}
        >
            <PopoverTrigger
                render={
                    <Button variant="outline" className={cn("font-normal", className)}>
                        <CalendarIcon />
                        <span className="truncate">
                            {short(from)} – {short(to)}
                        </span>
                    </Button>
                }
            />

            <PopoverContent className="w-auto overflow-hidden p-0" align="end" sideOffset={8}>
                <Calendar
                    mode="range"
                    selected={range}
                    defaultMonth={from}
                    numberOfMonths={2}
                    onSelect={(next) => {
                        setRange(next);
                        if (next?.from && next?.to) {
                            onChange({ from: next.from, to: next.to });
                            setOpen(false);
                        }
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}
