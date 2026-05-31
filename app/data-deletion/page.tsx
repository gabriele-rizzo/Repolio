import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Data deletion | Repolio",
};

export default async function DataDeletionPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
    const { code } = await searchParams;

    return (
        <div className="flex min-h-dvh items-center justify-center p-6">
            <div className="max-w-md space-y-3 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">Data deletion</h1>

                <p className="text-sm text-muted-foreground">
                    Any data Repolio stored for your Meta account — connection credentials, ad accounts, and their
                    snapshots — has been deleted. This is immediate and permanent.
                </p>

                {code && (
                    <p className="text-xs text-muted-foreground">
                        Confirmation code: <span className="font-mono">{code}</span>
                    </p>
                )}
            </div>
        </div>
    );
}
