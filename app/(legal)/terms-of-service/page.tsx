import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Service — Repolio",
    description: "The terms that govern your use of Repolio.",
};

const LAST_UPDATED = "May 21, 2026";

export default function TermsOfServicePage() {
    return (
        <main className="mx-auto max-w-3xl px-6 py-16">
            <header className="mb-10">
                <h1 className="text-4xl font-semibold tracking-tight">Terms of Service</h1>
                <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
            </header>

            <div className="space-y-8 text-base leading-7">
                <section>
                    <p>
                        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Repolio
                        (&ldquo;Repolio&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), a reporting platform for marketing
                        agencies (the &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to
                        be bound by these Terms. If you do not agree, do not use the Service.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">1. Eligibility and accounts</h2>
                    <p>
                        You must be at least 16 years old and able to enter into a binding contract to use the Service.
                        If you use the Service on behalf of an organization, you represent that you are authorized to
                        bind that organization to these Terms.
                    </p>
                    <p className="mt-3">
                        You are responsible for keeping your sign-in credentials confidential and for all activity that
                        occurs under your account. Notify us promptly at the address below if you suspect unauthorized
                        access.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">2. The Service</h2>
                    <p>
                        Repolio lets marketing agencies connect their clients&rsquo; advertising accounts (such as Meta
                        / Facebook) through official OAuth flows and generate reports from the data those platforms
                        return. The Service is provided on an evolving basis: features may be added, modified, or
                        removed, and we may impose reasonable usage limits to protect the platform.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">3. Connected advertising accounts</h2>
                    <p>
                        When you connect a third-party advertising account, you authorize Repolio to access and process
                        the data the platform exposes to us through its API. You are responsible for ensuring you have
                        the right to grant that access — including, where applicable, on behalf of your clients. You can
                        revoke access at any time from your dashboard or from the third-party platform.
                    </p>
                    <p className="mt-3">
                        Your use of each connected platform remains subject to that platform&rsquo;s own terms and
                        policies. We are not responsible for changes those platforms make to their APIs, data, or
                        availability.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">4. Acceptable use</h2>
                    <p>You agree not to:</p>
                    <ul className="ml-6 mt-2 list-disc space-y-1">
                        <li>Use the Service in violation of any applicable law or third-party right;</li>
                        <li>
                            Access advertising data you are not authorized to access, or use Repolio to circumvent any
                            third-party platform&rsquo;s permissions;
                        </li>
                        <li>
                            Probe, scan, or test the vulnerability of the Service, or attempt to bypass its security or
                            rate limits;
                        </li>
                        <li>
                            Reverse engineer, decompile, or attempt to extract the source code of the Service, except as
                            permitted by applicable law;
                        </li>
                        <li>
                            Interfere with or disrupt the Service or the servers and networks used to provide it;
                        </li>
                        <li>
                            Use the Service to send spam, malware, or otherwise harmful content, or to harass or harm
                            others.
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">5. Customer data</h2>
                    <p>
                        &ldquo;Customer Data&rdquo; means the data you or your clients submit to the Service or that we
                        retrieve from connected advertising accounts on your behalf. As between you and Repolio, you
                        retain all rights in Customer Data. You grant us a worldwide, non-exclusive license to host,
                        process, transmit, and display Customer Data solely to provide and improve the Service for you.
                    </p>
                    <p className="mt-3">
                        Our handling of personal data within Customer Data is described in our{" "}
                        <a className="underline underline-offset-4" href="/privacy">
                            Privacy Policy
                        </a>
                        .
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">6. Intellectual property</h2>
                    <p>
                        Repolio and its licensors retain all rights, title, and interest in and to the Service,
                        including its software, design, branding, and any improvements or feedback derived from your
                        use. These Terms do not grant you any right to our trademarks or logos. Any feedback or
                        suggestions you provide may be used by us without obligation to you.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">7. Fees</h2>
                    <p>
                        If you subscribe to a paid plan, you agree to pay the fees described at the time of purchase.
                        Fees are billed in advance and are non-refundable except where required by law. We may change
                        pricing for future billing periods with reasonable notice. Failure to pay may result in
                        suspension or termination of your account.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">8. Suspension and termination</h2>
                    <p>
                        You may stop using the Service and delete your account at any time. We may suspend or terminate
                        your access if you breach these Terms, if your use poses a security or legal risk to us or other
                        users, or if we are required to do so by law. We will give you reasonable notice where
                        practical.
                    </p>
                    <p className="mt-3">
                        On termination, your right to use the Service ends immediately. We will delete or return
                        Customer Data in accordance with our Privacy Policy and applicable legal obligations.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">9. Disclaimer of warranties</h2>
                    <p>
                        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of
                        any kind, whether express or implied, including warranties of merchantability, fitness for a
                        particular purpose, and non-infringement. We do not warrant that the Service will be
                        uninterrupted, error-free, or that the data retrieved from connected platforms will be
                        complete or accurate.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">10. Limitation of liability</h2>
                    <p>
                        To the maximum extent permitted by law, Repolio will not be liable for any indirect, incidental,
                        special, consequential, or punitive damages, or for any loss of profits, revenue, data, or
                        goodwill, arising out of or related to your use of the Service. Our aggregate liability for any
                        claim arising under these Terms will not exceed the greater of (a) the fees you paid to us in
                        the twelve months preceding the event giving rise to the claim, or (b) one hundred euros (€100).
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">11. Indemnification</h2>
                    <p>
                        You agree to defend, indemnify, and hold harmless Repolio and its affiliates from any claims,
                        damages, liabilities, and expenses (including reasonable legal fees) arising out of your use of
                        the Service, your Customer Data, or your breach of these Terms or any applicable law.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">12. Changes to the Service or Terms</h2>
                    <p>
                        We may modify the Service or these Terms from time to time. When we make material changes to
                        the Terms, we will update the &ldquo;Last updated&rdquo; date above and, where appropriate,
                        notify you by email or through the Service. Your continued use of the Service after the changes
                        take effect constitutes your acceptance of the updated Terms.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">13. Governing law and disputes</h2>
                    <p>
                        These Terms are governed by the laws of the European Union member state in which Repolio is
                        established, without regard to its conflict-of-laws rules. The courts of that jurisdiction will
                        have exclusive jurisdiction over any dispute arising out of or relating to these Terms, except
                        where mandatory consumer protection law gives you the right to bring proceedings in your place
                        of residence.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">14. Miscellaneous</h2>
                    <p>
                        These Terms constitute the entire agreement between you and Repolio regarding the Service and
                        supersede any prior agreements on the same subject. If any provision is found unenforceable,
                        the remaining provisions will remain in effect. Our failure to enforce a provision is not a
                        waiver of our right to do so later. You may not assign these Terms without our prior written
                        consent; we may assign them in connection with a merger, acquisition, or sale of assets.
                    </p>
                </section>

                <section>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight">15. Contact us</h2>
                    <p>
                        If you have questions about these Terms, contact us at{" "}
                        <a className="underline underline-offset-4" href="mailto:legal@repolio.com">
                            legal@repolio.com
                        </a>
                        .
                    </p>
                </section>
            </div>
        </main>
    );
}
