"use client";

import { enrollClient } from "@/actions/admin/enroll";
import { useState } from "react";
import { toast } from "sonner";
import { DynamicForm } from "../dynamic-form";
import * as z from "zod";

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

/**
 * The three enrollment fields, laid out across the page like the rest of the admin section.
 *
 * Success is a toast and a cleared form rather than a full-page swap: the page already carries its own
 * heading and a list of recent invites, and replacing all of that with a confirmation card loses both —
 * and makes inviting a second client take an extra click.
 */
export function EnrollmentForm() {
    // Remounting is the reset: DynamicForm holds the field state, so bumping the key clears it.
    const [attempt, setAttempt] = useState(0);

    return (
        <DynamicForm
            key={attempt}
            schema={schema}
            action={(data) => enrollClient(data)}
            onSuccess={() => {
                toast.success("Invite sent.");
                setAttempt((n) => n + 1);
            }}
            id="client-enrollment"
            className="max-w-none"
            columns={3}
            submitLabel="Send invite"
            defaultValues={{ email: "", name: "", company: "" }}
            inputs={{
                name: {
                    label: "Full name",
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
