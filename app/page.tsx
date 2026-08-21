import { getCurrentClient } from "@/actions/auth/authorize";
import { Brand } from "@/components/brand";
import { Typo } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarSync, FileText, Link2, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

// The public front door. Everything else at the root of the app is behind a session, so this page is
// also the only place a visitor who has never logged in sees anything at all — see PUBLIC_EXACT in
// proxy.ts, which is what lets an anonymous request reach it.
//
// Its copy is translated (messages/*.json, `landing`), unlike the meta tags in lib/site.ts: those are
// read by crawlers that carry no locale, so they stay in one language. The hero deliberately restates
// the tagline from there rather than importing it, because this one has to exist in de/en/it.

const STEPS = ["step1", "step2", "step3", "step4"] as const;
const STEP_ICONS: Record<(typeof STEPS)[number], LucideIcon> = {
    step1: Link2,
    step2: CalendarSync,
    step3: FileText,
    step4: ShieldCheck,
};

const FEATURES = ["feature1", "feature2", "feature3"] as const;

// The app's own Button, one notch up. Every control in the dashboard is h-7/h-8 at text-xs because it
// sits in a dense working surface; a landing page is read from further away, and next to a text-5xl
// heading the stock size reads as a stray toolbar button. Same component, same colours, same square
// corners — only the scale changes, and only for the two buttons that are the point of the page.
const CTA = "h-9 px-4 text-sm";

export default async function RootPage() {
    // A signed-in client asking for "/" wants their reports, not the pitch. This is the redirect that
    // used to be the whole page.
    const client = await getCurrentClient();
    if (client) redirect("/dashboard");

    const t = await getTranslations("landing");

    return (
        <div className="flex min-h-dvh flex-col">
            <header className="flex flex-row items-center justify-between gap-4 px-6 py-4">
                <Brand />

                <Button size="lg" render={<Link href="/auth/login">{t("signIn")}</Link>} />
            </header>

            <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:py-20 space-y-16 sm:space-y-20">
                <section className="max-w-3xl space-y-6">
                    <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                        {t("heroTitle")}
                    </h1>

                    <Typo as="lead" className="text-base sm:text-lg">
                        {t("heroBody")}
                    </Typo>

                    <div className="flex flex-row flex-wrap items-center gap-2">
                        <Button size="lg" className={CTA} render={<Link href="/auth/login">{t("signIn")}</Link>} />
                        <Button
                            size="lg"
                            variant="outline"
                            className={CTA}
                            render={<Link href="#how-it-works">{t("heroSteps")}</Link>}
                        />
                    </div>
                </section>

                <section id="how-it-works" className="space-y-6 scroll-mt-8">
                    <div className="max-w-2xl space-y-1">
                        <Typo as="title">{t("stepsTitle")}</Typo>
                        <Typo as="muted">{t("stepsBody")}</Typo>
                    </div>

                    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {STEPS.map((step, index) => {
                            const Icon = STEP_ICONS[step];

                            return (
                                <li key={step}>
                                    <Card className="h-full p-4 gap-3">
                                        <div className="flex flex-row items-center justify-between gap-2">
                                            <Icon className="size-4 text-muted-foreground" />
                                            <Typo as="muted" className="text-[10px] tabular-nums">
                                                {String(index + 1).padStart(2, "0")}
                                            </Typo>
                                        </div>

                                        <div className="space-y-1">
                                            <Typo as="large" className="text-sm">
                                                {t(`${step}Title`)}
                                            </Typo>
                                            <Typo as="muted" className="text-xs/relaxed">
                                                {t(`${step}Body`)}
                                            </Typo>
                                        </div>
                                    </Card>
                                </li>
                            );
                        })}
                    </ol>
                </section>

                <section className="space-y-6">
                    <Typo as="title" className="max-w-2xl">
                        {t("featuresTitle")}
                    </Typo>

                    {/* A plain ruled list rather than three more cards: the section above is already a
                        card grid, and two grids in a row read as one undifferentiated wall. */}
                    <dl className="grid gap-x-8 gap-y-8 border-t pt-8 sm:grid-cols-3">
                        {FEATURES.map((feature) => (
                            <div key={feature} className="space-y-1">
                                <dt>
                                    <Typo as="large" className="text-sm">
                                        {t(`${feature}Title`)}
                                    </Typo>
                                </dt>
                                <dd>
                                    <Typo as="muted" className="text-xs/relaxed">
                                        {t(`${feature}Body`)}
                                    </Typo>
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>

                <section>
                    <Card className="p-6 gap-4 flex-row flex-wrap items-center justify-between">
                        <div className="min-w-0 max-w-xl space-y-1">
                            <Typo as="large" className="text-sm">
                                {t("closingTitle")}
                            </Typo>
                            <Typo as="muted" className="text-xs/relaxed">
                                {t("closingBody")}
                            </Typo>
                        </div>

                        <Button size="lg" className={CTA} render={<Link href="/auth/login">{t("signIn")}</Link>} />
                    </Card>
                </section>
            </main>

            <footer className="mx-auto w-full max-w-5xl px-6 pb-8">
                <div className="flex flex-row flex-wrap items-center justify-between gap-4 border-t pt-6">
                    <Typo as="muted" className="text-xs">
                        Repolio
                    </Typo>

                    <div className="flex flex-row gap-4 text-xs text-muted-foreground">
                        <Link href="/privacy" className="transition-colors hover:text-foreground">
                            {t("privacy")}
                        </Link>
                        <Link href="/terms-of-service" className="transition-colors hover:text-foreground">
                            {t("terms")}
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
