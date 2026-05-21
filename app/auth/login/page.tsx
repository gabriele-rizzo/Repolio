import { authorize } from "@/actions/auth/authorize";
import { LoginForm } from "@/components/forms/login-form";
import { redirect } from "next/navigation";

export default async function LoginPage() {
    const user = await authorize();
    if (user) redirect("/dashboard");

    return <LoginForm />;
}
