import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Work In Progress | Repolio",
};

export default async function DashboardLayout({ children }: React.PropsWithChildren) {
    return <div className="size-full min-h-dvh items-center justify-center flex">{children}</div>;
}
