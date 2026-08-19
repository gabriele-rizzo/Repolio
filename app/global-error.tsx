"use client";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/locales";
import { useSyncExternalStore } from "react";

// Last-resort boundary: this catches a throw in the ROOT LAYOUT itself, which app/dashboard/error.tsx
// and app/admin/error.tsx cannot — they live inside it.
//
// It therefore REPLACES the root layout, and everything the layout provides is gone: no
// NextIntlClientProvider (so `useTranslations` would throw — the one thing this page must never do),
// no ThemeProvider, no font variables, and no guarantee that globals.css and its CSS custom
// properties are on the page. So this file deliberately owes nothing to the rest of the app: its own
// <html>/<body>, its own inlined styles, its own copy. Every abstraction reused here is one more thing
// that can be broken at the moment this page is needed.
//
// The copy is inlined rather than translated for the same reason. The locale still comes from the
// cookie the proxy sets, so a German client gets German.

const COPY: Record<Locale, { title: string; description: string; retry: string; reference: string }> = {
    de: {
        title: "Etwas ist schiefgelaufen",
        description: "Beim Laden der Seite ist ein unerwartetes Problem aufgetreten. Es ist nichts verloren gegangen.",
        retry: "Erneut versuchen",
        reference: "Referenz",
    },
    en: {
        title: "Something went wrong",
        description: "We hit an unexpected problem while loading the page. Nothing was lost.",
        retry: "Try again",
        reference: "Reference",
    },
    it: {
        title: "Si è verificato un errore",
        description: "Si è verificato un problema inatteso durante il caricamento della pagina. Non è andato perso nulla.",
        retry: "Riprova",
        reference: "Riferimento",
    },
};

// useSyncExternalStore rather than an effect or a render-time read: it is the one API that reads an
// external source with an explicit SERVER snapshot, so the server render and the hydration agree by
// construction instead of mismatching on a page that only renders when something is already wrong.
// The cookie cannot change while this page is up, so subscribe is a no-op.
const subscribe = () => () => {};
const serverSnapshot = (): Locale => DEFAULT_LOCALE;

function clientSnapshot(): Locale {
    const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
    const value = match?.[1] && decodeURIComponent(match[1]);
    return isLocale(value) ? value : DEFAULT_LOCALE;
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const locale = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
    const copy = COPY[locale];

    return (
        <html lang={locale}>
            <body>
                {/* Inlined, self-contained styles: no Tailwind build output and no CSS variables are
                    assumed to be present. Both schemes are declared, since next-themes isn't here to
                    resolve one. */}
                <style>{`
                    :root { color-scheme: light dark; --rp-bg: #ffffff; --rp-fg: #09090b; --rp-muted: #71717a; --rp-border: #e4e4e7; --rp-accent: #18181b; --rp-accent-fg: #fafafa; }
                    @media (prefers-color-scheme: dark) {
                        :root { --rp-bg: #09090b; --rp-fg: #fafafa; --rp-muted: #a1a1aa; --rp-border: #27272a; --rp-accent: #fafafa; --rp-accent-fg: #18181b; }
                    }
                    body { margin: 0; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
                           background: var(--rp-bg); color: var(--rp-fg);
                           font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
                    .rp-card { width: 100%; max-width: 28rem; text-align: center; border: 1px dashed var(--rp-border); border-radius: 0.75rem; padding: 2rem 1.5rem; }
                    .rp-title { margin: 0 0 0.5rem; font-size: 1.125rem; font-weight: 600; }
                    .rp-body { margin: 0 0 1.5rem; font-size: 0.875rem; line-height: 1.5; color: var(--rp-muted); }
                    .rp-btn { font: inherit; font-size: 0.875rem; font-weight: 500; cursor: pointer; border: 0; border-radius: 0.5rem;
                              padding: 0.5rem 1rem; background: var(--rp-accent); color: var(--rp-accent-fg); }
                    .rp-btn:hover { opacity: 0.85; }
                    .rp-ref { margin: 1rem 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.75rem; color: var(--rp-muted); }
                `}</style>

                <div className="rp-card">
                    <h1 className="rp-title">{copy.title}</h1>
                    <p className="rp-body">{copy.description}</p>

                    <button type="button" className="rp-btn" onClick={reset}>
                        {copy.retry}
                    </button>

                    {/* In production the message is withheld from the client, so the digest is the only
                        handle tying what the user saw to a server log line. */}
                    {error.digest && <p className="rp-ref">{`${copy.reference} ${error.digest}`}</p>}
                </div>
            </body>
        </html>
    );
}
