"use client";

import type { ActionResult } from "@/lib/action";
import * as z from "zod";
import { DynamicForm } from "../dynamic-form";

const schema = z.object({
    name: z.string().trim().min(1, "Please enter the client's name."),
    email: z.string().trim().email("Enter a valid email address."),
    // Optional: an empty box submits as null rather than "" so it lands as a null Client.company.
    company: z
        .string()
        .trim()
        .transform((v) => v || null)
        .nullable(),
});

interface EnrollmentFormProps {
    onSuccess: () => void;
    action: (data: z.infer<typeof schema>) => Promise<ActionResult>;
}

export function EnrollmentForm({ onSuccess, action }: EnrollmentFormProps) {
    return (
        <DynamicForm
            onSuccess={onSuccess}
            schema={schema}
            action={action}
            id="client-enrollment"
            title="Client Enrollment"
            description="Invite a new client to the platform."
            submitLabel="Invite"
            defaultValues={{ email: "", name: "", company: "" }}
            inputs={{
                name: {
                    label: "Full Name",
                    placeholder: "John Doe",
                    type: "text",
                    autoComplete: "name",
                    required: true,
                },
                email: {
                    label: "Email",
                    placeholder: "m@example.com",
                    type: "email",
                    autoComplete: "email",
                    required: true,
                },
                company: {
                    label: "Company (optional)",
                    placeholder: "Acme Corp.",
                    type: "text",
                    autoComplete: "organization",
                },
            }}
        />
    );
}
