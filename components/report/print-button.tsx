"use client";

import { Download } from "lucide-react";
import { Button } from "../ui/button";

export function PrintButton() {
    return (
        <Button onClick={() => window.print()}>
            <Download />
            Download
        </Button>
    );
}
