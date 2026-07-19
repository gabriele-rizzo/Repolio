import { redirect } from "next/navigation";

// /admin lands on the default section once past the OTP gate (handled by the layout).
export default function AdminPage() {
    redirect("/admin/enrollment");
}
