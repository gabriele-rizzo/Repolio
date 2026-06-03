"use client";

import { Download } from "lucide-react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function PrintButton() {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button size="icon" aria-label="Download report" onClick={() => window.print()}>
                        <Download />
                    </Button>
                }
            />
            <TooltipContent>Download</TooltipContent>
        </Tooltip>
    );
}
