"use client";

import { login } from "@/actions/auth/login";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";

const schema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export function LoginForm() {
    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { email: "", password: "" },
    });

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Welcome Back</CardTitle>
                <CardDescription>Log in into your account to continue.</CardDescription>
            </CardHeader>

            <CardContent>
                <form id="login" onSubmit={form.handleSubmit(({ email, password }) => login(email, password))}>
                    <FieldGroup>
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

            <CardFooter>
                <Field orientation="horizontal">
                    <Button type="submit" form="login">
                        Login
                    </Button>
                </Field>
            </CardFooter>
        </Card>
    );
}
