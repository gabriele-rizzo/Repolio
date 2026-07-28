"use client";

import { updateName } from "@/actions/account/update-name";
import { cn } from "@/lib/utils";
import { LoaderCircle, Pen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

// Shared between the input and the invisible sizer so their widths match exactly.
const FIELD = "rounded-md border border-transparent px-2 py-0.5 text-2xl font-semibold tracking-tight";

export function ProfileName({ name }: { name: string }) {
    const t = useTranslations("account.profile");
    const [value, setValue] = useState(name);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const cancelRef = useRef(false);

    async function save() {
        // Escape resets the value and flags a cancel so blur doesn't save.
        if (cancelRef.current) {
            cancelRef.current = false;
            return;
        }

        const trimmed = value.trim();

        if (trimmed === name) {
            setValue(name); // normalise stray whitespace
            return;
        }

        if (trimmed.length === 0) {
            setValue(name);
            toast.error(t("nameEmpty"));
            return;
        }

        setLoading(true);

        try {
            await updateName(trimmed);
            setValue(trimmed);
            toast.success(t("nameUpdated"));
        } catch (error) {
            setValue(name);
            toast.error(error instanceof Error ? error.message : t("nameError"));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="group/name -ml-2 flex w-fit items-center gap-1">
            {/* The grid + invisible sizer makes the input hug the text width. */}
            <div className="relative grid items-center">
                <span aria-hidden className={cn(FIELD, "invisible col-start-1 row-start-1 whitespace-pre")}>
                    {value || " "}
                </span>

                <input
                    ref={inputRef}
                    value={value}
                    size={1}
                    onChange={(event) => setValue(event.target.value)}
                    onBlur={save}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            inputRef.current?.blur();
                        } else if (event.key === "Escape") {
                            cancelRef.current = true;
                            setValue(name);
                            inputRef.current?.blur();
                        }
                    }}
                    disabled={loading}
                    aria-label={t("editName")}
                    spellCheck={false}
                    maxLength={80}
                    className={cn(
                        FIELD,
                        "col-start-1 row-start-1 w-full min-w-0 bg-transparent outline-none transition-colors",
                        "hover:border-border focus:border-border focus:bg-background disabled:opacity-100",
                    )}
                />
            </div>

            <button
                type="button"
                onClick={() => inputRef.current?.focus()}
                disabled={loading}
                aria-label="Edit your name"
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
                {loading ? <LoaderCircle className="size-3.5 animate-spin" /> : <Pen className="size-3.5" />}
            </button>
        </div>
    );
}
