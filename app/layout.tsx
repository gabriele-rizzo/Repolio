import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
    SITE_DESCRIPTION,
    SITE_NAME,
    SITE_SOCIAL_DESCRIPTION,
    SITE_TITLE,
    SITE_TITLE_TEMPLATE,
    siteOrigin,
} from "@/lib/site";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// The only metadata block that describes the SITE; every other one names a single page. The strings and
// the origin come from lib/site.ts, shared with the generated social card so a preview can never show
// copy the meta tags contradict.
//
// `metadataBase` is what makes the rest work: Next resolves the image entries against it, and a crawler
// discards a relative og:image outright. Nothing here is inherited by accident either — a page that sets
// only `title` still gets this description, site name and card, which is what the auth and legal pages
// (the only publicly reachable ones) want.
export const metadata: Metadata = {
    metadataBase: siteOrigin(),
    title: { default: SITE_TITLE, template: SITE_TITLE_TEMPLATE },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    openGraph: {
        type: "website",
        siteName: SITE_NAME,
        title: SITE_TITLE,
        description: SITE_SOCIAL_DESCRIPTION,
        url: "/",
        // The app UI is de/en/it; this copy is English only, so the card declares English rather than
        // Client.locale or the visitor's cookie, neither of which a crawler carries.
        locale: "en_US",
    },
    // Names the installed web app on iOS. Was a hand-written <meta> in the layout's <head>; it belongs
    // with the rest of the tags so there is one place to read what this page declares.
    appleWebApp: { title: SITE_NAME },
    twitter: {
        // Without this X renders the card as a small thumbnail, or as text with no media at all.
        card: "summary_large_image",
        title: SITE_TITLE,
        description: SITE_SOCIAL_DESCRIPTION,
    },
};

export default async function RootLayout({ children }: React.PropsWithChildren) {
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning className={`${sans.variable} ${mono.variable} h-full antialiased`}>
            <body className="min-h-full flex flex-col">
                <NextIntlClientProvider locale={locale} messages={messages}>
                    <ThemeProvider>
                        <TooltipProvider>{children}</TooltipProvider>
                        {/* The themed wrapper, not sonner's raw Toaster: it reads next-themes and maps toasts onto the
                            app's own CSS variables. The raw one was pinned to theme="system", so toasts followed the OS
                            rather than the in-app theme toggle. */}
                        <Toaster richColors />
                    </ThemeProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
