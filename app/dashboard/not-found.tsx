import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function DashboardNotFound() {
    return (
        <Empty className="border border-dashed">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <FileQuestion />
                </EmptyMedia>

                <EmptyTitle>Page Not Found</EmptyTitle>
                <EmptyDescription>
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </EmptyDescription>
            </EmptyHeader>

            <EmptyContent>
                <Link href="/dashboard">
                    <Button>Back to Overview</Button>
                </Link>
            </EmptyContent>
        </Empty>
    );
}
