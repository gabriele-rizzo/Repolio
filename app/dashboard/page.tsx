import { buttonVariants } from "@/components/ui/button";

export default async function DashboardPage() {
    return (
        <div className="p-6">
            <a href="/api/meta/connect" className={buttonVariants()}>
                Connect Facebook
            </a>
        </div>
    );
}
