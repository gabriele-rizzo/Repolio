"use client";

import { updateRecurrence } from "@/actions/account/update-recurrence";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

const PRESETS = [
    { key: "weekly", days: 7 },
    { key: "biweekly", days: 14 },
    { key: "monthly", days: 30 },
    { key: "quarterly", days: 90 },
] as const;

export function RecurrenceSettings({ ndays }: { ndays: number }) {
    const t = useTranslations("account.cadence");
    const [optimistic, setOptimistic] = useState<number | null>(null);
    const [pending, setPending] = useState<number | null>(null);

    const current = optimistic ?? ndays;

    async function save(days: number) {
        if (days === current || pending !== null) return;

        setOptimistic(days);
        setPending(days);

        try {
            await updateRecurrence(days);
            toast.success(t("updated"));
        } catch (error) {
            setOptimistic(null);
            toast.error(error instanceof Error ? error.message : t("error"));
        } finally {
            setPending(null);
        }
    }

    return (
        <Card className="gap-4 p-4">
            <div className="space-y-1">
                <Typo as="large" className="text-base">
                    {t("title")}
                </Typo>
                <Typo as="muted" className="text-sm">
                    {t("description", { days: current })}
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
                            {t(preset.key)}
                        </Button>
                    );
                })}
            </div>
        </Card>
    );
}
