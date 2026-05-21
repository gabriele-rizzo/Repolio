"use client";

import { login } from "@/actions/auth/login";
import * as z from "zod";
import { DynamicForm } from "../dynamic-form";

const schema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export function LoginForm() {
    return (
        <DynamicForm
            schema={schema}
            id="login-form"
            title="Welcome Back"
            description="Log in into your account to continue"
            action={async (data) => await login(data.email, data.password)}
            defaultValues={{ email: "", password: "" }}
            submitLabel="Login"
            inputs={{
                email: {
                    label: "Email",
                    placeholder: "m@example.com",
                    type: "email",
                    autoComplete: "email",
                    required: true,
                },
                password: {
                    label: "Password",
                    placeholder: "••••••••",
                    type: "password",
                    autoComplete: "current-password",
                    required: true,
                },
            }}
        />
    );
}
