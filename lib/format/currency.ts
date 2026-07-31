/**
 * Builds a currency formatter for an ISO 4217 code (e.g. "EUR", "USD").
 *
 * `locale` controls digit grouping and decimal separators — a German report should read "€3.460,45",
 * not "€3,460.45". It defaults to en-US so the web dashboard keeps the grouping it has always used;
 * the report renderers pass the recipient's own locale.
 */
export function currencyFormatter(code: string, maximumFractionDigits = 2, locale = "en-US"): Intl.NumberFormat {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code, maximumFractionDigits });
}
