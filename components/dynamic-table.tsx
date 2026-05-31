"use client";

import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

type DynamicTableProps<T, C> = {
    caption?: string;
    columns: C[];
    data: T[] | null | undefined;
    loading?: boolean;
    loadingHeight?: React.CSSProperties["height"];
    render: (row: T, column: C) => React.ReactNode;
    href?: (row: T) => string;
    className?: string;
};

export function DynamicTable<T extends object, C>({ loadingHeight = "50vh", ...props }: DynamicTableProps<T, C>) {
    const ready = useMemo(() => !props.loading && props.data != null, [props.loading, props.data]);
    const router = useRouter();

    return (
        <Table className={props.className}>
            {props.caption && <TableCaption>{props.caption}</TableCaption>}

            <TableHeader className="pointer-events-none">
                <TableRow>
                    {props.columns.map((key, index, { length }) => (
                        <TableHead key={String(key)} className={cn("capitalize", index === length - 1 && "text-right")}>
                            {String(key)}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>

            <TableBody>
                {ready && props.data!.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={props.columns.length} className="h-24 text-center text-muted-foreground">
                            No results for this range.
                        </TableCell>
                    </TableRow>
                ) : ready ? (
                    props.data!.map((row, index) => {
                        const href = props.href?.(row);
                        const content = props.columns.map((key, index, { length }) => (
                            <TableCell key={String(key)} className={cn(index === length - 1 && "text-right")}>
                                {props.render(row, key)}
                            </TableCell>
                        ));

                        return (
                            <TableRow
                                key={index}
                                onClick={href ? () => router.push(href) : undefined}
                                onPointerOver={href ? () => router.prefetch(href) : undefined}
                                className={cn(href && "cursor-pointer")}
                            >
                                {content}
                            </TableRow>
                        );
                    })
                ) : (
                    <TableRow>
                        <TableCell colSpan={props.columns.length} className="p-0">
                            <Skeleton className="w-full" style={{ height: loadingHeight }} />
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}
