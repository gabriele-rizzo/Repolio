"use client";

import { updateRecurrence } from "@/actions/account/update-recurrence";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PRESETS = [
    { label: "Weekly", days: 7 },
    { label: "Every 2 weeks", days: 14 },
    { label: "Monthly", days: 30 },
    { label: "Quarterly", days: 90 },
];

export function RecurrenceSettings({ ndays }: { ndays: number }) {
    const [optimistic, setOptimistic] = useState<number | null>(null);
    const [pending, setPending] = useState<number | null>(null);

    const current = optimistic ?? ndays;

    async function save(days: number) {
        if (days === current || pending !== null) return;

        setOptimistic(days);
        setPending(days);

        try {
            await updateRecurrence(days);
            toast.success("Reporting cadence updated.");
        } catch (error) {
            setOptimistic(null);
            toast.error(error instanceof Error ? error.message : "Could not update cadence.");
        } finally {
            setPending(null);
        }
    }

    return (
        <Card className="gap-4 p-4">
            <div className="space-y-1">
                <Typo as="large" className="text-base">
                    Report cadence
                </Typo>
                <Typo as="muted" className="text-sm">
                    How often we generate a new report for each connected ad account. Currently every {current}{" "}
                    {current === 1 ? "day" : "days"}.
                </Typo>
            </div>

            <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => {
                    const active = preset.days === current;

                    return (
                        <Button
                            key={preset.days}
                            variant={active ? "default" : "outline"}
                            onClick={() => save(preset.days)}
                            disabled={pending !== null}
                        >
                            {pending === preset.days && <LoaderCircle className="animate-spin" />}
                            {preset.label}
                        </Button>
                    );
                })}
            </div>
        </Card>
    );
}
