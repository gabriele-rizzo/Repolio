"use client";

import { requestAccess } from "@/actions/auth/request-access";
import { accessRequestSchema } from "@/lib/access-request/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { DynamicForm } from "../dynamic-form";

/**
 * The public request-access form.
 *
 * The schema comes from lib/access-request/schema.ts, the same object the server action validates with,
 * so the message a visitor sees under a field and the rule that actually guards the write are one
 * thing. Nothing here is told whether the address is already a client — the action answers a repeat
 * request exactly like a new one (see the note there), so this form has one success state and no
 * branch that could leak the difference.
 *
 * Confirmation replaces the form rather than being a toast: unlike the admin's enrollment form, this is
 * submitted once and never again, and "did that go through?" is the only question a visitor has left.
 */
export function RegisterForm() {
    const t = useTranslations("register");
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
                            <EmptyTitle>{t("doneTitle")}</EmptyTitle>
                            <EmptyDescription>{t("doneBody")}</EmptyDescription>
                        </EmptyHeader>

                        <EmptyContent className="flex-row justify-center gap-2">
                            <Button variant="outline" render={<Link href="/auth/login">{t("backToLogin")}</Link>} />
                        </EmptyContent>
                    </Empty>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex w-full max-w-md flex-col gap-4">
            <DynamicForm
                schema={accessRequestSchema}
                id="register-form"
                title={t("title")}
                description={t("subtitle")}
                action={(data) => requestAccess(data)}
                onSuccess={() => setSent(true)}
                defaultValues={{ name: "", email: "", company: "" }}
                submitLabel={t("submit")}
                inputs={{
                    name: {
                        label: t("name"),
                        placeholder: t("namePlaceholder"),
                        type: "text",
                        autoComplete: "name",
                        required: true,
                    },
                    email: {
                        label: t("email"),
                        placeholder: t("emailPlaceholder"),
                        type: "email",
                        autoComplete: "email",
                        required: true,
                    },
                    company: {
                        label: t("company"),
                        placeholder: t("companyPlaceholder"),
                        type: "text",
                        autoComplete: "organization",
                    },
                }}
            />

            <div className="flex flex-row items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>{t("haveAccount")}</span>
                <Link href="/auth/login" className="underline transition-colors hover:text-foreground">
                    {t("signIn")}
                </Link>
            </div>
        </div>
    );
}
