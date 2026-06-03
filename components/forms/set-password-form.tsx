"use client";

import { updatePassword } from "@/actions/auth/password";
import * as z from "zod";
import { DynamicForm } from "../dynamic-form";

const schema = z.object({
    password: z.string().min(8),
    confirm: z.string().min(8),
});

interface SetPasswordFormProps {
    onSuccess: () => void;
}

export function SetPasswordForm({ onSuccess }: SetPasswordFormProps) {
    return (
        <DynamicForm
            schema={schema}
            onSuccess={onSuccess}
            id="set-password"
            title="Set Your Password"
            description="Update your temporary password to a new one that you'll remember."
            defaultValues={{ password: "", confirm: "" }}
            submitLabel="Update"
            action={async (data) => await updatePassword(data.password)}
            refine={{
                check: (data) => data.password === data.confirm,
                message: "Passwords do not match.",
                path: ["confirm"],
            }}
            inputs={{
                password: {
                    label: "Password",
                    type: "password",
                    placeholder: "••••••••",
                    autoComplete: "new-password",
                    required: true,
                },
                confirm: {
                    label: "Confirm password",
                    type: "password",
                    placeholder: "••••••••",
                    autoComplete: "new-password",
                    required: true,
                },
            }}
        />
    );
}
