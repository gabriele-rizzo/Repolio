// The shared contract between the metrics layer and each platform's fact extractor. Deliberately free
// of any platform vocabulary: `actions`/`actionValues` are named for Meta's shape because that is what
// Zernio stores today, but a platform whose rows carry something else entirely reads whatever it needs
// off the raw row.

/** A raw daily timeline row as Zernio stored it, before any platform interpretation. */
export type RawRow = Record<string, unknown>;

/** Meta-style `action_type -> number` map. Only platforms that actually have one use this. */
export type ActionMap = Record<string, number> | null | undefined;

/**
 * The per-day facts every surface in the app is allowed to build numbers from.
 *
 * This is the whole point of the seam: whatever a platform reports and however it names it, it must
 * land in exactly these four fields, with these null semantics. Counts read 0 when nothing happened;
 * VALUES stay null when unmeasured, because an unmeasured value rendered as 0 is how a client came to
 * see a fake ROAS of 74.5x.
 */
export interface RowFacts {
    /** Purchase conversions counted this day. */
    purchases: number;
    /** Purchase-attributed value; null when no purchase value was measured (never a fake 0). */
    revenue: number | null;
    /** Lead conversions counted this day. */
    leads: number;
    /** Link clicks; null when the row doesn't break them out (unmeasured ≠ zero). */
    linkClicks: number | null;
}

/** One platform's translation from its raw rows to {@link RowFacts}. Must be pure. */
export type FactExtractor = (row: RawRow) => RowFacts;
