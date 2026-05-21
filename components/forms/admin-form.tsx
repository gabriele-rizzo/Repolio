"use client";

import { verifyAdmin } from "@/actions/admin/verify";
import * as z from "zod";
import { DynamicForm } from "../dynamic-form";

const schema = z.object({
    code: z.string().length(6),
});

export function AdminForm() {
    return (
        <DynamicForm
            id="admin-auth"
            title="Admin Access"
            description="Access restricted areas to manage Repolio's resources."
            schema={schema}
            action={async (data) => await verifyAdmin(data.code)}
            submitLabel="Verify"
            defaultValues={{
                code: "",
            }}
            inputs={{
                code: {
                    inputType: "otp",
                    label: "OTP Code",
                },
            }}
        />
    );
}
