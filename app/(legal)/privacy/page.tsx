import { LEGAL_CONTACT } from "@/lib/legal";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: "How Repolio collects, uses, and protects your data.",
};

const LAST_UPDATED = "August 21, 2026";

export default function PrivacyPage() {
    return (
        <main className="mx-auto max-w-3xl px-6 py-16">
            <header className="mb-10">
                <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
                <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
            </header>

            <div className="space-y-8 text-base leading-7">
                <section>
                    <p>
                        This Privacy Policy describes how Repolio (&ldquo;Repolio&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
                        collects, uses, and shares information when you use our reporting platform for marketing agencies
                        (the &ldquo;Service&rdquo;). By using the Service, you agree to the practices described below.
                    </p>
                    <p className="mt-3">
                        The Service is operated by {LEGAL_CONTACT.name}, who is responsible for the personal
                        information described in this policy and can be reached at{" "}
                        <a className="underline underline-offset-4" href={`mailto:${LEGAL_CONTACT.privacyEmail}`}>
                            {LEGAL_CONTACT.privacyEmail}
                        </a>
                        .
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">1. Information we collect</h2>

                    <h3 className="mt-4 mb-1 text-lg font-medium">Account information</h3>
                    <p>
                        When your agency enrolls you, we collect your name, email address, and company name so we can
                        create your account and contact you about the Service. Authentication is handled through our
                        identity provider (Supabase), which manages your sign-in credentials on our behalf.
                    </p>

                    <h3 className="mt-4 mb-1 text-lg font-medium">Connected advertising accounts</h3>
                    <p>
                        Repolio integrates with third-party advertising platforms (such as Meta / Facebook) through their
                        official OAuth flows. When you connect an account, we receive an access token that lets us read
                        the ad-reporting data you have authorized — for example, campaign names, spend, impressions,
                        clicks, and conversion metrics. We do not request permissions beyond what is needed to generate
                        the reports you have asked for, and we never receive your password for any connected platform.
                    </p>

                    <h3 className="mt-4 mb-1 text-lg font-medium">Usage and device information</h3>
                    <p>
                        We collect basic technical information when you use the Service, including your IP address,
                        browser type, operating system, the pages you visit, and the times of your requests. This is used
                        to operate, secure, and improve the Service.
                    </p>

                    <h3 className="mt-4 mb-1 text-lg font-medium">Cookies</h3>
                    <p>
                        We use strictly necessary cookies to keep you signed in and to remember your preferences (such as
                        light or dark theme). We do not use third-party advertising or cross-site tracking cookies.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">2. How we use your information</h2>
                    <p>We use the information we collect to:</p>
                    <ul className="ml-6 mt-2 list-disc space-y-1">
                        <li>Provide, maintain, and improve the Service;</li>
                        <li>Generate the reports and analyses you have requested;</li>
                        <li>Authenticate you and keep your account secure;</li>
                        <li>Respond to support requests and communicate service updates;</li>
                        <li>Detect and prevent abuse, fraud, or violations of our terms;</li>
                        <li>Comply with our legal obligations.</li>
                    </ul>
                    <p className="mt-3">
                        We do not sell your personal information, and we do not use the data we obtain from connected
                        advertising platforms to train machine-learning models for other customers.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">3. How we share information</h2>
                    <p>We share information only in the limited circumstances below:</p>
                    <ul className="ml-6 mt-2 list-disc space-y-1">
                        <li>
                            <strong>Service providers.</strong> We rely on trusted vendors to host and operate the Service
                            — including Vercel (hosting), Supabase (authentication and database), and the advertising
                            platforms you choose to connect. These providers process data only on our instructions.
                        </li>
                        <li>
                            <strong>Your agency.</strong> If you are an end client enrolled by an agency, the agency that
                            invited you can view the reports generated from your connected accounts.
                        </li>
                        <li>
                            <strong>Legal requests.</strong> We may disclose information when required by law, court
                            order, or to protect the rights, safety, or property of Repolio or others.
                        </li>
                        <li>
                            <strong>Business transfers.</strong> If Repolio is involved in a merger, acquisition, or sale
                            of assets, your information may be transferred as part of that transaction.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">4. Data retention</h2>
                    <p>
                        We retain account information for as long as your account is active. Reporting data fetched from
                        connected platforms is stored to provide historical comparisons and is deleted when you disconnect
                        the corresponding account or close your Repolio account. Backups containing your data are
                        rotated regularly and purged within 30 days.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">5. Security</h2>
                    <p>
                        We protect your information with encryption in transit (TLS), encryption at rest for our managed
                        database, scoped access controls, and audit logging. No system is perfectly secure, but we work
                        to apply industry-standard safeguards and to notify you promptly if a breach affects your data.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">6. Your rights</h2>
                    <p>
                        Depending on where you live, you may have the right to access, correct, export, or delete the
                        personal information we hold about you, to object to or restrict certain processing, and to
                        withdraw consent at any time. You can exercise these rights by contacting us at the address
                        below. We will respond within the timeframe required by applicable law.
                    </p>
                    <p className="mt-3">
                        You can disconnect any third-party advertising account at any time from your dashboard, which
                        revokes our access token and stops further data ingestion from that account.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">7. International transfers</h2>
                    <p>
                        Repolio operates from the European Union and uses service providers that may process data in the
                        United States and other countries. Where required, we rely on Standard Contractual Clauses or
                        other approved transfer mechanisms to protect your data.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">8. Children</h2>
                    <p>
                        The Service is not directed to children under 16 and we do not knowingly collect personal
                        information from them. If you believe a child has provided us with personal information, please
                        contact us so we can delete it.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">9. Changes to this policy</h2>
                    <p>
                        We may update this Privacy Policy from time to time. When we make material changes, we will
                        update the &ldquo;Last updated&rdquo; date above and, where appropriate, notify you by email or
                        through the Service.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">10. Contact us</h2>
                    <p>
                        If you have questions about this Privacy Policy or how we handle your data, or want to
                        exercise any of the rights above, contact {LEGAL_CONTACT.name} at{" "}
                        <a className="underline underline-offset-4" href={`mailto:${LEGAL_CONTACT.privacyEmail}`}>
                            {LEGAL_CONTACT.privacyEmail}
                        </a>
                        .
                    </p>
                </section>
            </div>
        </main>
    );
}
