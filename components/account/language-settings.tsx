"use client";

import { updateLocale } from "@/actions/account/update-locale";
import { AUTO_LOCALE } from "@/i18n/locales";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

const LANGS = ["de", "en", "it"] as const;

export function LanguageSettings({ locale, auto }: { locale: string; auto: boolean }) {
    const t = useTranslations("account.language");
    const tLocale = useTranslations("locale");
    const [pending, setPending] = useState<string | null>(null);

    async function save(next: string) {
        // Re-selecting the active language is a no-op, but re-selecting Automatic is not — it re-runs
        // detection, which is the whole point of pressing it again.
        if (pending !== null || (next !== AUTO_LOCALE && !auto && next === locale)) return;

        setPending(next);
        try {
            const result = await updateLocale(next);
            toast.success(
                next === AUTO_LOCALE ? t("autoApplied", { language: tLocale(result.locale) }) : t("updated"),
            );
        } catch (error) {
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
                    {t("description")}
                </Typo>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    variant={auto ? "default" : "outline"}
                    onClick={() => save(AUTO_LOCALE)}
                    disabled={pending !== null}
                >
                    {pending === AUTO_LOCALE && <LoaderCircle className="animate-spin" />}
                    {t("automatic")}
                </Button>

                {LANGS.map((lang) => (
                    <Button
                        key={lang}
                        variant={!auto && lang === locale ? "default" : "outline"}
                        onClick={() => save(lang)}
                        disabled={pending !== null}
                    >
                        {pending === lang && <LoaderCircle className="animate-spin" />}
                        {tLocale(lang)}
                    </Button>
                ))}
            </div>
        </Card>
    );
}
