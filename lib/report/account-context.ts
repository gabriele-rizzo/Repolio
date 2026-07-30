/**
 * Limits for the standing per-ad-account context fed into the AI report prompt.
 *
 * Lives outside the server actions that enforce it because a `"use server"` module may only export
 * async functions — exporting a plain const from one breaks the build, and both the client and admin
 * editors need this value to bound their textarea.
 *
 * Matched to Report.context_comment's existing 2,000-character cap: long enough for real background,
 * short enough that it can't crowd out the metrics in the prompt.
 */
export const MAX_ACCOUNT_CONTEXT = 2000;
