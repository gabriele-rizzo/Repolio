"use client";

import type { ActionResult } from "@/lib/action";
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

type Data<S extends z.ZodRawShape> = {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    [k in keyof z.objectUtil.addQuestionMarks<z.baseObjectOutputType<S>, any>]: z.objectUtil.addQuestionMarks<
        z.baseObjectOutputType<S>,
        any
    >[k];
};

interface DynamicFormProps<S extends z.ZodRawShape> {
    id: string;
    /** Omit both when the surrounding page already carries the heading (the admin pages do). */
    title?: string;
    description?: string;
    /** Overrides the default centred `w-full max-w-md` card, for full-width page layouts. */
    className?: string;
    /** Lay the fields out in columns instead of a single stack. Collapses to one column when narrow. */
    columns?: 1 | 2 | 3;
    schema: z.ZodObject<S>;
    onSuccess?: () => void;
    action: (data: Data<S>) => ActionResult | Promise<ActionResult>;
    defaultValues: Data<S>;
    inputs: Record<keyof S, React.ComponentProps<typeof Input> & { label: string }>;
    submitLabel: string;
    /** Optional cross-field validation (e.g. password confirmation). The error is shown under `path`. */
    refine?: {
        check: (data: Data<S>) => boolean;
        message: string;
        path: string[];
    };
}

export function DynamicForm<S extends z.ZodRawShape>(props: DynamicFormProps<S>) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Field rendering iterates props.schema.shape (a plain object), but the resolver validates a
    // refined version when cross-field rules (e.g. confirm-password) are supplied.
    const resolverSchema = props.refine
        ? props.schema.refine(props.refine.check as (data: any) => boolean, {
              message: props.refine.message,
              path: props.refine.path,
          })
        : props.schema;

    const form = useForm<z.infer<typeof props.schema>>({
        resolver: zodResolver(resolverSchema as any),
        /* eslint-disable @typescript-eslint/no-explicit-any */
        defaultValues: props.defaultValues as any,
    });

    const reset = useCallback(() => {
        if (loading) return;

        form.reset();
        setError(null);
    }, [form, setError, loading]);

    // Surface the failure but keep everything the user typed — re-entering a whole form after a
    // transient error (rate-limit, duplicate email) is exactly the frustration to avoid. Clearing
    // is the explicit "Clear" button's job.
    const onError = useCallback((error: Error) => {
        setError(error);
    }, []);

    const onSubmit = form.handleSubmit(async (data) => {
        if (loading) return;

        setLoading(true);

        await Promise.resolve(props.action(data))
            .then((result) => {
                // Actions return `{ error }` on failure so the real message survives Next.js's
                // production redaction of thrown Server Action errors.
                if (result?.error) onError(new Error(result.error));
                else props.onSuccess?.();
            })
            .catch(onError)
            .finally(() => setLoading(false));
    });

    const columnClass =
        props.columns === 3 ? "sm:grid sm:grid-cols-3" : props.columns === 2 ? "sm:grid sm:grid-cols-2" : undefined;

    return (
        <Card className={cn("w-full max-w-md", props.className)}>
            {props.title && (
                <CardHeader>
                    <CardTitle>{props.title}</CardTitle>
                    {props.description && <CardDescription>{props.description}</CardDescription>}
                </CardHeader>
            )}

            <CardContent>
                <form id={props.id} onSubmit={onSubmit}>
                    <FieldGroup className={columnClass}>
                        {Object.keys(props.schema.shape).map((key) => (
                            <Controller
                                key={key}
                                name={key as any}
                                control={form.control}
                                render={({ field, fieldState }) => {
                                    const { label, ...p } = props.inputs[key];

                                    return (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor={key}>{label}</FieldLabel>
                                            <Input {...p} {...(field as ControllerRenderProps)} id={key} />
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

                {error && (
                    <p
                        role="alert"
                        className="w-full rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                        {error.message}
                    </p>
                )}
            </CardFooter>
        </Card>
    );
}
