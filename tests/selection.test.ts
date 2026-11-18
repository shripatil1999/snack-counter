import { describe, expect, it } from 'vitest';
import { FakeClock } from '../src/core/clock';
import { money } from '../src/core/money';
import { PresenceRegistry } from '../src/core/presence';
import type { Refill } from '../src/core/types';
import { chooseVolunteer } from '../src/core/volunteerSelector';
import { START, VOLUNTEERS, ok, setup } from './fixtures';

function pastPurchase(buyerId: string, daysAgo: number): Refill {
  return {
    id: `old-${buyerId}-${daysAgo}`,
    office: 'BLR',
    status: 'REIMBURSED',
    reportedBy: 'x',
    reportedAt: new Date(START.getTime() - daysAgo * 86_400_000),
    passedOver: [],
    hrReminderSent: false,
    history: [],
    purchase: {
      buyerId,
      amount: money(500, 'INR'),
      receiptImage: 'r.jpg',
      purchasedAt: new Date(START.getTime() - daysAgo * 86_400_000),
    },
  };
}

describe('choosing who buys', () => {
  const now = new FakeClock(START).now();

  it('picks the volunteer with the fewest refills in the last 30 days', () => {
    const history = [pastPurchase('asha', 2), pastPurchase('asha', 5), pastPurchase('meera', 3)];
    const chosen = chooseVolunteer('BLR', VOLUNTEERS, new PresenceRegistry(), history, now);
    expect(chosen?.employeeId).toBe('ravi');
  });

  it('ignores refills older than 30 days', () => {
    const history = [pastPurchase('asha', 40), pastPurchase('meera', 3), pastPurchase('ravi', 4)];
    const chosen = chooseVolunteer('BLR', VOLUNTEERS, new PresenceRegistry(), history, now);
    expect(chosen?.employeeId).toBe('asha');
  });

  it('on a tie, picks whoever bought longest ago', () => {
    const history = [pastPurchase('asha', 2), pastPurchase('meera', 10), pastPurchase('ravi', 5)];
    const chosen = chooseVolunteer('BLR', VOLUNTEERS, new PresenceRegistry(), history, now);
    expect(chosen?.employeeId).toBe('meera');
  });

  it('skips people on holiday or working from home', () => {
    const presence = new PresenceRegistry();
    presence.set('asha', { kind: 'HOLIDAY' });
    presence.set('meera', { kind: 'HOME' });
    const chosen = chooseVolunteer('BLR', VOLUNTEERS, presence, [pastPurchase('ravi', 1)], now);
    expect(chosen?.employeeId).toBe('ravi'); // only one left, even though he bought recently
  });

  it('includes visitors from the other office and excludes them at home', () => {
    const presence = new PresenceRegistry();
    presence.set('ola', { kind: 'OFFICE', office: 'BLR' });
    const history = [pastPurchase('asha', 1), pastPurchase('meera', 1), pastPurchase('ravi', 1)];

    expect(chooseVolunteer('BLR', VOLUNTEERS, presence, history, now)?.employeeId).toBe('ola');
    expect(chooseVolunteer('OSLO', VOLUNTEERS, presence, history, now)?.employeeId).toBe('kari');
  });

  it('a visitor buying in Bengaluru is charged to the Bengaluru budget, claimed in INR', () => {
    const { service, presence, hr } = setup();
    presence.set('ola', { kind: 'OFFICE', office: 'BLR' });

    const refill = ok(service.reportEmpty('BLR', 'someone'));
    ok(service.accept(refill.id, 'ola'));
    ok(service.recordPurchase(refill.id, 'ola', money(2000, 'INR'), 'r.jpg'));

    expect(hr.claims.get(refill.claimId!)?.amount).toEqual(money(2000, 'INR'));
    expect(service.remaining('BLR')).toEqual(money(13000, 'INR'));
    expect(service.remaining('OSLO')).toEqual(money(6000, 'NOK'));
  });
});
