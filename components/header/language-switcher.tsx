"use client";

import { updateLocale } from "@/actions/account/update-locale";
import { AUTO_LOCALE, LOCALES } from "@/i18n/locales";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Check, Globe, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface LanguageSwitcherProps {
    /** The language currently in effect. */
    locale: string;
    /** Whether it was detected rather than chosen — drives which row shows the tick. */
    auto: boolean;
}

/**
 * Language control for the dashboard header.
 *
 * Offers the three languages plus "Automatic", which follows the browser's language (falling back to
 * the visitor's country). Automatic still resolves to a concrete language immediately, because the
 * client's reports are written in whatever is stored — so the trigger always shows the language that
 * is actually in effect, with a hint when it was detected rather than picked.
 */
export function LanguageSwitcher({ locale, auto }: LanguageSwitcherProps) {
    const t = useTranslations("account.language");
    const tLocale = useTranslations("locale");
    const [pending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);

    function choose(choice: string) {
        if (pending) return;
        setOpen(false);

        startTransition(async () => {
            try {
                const result = await updateLocale(choice);
                toast.success(
                    choice === AUTO_LOCALE ? t("autoApplied", { language: tLocale(result.locale) }) : t("updated"),
                );
            } catch (error) {
                toast.error(error instanceof Error ? error.message : t("error"));
            }
        });
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger
                render={
                    <Button variant="ghost" size="icon-lg" aria-label={t("title")} disabled={pending}>
                        {pending ? <LoaderCircle className="animate-spin" /> : <Globe />}
                        <span className="sr-only">{t("title")}</span>
                    </Button>
                }
            />

            <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem onClick={() => choose(AUTO_LOCALE)}>
                    <Check className={cn("size-3.5 shrink-0", auto ? "opacity-100" : "opacity-0")} />
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate">{t("automatic")}</span>
                        {auto && (
                            <span className="truncate text-[0.7rem] text-muted-foreground">{tLocale(locale)}</span>
                        )}
                    </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {LOCALES.map((option) => (
                    <DropdownMenuItem key={option} onClick={() => choose(option)}>
                        <Check
                            className={cn("size-3.5 shrink-0", !auto && option === locale ? "opacity-100" : "opacity-0")}
                        />
                        <span className="truncate">{tLocale(option)}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
