/**
 * Money Handling Module
 * 
 * Rules:
 * 1. Money is always represented as an integer in minor units (e.g., cents).
 * 2. Never use floats or decimals for monetary arithmetic.
 * 3. Currency is a single app-wide constant.
 */

export const CURRENCY = 'usd';

/**
 * Formats an amount in minor units to a localized currency string.
 * The division by 100 happens exclusively at the display boundary.
 */
export function formatMoney(amountInMinorUnits: number, locale = 'en-US'): string {
  if (!Number.isInteger(amountInMinorUnits)) {
    throw new Error('Monetary amounts must be integers (minor units).');
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY.toUpperCase(),
  }).format(amountInMinorUnits / 100);
}

/**
 * Converts a major unit string (like "10.50") to minor units (1050).
 * Prevents float math (e.g., 10.50 * 100) by parsing the string directly.
 */
export function toMinorUnits(amountStr: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(amountStr)) {
    throw new Error('Invalid money format. Must be a positive number with up to 2 decimal places.');
  }
  
  const [dollars = '0', cents = '00'] = amountStr.split('.');
  const paddedCents = cents.padEnd(2, '0');
  
  return parseInt(dollars, 10) * 100 + parseInt(paddedCents, 10);
}

/**
 * Calculates the prorated credit for unused time on a plan.
 * 
 * Arithmetic: Multiplies first before dividing to avoid float precision loss.
 * Rounding: Uses Math.ceil so the business "eats the cent". The customer gets 
 * the benefit of the fractional cent during an upgrade.
 * 
 * @param priceInMinorUnits The total price of the current period in minor units
 * @param totalDays The total days in the billing cycle
 * @param unusedDays The remaining days that were paid for but won't be used
 */
export function calculateProratedCredit(
  priceInMinorUnits: number,
  totalDays: number,
  unusedDays: number
): number {
  if (!Number.isInteger(priceInMinorUnits)) {
    throw new Error('Price must be in minor units (integer).');
  }
  
  if (unusedDays < 0 || totalDays <= 0 || unusedDays > totalDays) {
    throw new Error('Invalid day counts for proration.');
  }

  // E.g., Upgrading on day 12 of a 30-day cycle: unusedDays = 18
  // (Price * 18) / 30
  const credit = Math.ceil((priceInMinorUnits * unusedDays) / totalDays);
  
  return credit;
}
