"use client";

import { setClientSchedule } from "@/actions/admin/schedule";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MAX_NDAYS, MIN_NDAYS, upcomingSlots } from "@/lib/recurrence/schedule";
import { LoaderCircle, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

const PRESETS = [7, 14, 30, 90] as const;

/** How many upcoming report dates to show, so the admin can see the weekday before saving. */
const PREVIEW_COUNT = 4;

const utcDay = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

interface ScheduleFormProps {
    clientId: number;
    clientName: string;
    ndays: number;
    /** Current anchor as "YYYY-MM-DD", or null when unset. */
    startDate: string | null;
    /** Today as "YYYY-MM-DD", from the server, so the preview matches the cron's UTC day. */
    today: string;
    /** The client's signup day — the anchor the schedule falls back to when none is set. */
    createdAt: string;
}

export function ScheduleForm({ clientId, clientName, ndays, startDate, today, createdAt }: ScheduleFormProps) {
    const [days, setDays] = useState(String(ndays));
    const [anchor, setAnchor] = useState(startDate ?? "");
    const [saving, startSave] = useTransition();

    const parsedDays = Number(days);
    const daysValid = Number.isInteger(parsedDays) && parsedDays >= MIN_NDAYS && parsedDays <= MAX_NDAYS;
    const anchorValid = anchor === "" || /^\d{4}-\d{2}-\d{2}$/.test(anchor);

    // Preview against the effective anchor: the chosen day, or signup when it's cleared — which is
    // exactly what due_clients() falls back to.
    const effectiveAnchor = anchor || createdAt;
    const upcoming =
        daysValid && anchorValid ? upcomingSlots(utcDay(effectiveAnchor), parsedDays, utcDay(today), PREVIEW_COUNT) : [];

    const dirty = days !== String(ndays) || anchor !== (startDate ?? "");

    function onSave() {
        if (!daysValid) return toast.error(`Cadence must be a whole number of days (${MIN_NDAYS}–${MAX_NDAYS}).`);
        if (!anchorValid) return toast.error("That isn't a valid start date.");

        startSave(async () => {
            const result = await setClientSchedule({
                clientId,
                ndays: parsedDays,
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
                    The first report lands on the start date, then every {daysValid ? parsedDays : "—"} days from it.
                    The start date fixes the weekday: anchor a client to a Saturday and their reports stay on Saturdays,
                    even if a run is late.
                </Typo>
            </div>

            <div className="flex flex-row flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                    <Typo as="muted" className="text-xs uppercase tracking-wide">
                        First report on
                    </Typo>
                    <Input
                        type="date"
                        value={anchor}
                        aria-label="First report date"
                        onChange={(e) => setAnchor(e.target.value)}
                        disabled={saving}
                        className="w-44"
                    />
                </div>

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
            </div>

            <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
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
                        Enter a valid cadence to preview the schedule.
                    </Typo>
                )}
            </div>

            <div className="flex flex-row items-center gap-2">
                <Button onClick={onSave} disabled={saving || !dirty || !daysValid || !anchorValid}>
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
