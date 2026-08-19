import type { Platform } from "@/generated/prisma/browser";
import { extractMetaRowFacts } from "./meta";
import type { FactExtractor, RawRow, RowFacts } from "./types";

export type { ActionMap, FactExtractor, RawRow, RowFacts } from "./types";

// Where a raw daily row becomes facts the rest of the app may compute on.
//
// WHY THIS EXISTS: every KPI, delta and the 0-100 score is recomputed live from snapshots, so this
// translation is the single narrowest point through which all of a platform's data passes. Before the
// seam it was Meta's action_type vocabulary called directly from computeMetrics — which was correct,
// because Meta is the only platform wired, and completely unextendable, because a second platform does
// not have action_type maps at all.
//
// Adding a platform means adding a row here and nothing else in lib/metrics/.
//
// NOT YET SEAMED: lib/metrics/score.ts is still calibrated to Meta — its benchmark curves are Meta
// averages and its `ctrBasis: "link" | "all"` is a Meta concept. A second platform needs its own
// benchmark set there before its scores mean anything. Extraction was seamed first because it is the
// layer that decides whether the NUMBERS are right; the score decides how they are judged.
const EXTRACTORS: Partial<Record<Platform, FactExtractor>> = {
    META: extractMetaRowFacts,
};

/** True when `platform` can have its rows interpreted — i.e. it is wired end-to-end. */
export const hasFactExtractor = (platform: Platform): boolean => platform in EXTRACTORS;

/**
 * Facts for one raw row, interpreted according to its platform.
 *
 * THROWS on a platform with no extractor, and that is deliberate. The alternative — falling back to
 * Meta's vocabulary — would find none of another platform's keys and return "0 purchases, 0 leads, no
 * revenue": a wrong number that looks exactly like a real one, reported to a client as fact. That
 * failure mode is the one this codebase has been bitten by before (the fake 74.5x ROAS), and it is
 * strictly worse than a loud stop.
 *
 * Unreachable today: only Meta appears in ZERNIO_PLATFORMS, so only Meta snapshots can exist. It
 * becomes reachable the moment someone wires a platform's OAuth without wiring its extractor, which is
 * precisely when a loud stop is what you want.
 */
export function extractRowFacts(platform: Platform, row: RawRow): RowFacts {
    const extract = EXTRACTORS[platform];

    if (!extract) {
        throw new Error(
            `No fact extractor for platform '${platform}'. Its raw rows cannot be interpreted, and ` +
                `guessing with another platform's vocabulary would report zeroed conversions as fact. ` +
                `Add an entry to EXTRACTORS in lib/metrics/extract/index.ts.`,
        );
    }

    return extract(row);
}
