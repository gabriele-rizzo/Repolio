"use client";

import { dateFormatRelative } from "@/lib/date/format-relative";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { TimelineView } from "./timeline-view";
import { Calendar } from "./ui/calendar";
import { Field, FieldLabel } from "./ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

function isValidDate(date: Date | undefined) {
    if (!date) return false;

    return !isNaN(date.getTime());
}

interface DatePickerProps {
    label: string;
    date?: Date;
    onChange: (date: Date) => void;
    minDate?: Date;
    maxDate?: Date;
    className?: string;
}

export function DatePicker({ label, date, onChange, minDate, maxDate, className }: DatePickerProps) {
    const id = useId();

    const [open, setOpen] = useState(false);
    const [month, setMonth] = useState<Date | undefined>(date);

    const onSelect = useCallback(
        (date?: Date) => {
            if (!date) return;

            if (minDate && date < minDate) return;
            if (maxDate && date > maxDate) return;

            onChange(date);
            setOpen(false);
        },
        [minDate, maxDate, onChange],
    );

    return (
        <Field className={cn("mx-auto w-48", className)}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>

            <InputGroup>
                <TimelineView
                    render={(now) => (
                        <InputGroupInput
                            id={id}
                            value={date ? dateFormatRelative(date, now) : ""}
                            placeholder="No date selected"
                            onChange={(e) => {
                                const date = new Date(e.target.value);

                                if (!isValidDate(date)) return;

                                if (minDate && date < minDate) return;
                                if (maxDate && date > maxDate) return;

                                onChange(date);
                                setMonth(date);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    setOpen(true);
                                }
                            }}
                        />
                    )}
                />

                <InputGroupAddon align="inline-end">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger
                            render={
                                <InputGroupButton
                                    id="date-picker"
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label="Select date"
                                >
                                    <CalendarIcon />
                                    <span className="sr-only">Select date</span>
                                </InputGroupButton>
                            }
                        />

                        <PopoverContent
                            className="w-auto overflow-hidden p-0"
                            align="end"
                            alignOffset={-8}
                            sideOffset={10}
                        >
                            <Calendar
                                mode="single"
                                selected={date}
                                month={month}
                                onMonthChange={setMonth}
                                onSelect={onSelect}
                                disabled={(date) => {
                                    if (minDate && date < minDate) return true;
                                    if (maxDate && date > maxDate) return true;

                                    return false;
                                }}
                            />
                        </PopoverContent>
                    </Popover>
                </InputGroupAddon>
            </InputGroup>
        </Field>
    );
}
