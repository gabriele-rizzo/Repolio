import { getCurrentClient } from "@/actions/auth/authorize";
import { LoginErrorToast } from "@/components/forms/login-error-toast";
import { LoginForm } from "@/components/forms/login-form";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
    const user = await getCurrentClient();
    if (user) redirect("/dashboard");

    const { error } = await searchParams;

    return (
        <>
            <LoginErrorToast error={error} />
            <LoginForm />
        </>
    );
}
