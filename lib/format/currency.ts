/**
 * Builds a currency formatter for an ISO 4217 code (e.g. "EUR", "USD"). The locale is fixed to
 * en-US so digit grouping matches the rest of the app's formatters; only the currency symbol and
 * placement vary per account. `maximumFractionDigits` defaults to 2 (whole-money displays pass 0).
 */
export function currencyFormatter(code: string, maximumFractionDigits = 2): Intl.NumberFormat {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits });
}
