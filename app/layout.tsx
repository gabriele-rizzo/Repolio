import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";

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
            <body className="min-h-full flex flex-col">
                <NextIntlClientProvider locale={locale} messages={messages}>
                    <ThemeProvider>
                        <TooltipProvider>{children}</TooltipProvider>
                        <Toaster theme="system" richColors />
                    </ThemeProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
