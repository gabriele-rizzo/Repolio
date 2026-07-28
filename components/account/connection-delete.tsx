"use client";

import { deleteConnection } from "@/actions/account/delete-connection";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LoaderCircle, Trash } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

interface ConnectionDeleteProps {
    connectionId: number;
    platform: string;
}

export function ConnectionDelete({ connectionId, platform }: ConnectionDeleteProps) {
    const t = useTranslations("account.connections");
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    async function onDelete() {
        setLoading(true);

        try {
            await deleteConnection(connectionId);
            toast.success(t("removed"));
            setOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t("removeError"));
        } finally {
            setLoading(false);
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("removeLabel")}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                        <Trash />
                    </Button>
                }
            />

            <PopoverContent align="end" className="w-72 gap-3">
                <div className="flex flex-col gap-1">
                    <Typo as="normal" className="text-sm font-medium">
                        {t("removeTitle")}
                    </Typo>
                    <Typo as="muted" className="text-xs">
                        {t("removeBody", { platform })}
                    </Typo>
                </div>

                <div className="flex flex-row justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        {t("cancel")}
                    </Button>
                    <Button variant="destructive" onClick={onDelete} disabled={loading}>
                        {loading && <LoaderCircle className="animate-spin" />}
                        {t("remove")}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
