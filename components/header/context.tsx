"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Overrides = Record<string, string>;

interface BreadcrumbContextValue {
    overrides: Overrides;
    setOverride: (segment: string, label: string) => void;
    clearOverride: (segment: string) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: React.PropsWithChildren) {
    const [overrides, setOverrides] = useState<Overrides>({});

    const setOverride = useCallback((segment: string, label: string) => {
        setOverrides((prev) => (prev[segment] === label ? prev : { ...prev, [segment]: label }));
    }, []);

    const clearOverride = useCallback((segment: string) => {
        setOverrides((prev) => {
            if (!(segment in prev)) return prev;
            const next = { ...prev };
            delete next[segment];
            return next;
        });
    }, []);

    const value = useMemo(() => ({ overrides, setOverride, clearOverride }), [overrides, setOverride, clearOverride]);

    return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbOverrides(): Overrides {
    return useContext(BreadcrumbContext)?.overrides ?? {};
}

export function BreadcrumbLabel({ segment, label }: { segment: string; label: string }) {
    const ctx = useContext(BreadcrumbContext);
    const setOverride = ctx?.setOverride;
    const clearOverride = ctx?.clearOverride;

    useEffect(() => {
        if (!setOverride || !clearOverride) return;
        setOverride(segment, label);
        return () => clearOverride(segment);
    }, [setOverride, clearOverride, segment, label]);

    return null;
}
