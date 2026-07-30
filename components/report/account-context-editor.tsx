"use client";

import { updateAccountContext } from "@/actions/account/update-account-context";
import { MAX_ACCOUNT_CONTEXT } from "@/lib/report/account-context";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

/**
 * Standing context for the ad account — background the AI gets for every future report on it.
 *
 * Sits next to the per-report note on purpose: they're easy to confuse, and showing them together with
 * different copy is what makes the difference legible ("about the account, always" vs "about this
 * period"). Saving here changes nothing about reports already generated.
 */
export function AccountContextEditor({
    adAccountId,
    accountName,
    initial,
}: {
    adAccountId: number;
    accountName: string;
    initial: string | null;
}) {
    const t = useTranslations("report");
    const [value, setValue] = useState(initial ?? "");
    const [saved, setSaved] = useState(initial ?? "");
    const [pending, startSave] = useTransition();

    const dirty = value.trim() !== saved.trim();

    function onSave() {
        startSave(async () => {
            try {
                await updateAccountContext(adAccountId, value);
                setSaved(value);
                toast.success(t("accountContextSaved"));
            } catch (error) {
                toast.error(error instanceof Error ? error.message : t("contextError"));
            }
        });
    }

    return (
        <div className="space-y-3" id="account-context">
            <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div className="flex flex-row items-center gap-1.5">
                    <Typo as="muted" className="text-xs font-medium uppercase tracking-wide">
                        {t("accountContext")}
                    </Typo>
                    <Typo as="muted" className="text-xs font-medium tracking-wide opacity-50">
                        {t("optional")}
                    </Typo>
                </div>

                <Typo
                    as="muted"
                    className="flex flex-row items-center gap-1.5 text-xs font-medium tracking-wide text-purple-300"
                >
                    <ArrowRight className="size-3.5" />
                    {t("appliesToFuture")}
                </Typo>
            </div>

            <Typo as="muted" className="text-xs">
                {t("accountContextHelp", { account: accountName })}
            </Typo>

            <Textarea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={pending}
                maxLength={MAX_ACCOUNT_CONTEXT}
                placeholder={t("accountContextPlaceholder")}
            />

            <div className="flex flex-row items-center justify-end gap-3 print:hidden">
                <Typo as="muted" className="text-xs">
                    {value.length.toLocaleString("en-US")} / {MAX_ACCOUNT_CONTEXT.toLocaleString("en-US")}
                </Typo>
                <Button onClick={onSave} disabled={pending || !dirty}>
                    {pending && <LoaderCircle className="animate-spin" />}
                    {t("saveContext")}
                </Button>
            </div>
        </div>
    );
}
