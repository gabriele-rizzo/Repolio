import { getCurrentClient } from "@/actions/auth/authorize";
import { LoginErrorToast } from "@/components/forms/login-error-toast";
import { LoginForm } from "@/components/forms/login-form";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
    const user = await getCurrentClient();
    if (user) redirect("/dashboard");

    const [{ error }, t] = await Promise.all([searchParams, getTranslations("auth")]);

    return (
        <>
            <LoginErrorToast error={error} />
            <LoginForm />

            {/* The other way in. Someone who reached the login without an account previously had
                nowhere to go from here — the form's only outcome was a failed password. */}
            <div className="flex flex-row items-center gap-2 text-xs text-muted-foreground">
                <span>{t("noAccount")}</span>
                <Link href="/auth/register" className="underline transition-colors hover:text-foreground">
                    {t("requestAccess")}
                </Link>
            </div>
        </>
    );
}
