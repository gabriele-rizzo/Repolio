"use client";

import {
    applyPresetToClient,
    previewClientTemplate,
    resetClientTemplate,
    setClientTemplate,
} from "@/actions/admin/template";
import { TemplateEditor } from "@/components/report/template-editor";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TEMPLATE_PRESETS } from "@/lib/report/template/presets";
import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

/**
 * Admin template editing for one client scope: the shared editor bound to the admin actions, plus a
 * one-click preset applier for setting a client up without touching the editor at all.
 */
export function TemplateAdminEditor({
    clientId,
    clientName,
    adAccountId,
    scopeLabel,
    scopeHelp,
    initialBody,
    stored,
}: {
    clientId: number;
    clientName: string;
    adAccountId: number | null;
    scopeLabel: string;
    scopeHelp: string;
    initialBody: string;
    stored: boolean;
}) {
    const [applying, startApply] = useTransition();
    const [confirming, setConfirming] = useState<string | null>(null);

    function apply(presetId: string, presetName: string) {
        if (confirming !== presetId) return setConfirming(presetId);
        setConfirming(null);

        startApply(async () => {
            try {
                await applyPresetToClient(clientId, presetId, adAccountId);
                toast.success(`Applied "${presetName}" to ${scopeLabel}.`);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not apply the preset.");
            }
        });
    }

    return (
        <div className="space-y-4">
            <Card className="gap-3 p-4">
                <div>
                    <Typo as="large" className="text-base">
                        Apply a preset
                    </Typo>
                    <Typo as="muted" className="text-sm">
                        Saves that preset straight onto {scopeLabel} for {clientName}. This replaces whatever is
                        currently stored for this scope, including the client&apos;s own edits.
                    </Typo>
                </div>

                <div className="flex flex-row flex-wrap gap-2">
                    {TEMPLATE_PRESETS.map((preset) => (
                        <Button
                            key={preset.id}
                            variant={confirming === preset.id ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => apply(preset.id, preset.name)}
                            disabled={applying}
                        >
                            {applying && confirming === preset.id && <LoaderCircle className="animate-spin" />}
                            {confirming === preset.id ? `Confirm — overwrite with ${preset.name}` : preset.name}
                        </Button>
                    ))}

                    {confirming && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirming(null)} disabled={applying}>
                            Cancel
                        </Button>
                    )}
                </div>
            </Card>

            <TemplateEditor
                // Remount on scope change so the editor loads that scope's body, not the previous one's.
                key={`${clientId}:${adAccountId ?? "default"}`}
                initialBody={initialBody}
                stored={stored}
                labels={{
                    scopeLabel,
                    scopeHelp,
                    saved: `Template saved for ${scopeLabel}.`,
                    resetConfirm: "Confirm reset",
                }}
                onSave={(body) => setClientTemplate(clientId, body, adAccountId)}
                onReset={() => resetClientTemplate(clientId, adAccountId)}
                onPreview={(body) => previewClientTemplate(clientId, body, adAccountId)}
            />
        </div>
    );
}
