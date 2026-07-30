"use client";

import {
    previewReportTemplate,
    resetReportTemplate,
    saveReportTemplate,
} from "@/actions/report/update-template";
import { TemplateEditor, type TemplateEditorLabels } from "@/components/report/template-editor";

/**
 * Binds the client-facing template actions to one scope (the client's default, or a single ad account)
 * and hands them to the shared editor. Exists so the editor itself stays scope-agnostic and can be
 * reused by the admin screen with different actions.
 */
export function TemplateScopeEditor({
    adAccountId,
    initialBody,
    stored,
    labels,
}: {
    adAccountId: number | null;
    initialBody: string;
    stored: boolean;
    labels: TemplateEditorLabels;
}) {
    return (
        <TemplateEditor
            // Remount when the scope changes, so switching accounts loads that scope's body rather
            // than keeping the previous one in state.
            key={adAccountId ?? "default"}
            initialBody={initialBody}
            stored={stored}
            labels={labels}
            onSave={(body) => saveReportTemplate(body, adAccountId)}
            onReset={() => resetReportTemplate(adAccountId)}
            onPreview={(body) => previewReportTemplate(body, adAccountId)}
        />
    );
}
