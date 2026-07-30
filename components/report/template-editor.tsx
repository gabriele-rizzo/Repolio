"use client";

import { Typo } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { TEMPLATE_PRESETS } from "@/lib/report/template/presets";
import { MAX_TEMPLATE_LENGTH, type TemplateIssue } from "@/lib/report/template/types";
import { VARIABLE_REFERENCE } from "@/lib/report/template/variables";
import { AlertTriangle, Eye, LoaderCircle, RotateCcw, Save } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

/**
 * The report template editor: source on the left, live preview on the right, with the variable
 * reference and preset library underneath.
 *
 * Shared by the client's own page and the admin screen — they differ only in the callbacks passed in
 * and the copy, so the two can't drift into behaving differently. Preview HTML is rendered on the
 * server by the real renderer and shown in a sandboxed iframe, so what you see is what ships.
 */
export interface TemplateEditorLabels {
    /** e.g. "Client default" or an ad account's name. */
    scopeLabel: string;
    /** Explains what this scope governs and what it falls back to. */
    scopeHelp: string;
    saved: string;
    resetConfirm: string;
}

export interface TemplateEditorProps {
    /** The stored body, or the inherited one when nothing is stored for this scope. */
    initialBody: string;
    /** Whether `initialBody` is stored for this scope, or inherited from further up the chain. */
    stored: boolean;
    labels: TemplateEditorLabels;
    onSave: (body: string) => Promise<{ issues: TemplateIssue[] }>;
    onReset: () => Promise<void>;
    onPreview: (body: string) => Promise<{ html: string; basis: "report" | "sample" }>;
}

export function TemplateEditor({
    initialBody,
    stored,
    labels,
    onSave,
    onReset,
    onPreview,
}: TemplateEditorProps) {
    const [body, setBody] = useState(initialBody);
    const [savedBody, setSavedBody] = useState(initialBody);
    const [issues, setIssues] = useState<TemplateIssue[]>([]);
    const [preview, setPreview] = useState<{ html: string; basis: "report" | "sample" } | null>(null);
    const [showReference, setShowReference] = useState(false);
    const [confirmingReset, setConfirmingReset] = useState(false);

    const [saving, startSave] = useTransition();
    const [previewing, startPreview] = useTransition();
    const [resetting, startReset] = useTransition();

    const textarea = useRef<HTMLTextAreaElement>(null);
    const busy = saving || previewing || resetting;
    const dirty = body !== savedBody;

    /** Inserts a placeholder at the caret, so the reference list is usable without typing braces. */
    function insert(name: string, ownLine: boolean) {
        const el = textarea.current;
        const token = `{{ .${name} }}`;

        if (!el) {
            setBody((current) => `${current}${ownLine ? "\n" : ""}${token}`);
            return;
        }

        const start = el.selectionStart;
        const end = el.selectionEnd;
        const before = body.slice(0, start);
        const after = body.slice(end);
        // A section block must own its line, or the parser treats it as prose.
        const prefix = ownLine && before.length > 0 && !before.endsWith("\n") ? "\n" : "";
        const suffix = ownLine && !after.startsWith("\n") ? "\n" : "";
        const next = `${before}${prefix}${token}${suffix}${after}`;

        setBody(next);
        requestAnimationFrame(() => {
            const caret = start + prefix.length + token.length;
            el.focus();
            el.setSelectionRange(caret, caret);
        });
    }

    function doSave() {
        startSave(async () => {
            try {
                const result = await onSave(body);
                setSavedBody(body);
                setIssues(result.issues);
                if (result.issues.length > 0) {
                    toast.warning(
                        `Saved with ${result.issues.length} ${result.issues.length === 1 ? "warning" : "warnings"}.`,
                    );
                } else {
                    toast.success(labels.saved);
                }
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not save the template.");
            }
        });
    }

    function doPreview() {
        startPreview(async () => {
            try {
                setPreview(await onPreview(body));
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not render the preview.");
            }
        });
    }

    function doReset() {
        if (!confirmingReset) return setConfirmingReset(true);
        setConfirmingReset(false);

        startReset(async () => {
            try {
                await onReset();
                toast.success("Reset to the inherited template.");
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not reset the template.");
            }
        });
    }

    return (
        <div className="space-y-4">
            <Card className="gap-3 p-4">
                <div className="flex flex-row flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-row items-center gap-2">
                            <Typo as="large" className="truncate text-base">
                                {labels.scopeLabel}
                            </Typo>
                            <Badge variant={stored ? "default" : "outline"}>{stored ? "Custom" : "Inherited"}</Badge>
                        </div>
                        <Typo as="muted" className="text-sm">
                            {labels.scopeHelp}
                        </Typo>
                    </div>

                    <div className="flex shrink-0 flex-row flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={doPreview} disabled={busy}>
                            {previewing ? <LoaderCircle className="animate-spin" /> : <Eye />}
                            Preview
                        </Button>

                        {stored && (
                            <Button
                                variant={confirmingReset ? "destructive" : "ghost"}
                                size="sm"
                                onClick={doReset}
                                disabled={busy}
                            >
                                {resetting ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
                                {confirmingReset ? labels.resetConfirm : "Reset"}
                            </Button>
                        )}

                        <Button size="sm" onClick={doSave} disabled={busy || !dirty}>
                            {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
                            Save
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                        <Textarea
                            ref={textarea}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            spellCheck={false}
                            rows={24}
                            aria-label="Report template source"
                            className="font-mono text-xs leading-relaxed"
                        />

                        <div className="flex flex-row items-center justify-between">
                            <Typo as="muted" className="text-xs">
                                {body.length.toLocaleString("en-US")} / {MAX_TEMPLATE_LENGTH.toLocaleString("en-US")}
                            </Typo>
                            {dirty && (
                                <Typo as="muted" className="text-xs">
                                    Unsaved changes
                                </Typo>
                            )}
                        </div>

                        {issues.length > 0 && (
                            <div className="space-y-1 border border-dashed border-amber-500/50 bg-amber-500/5 p-3">
                                <div className="flex flex-row items-center gap-1.5 text-amber-700 dark:text-amber-400">
                                    <AlertTriangle className="size-3.5" />
                                    <Typo as="muted" className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                        Saved, but check these
                                    </Typo>
                                </div>
                                {issues.map((issue, i) => (
                                    <Typo key={i} as="muted" className="text-xs">
                                        Line {issue.line}: {issue.message}
                                    </Typo>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        {preview ? (
                            <>
                                <iframe
                                    // Sandboxed with no allow-scripts: the preview is a document to look
                                    // at, and nothing in it should be able to run.
                                    sandbox=""
                                    srcDoc={preview.html}
                                    title="Report preview"
                                    className="h-[32rem] w-full border bg-white"
                                />
                                <Typo as="muted" className="text-xs">
                                    {preview.basis === "report"
                                        ? "Rendered from your most recent report."
                                        : "Rendered from sample figures — you have no reports yet."}
                                </Typo>
                            </>
                        ) : (
                            <div className="flex h-[32rem] w-full flex-col items-center justify-center gap-2 border border-dashed">
                                <Typo as="muted" className="text-sm">
                                    Press Preview to render this template.
                                </Typo>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Presets */}
            <Card className="gap-3 p-4">
                <Typo as="large" className="text-base">
                    Start from a preset
                </Typo>
                <Typo as="muted" className="text-sm">
                    Loads the preset into the editor. Nothing is saved until you press Save.
                </Typo>

                <div className="grid gap-2 sm:grid-cols-2">
                    {TEMPLATE_PRESETS.map((preset) => (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => setBody(preset.body)}
                            disabled={busy}
                            className="border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                        >
                            <Typo as="normal" className="text-sm font-medium">
                                {preset.name}
                            </Typo>
                            <Typo as="muted" className="text-xs">
                                {preset.description}
                            </Typo>
                        </button>
                    ))}
                </div>
            </Card>

            {/* Variable reference */}
            <Card className="gap-3 p-4">
                <button
                    type="button"
                    onClick={() => setShowReference((v) => !v)}
                    className="flex flex-row items-center justify-between gap-2 text-left"
                >
                    <div>
                        <Typo as="large" className="text-base">
                            Available variables
                        </Typo>
                        <Typo as="muted" className="text-sm">
                            Click one to insert it at the cursor. Sections must sit on their own line.
                        </Typo>
                    </div>
                    <Typo as="muted" className="shrink-0 text-xs">
                        {showReference ? "Hide" : "Show"}
                    </Typo>
                </button>

                {showReference && (
                    <div className="space-y-4">
                        {VARIABLE_REFERENCE.map((group) => {
                            const ownLine = group.group.includes("own line");

                            return (
                                <div key={group.group} className="space-y-2">
                                    <Typo as="muted" className="text-xs font-medium uppercase tracking-wide">
                                        {group.group}
                                    </Typo>

                                    <div className="grid gap-1.5 sm:grid-cols-2">
                                        {group.variables.map((variable) => (
                                            <button
                                                key={variable.name}
                                                type="button"
                                                onClick={() => insert(variable.name, ownLine)}
                                                disabled={busy}
                                                className="flex flex-col items-start gap-0.5 border border-transparent px-2 py-1.5 text-left hover:border-border hover:bg-muted disabled:opacity-50"
                                            >
                                                <code className="font-mono text-xs">{`{{ .${variable.name} }}`}</code>
                                                <Typo as="muted" className="text-[0.7rem]">
                                                    {variable.description}
                                                    {variable.example && ` · e.g. ${variable.example}`}
                                                </Typo>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        <div className="space-y-1 border-t pt-3">
                            <Typo as="muted" className="text-xs font-medium uppercase tracking-wide">
                                Line syntax
                            </Typo>
                            {[
                                ["# Title", "Large heading"],
                                ["## Subtitle", "Medium heading"],
                                ["### LABEL", "Small uppercase label"],
                                ["> note", "Small muted note"],
                                ["---", "Horizontal divider"],
                            ].map(([syntax, meaning]) => (
                                <div key={syntax} className="flex flex-row items-baseline gap-2">
                                    <code className="font-mono text-xs">{syntax}</code>
                                    <Typo as="muted" className="text-[0.7rem]">
                                        {meaning}
                                    </Typo>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
