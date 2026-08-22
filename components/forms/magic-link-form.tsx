"use client";

import { sendMagicLink } from "@/actions/auth/magic-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import * as z from "zod";
import { DynamicForm } from "../dynamic-form";

const schema = z.object({
    email: z.string().trim().email(),
});

/**
 * Passwordless login: one field, one email, no password to remember.
 *
 * The confirmation is unconditional — it says "we sent a link if that address has an account" whatever
 * the server found, because the action cannot tell us which it was without turning this box into a way
 * to test whether a given agency is a client (see the note in actions/auth/magic-link.ts).
 */
export function MagicLinkForm({ onUsePassword }: { onUsePassword: () => void }) {
    const t = useTranslations("auth");
    const [sent, setSent] = useState(false);

    if (sent) {
        return (
            <Card className="w-full max-w-md">
                <CardContent>
                    <Empty>
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <MailCheck />
                            </EmptyMedia>
                            <EmptyTitle>{t("linkSentTitle")}</EmptyTitle>
                            <EmptyDescription>{t("linkSentBody")}</EmptyDescription>
                        </EmptyHeader>

                        <EmptyContent className="flex-row justify-center gap-2">
                            <Button variant="outline" onClick={onUsePassword}>
                                {t("usePassword")}
                            </Button>
                        </EmptyContent>
                    </Empty>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex w-full max-w-md flex-col gap-4">
            <DynamicForm
                schema={schema}
                id="magic-link-form"
                title={t("magicLinkTitle")}
                description={t("magicLinkSubtitle")}
                action={(data) => sendMagicLink(data)}
                onSuccess={() => setSent(true)}
                defaultValues={{ email: "" }}
                submitLabel={t("sendLink")}
                inputs={{
                    email: {
                        label: t("email"),
                        placeholder: "m@example.com",
                        type: "email",
                        autoComplete: "email",
                        required: true,
                    },
                }}
            />

            <button
                type="button"
                onClick={onUsePassword}
                className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
            >
                {t("usePassword")}
            </button>
        </div>
    );
}
