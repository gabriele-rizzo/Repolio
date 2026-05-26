"use client";

import React, { useCallback, useEffect } from "react";
import { Typo } from "../typography";

interface PageScaffoldProps extends React.PropsWithChildren {
    title?: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    onShow?: (event: PageTransitionEvent) => void;
}

export function PageScaffold({ onShow, ...props }: PageScaffoldProps) {
    const onPageShow = useCallback(
        (e: PageTransitionEvent) => {
            if (e.persisted) onShow?.(e);
        },
        [onShow],
    );

    useEffect(() => {
        window.addEventListener("pageshow", onPageShow);
        return () => window.removeEventListener("pageshow", onPageShow);
    }, [onPageShow]);

    return (
        <div className="gap-4 flex flex-col">
            <div className="flex flex-row justify-between gap-4">
                <div className="space-y-2">
                    {props.title &&
                        (typeof props.title === "string" ? <Typo as="title">{props.title}</Typo> : props.title)}

                    {props.description &&
                        (typeof props.description === "string" ? (
                            <Typo as="muted" className="max-w-3xl whitespace-pre-wrap">
                                {props.description}
                            </Typo>
                        ) : (
                            props.description
                        ))}
                </div>

                {typeof props.actions !== "undefined" && <div className="flex-row flex gap-2">{props.actions}</div>}
            </div>

            {props.children}
        </div>
    );
}
