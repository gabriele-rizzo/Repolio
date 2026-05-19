"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";

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
    const [error, setError] = useState<Error | null>(null);

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { email: "", name: "", company: "" },
    });

    const reset = useCallback(() => {
        form.reset();
        setError(null);
    }, [form.reset, setError]);

    const onSubmit = form.handleSubmit(async (data) => {
        await action(data)
            .then(() => onSuccess())
            .catch((error) => setError(error));
    });

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Client Enrollment</CardTitle>
                <CardDescription>Invite a new client to the platform.</CardDescription>
            </CardHeader>

            <CardContent>
                <form id="client-enrollment" onSubmit={onSubmit}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="name">Full Name</FieldLabel>

                                    <Input
                                        id="name"
                                        placeholder="John Doe"
                                        type="text"
                                        autoComplete="name"
                                        required
                                        {...field}
                                    />

                                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />

                        <Controller
                            name="email"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="email">Email</FieldLabel>

                                    <Input
                                        id="email"
                                        placeholder="m@example.com"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        {...field}
                                    />

                                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />

                        <Controller
                            name="company"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="company">Company</FieldLabel>

                                    <Input
                                        id="company"
                                        placeholder="Acme Corp."
                                        type="text"
                                        autoComplete="company"
                                        {...field}
                                        value={field.value ?? undefined}
                                    />

                                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
            </CardContent>

            <CardFooter className="flex flex-col items-start gap-4">
                <Field orientation="horizontal">
                    <Button type="button" variant="outline" onClick={reset}>
                        Clear
                    </Button>

                    <Button type="submit" form="client-enrollment">
                        Invite
                    </Button>
                </Field>

                {error && <p className="text-destructive">{error.message}</p>}
            </CardFooter>
        </Card>
    );
}
