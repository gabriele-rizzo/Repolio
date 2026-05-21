"use client";

import { updatePassword } from "@/actions/auth/password";
import * as z from "zod";
import { DynamicForm } from "../dynamic-form";

const schema = z.object({
    password: z.string().min(8),
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
            defaultValues={{ password: "" }}
            submitLabel="Update"
            action={async (data) => await updatePassword(data.password)}
            inputs={{
                password: { label: "Password", placeholder: "••••••••", autoComplete: "new-password", required: true },
            }}
        />
    );
}
