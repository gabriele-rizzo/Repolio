"use client";

import { updateRecurrence, updateRecurrenceStart } from "@/actions/account/update-recurrence";
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
import { LoaderCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

const PRESETS = [
    { key: "weekly", days: 7 },
    { key: "biweekly", days: 14 },
    { key: "monthly", days: 30 },
    { key: "quarterly", days: 90 },
] as const;

const MONTH_INTERVALS = [1, 3, 6, 12] as const;
const DAY_CHOICES = [1, 5, 10, 15, 20, 25, LAST_DAY_OF_MONTH] as const;

/** How many upcoming report dates to preview. */
const PREVIEW_COUNT = 3;

const utcDay = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export interface RecurrenceSettingsValues {
    mode: RecurrenceMode;
    ndays: number;
    dayOfMonth: number;
    monthInterval: number;
}

interface RecurrenceSettingsProps {
    schedule: RecurrenceSettingsValues;
    /** The anchor as a "YYYY-MM-DD" day string, or null when the client has never set one. */
    startDate: string | null;
    /** Today as a day string, resolved on the server so the preview doesn't depend on the clock. */
    today: string;
}

export function RecurrenceSettings({ schedule, startDate, today }: RecurrenceSettingsProps) {
    const t = useTranslations("account.cadence");
    const format = useFormatter();

    // Optimistic mirrors, so a click reflects immediately and the schedule preview moves with it.
    const [mode, setMode] = useState<RecurrenceMode>(schedule.mode);
    const [days, setDays] = useState(schedule.ndays);
    const [custom, setCustom] = useState(String(schedule.ndays));
    const [dayOfMonth, setDayOfMonth] = useState(schedule.dayOfMonth);
    const [monthInterval, setMonthInterval] = useState(schedule.monthInterval);
    const [anchor, setAnchor] = useState(startDate);
    const [pending, setPending] = useState<string | null>(null);

    const isPreset = PRESETS.some((p) => p.days === days);

    async function save(next: Partial<RecurrenceSettingsValues>, key: string) {
        if (pending) return;

        const previous = { mode, ndays: days, dayOfMonth, monthInterval };
        const merged = { ...previous, ...next };

        setMode(merged.mode);
        setDays(merged.ndays);
        setCustom(String(merged.ndays));
        setDayOfMonth(merged.dayOfMonth);
        setMonthInterval(merged.monthInterval);
        setPending(key);

        try {
            await updateRecurrence(merged);
            toast.success(t("updated"));
        } catch (error) {
            setMode(previous.mode);
            setDays(previous.ndays);
            setCustom(String(previous.ndays));
            setDayOfMonth(previous.dayOfMonth);
            setMonthInterval(previous.monthInterval);
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
        void save({ mode: "INTERVAL", ndays: parsed }, "custom");
    }

    // Anchored to the client's chosen day when set; otherwise there's nothing to phase-lock to and the
    // schedule follows signup, which only the server knows — so the preview is hidden.
    const upcoming = anchor
        ? upcomingSlots(
              { mode, anchor: utcDay(anchor), ndays: days, dayOfMonth, monthInterval } satisfies Schedule,
              utcDay(today),
              PREVIEW_COUNT,
          )
        : [];

    const tomorrow = new Date(utcDay(today).getTime() + 86_400_000).toISOString().slice(0, 10);

    return (
        <Card className="gap-4 p-4">
            <div className="space-y-1">
                <Typo as="large" className="text-base">
                    {t("title")}
                </Typo>
                <Typo as="muted" className="text-sm">
                    {mode === "MONTHLY"
                        ? t("descriptionMonthly", {
                              day: dayOfMonth === LAST_DAY_OF_MONTH ? t("lastDay") : String(dayOfMonth),
                              months: monthInterval,
                          })
                        : t("description", { days })}
                </Typo>
            </div>

            {/* Mode */}
            <div className="flex flex-wrap gap-2">
                <Button
                    variant={mode === "INTERVAL" ? "default" : "outline"}
                    onClick={() => save({ mode: "INTERVAL" }, "mode-interval")}
                    disabled={pending !== null}
                >
                    {pending === "mode-interval" && <LoaderCircle className="animate-spin" />}
                    {t("modeInterval")}
                </Button>
                <Button
                    variant={mode === "MONTHLY" ? "default" : "outline"}
                    onClick={() => save({ mode: "MONTHLY" }, "mode-monthly")}
                    disabled={pending !== null}
                >
                    {pending === "mode-monthly" && <LoaderCircle className="animate-spin" />}
                    {t("modeMonthly")}
                </Button>
            </div>

            {mode === "INTERVAL" ? (
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {PRESETS.map((preset) => (
                            <Button
                                key={preset.days}
                                variant={preset.days === days ? "default" : "outline"}
                                onClick={() => save({ mode: "INTERVAL", ndays: preset.days }, preset.key)}
                                disabled={pending !== null}
                            >
                                {pending === preset.key && <LoaderCircle className="animate-spin" />}
                                {t(preset.key)}
                            </Button>
                        ))}
                    </div>

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
                                {pending === "custom" ? <LoaderCircle className="animate-spin" /> : null}
                                {t("apply")}
                            </Button>

                            {!isPreset && (
                                <Typo as="muted" className="text-xs">
                                    {t("customActive", { days })}
                                </Typo>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Typo as="muted" className="text-xs uppercase tracking-wide">
                            {t("onThe")}
                        </Typo>
                        <div className="flex flex-wrap gap-1.5">
                            {DAY_CHOICES.map((d) => (
                                <Button
                                    key={d}
                                    size="sm"
                                    variant={dayOfMonth === d ? "default" : "outline"}
                                    onClick={() => save({ mode: "MONTHLY", dayOfMonth: d }, `dom-${d}`)}
                                    disabled={pending !== null}
                                >
                                    {pending === `dom-${d}` && <LoaderCircle className="animate-spin" />}
                                    {d === LAST_DAY_OF_MONTH ? t("lastDay") : d}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Typo as="muted" className="text-xs uppercase tracking-wide">
                            {t("howOften")}
                        </Typo>
                        <div className="flex flex-wrap gap-2">
                            {MONTH_INTERVALS.map((months) => (
                                <Button
                                    key={months}
                                    size="sm"
                                    variant={monthInterval === months ? "default" : "outline"}
                                    onClick={() => save({ mode: "MONTHLY", monthInterval: months }, `mi-${months}`)}
                                    disabled={pending !== null}
                                >
                                    {pending === `mi-${months}` && <LoaderCircle className="animate-spin" />}
                                    {t("everyMonths", { months })}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* The anchor: where the schedule starts. */}
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
