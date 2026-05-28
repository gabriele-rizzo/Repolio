import { authorize } from "@/actions/auth/authorize";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { prisma } from "@/lib/prisma";
import { Construction, Link2Off } from "lucide-react";

export default async function WorkInProgressPage() {
    const client = await authorize();
    const connections = await prisma.accountConnection.findMany({
        where: { client_id: client.id },
    });

    if (connections.length === 0) {
        return (
            <Empty className="border border-dashed max-w-fit">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Link2Off />
                    </EmptyMedia>

                    <EmptyTitle>No Ad Account Connected</EmptyTitle>
                    <EmptyDescription>
                        Connect your Facebook business account and select all ads accounts to help us build exactly what
                        you need.
                    </EmptyDescription>
                </EmptyHeader>

                <EmptyContent>
                    <a href="/api/meta/connect" className={buttonVariants()}>
                        Connect Facebook
                    </a>
                </EmptyContent>
            </Empty>
        );
    }

    return (
        <Empty className="border border-dashed max-w-fit">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Construction />
                </EmptyMedia>

                <EmptyTitle>Work in Progress</EmptyTitle>
                <EmptyDescription>
                    Thank you for helping us improve our product. We're going to get back to you as soon as possible.
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}
