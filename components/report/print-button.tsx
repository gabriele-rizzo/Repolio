"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface PrintButtonProps {
    reportId: number;
}

/**
 * Downloads the report as a PDF: fetches the same standalone HTML used for emails, loads it into a
 * hidden iframe, and opens the browser's print dialog (Save as PDF) on that clean document — so the
 * PDF is the report on its own, not the dashboard chrome.
 */
export function PrintButton({ reportId }: PrintButtonProps) {
    const [loading, setLoading] = useState(false);

    async function onDownload() {
        if (loading) return;
        setLoading(true);

        try {
            const response = await fetch(`/api/reports/${reportId}/email`);
            if (!response.ok) throw new Error("Could not render the report.");

            const html = await response.text();

            const iframe = document.createElement("iframe");
            iframe.setAttribute("aria-hidden", "true");
            iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
            iframe.srcdoc = html;

            iframe.onload = () => {
                const frame = iframe.contentWindow;
                if (!frame) return iframe.remove();

                const cleanup = () => iframe.remove();
                frame.addEventListener("afterprint", cleanup);
                setTimeout(cleanup, 60_000); // fallback if afterprint never fires

                frame.focus();
                frame.print();
            };

            document.body.appendChild(iframe);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not download the report.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button size="icon" aria-label="Download report as PDF" onClick={onDownload} disabled={loading}>
                        {loading ? <LoaderCircle className="animate-spin" /> : <Download />}
                    </Button>
                }
            />
            <TooltipContent>Download PDF</TooltipContent>
        </Tooltip>
    );
}
