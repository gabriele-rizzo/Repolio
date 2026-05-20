import { authorize } from "@/actions/auth/authorize";
import { LoginForm } from "@/components/forms/login-form";
import { redirect } from "next/navigation";

export default async function LoginPage() {
    const user = await authorize();

    console.log(user);
    if (user) redirect("/dashboard");

    return <LoginForm />;
}
