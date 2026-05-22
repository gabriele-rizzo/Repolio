"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DashboardPage() {
    // const client = await authorize();

    return (
        <div>
            {/* <pre>{JSON.stringify(client, null, 2)}</pre>

            {!client.accounts.some((a) => a.platform === "META") && (
                <a href="/api/meta/connect" className={buttonVariants()}>
                    Connect Meta
                </a>
            )} */}

            <Button onClick={() => toast("Event has been created.")}>Toast</Button>
        </div>
    );
}
