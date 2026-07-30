import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Repolio",
    description: "AI reporting tools for marketing agencies.",
};

export default async function RootLayout({ children }: React.PropsWithChildren) {
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning className={`${sans.variable} ${mono.variable} h-full antialiased`}>
            <head>
                <meta name="apple-mobile-web-app-title" content="Repolio" />
            </head>

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
