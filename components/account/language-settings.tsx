"use client";

import { updateLocale } from "@/actions/account/update-locale";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

const LANGS = ["de", "en", "it"] as const;

export function LanguageSettings({ locale }: { locale: string }) {
    const t = useTranslations("account.language");
    const tLocale = useTranslations("locale");
    const [pending, setPending] = useState<string | null>(null);

    async function save(next: string) {
        if (next === locale || pending !== null) return;

        setPending(next);
        try {
            await updateLocale(next);
            toast.success(t("updated"));
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
                {LANGS.map((lang) => (
                    <Button
                        key={lang}
                        variant={lang === locale ? "default" : "outline"}
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
