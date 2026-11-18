import { add, convert, subtract, zero, type RateTable } from './money';
import type { Currency, Money, Office, OfficeId, Refill } from './types';

/** Refills whose money counts as spent. A rejected claim was never paid by the company. */
function countsAsSpend(refill: Refill): boolean {
  return refill.purchase !== undefined && refill.status !== 'CLAIM_REJECTED';
}

/** "2026-11" for the given instant, in the office's own time zone. */
export function monthKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  return `${year}-${month}`;
}

export function spentInMonth(office: Office, refills: Refill[], month: string, excludeRefillId?: string): Money {
  return refills
    .filter((r) => r.office === office.id && r.id !== excludeRefillId && countsAsSpend(r))
    .filter((r) => monthKey(r.purchase!.purchasedAt, office.timeZone) === month)
    .reduce((sum, r) => add(sum, r.purchase!.amount), zero(office.currency));
}

export function remainingBudget(office: Office, refills: Refill[], at: Date, excludeRefillId?: string): Money {
  const month = monthKey(at, office.timeZone);
  return subtract(office.monthlyBudget, spentInMonth(office, refills, month, excludeRefillId));
}

export interface OfficeReportLine {
  office: OfficeId;
  refillCount: number;
  spentLocal: Money;
  budgetLocal: Money;
  spentInReportCurrency: Money;
}

export interface MonthlyReport {
  month: string;
  reportCurrency: Currency;
  rates: RateTable;
  offices: OfficeReportLine[];
  total: Money;
}

/** One report for management covering both offices, converted with a fixed monthly rate. */
export function monthlyReport(
  offices: Office[],
  refills: Refill[],
  month: string,
  reportCurrency: Currency,
  rates: RateTable,
): MonthlyReport {
  const lines = offices.map((office): OfficeReportLine => {
    const spentLocal = spentInMonth(office, refills, month);
    const refillCount = refills.filter(
      (r) =>
        r.office === office.id &&
        countsAsSpend(r) &&
        monthKey(r.purchase!.purchasedAt, office.timeZone) === month,
    ).length;
    return {
      office: office.id,
      refillCount,
      spentLocal,
      budgetLocal: office.monthlyBudget,
      spentInReportCurrency: convert(spentLocal, reportCurrency, rates),
    };
  });
  const total = lines.reduce((sum, l) => add(sum, l.spentInReportCurrency), zero(reportCurrency));
  return { month, reportCurrency, rates, offices: lines, total };
}
