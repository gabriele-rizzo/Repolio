import { checkEnv } from "../env";
import { createAdminClient } from "../supabase/admin/server";

/** The three fields a Client row needs, in the shape the Supabase trigger reads them from. */
export interface ClientInvite {
    email: string;
    name: string;
    company: string | null;
}

/**
 * Sends the Supabase invite that IS enrollment.
 *
 * There is no app code that creates a `Client`: the row comes from a trigger on `auth.users`, which
 * reads `name` and `company` out of the invite's user metadata. So this one call is the whole account
 * creation path, and it is shared by both routes into it — an admin typing a name on
 * /admin/enrollment, and an admin accepting a request that a visitor filed themselves.
 *
 * Throws rather than returning a Result: both callers are `safeAction` bodies, which turn a throw into
 * the message the form displays.
 */
export async function inviteClient({ email, name, company }: ClientInvite): Promise<void> {
    const supabase = await createAdminClient();
    const baseUrl = checkEnv("NEXT_PUBLIC_SITE_URL");

    const { error } = await supabase.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
        redirectTo: `${baseUrl}/auth/confirm`,
        data: { name, company },
    });

    // Turn Supabase's raw "already been registered" into something an admin can act on.
    if (error?.code === "email_exists") throw new Error("A client with this email is already enrolled.");
    if (error) throw error;
}
