"use client";

import { setAccountContext } from "@/actions/admin/account-context";
import { MAX_ACCOUNT_CONTEXT } from "@/lib/report/account-context";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LoaderCircle, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

/**
 * Admin editor for one ad account's standing context — the background every future report on that
 * account is generated with.
 *
 * Separate concern from the template on the same page: the template decides how the report is laid out,
 * this decides what the model knows going in. Nothing here changes reports already generated.
 */
export function AccountContextForm({
    clientId,
    adAccountId,
    accountName,
    initial,
}: {
    clientId: number;
    adAccountId: number;
    accountName: string;
    initial: string | null;
}) {
    const [value, setValue] = useState(initial ?? "");
    const [saved, setSaved] = useState(initial ?? "");
    const [pending, startSave] = useTransition();

    const dirty = value.trim() !== saved.trim();

    function onSave() {
        startSave(async () => {
            const result = await setAccountContext(clientId, adAccountId, value);
            if (result?.error) {
                toast.error(result.error);
                return;
            }

            setSaved(value);
            toast.success(`Context saved for ${accountName}.`);
        });
    }

    return (
        <Card className="gap-3 p-4">
            <div>
                <Typo as="large" className="text-base">
                    Account context
                </Typo>
                <Typo as="muted" className="text-sm">
                    Background the AI is given for every report on {accountName}: what the account is, what to judge it
                    on, known seasonality. Applies from the next generation onwards — it does not change reports that
                    already exist. The client can edit this too, from their report page.
                </Typo>
            </div>

            <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={pending}
                maxLength={MAX_ACCOUNT_CONTEXT}
                rows={5}
                aria-label="Account context"
                placeholder="Lead-generation account — judge on CPL, never ROAS. Target CPL €35. Runs a seasonal push each November."
            />

            <div className="flex flex-row items-center justify-end gap-3">
                <Typo as="muted" className="text-xs">
                    {value.length.toLocaleString("en-US")} / {MAX_ACCOUNT_CONTEXT.toLocaleString("en-US")}
                </Typo>
                <Button size="sm" onClick={onSave} disabled={pending || !dirty}>
                    {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                    Save context
                </Button>
            </div>
        </Card>
    );
}
