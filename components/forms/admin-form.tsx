"use client";

import { verifyAdmin } from "@/actions/admin/verify";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Field, FieldError, FieldLabel } from "../ui/field";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "../ui/input-otp";

const schema = z.object({
    code: z.string().length(6),
});

export function AdminForm() {
    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { code: "" },
    });

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Admin Access</CardTitle>
                <CardDescription>Access restricted areas to manage Repolio's resources.</CardDescription>
            </CardHeader>

            <CardContent>
                <form id="admin-auth" onSubmit={form.handleSubmit(({ code }) => verifyAdmin(code))}>
                    <Controller
                        name="code"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor="code">OTP Code</FieldLabel>

                                <InputOTP maxLength={6} autoFocus {...field} className="w-fit! mx-auto">
                                    <InputOTPGroup>
                                        <InputOTPSlot index={0} />
                                        <InputOTPSlot index={1} />
                                        <InputOTPSlot index={2} />
                                    </InputOTPGroup>

                                    <InputOTPSeparator />

                                    <InputOTPGroup>
                                        <InputOTPSlot index={3} />
                                        <InputOTPSlot index={4} />
                                        <InputOTPSlot index={5} />
                                    </InputOTPGroup>
                                </InputOTP>

                                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                            </Field>
                        )}
                    />
                </form>
            </CardContent>

            <CardFooter>
                <Field orientation="horizontal">
                    <Button type="button" variant="outline" onClick={() => form.reset()}>
                        Clear
                    </Button>

                    <Button type="submit" form="admin-auth">
                        Verify
                    </Button>
                </Field>
            </CardFooter>
        </Card>
    );
}
