import * as z from "zod";

/**
 * The shape of a self-serve access request, shared by the public form and the server action that
 * writes it.
 *
 * One schema for both sides on purpose. The form is a convenience — the action is a PUBLIC endpoint
 * that anyone can POST to directly, so it has to re-validate everything the form already checked, and
 * two copies of these rules would drift.
 *
 * The maximum lengths are not cosmetic. This is the only unauthenticated write in the app, so an
 * absent bound is an invitation to post a megabyte of "name" and have Postgres store it: TEXT has no
 * length limit of its own. 254 for the email is the RFC 5321 maximum; the other two are generous
 * versions of what a real name and company are.
 */
export const NAME_MAX = 120;
export const EMAIL_MAX = 254;
export const COMPANY_MAX = 160;

export const accessRequestSchema = z.object({
    name: z.string().trim().min(1, "Please enter your name.").max(NAME_MAX, "That name is too long."),
    email: z
        .string()
        .trim()
        .max(EMAIL_MAX, "That email address is too long.")
        .email("Enter a valid email address.")
        // Lowercased here rather than at the call site: it is what dedupes a repeat request against
        // the pending row, and Supabase stores auth emails lowercased anyway, so a request typed as
        // "Me@Example.com" has to match the invite that would be sent to "me@example.com".
        .transform((value) => value.toLowerCase()),
    // Optional: an empty box submits as null rather than "", matching Client.company.
    company: z
        .string()
        .trim()
        .max(COMPANY_MAX, "That company name is too long.")
        .transform((value) => value || null)
        .nullable(),
});

export type AccessRequestInput = z.infer<typeof accessRequestSchema>;
