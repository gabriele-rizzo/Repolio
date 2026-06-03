"use client";

import { cn } from "@/lib/utils";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useMemo } from "react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { SidebarTrigger } from "../ui/sidebar";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useBreadcrumbOverrides } from "./context";

interface DashboardHeaderProps extends React.PropsWithChildren {
    className?: string;
}

export function DashboardHeader({ children, className }: DashboardHeaderProps) {
    const path = usePathname();
    const overrides = useBreadcrumbOverrides();
    // The reports index is just a resolver that needs an account; keep the param so the
    // "Reports" crumb routes back to this account's latest report instead of the picker.
    const account = useSearchParams().get("account");

    const secondaries = useMemo(() => {
        const segments = path === "/dashboard" ? ["dashboard", "overview"] : path.split("/").filter(Boolean);

        return segments.map((segment, index) => {
            const path = segments.slice(0, index + 1).join("/");
            const override = overrides[segment];
            const pending = !override && /^\d+$/.test(segment);
            const content = pending ? <Skeleton className="h-4 w-24" /> : (override ?? segment);

            return (
                <Fragment key={segment}>
                    {index !== 0 && <BreadcrumbSeparator />}

                    <BreadcrumbItem>
                        {index === segments.length - 1 ? (
                            <BreadcrumbPage className="capitalize">{content}</BreadcrumbPage>
                        ) : (
                            <BreadcrumbLink
                                href={
                                    path === "dashboard/reports" && account
                                        ? `/${path}?account=${account}`
                                        : `/${path}`
                                }
                                className="capitalize"
                            >
                                {content}
                            </BreadcrumbLink>
                        )}
                    </BreadcrumbItem>
                </Fragment>
            );
        });
    }, [path, overrides, account]);

    return (
        <div className={cn("h-12 w-full bg-background flex flex-row items-center gap-4 justify-between", className)}>
            <div className="flex-row flex items-center gap-4">
                <Tooltip>
                    <TooltipTrigger render={<SidebarTrigger size="icon-lg" />} />

                    <TooltipContent side="bottom" sideOffset={10}>
                        <p>Toggle Sidebar</p>
                    </TooltipContent>
                </Tooltip>

                <Breadcrumb>
                    <BreadcrumbList>{secondaries}</BreadcrumbList>
                </Breadcrumb>
            </div>

            {children}
        </div>
    );
}
