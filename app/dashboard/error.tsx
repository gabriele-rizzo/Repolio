"use client";

import { ErrorState } from "@/components/scaffolds/error-state";

// Segment boundary for every /dashboard route. Catches a throw in any page or server component
// underneath it — a Prisma call that fails, a Zernio timeout, a bad render — and swaps only the
// content area, so the sidebar, header and navigation survive the failure and the client can move
// somewhere else instead of being stranded on a blank page.
//
// Before this existed, the same throw reached the framework's own handler: in production that is an
// unbranded "Application error: a client-side exception has occurred", with no retry and no way back.
//
// error.tsx must be a Client Component (it receives an onClick handler and Next hydrates it as one).
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ErrorState reset={reset} digest={error.digest} homeHref="/dashboard" />;
}
