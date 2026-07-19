"use client";

import { enrollClient } from "@/actions/admin/enroll";
import { EnrollmentForm } from "@/components/forms/enrollment-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { MailCheck } from "lucide-react";
import { useState } from "react";

export default function EnrollmentPage() {
    const [sent, setSent] = useState(false);

    if (!sent) {
        return (
            <div className="mx-auto w-full max-w-md">
                <EnrollmentForm action={(data) => enrollClient(data)} onSuccess={() => setSent(true)} />
            </div>
        );
    }

    return (
        <Card className="mx-auto w-full max-w-md">
            <CardContent>
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <MailCheck />
                        </EmptyMedia>
                        <EmptyTitle>Invite Sent Successfully</EmptyTitle>
                        <EmptyDescription>
                            The invite was correctly sent to the specified email address.
                        </EmptyDescription>
                    </EmptyHeader>

                    <EmptyContent className="flex-row justify-center gap-2">
                        <Button type="button" onClick={() => setSent(false)}>
                            Back
                        </Button>
                    </EmptyContent>
                </Empty>
            </CardContent>
        </Card>
    );
}
