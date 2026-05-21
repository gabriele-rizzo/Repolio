"use client";

import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { Controller, useForm, type ControllerRenderProps } from "react-hook-form";
import { z } from "zod";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "./ui/input-otp";

type Data<S extends z.ZodRawShape> = {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    [k in keyof z.objectUtil.addQuestionMarks<z.baseObjectOutputType<S>, any>]: z.objectUtil.addQuestionMarks<
        z.baseObjectOutputType<S>,
        any
    >[k];
};

interface DynamicFormProps<S extends z.ZodRawShape> {
    id: string;
    title: string;
    description: string;
    schema: z.ZodObject<S>;
    onSuccess?: () => void;
    action: (data: Data<S>) => void | Promise<void>;
    defaultValues: Data<S>;
    inputs: Record<keyof S, React.ComponentProps<typeof Input> & { label: string; inputType?: "default" | "otp" }>;
    submitLabel: string;
}

export function DynamicForm<S extends z.ZodRawShape>(props: DynamicFormProps<S>) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const form = useForm<z.infer<typeof props.schema>>({
        resolver: zodResolver(props.schema),
        /* eslint-disable @typescript-eslint/no-explicit-any */
        defaultValues: props.defaultValues as any,
    });

    const reset = useCallback(() => {
        if (loading) return;

        form.reset();
        setError(null);
    }, [form.reset, setError, loading]);

    const onSubmit = form.handleSubmit(async (data) => {
        if (loading) return;

        setLoading(true);

        await Promise.resolve(props.action(data))
            .then(() => props.onSuccess?.())
            .catch((error) => setError(error))
            .finally(() => setLoading(false));
    });

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>{props.title}</CardTitle>
                <CardDescription>{props.description}</CardDescription>
            </CardHeader>

            <CardContent>
                <form id={props.id} onSubmit={onSubmit}>
                    <FieldGroup>
                        {Object.keys(props.schema.shape).map((key) => (
                            <Controller
                                key={key}
                                name={key as any}
                                control={form.control}
                                render={({ field, fieldState }) => {
                                    const { label, inputType, ...p } = props.inputs[key];

                                    return (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor={key}>{label}</FieldLabel>

                                            {inputType !== "otp" ? (
                                                <Input {...p} {...(field as ControllerRenderProps)} id={key} />
                                            ) : (
                                                <InputOTP
                                                    maxLength={6}
                                                    autoFocus
                                                    {...p}
                                                    {...(field as any)}
                                                    className={cn(p.className, "w-fit! mx-auto")}
                                                >
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
                                            )}

                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    );
                                }}
                            />
                        ))}
                    </FieldGroup>
                </form>
            </CardContent>

            <CardFooter className="flex flex-col items-start gap-4">
                <Field orientation="horizontal">
                    <Button type="reset" variant="outline" onClick={reset} disabled={loading}>
                        Clear
                    </Button>

                    <Button type={loading ? "button" : "submit"} form={props.id} disabled={loading}>
                        {loading && <LoaderCircle className="animate-spin" />}
                        {props.submitLabel}
                    </Button>
                </Field>

                {error && <p className="text-destructive">{error.message}</p>}
            </CardFooter>
        </Card>
    );
}
