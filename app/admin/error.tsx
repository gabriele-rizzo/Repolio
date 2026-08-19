"use client";

import { ErrorState } from "@/components/scaffolds/error-state";

// Segment boundary for /admin. Worth having separately from the dashboard one because the admin
// surface is where a failure is most expensive: batch validation is the step that releases reports to
// clients, and an operator who hits a blank crash mid-review has no way to tell whether the batch
// went out. Retry re-runs the segment against current state.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <ErrorState reset={reset} digest={error.digest} homeHref="/admin" />;
}
