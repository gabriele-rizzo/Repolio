"use client";

import { updateRecurrence, updateRecurrenceStart } from "@/actions/account/update-recurrence";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MAX_NDAYS, MIN_NDAYS, normalizeNdays, upcomingSlots } from "@/lib/recurrence/schedule";
import { Check, LoaderCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

const PRESETS = [
    { key: "weekly", days: 7 },
    { key: "biweekly", days: 14 },
    { key: "monthly", days: 30 },
    { key: "quarterly", days: 90 },
] as const;

/** How many upcoming report dates to preview. */
const PREVIEW_COUNT = 3;

interface RecurrenceSettingsProps {
    ndays: number;
    /** The anchor as a "YYYY-MM-DD" day string, or null when the client has never set one. */
    startDate: string | null;
    /** Today as a day string, resolved on the server so the preview doesn't depend on the clock. */
    today: string;
}

export function RecurrenceSettings({ ndays, startDate, today }: RecurrenceSettingsProps) {
    const t = useTranslations("account.cadence");
    const format = useFormatter();

    // Optimistic mirrors, so a click reflects immediately and the schedule preview moves with it.
    const [days, setDays] = useState(ndays);
    const [anchor, setAnchor] = useState(startDate);
    const [custom, setCustom] = useState(String(ndays));
    const [pending, setPending] = useState<string | null>(null);

    const isPreset = PRESETS.some((p) => p.days === days);

    async function saveDays(next: number, key: string) {
        if (next === days || pending) return;

        const previous = days;
        setDays(next);
        setCustom(String(next));
        setPending(key);

        try {
            await updateRecurrence(next);
            toast.success(t("updated"));
        } catch (error) {
            setDays(previous);
            setCustom(String(previous));
            toast.error(error instanceof Error ? error.message : t("error"));
        } finally {
            setPending(null);
        }
    }

    async function saveAnchor(next: string | null) {
        if (next === anchor || pending) return;

        const previous = anchor;
        setAnchor(next);
        setPending("anchor");

        try {
            await updateRecurrenceStart(next);
            toast.success(t("startUpdated"));
        } catch (error) {
            setAnchor(previous);
            toast.error(error instanceof Error ? error.message : t("error"));
        } finally {
            setPending(null);
        }
    }

    function onCustomCommit() {
        const parsed = Number(custom);
        if (!Number.isInteger(parsed) || parsed < MIN_NDAYS || parsed > MAX_NDAYS) {
            setCustom(String(days));
            return toast.error(t("customInvalid", { min: MIN_NDAYS, max: MAX_NDAYS }));
        }
        void saveDays(parsed, "custom");
    }

    // Anchored to the client's chosen day when set; otherwise there's nothing to phase-lock to and the
    // schedule follows signup, which only the server knows — so the preview is hidden.
    const upcoming = anchor
        ? upcomingSlots(new Date(`${anchor}T00:00:00.000Z`), days, new Date(`${today}T00:00:00.000Z`), PREVIEW_COUNT)
        : [];

    const tomorrow = new Date(new Date(`${today}T00:00:00.000Z`).getTime() + 86_400_000).toISOString().slice(0, 10);

    return (
        <Card className="gap-4 p-4">
            <div className="space-y-1">
                <Typo as="large" className="text-base">
                    {t("title")}
                </Typo>
                <Typo as="muted" className="text-sm">
                    {t("description", { days: normalizeNdays(days) })}
                </Typo>
            </div>

            <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                    <Button
                        key={preset.days}
                        variant={preset.days === days ? "default" : "outline"}
                        onClick={() => saveDays(preset.days, preset.key)}
                        disabled={pending !== null}
                    >
                        {pending === preset.key && <LoaderCircle className="animate-spin" />}
                        {t(preset.key)}
                    </Button>
                ))}
            </div>

            {/* Any other cadence, in whole days. */}
            <div className="space-y-2 border-t pt-4">
                <Typo as="muted" className="text-xs uppercase tracking-wide">
                    {t("customLabel")}
                </Typo>

                <div className="flex flex-row items-center gap-2">
                    <Input
                        type="number"
                        inputMode="numeric"
                        min={MIN_NDAYS}
                        max={MAX_NDAYS}
                        value={custom}
                        aria-label={t("customLabel")}
                        onChange={(e) => setCustom(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && onCustomCommit()}
                        disabled={pending !== null}
                        className="w-24"
                    />
                    <Typo as="muted" className="text-sm">
                        {t("daysUnit")}
                    </Typo>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onCustomCommit}
                        disabled={pending !== null || custom === String(days)}
                    >
                        {pending === "custom" ? <LoaderCircle className="animate-spin" /> : <Check />}
                        {t("apply")}
                    </Button>

                    {!isPreset && (
                        <Typo as="muted" className="text-xs">
                            {t("customActive", { days: normalizeNdays(days) })}
                        </Typo>
                    )}
                </div>
            </div>

            {/* The anchor: which day the cycle lands on. */}
            <div className="space-y-2 border-t pt-4">
                <Typo as="muted" className="text-xs uppercase tracking-wide">
                    {t("startLabel")}
                </Typo>
                <Typo as="muted" className="text-sm">
                    {t("startHelp")}
                </Typo>

                <div className="flex flex-row flex-wrap items-center gap-2">
                    <Input
                        type="date"
                        value={anchor ?? ""}
                        // Future only — a past or same-day anchor would come due at once, letting a
                        // client generate reports on demand. Mirrors the check in the server action.
                        min={tomorrow}
                        aria-label={t("startLabel")}
                        onChange={(e) => saveAnchor(e.target.value || null)}
                        disabled={pending !== null}
                        className="w-44"
                    />

                    {pending === "anchor" && <LoaderCircle className="size-4 animate-spin" />}

                    {anchor && (
                        <Button variant="ghost" size="sm" onClick={() => saveAnchor(null)} disabled={pending !== null}>
                            {t("startClear")}
                        </Button>
                    )}
                </div>

                {upcoming.length > 0 ? (
                    <Typo as="muted" className="text-xs">
                        {t("startNext")}{" "}
                        {upcoming
                            .map((d) => format.dateTime(d, { day: "2-digit", month: "short", timeZone: "UTC" }))
                            .join(" · ")}
                    </Typo>
                ) : (
                    <Typo as="muted" className="text-xs">
                        {t("startNone")}
                    </Typo>
                )}
            </div>
        </Card>
    );
}
