import { describe, expect, it } from 'vitest';
import { monthKey, monthlyReport } from '../src/core/budget';
import { money } from '../src/core/money';
import type { OfficeId } from '../src/core/types';
import { BLR, OSLO, ok, setup } from './fixtures';

function buy(ctx: ReturnType<typeof setup>, office: OfficeId, major: number) {
  const refill = ok(ctx.service.reportEmpty(office, 'someone'));
  const buyer = refill.assigneeId!;
  ok(ctx.service.accept(refill.id, buyer));
  ok(ctx.service.recordPurchase(refill.id, buyer, money(major, office === 'OSLO' ? 'NOK' : 'INR'), 'r.jpg'));
  return refill;
}

describe('budget check', () => {
  it('tracks remaining budget per office in its own currency', () => {
    const ctx = setup();
    buy(ctx, 'OSLO', 1200);
    buy(ctx, 'OSLO', 800.5);
    buy(ctx, 'BLR', 3000);

    expect(ctx.service.remaining('OSLO')).toEqual(money(3999.5, 'NOK'));
    expect(ctx.service.remaining('BLR')).toEqual(money(12000, 'INR'));
  });

  it('an over-budget purchase waits for manager approval before going to HR', () => {
    const ctx = setup();
    for (let i = 0; i < 5; i++) buy(ctx, 'OSLO', 1100); // 5 500 NOK spent, 500 left

    const refill = buy(ctx, 'OSLO', 700);
    expect(refill.status).toBe('NEEDS_APPROVAL');
    expect(refill.claimId).toBeUndefined();
    expect(ctx.chat.messagesFor('oslo-manager').at(-1)).toContain('Please approve');

    expect(ctx.service.approveOverBudget(refill.id, 'kari')).toEqual({ ok: false, reason: 'NOT_THE_MANAGER' });
    ok(ctx.service.approveOverBudget(refill.id, 'oslo-manager'));
    expect(refill.status).toBe('CLAIM_SUBMITTED');
  });

  it('blocks new refills when the month budget is used up', () => {
    const ctx = setup();
    for (let i = 0; i < 5; i++) buy(ctx, 'BLR', 3000); // exactly 15 000 INR

    expect(ctx.service.reportEmpty('BLR', 'someone')).toEqual({ ok: false, reason: 'BUDGET_EXHAUSTED' });
    expect(ctx.service.reportEmpty('OSLO', 'someone').ok).toBe(true);
  });

  it('the budget resets in a new month', () => {
    const ctx = setup();
    for (let i = 0; i < 5; i++) buy(ctx, 'BLR', 3000);
    ctx.clock.set(new Date('2026-12-02T08:00:00Z'));
    expect(ctx.service.remaining('BLR')).toEqual(money(15000, 'INR'));
  });

  it('a rejected claim does not count as spend', () => {
    const ctx = setup();
    const refill = buy(ctx, 'OSLO', 1000);
    ctx.hr.reject(refill.claimId!);
    ctx.service.tick();
    expect(ctx.service.remaining('OSLO')).toEqual(money(6000, 'NOK'));
  });
});

describe('monthly report across currencies', () => {
  const rates = { NOK: 1, INR: 0.12 }; // fixed monthly rate: 1 INR = 0.12 NOK

  it('converts each office and totals in NOK', () => {
    const ctx = setup();
    buy(ctx, 'OSLO', 1200);
    buy(ctx, 'OSLO', 800);
    buy(ctx, 'BLR', 3000);
    buy(ctx, 'BLR', 1500.25);

    const report = monthlyReport([OSLO, BLR], [...ctx.service.all()], '2026-11', 'NOK', rates);

    expect(report.offices[0]).toMatchObject({ office: 'OSLO', refillCount: 2, spentLocal: money(2000, 'NOK') });
    expect(report.offices[1]).toMatchObject({ office: 'BLR', refillCount: 2, spentLocal: money(4500.25, 'INR') });
    expect(report.offices[1].spentInReportCurrency).toEqual(money(540.03, 'NOK')); // 4500.25 * 0.12 = 540.03
    expect(report.total).toEqual(money(2540.03, 'NOK'));
  });

  it('can also report in INR', () => {
    const ctx = setup();
    buy(ctx, 'OSLO', 120);
    buy(ctx, 'BLR', 1000);
    const report = monthlyReport([OSLO, BLR], [...ctx.service.all()], '2026-11', 'INR', { NOK: 8.5, INR: 1 });
    expect(report.total).toEqual(money(2020, 'INR')); // 120 * 8.5 + 1000
  });

  it('assigns a purchase to the month in the office local time zone', () => {
    // 23:30 UTC on 30 Nov is already 1 Dec in both Oslo (00:30) and Bengaluru (05:00).
    const lateNight = new Date('2026-11-30T23:30:00Z');
    expect(monthKey(lateNight, OSLO.timeZone)).toBe('2026-12');
    expect(monthKey(lateNight, BLR.timeZone)).toBe('2026-12');
    expect(monthKey(lateNight, 'UTC')).toBe('2026-11');

    const ctx = setup();
    ctx.clock.set(lateNight);
    buy(ctx, 'BLR', 1000);
    const nov = monthlyReport([OSLO, BLR], [...ctx.service.all()], '2026-11', 'NOK', rates);
    const dec = monthlyReport([OSLO, BLR], [...ctx.service.all()], '2026-12', 'NOK', rates);
    expect(nov.total.amountMinor).toBe(0);
    expect(dec.total).toEqual(money(120, 'NOK'));
  });
});
