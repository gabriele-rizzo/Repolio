import "server-only";

import { DEFAULT_LOCALE, isLocale } from "@/i18n/locales";
import { getTranslations } from "next-intl/server";

export interface RenderedConnectionEmail {
    subject: string;
    html: string;
}

const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Neutral palette mirroring the report email (inline styles, square corners — email clients don't
// load Tailwind/theme CSS).
const ink = "#0a0a0a";
const bodyText = "#404040";
const muted = "#737373";
const border = "#e5e5e5";
const pageBg = "#fafafa";
const white = "#ffffff";
const primary = "#171717";
const primaryFg = "#fafafa";
const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Renders the "reconnect your account" transactional email sent when a connection's health check
 * fails. Returns a self-contained HTML string; does not send anything.
 *
 * Rendered in the CLIENT'S language, like the batch report email (lib/report/send-batch.ts). It used to
 * be hardcoded English with `lang="en"`, which meant a German client — the default locale — got their
 * reports in German and this one in English, at the exact moment they had to act on it.
 *
 * `locale` is passed explicitly rather than detected: the health check runs in the daily cron, which has
 * no request to infer a language from. That is also why `Client.locale` is always a concrete language.
 */
export async function renderConnectionExpiredEmail(opts: {
    clientName: string;
    platformLabel: string;
    reconnectUrl: string;
    locale: string;
}): Promise<RenderedConnectionEmail> {
    const locale = isLocale(opts.locale) ? opts.locale : DEFAULT_LOCALE;
    const t = await getTranslations({ locale, namespace: "email.connectionExpired" });

    const clientName = opts.clientName?.trim();
    const { reconnectUrl } = opts;

    // Subject stays unescaped — it is a mail header, not markup. Everything interpolated into the HTML
    // below goes through escapeHtml, translated copy included.
    const subject = t("subject", { platform: opts.platformLabel });
    const intro = escapeHtml(
        clientName
            ? t("intro", { name: clientName, platform: opts.platformLabel })
            : t("introNoName", { platform: opts.platformLabel }),
    );

    const html =
        "<!DOCTYPE html>" +
        `<html lang="${locale}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(subject)}</title></head>` +
        `<body style="margin:0;padding:24px 0;background-color:${pageBg};font-family:${fontStack};color:${ink};">` +
        `<div style="max-width:560px;margin:0 auto;padding:0 16px;">` +
        `<div style="background-color:${white};border:1px solid ${border};padding:24px;">` +
        `<div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;color:${muted};margin-bottom:8px;">${escapeHtml(t("eyebrow"))}</div>` +
        `<h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:${ink};">${escapeHtml(t("heading", { platform: opts.platformLabel }))}</h1>` +
        `<p style="font-size:14px;line-height:1.6;color:${bodyText};margin:0 0 16px;">${intro}</p>` +
        `<a href="${reconnectUrl}" style="display:inline-block;background-color:${primary};color:${primaryFg};padding:10px 16px;text-decoration:none;font-size:14px;font-weight:600;">${escapeHtml(t("cta", { platform: opts.platformLabel }))}</a>` +
        `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${muted};">${escapeHtml(t("linkFallback"))}<br />${escapeHtml(reconnectUrl)}</p>` +
        `</div>` +
        `<div style="margin-top:16px;font-size:12px;color:${muted};text-align:center;">${escapeHtml(t("footer"))}</div>` +
        `</div></body></html>`;

    return { subject, html };
}
