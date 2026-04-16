/**
 * Format a price number as a currency string.
 * Assumes prices are stored as decimal dollars (e.g. 25.00).
 */
export function formatPrice(
  amount: number,
  currency = 'CAD',
  locale = 'en-CA',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}
