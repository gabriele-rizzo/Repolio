import { getCurrentClient } from "@/actions/auth/authorize";
import { LoginErrorToast } from "@/components/forms/login-error-toast";
import { LoginPanel } from "@/components/forms/login-panel";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
    const user = await getCurrentClient();
    if (user) redirect("/dashboard");

    const { error } = await searchParams;

    return (
        <>
            {/* Where /auth/confirm sends a token it could not verify — an expired magic link included. */}
            <LoginErrorToast error={error} />
            <LoginPanel />
        </>
    );
}
