import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface AppShellProps extends React.PropsWithChildren {
    /** The `<Sidebar>` for this section — the dashboard's or the admin's. */
    sidebar: React.ReactNode;
    /** The top bar's contents. Rendered in a fixed-height band above the scroll area. */
    header: React.ReactNode;
    /** Sidebar open state restored from the cookie by the caller (each section has its own default). */
    defaultOpen?: boolean;
    /** Extra classes for the scrolling content area. */
    className?: string;
}

/**
 * The one app shell: sidebar + top bar + scrolling content. Both signed-in sections (`/dashboard`
 * and `/admin`) render through this, so the frame can only ever be fixed in one place.
 *
 * The layout is a plain flex column, and — this is the part that matters — the top bar sits OUTSIDE
 * the scroll container. When the bar lived inside it (as a `sticky top-0` child), the scrollable box
 * started at the top of the inset, so its scrollbar ran the full height and cut across the bar's
 * right end. macOS draws that scrollbar permanently whenever a mouse is attached, so it read as a
 * bar welded over the nav. With the bar as a sibling, the scroll area — and therefore the scrollbar
 * — begins below it.
 *
 * `min-h-0` on the scroll area is what lets it actually shrink to the inset's height: a flex item
 * defaults to `min-height: auto`, which would let tall content push the box past the viewport and
 * hand the scrolling back to the page.
 */
export function AppShell({ sidebar, header, defaultOpen, className, children }: AppShellProps) {
    return (
        <SidebarProvider defaultOpen={defaultOpen} className="overscroll-none">
            {sidebar}

            <SidebarInset className="flex h-[calc(100vh-var(--spacing)*4)]! shrink-0 flex-col overflow-hidden overscroll-none">
                <div className="z-10 shrink-0 print:hidden">{header}</div>

                <div
                    data-slot="app-scroll"
                    className={cn(
                        "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-none p-4",
                        className,
                    )}
                >
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
