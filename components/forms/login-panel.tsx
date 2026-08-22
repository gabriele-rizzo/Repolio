"use client";

import { LoginForm } from "./login-form";
import { MagicLinkForm } from "./magic-link-form";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

/**
 * The two ways to sign in, one at a time.
 *
 * A toggle rather than both forms stacked: they take the same email address, and two boxes asking for
 * it with different buttons underneath is the kind of login page people submit twice. The password form
 * stays the default — it is what every existing client already has — and the magic link is one click
 * away for anyone who never set one, or who is reading their mail on a phone.
 */
export function LoginPanel() {
    const t = useTranslations("auth");
    const [mode, setMode] = useState<"password" | "link">("password");

    if (mode === "link") return <MagicLinkForm onUsePassword={() => setMode("password")} />;

    return (
        <div className="flex w-full max-w-md flex-col gap-4">
            <LoginForm />

            <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                <button
                    type="button"
                    onClick={() => setMode("link")}
                    className="underline transition-colors hover:text-foreground"
                >
                    {t("useMagicLink")}
                </button>

                {/* The other way in, for someone who has no account at all. */}
                <div className="flex flex-row items-center gap-2">
                    <span>{t("noAccount")}</span>
                    <Link href="/auth/register" className="underline transition-colors hover:text-foreground">
                        {t("requestAccess")}
                    </Link>
                </div>
            </div>
        </div>
    );
}
