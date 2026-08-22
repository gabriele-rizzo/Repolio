"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function logout() {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    // "/" and not "/auth/login": signing out lands on the public front door, not on a form inviting you
    // straight back in. It also used to make the landing page unreachable to anyone with an account —
    // signed in, "/" redirected to the dashboard; signed out, logout dropped you here — so the only way
    // to see it was a private window.
    redirect("/");
}
