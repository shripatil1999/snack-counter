import { describe, expect, it } from 'vitest';
import { ok, setup } from './fixtures';

describe('no double buying', () => {
  it('two people cannot both commit to the same refill', () => {
    const { service, chat } = setup();
    const refill = ok(service.reportEmpty('BLR', 'someone'));
    const offeredTo = refill.assigneeId!;

    // Someone else jumps in first; first accept wins.
    expect(service.accept(refill.id, 'ravi').ok).toBe(true);
    expect(service.accept(refill.id, offeredTo)).toEqual({ ok: false, reason: 'ALREADY_TAKEN' });
    expect(service.accept(refill.id, 'meera')).toEqual({ ok: false, reason: 'ALREADY_TAKEN' });

    expect(refill.assigneeId).toBe('ravi');
    expect(chat.messagesFor(offeredTo).at(-1)).toContain('ravi took it');
  });

  it('reporting the same empty box twice does not create a second refill', () => {
    const { service } = setup();
    const first = ok(service.reportEmpty('OSLO', 'a'));
    const second = ok(service.reportEmpty('OSLO', 'b'));

    expect(second.id).toBe(first.id);
    expect(service.all()).toHaveLength(1);
  });

  it('each office has its own independent refill', () => {
    const { service } = setup();
    const oslo = ok(service.reportEmpty('OSLO', 'a'));
    const blr = ok(service.reportEmpty('BLR', 'b'));
    expect(oslo.id).not.toBe(blr.id);
  });

  it('a new refill can be opened once the previous one is bought', () => {
    const { service } = setup();
    const first = ok(service.reportEmpty('OSLO', 'a'));
    ok(service.accept(first.id, 'kari'));
    ok(service.recordPurchase(first.id, 'kari', { amountMinor: 30000, currency: 'NOK' }, 'r.jpg'));

    const second = ok(service.reportEmpty('OSLO', 'a'));
    expect(second.id).not.toBe(first.id);
  });
});
