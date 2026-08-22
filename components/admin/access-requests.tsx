"use client";

import { acceptAccessRequest, rejectAccessRequest } from "@/actions/admin/access-requests";
import { Typo } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

export interface AccessRequestRow {
    id: number;
    name: string;
    email: string;
    company: string | null;
    locale: string;
    /** Preformatted relative date — the server owns formatting, so this stays locale-free. */
    createdLabel: string;
}

/**
 * The pending queue on /admin/enrollment.
 *
 * Accepting sends the invite that manual enrollment sends, so the two paths converge: after this the
 * client is enrolled and appears in "Recently enrolled" below, and the request is gone from here. No
 * optimistic removal — both actions revalidate the page, and a row that vanished locally while the
 * invite was in fact rejected by Supabase would be the one failure an admin must not miss.
 */
function RequestCard({ request }: { request: AccessRequestRow }) {
    const [accepting, startAccept] = useTransition();
    const [rejecting, startReject] = useTransition();
    const busy = accepting || rejecting;

    function onAccept() {
        startAccept(async () => {
            const result = await acceptAccessRequest(request.id);

            if (result?.error) {
                toast.error(result.error);
                return;
            }

            toast.success(`Invite sent to ${request.email}.`);
        });
    }

    function onReject() {
        startReject(async () => {
            const result = await rejectAccessRequest(request.id);

            if (result?.error) {
                toast.error(result.error);
                return;
            }

            toast.success("Request rejected.");
        });
    }

    return (
        <Card className="flex-row flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
                <Typo as="normal" className="truncate text-sm font-medium">
                    {request.name}
                    {request.company && <span className="text-muted-foreground"> · {request.company}</span>}
                </Typo>
                <Typo as="muted" className="truncate text-xs">
                    {request.email}
                </Typo>
            </div>

            <div className="flex shrink-0 flex-row items-center gap-2">
                {/* The language the request came in, so an admin knows what the invite will read like. */}
                <Badge variant="outline" className="uppercase">
                    {request.locale}
                </Badge>
                <Typo as="muted" className="text-xs">
                    {request.createdLabel}
                </Typo>

                <Button variant="ghost" size="sm" disabled={busy} onClick={onReject}>
                    <X />
                    Reject
                </Button>
                <Button size="sm" disabled={busy} onClick={onAccept}>
                    <Check />
                    Accept &amp; invite
                </Button>
            </div>
        </Card>
    );
}

export function AccessRequests({ requests }: { requests: AccessRequestRow[] }) {
    return (
        <div className="space-y-3 pt-2">
            <div className="flex flex-row items-baseline justify-between gap-3">
                <Typo as="large">Requests</Typo>
                <Typo as="muted" className="text-xs">
                    {requests.length} pending
                </Typo>
            </div>

            <div className="space-y-2">
                {requests.map((request) => (
                    <RequestCard key={request.id} request={request} />
                ))}
            </div>
        </div>
    );
}
