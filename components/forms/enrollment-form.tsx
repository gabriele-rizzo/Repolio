"use client";

import * as z from "zod";
import { DynamicForm } from "../dynamic-form";

const schema = z.object({
    email: z.string().email(),
    name: z.string(),
    company: z.string().nullable(),
});

interface EnrollmentFormProps {
    onSuccess: () => void;
    action: (data: z.infer<typeof schema>) => Promise<void>;
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
                    label: "Company",
                    placeholder: "Acme Corp.",
                    type: "text",
                    autoComplete: "company",
                },
            }}
        />
    );
}
