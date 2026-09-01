import { SnapshotRecovery } from "@/components/admin/snapshot-recovery";
import { Typo } from "@/components/typography";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Recovery",
};

// /admin/health answers "what failed". This page answers the question that follows it: "and can I
// undo the damage" — which is a different question, because the two do not line up. The outage that
// motivated this (Zernio's billing lapse, Aug 2026) logged a SyncError for every account whose fetch
// threw, and NOTHING for the accounts Zernio answered 200-with-no-rows, which are the ones whose
// history is now silently wrong. So recovery is driven off the stored data, not off the error log.
//
// See lib/snapshot/gaps.ts for the two damage shapes and actions/admin/snapshot-recovery.ts for why
// no "failed window" is persisted anywhere: the window is reconstructed from history, which makes it
// self-verifying — a healed day simply stops appearing.

export default function RecoveryPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="space-y-2">
                <Typo as="title">Recovery</Typo>
                <Typo as="muted" className="max-w-3xl">
                    Re-pulls ad data for days a provider outage left wrong. Two shapes are detected: days with
                    no stored row at all, and runs of stored all-zero days on an account that was spending
                    right before them — the signature of a provider answering &ldquo;no rows&rdquo; instead of
                    failing, which the daily pull records as a real zero and then never revisits.
                </Typo>
            </div>

            <section className="space-y-3">
                <Typo as="lead">Damaged snapshot history</Typo>
                <Typo as="muted" className="text-sm">
                    Scanning only reads. A re-pull requests the selected ranges again and overwrites the days
                    the provider returns; days it still returns nothing for are left exactly as they are, never
                    zeroed — so running this twice is safe, and it can never turn stored data into a hole. Zero
                    runs are <em>suspect, not proven</em>: a genuinely paused account looks identical, and only
                    the re-pull settles which one it was.
                </Typo>
                <Typo as="muted" className="text-sm">
                    Plain gaps are the less urgent half: a day with no row does not advance the account&apos;s
                    newest recorded day, so the next daily run already widens its window back across the whole
                    gap and heals it unattended. Re-pull them here to fix a client&apos;s numbers before the
                    next report goes out, not because they would otherwise stay broken. The zero runs are the
                    ones nothing else will ever come back for.
                </Typo>

                <SnapshotRecovery />
            </section>
        </div>
    );
}
