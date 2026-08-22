import { getCurrentClient } from "@/actions/auth/authorize";
import { RegisterForm } from "@/components/forms/register-form";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

// Public, like the rest of /auth — the whole prefix is in PUBLIC_PREFIXES (lib/supabase/proxy.ts), so
// no routing change was needed to reach this.
//
// Filing a request creates no account and no session; it queues a row an admin reviews on
// /admin/enrollment. The invite that does create the account is the same one manual enrollment sends.

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("register");

    return { title: t("title"), description: t("subtitle") };
}

export default async function RegisterPage() {
    // Someone already signed in has no use for this, exactly as on /auth/login.
    const client = await getCurrentClient();
    if (client) redirect("/dashboard");

    return <RegisterForm />;
}
