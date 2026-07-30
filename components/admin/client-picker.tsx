"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import Link from "next/link";

export interface ClientOption {
    id: number;
    name: string;
    email: string;
    company: string | null;
}

interface ClientPickerProps {
    clients: ClientOption[];
    selectedId: number | null;
    /** Admin page the selection navigates to; the client id is appended as `?client=`. */
    basePath?: string;
}

export function ClientPicker({ clients, selectedId, basePath = "/admin/simulation" }: ClientPickerProps) {
    const selected = clients.find((c) => c.id === selectedId) ?? null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button variant="outline" className="w-full max-w-sm justify-between">
                        <span className="truncate">
                            {selected ? (
                                <>
                                    {selected.name}
                                    {selected.company ? ` · ${selected.company}` : ""}
                                </>
                            ) : (
                                "Select a client…"
                            )}
                        </span>
                        <ChevronsUpDown className="opacity-50" />
                    </Button>
                }
            />

            <DropdownMenuContent className="max-h-80 w-(--anchor-width) max-w-sm">
                {clients.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No clients enrolled yet.</div>
                ) : (
                    clients.map((client) => (
                        <DropdownMenuItem
                            key={client.id}
                            render={<Link href={`${basePath}?client=${client.id}`} />}
                        >
                            <Check
                                className={cn("size-3.5 shrink-0", client.id === selectedId ? "opacity-100" : "opacity-0")}
                            />
                            <div className="flex min-w-0 flex-col">
                                <span className="truncate">{client.name}</span>
                                <span className="truncate text-[0.7rem] text-muted-foreground">{client.email}</span>
                            </div>
                        </DropdownMenuItem>
                    ))
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
