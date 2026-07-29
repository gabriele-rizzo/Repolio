"use client";

import { updateReportContext } from "@/actions/report/update-context";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Typo } from "../typography";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

interface ReportContextEditorProps {
    reportId: number;
    initial: string | null;
}

export function ReportContextEditor({ reportId, initial }: ReportContextEditorProps) {
    const t = useTranslations("report");
    const [value, setValue] = useState(initial ?? "");
    const [saved, setSaved] = useState(initial ?? "");
    const [loading, setLoading] = useState(false);

    const dirty = value.trim() !== saved.trim();

    async function onSave() {
        setLoading(true);

        try {
            await updateReportContext(reportId, value);
            setSaved(value);
            toast.success(t("contextSaved"));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t("contextError"));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-3" id="context">
            <div className="flex flex-row items-center justify-between">
                <div className="flex flex-row items-center gap-1.5">
                    <Typo as="muted" className="text-xs font-medium uppercase tracking-wide">
                        {t("context")}
                    </Typo>
                    <Typo as="muted" className="text-xs font-medium tracking-wide opacity-50">
                        {t("optional")}
                    </Typo>
                </div>

                <Typo
                    as="muted"
                    className="flex flex-row items-center gap-1.5 text-xs font-medium tracking-wide text-purple-300"
                >
                    <ArrowRight className="size-3.5" />
                    {t("helpsAi")}
                </Typo>
            </div>

            <Textarea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={loading}
                maxLength={2000}
                placeholder={t("contextPlaceholder")}
            />

            <div className="flex justify-end print:hidden">
                <Button onClick={onSave} disabled={loading || !dirty}>
                    {loading && <LoaderCircle className="animate-spin" />}
                    {t("saveContext")}
                </Button>
            </div>
        </div>
    );
}
