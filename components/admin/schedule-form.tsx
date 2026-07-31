"use client";

import { setClientSchedule } from "@/actions/admin/schedule";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    LAST_DAY_OF_MONTH,
    MAX_NDAYS,
    MIN_NDAYS,
    upcomingSlots,
    type RecurrenceMode,
    type Schedule,
} from "@/lib/recurrence/schedule";
import { LoaderCircle, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

const DAY_PRESETS = [7, 14, 30, 90] as const;
/** 1 = monthly, 3 = quarterly, 6 = half-yearly, 12 = yearly. */
const MONTH_INTERVALS = [
    { months: 1, label: "Monthly" },
    { months: 3, label: "Quarterly" },
    { months: 6, label: "Every 6 months" },
    { months: 12, label: "Yearly" },
] as const;

/** How many upcoming report dates to show, so the admin can see the real days before saving. */
const PREVIEW_COUNT = 4;

const utcDay = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const ordinal = (day: number) => (day === LAST_DAY_OF_MONTH ? "Last day" : `${day}.`);

export interface ScheduleFormValues {
    mode: RecurrenceMode;
    ndays: number;
    dayOfMonth: number;
    monthInterval: number;
}

interface ScheduleFormProps {
    clientId: number;
    clientName: string;
    schedule: ScheduleFormValues;
    /** Current anchor as "YYYY-MM-DD", or null when unset. */
    startDate: string | null;
    /** Today as "YYYY-MM-DD", from the server, so the preview matches the cron's UTC day. */
    today: string;
    /** The client's signup day — the anchor the schedule falls back to when none is set. */
    createdAt: string;
}

export function ScheduleForm({ clientId, clientName, schedule, startDate, today, createdAt }: ScheduleFormProps) {
    const [mode, setMode] = useState<RecurrenceMode>(schedule.mode);
    const [days, setDays] = useState(String(schedule.ndays));
    const [dayOfMonth, setDayOfMonth] = useState(schedule.dayOfMonth);
    const [monthInterval, setMonthInterval] = useState(schedule.monthInterval);
    const [anchor, setAnchor] = useState(startDate ?? "");
    const [saving, startSave] = useTransition();

    const parsedDays = Number(days);
    const daysValid = Number.isInteger(parsedDays) && parsedDays >= MIN_NDAYS && parsedDays <= MAX_NDAYS;
    const anchorValid = anchor === "" || /^\d{4}-\d{2}-\d{2}$/.test(anchor);
    const valid = anchorValid && (mode === "MONTHLY" || daysValid);

    // Preview against the effective anchor: the chosen day, or signup when it's cleared — which is
    // exactly what due_clients() falls back to.
    const effectiveAnchor = anchor || createdAt;
    const upcoming = valid
        ? upcomingSlots(
              {
                  mode,
                  anchor: utcDay(effectiveAnchor),
                  ndays: daysValid ? parsedDays : 30,
                  dayOfMonth,
                  monthInterval,
              } satisfies Schedule,
              utcDay(today),
              PREVIEW_COUNT,
          )
        : [];

    const dirty =
        mode !== schedule.mode ||
        days !== String(schedule.ndays) ||
        dayOfMonth !== schedule.dayOfMonth ||
        monthInterval !== schedule.monthInterval ||
        anchor !== (startDate ?? "");

    function onSave() {
        if (!valid) return toast.error("Check the cadence and start date.");

        startSave(async () => {
            const result = await setClientSchedule({
                clientId,
                mode,
                ndays: daysValid ? parsedDays : 30,
                dayOfMonth,
                monthInterval,
                startDate: anchor === "" ? null : anchor,
            });

            if (result?.error) toast.error(result.error);
            else toast.success(`Schedule saved for ${clientName}.`);
        });
    }

    return (
        <Card className="gap-4 p-4">
            <div className="space-y-1">
                <Typo as="large" className="text-base">
                    Report schedule
                </Typo>
                <Typo as="muted" className="text-sm">
                    Reports are generated on a fixed schedule, never drifting: a run that lands late still counts for
                    its own slot, and the next one is measured from the schedule rather than from the late run.
                </Typo>
            </div>

            {/* Mode */}
            <div className="flex flex-wrap gap-2">
                <Button variant={mode === "INTERVAL" ? "default" : "outline"} size="sm" onClick={() => setMode("INTERVAL")} disabled={saving}>
                    Every N days
                </Button>
                <Button variant={mode === "MONTHLY" ? "default" : "outline"} size="sm" onClick={() => setMode("MONTHLY")} disabled={saving}>
                    Day of the month
                </Button>
            </div>

            {mode === "INTERVAL" ? (
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Typo as="muted" className="text-xs uppercase tracking-wide">
                            Repeat every
                        </Typo>
                        <div className="flex flex-row items-center gap-2">
                            <Input
                                type="number"
                                inputMode="numeric"
                                min={MIN_NDAYS}
                                max={MAX_NDAYS}
                                value={days}
                                aria-label="Days between reports"
                                onChange={(e) => setDays(e.target.value)}
                                disabled={saving}
                                className="w-24"
                            />
                            <Typo as="muted" className="text-sm">
                                days
                            </Typo>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {DAY_PRESETS.map((preset) => (
                            <Button
                                key={preset}
                                variant={parsedDays === preset ? "default" : "outline"}
                                size="sm"
                                onClick={() => setDays(String(preset))}
                                disabled={saving}
                            >
                                {preset} days
                            </Button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Typo as="muted" className="text-xs uppercase tracking-wide">
                            On the
                        </Typo>
                        <div className="flex flex-wrap gap-1.5">
                            {/* "Last day" is day 31 clamped to each month's length, so February works. */}
                            {[1, 5, 10, 15, 20, 25, LAST_DAY_OF_MONTH].map((d) => (
                                <Button
                                    key={d}
                                    variant={dayOfMonth === d ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setDayOfMonth(d)}
                                    disabled={saving}
                                >
                                    {ordinal(d)}
                                </Button>
                            ))}
                            <Input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={LAST_DAY_OF_MONTH}
                                value={dayOfMonth}
                                aria-label="Day of the month"
                                onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                                disabled={saving}
                                className="w-20"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Typo as="muted" className="text-xs uppercase tracking-wide">
                            How often
                        </Typo>
                        <div className="flex flex-wrap gap-2">
                            {MONTH_INTERVALS.map(({ months, label }) => (
                                <Button
                                    key={months}
                                    variant={monthInterval === months ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setMonthInterval(months)}
                                    disabled={saving}
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Anchor */}
            <div className="space-y-1.5 border-t pt-4">
                <Typo as="muted" className="text-xs uppercase tracking-wide">
                    Start date
                </Typo>
                <Typo as="muted" className="text-xs">
                    {mode === "MONTHLY"
                        ? "The schedule starts here — a day of the month before this date is skipped."
                        : "The first report lands on this day, and every later one counts from it."}
                </Typo>
                <Input
                    type="date"
                    value={anchor}
                    aria-label="Start date"
                    onChange={(e) => setAnchor(e.target.value)}
                    disabled={saving}
                    className="w-44"
                />
            </div>

            <div className="space-y-1 border-t pt-4">
                {!anchor && (
                    <Typo as="muted" className="text-xs">
                        No start date set — the schedule falls back to this client&apos;s signup day ({createdAt}).
                    </Typo>
                )}

                {upcoming.length > 0 ? (
                    <Typo as="muted" className="text-xs">
                        Next reports:{" "}
                        {upcoming
                            .map((d) =>
                                d.toLocaleDateString("en-GB", {
                                    weekday: "short",
                                    day: "2-digit",
                                    month: "short",
                                    timeZone: "UTC",
                                }),
                            )
                            .join(" · ")}
                    </Typo>
                ) : (
                    <Typo as="muted" className="text-xs">
                        Enter a valid schedule to preview the dates.
                    </Typo>
                )}
            </div>

            <div className="flex flex-row items-center gap-2">
                <Button onClick={onSave} disabled={saving || !dirty || !valid}>
                    {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
                    {saving ? "Saving…" : "Save schedule"}
                </Button>

                {anchor && (
                    <Button variant="ghost" onClick={() => setAnchor("")} disabled={saving}>
                        Clear start date
                    </Button>
                )}
            </div>
        </Card>
    );
}
