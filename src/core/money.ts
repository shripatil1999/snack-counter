import type { Currency, Money } from './types';

/** Both NOK and INR have 100 minor units. */
const MINOR_PER_MAJOR = 100;

export function money(major: number, currency: Currency): Money {
  return { amountMinor: Math.round(major * MINOR_PER_MAJOR), currency };
}

export function zero(currency: Currency): Money {
  return { amountMinor: 0, currency };
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor - b.amountMinor, currency: a.currency };
}

export function greaterThan(a: Money, b: Money): boolean {
  assertSameCurrency(a, b);
  return a.amountMinor > b.amountMinor;
}

/**
 * rates[c] = how many units of the target currency one unit of c is worth.
 * Example with target NOK: { NOK: 1, INR: 0.12 }.
 */
export type RateTable = Record<Currency, number>;

export function convert(m: Money, to: Currency, rates: RateTable): Money {
  if (m.currency === to) return m;
  return { amountMinor: Math.round(m.amountMinor * rates[m.currency]), currency: to };
}

export function format(m: Money): string {
  return `${(m.amountMinor / MINOR_PER_MAJOR).toFixed(2)} ${m.currency}`;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}
