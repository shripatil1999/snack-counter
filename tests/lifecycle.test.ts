import { describe, expect, it } from 'vitest';
import { money } from '../src/core/money';
import { ok, setup } from './fixtures';

describe('refill lifecycle: empty -> reimbursed', () => {
  it('moves through every state and sends the claim to HR automatically', () => {
    const { service, hr, chat } = setup();

    const refill = ok(service.reportEmpty('OSLO', 'someone'));
    expect(refill.status).toBe('OFFERED');
    expect(refill.assigneeId).toBe('kari'); // nobody has refilled yet, so alphabetical tie-break
    expect(chat.messagesFor('kari')[0]).toContain('snack box is empty');

    ok(service.accept(refill.id, 'kari'));
    expect(refill.status).toBe('ACCEPTED');

    ok(service.recordPurchase(refill.id, 'kari', money(450, 'NOK'), 'receipt.jpg', ['chips', 'fruit']));
    expect(refill.status).toBe('CLAIM_SUBMITTED');

    const claim = hr.claims.get(refill.claimId!)!;
    expect(claim).toMatchObject({
      employeeId: 'kari',
      amount: { amountMinor: 45000, currency: 'NOK' },
      receiptImage: 'receipt.jpg',
    });

    service.tick();
    expect(refill.status).toBe('CLAIM_SUBMITTED'); // HR has not decided yet

    hr.approve(refill.claimId!);
    service.tick();
    expect(refill.status).toBe('REIMBURSED');
    expect(chat.messagesFor('kari').at(-1)).toContain('approved');
  });

  it('only the buyer can record the purchase', () => {
    const { service } = setup();
    const refill = ok(service.reportEmpty('OSLO', 'someone'));
    ok(service.accept(refill.id, 'kari'));

    const result = service.recordPurchase(refill.id, 'ola', money(300, 'NOK'), 'r.jpg');
    expect(result).toEqual({ ok: false, reason: 'NOT_YOUR_REFILL' });
  });

  it('rejects a receipt in the wrong currency', () => {
    const { service } = setup();
    const refill = ok(service.reportEmpty('OSLO', 'someone'));
    ok(service.accept(refill.id, 'kari'));

    const result = service.recordPurchase(refill.id, 'kari', money(300, 'INR'), 'r.jpg');
    expect(result).toEqual({ ok: false, reason: 'WRONG_CURRENCY' });
  });

  it('a rejected HR claim notifies the buyer and the manager', () => {
    const { service, hr, chat } = setup();
    const refill = ok(service.reportEmpty('BLR', 'someone'));
    ok(service.accept(refill.id, refill.assigneeId!));
    ok(service.recordPurchase(refill.id, refill.assigneeId!, money(1200, 'INR'), 'r.jpg'));

    hr.reject(refill.claimId!);
    service.tick();

    expect(refill.status).toBe('CLAIM_REJECTED');
    expect(chat.messagesFor('blr-manager').at(-1)).toContain('rejected');
  });

  it('retries the HR claim if the HR system was down', () => {
    const { service, hr } = setup();
    const refill = ok(service.reportEmpty('OSLO', 'someone'));
    ok(service.accept(refill.id, 'kari'));

    hr.unavailable = true;
    ok(service.recordPurchase(refill.id, 'kari', money(300, 'NOK'), 'r.jpg'));
    expect(refill.status).toBe('PURCHASED');

    hr.unavailable = false;
    service.tick();
    expect(refill.status).toBe('CLAIM_SUBMITTED');
  });

  it('reminds the manager once if HR has not decided after 7 days', () => {
    const { service, clock, chat } = setup();
    const refill = ok(service.reportEmpty('OSLO', 'someone'));
    ok(service.accept(refill.id, 'kari'));
    ok(service.recordPurchase(refill.id, 'kari', money(300, 'NOK'), 'r.jpg'));

    clock.advanceHours(6 * 24);
    service.tick();
    expect(chat.messagesFor('oslo-manager')).toHaveLength(0);

    clock.advanceHours(24);
    service.tick();
    service.tick();
    expect(chat.messagesFor('oslo-manager')).toHaveLength(1);
  });
});
