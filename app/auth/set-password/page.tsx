"use client";

import { SetPasswordForm } from "@/components/forms/set-password-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function SetPasswordPage() {
    const [changed, setChanged] = useState(false);

    if (!changed) return <SetPasswordForm onSuccess={() => setChanged(true)} />;

    return (
        <Card className="w-full max-w-md">
            <CardContent>
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <KeyRound />
                        </EmptyMedia>
                        <EmptyTitle>Password Set Successfully</EmptyTitle>
                        <EmptyDescription>The password was updated. You can now log in.</EmptyDescription>
                    </EmptyHeader>

                    <EmptyContent className="flex-row justify-center gap-2">
                        <Link href="/auth/login">
                            <Button>Log In</Button>
                        </Link>
                    </EmptyContent>
                </Empty>
            </CardContent>
        </Card>
    );
}
