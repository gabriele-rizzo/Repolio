"use client";

import { login } from "@/actions/auth/login";
import { useTranslations } from "next-intl";
import * as z from "zod";
import { DynamicForm } from "../dynamic-form";

const schema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export function LoginForm() {
    const t = useTranslations("auth");

    return (
        <DynamicForm
            schema={schema}
            id="login-form"
            title={t("welcomeBack")}
            description={t("subtitle")}
            action={async (data) => await login(data.email, data.password)}
            defaultValues={{ email: "", password: "" }}
            submitLabel={t("login")}
            inputs={{
                email: {
                    label: t("email"),
                    placeholder: "m@example.com",
                    type: "email",
                    autoComplete: "email",
                    required: true,
                },
                password: {
                    label: t("password"),
                    placeholder: "••••••••",
                    type: "password",
                    autoComplete: "current-password",
                    required: true,
                },
            }}
        />
    );
}
