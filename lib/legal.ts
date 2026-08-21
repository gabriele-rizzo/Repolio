/**
 * Who is legally responsible for the Service, and where to reach them.
 *
 * Shared by the privacy policy and the terms rather than typed into both. Each document tells the reader
 * to write to "the address below", so each address has to be one fact with one owner: a hand-written
 * copy in a second document is how a policy ends up naming a mailbox nobody reads. The pages previously
 * carried invented privacy@repolio.com and legal@repolio.com addresses, which no one could answer.
 *
 * Both are forwarding aliases on gj-automate.com, the domain the app already sends from
 * (`RESEND_FROM`, see lib/report/send-batch.ts), so mail reaches the responsible person without
 * publishing a personal mailbox on two crawlable pages. THE ALIASES HAVE TO EXIST: a legal document
 * naming an address that bounces is worse than one naming none, and GDPR rights requests arrive here.
 */
export const LEGAL_CONTACT = {
    /** The natural person operating the Service, and the data controller for GDPR purposes. */
    name: "Gabriele Rizzo",
    /** Data-protection questions and rights requests, published in the privacy policy. */
    privacyEmail: "privacy@gj-automate.com",
    /** Questions about the contract itself, published in the terms of service. */
    termsEmail: "legal@gj-automate.com",
} as const;
