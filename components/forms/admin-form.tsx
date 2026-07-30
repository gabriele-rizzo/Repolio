"use client";

import { verifyAdmin } from "@/actions/admin/verify";
import * as z from "zod";
import { DynamicForm } from "../dynamic-form";

// Only non-emptiness is checked here. The real rule — length, and whether it matches — belongs to the
// server, and a client-side length hint would tell an attacker how long the password is.
const schema = z.object({
    password: z.string().min(1, "Enter the admin password."),
});

export function AdminForm() {
    return (
        <DynamicForm
            id="admin-auth"
            title="Admin Access"
            description="Access restricted areas to manage Repolio's resources."
            schema={schema}
            action={async (data) => await verifyAdmin(data.password)}
            submitLabel="Sign in"
            defaultValues={{ password: "" }}
            inputs={{
                password: {
                    label: "Password",
                    type: "password",
                    autoComplete: "current-password",
                    autoFocus: true,
                    required: true,
                },
            }}
        />
    );
}
