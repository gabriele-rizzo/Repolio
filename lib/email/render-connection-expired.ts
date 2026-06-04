import "server-only";

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
 * Renders the "reconnect your account" transactional email sent when an automatic token refresh
 * fails. Returns a self-contained HTML string; does not send anything.
 */
export function renderConnectionExpiredEmail(opts: {
    clientName: string;
    platformLabel: string;
    reconnectUrl: string;
}): RenderedConnectionEmail {
    const name = escapeHtml(opts.clientName?.trim() || "there");
    const platform = escapeHtml(opts.platformLabel);
    const { reconnectUrl } = opts;
    const subject = `Action needed: reconnect your ${opts.platformLabel} account`;

    const html =
        "<!DOCTYPE html>" +
        `<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(subject)}</title></head>` +
        `<body style="margin:0;padding:24px 0;background-color:${pageBg};font-family:${fontStack};color:${ink};">` +
        `<div style="max-width:560px;margin:0 auto;padding:0 16px;">` +
        `<div style="background-color:${white};border:1px solid ${border};padding:24px;">` +
        `<div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;color:${muted};margin-bottom:8px;">Connection expired</div>` +
        `<h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:${ink};">Reconnect your ${platform} account</h1>` +
        `<p style="font-size:14px;line-height:1.6;color:${bodyText};margin:0 0 16px;">Hi ${name}, we couldn't automatically refresh your ${platform} connection, so we've paused collecting new performance data. Reconnect to resume your reports — it only takes a moment.</p>` +
        `<a href="${reconnectUrl}" style="display:inline-block;background-color:${primary};color:${primaryFg};padding:10px 16px;text-decoration:none;font-size:14px;font-weight:600;">Reconnect ${platform}</a>` +
        `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${muted};">If the button doesn't work, paste this link into your browser:<br />${escapeHtml(reconnectUrl)}</p>` +
        `</div>` +
        `<div style="margin-top:16px;font-size:12px;color:${muted};text-align:center;">Sent by Repolio</div>` +
        `</div></body></html>`;

    return { subject, html };
}
