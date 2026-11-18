import { describe, expect, it } from 'vitest';
import { money } from '../src/core/money';
import { ok, setup } from './fixtures';

describe('refills nobody completes are handed on', () => {
  it('an offer not answered within 2 hours goes to the next volunteer', () => {
    const { service, clock } = setup();
    const refill = ok(service.reportEmpty('OSLO', 'someone'));
    expect(refill.assigneeId).toBe('kari');

    clock.advanceHours(1.9);
    service.tick();
    expect(refill.assigneeId).toBe('kari');

    clock.advanceHours(0.2);
    service.tick();
    expect(refill.status).toBe('OFFERED');
    expect(refill.assigneeId).toBe('ola');
    expect(refill.passedOver).toEqual(['kari']);
  });

  it('an accepted refill not bought within 24 hours goes to someone else', () => {
    const { service, clock, chat } = setup();
    const refill = ok(service.reportEmpty('OSLO', 'someone'));
    ok(service.accept(refill.id, 'kari'));

    clock.advanceHours(24);
    service.tick();

    expect(refill.status).toBe('OFFERED');
    expect(refill.assigneeId).toBe('ola');
    expect(chat.messagesFor('kari').at(-1)).toContain('handed to someone else');

    // Kari can no longer record a purchase for it.
    const late = service.recordPurchase(refill.id, 'kari', money(300, 'NOK'), 'r.jpg');
    expect(late).toEqual({ ok: false, reason: 'NOT_YOUR_REFILL' });
  });

  it('a decline goes straight to the next volunteer', () => {
    const { service } = setup();
    const refill = ok(service.reportEmpty('OSLO', 'someone'));
    ok(service.decline(refill.id, 'kari'));
    expect(refill.assigneeId).toBe('ola');
  });

  it('when everyone has passed, the office channel is asked and anyone can still take it', () => {
    const { service, chat } = setup();
    const refill = ok(service.reportEmpty('OSLO', 'someone'));
    ok(service.decline(refill.id, 'kari'));
    ok(service.decline(refill.id, 'ola'));

    expect(refill.status).toBe('UNASSIGNED');
    expect(chat.messagesFor('#OSLO')).toHaveLength(1);

    service.tick(); // retries must not spam the channel
    expect(chat.messagesFor('#OSLO')).toHaveLength(1);

    ok(service.accept(refill.id, 'kari'));
    expect(refill.status).toBe('ACCEPTED');
  });

  it('an unassigned refill is offered when someone comes back to the office', () => {
    const { service, presence } = setup();
    presence.set('ola', { kind: 'HOLIDAY' });
    presence.set('kari', { kind: 'HOME' });

    const refill = ok(service.reportEmpty('OSLO', 'someone'));
    expect(refill.status).toBe('UNASSIGNED');

    presence.clear('ola'); // back from holiday, at home office
    service.tick();
    expect(refill.status).toBe('OFFERED');
    expect(refill.assigneeId).toBe('ola');
  });
});
