"use client";

import { updatePassword } from "@/actions/auth/password";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";

const schema = z.object({
    password: z.string().min(8),
});

interface SetPasswordFormProps {
    onSuccess: () => void;
}

export function SetPasswordForm({ onSuccess }: SetPasswordFormProps) {
    const [error, setError] = useState<Error | null>(null);

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { password: "" },
    });

    const reset = useCallback(() => {
        form.reset();
        setError(null);
    }, [form.reset, setError]);

    const onSubmit = form.handleSubmit(async (data) => {
        await updatePassword(data.password)
            .then(() => onSuccess())
            .catch((error) => setError(error));
    });

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Set Your Password</CardTitle>
                <CardDescription>Invite a new client to the platform.</CardDescription>
            </CardHeader>

            <CardContent>
                <form id="password-update" onSubmit={onSubmit}>
                    <FieldGroup>
                        <Controller
                            name="password"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="password">Password</FieldLabel>

                                    <Input
                                        id="password"
                                        placeholder="••••••••"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        {...field}
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

                    <Button type="submit" form="password-update">
                        Update
                    </Button>
                </Field>

                {error && <p className="text-destructive">{error.message}</p>}
            </CardFooter>
        </Card>
    );
}
