/** Result of a form server action: `undefined` on success, `{ error }` on failure. */
export type ActionResult = { error: string } | void;

/**
 * Wraps a server-action body so failures are *returned* rather than thrown.
 *
 * Next.js redacts the message of any error thrown from a Server Action in
 * production ("An error occurred in the Server Components render..."), so the
 * real cause never reaches the client. Returned values are not redacted, so we
 * catch here and hand the message back for the form to display.
 */
export async function safeAction(fn: () => Promise<void>): Promise<ActionResult> {
    try {
        await fn();
    } catch (error) {
        // Let Next.js control-flow errors (redirect / notFound) propagate.
        if (
            error instanceof Error &&
            "digest" in error &&
            typeof error.digest === "string" &&
            error.digest.startsWith("NEXT_")
        ) {
            throw error;
        }

        return { error: error instanceof Error ? error.message : "An unexpected error occurred." };
    }
}
