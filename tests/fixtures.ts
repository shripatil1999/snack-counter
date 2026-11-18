import { FakeChatTool } from '../src/adapters/chatTool';
import { FakeHrSystem } from '../src/adapters/hrSystem';
import { FakeClock } from '../src/core/clock';
import { money } from '../src/core/money';
import { PresenceRegistry } from '../src/core/presence';
import { RefillService } from '../src/core/refillService';
import type { Office, Volunteer } from '../src/core/types';

export const OSLO: Office = {
  id: 'OSLO',
  name: 'Oslo',
  currency: 'NOK',
  timeZone: 'Europe/Oslo',
  monthlyBudget: money(6000, 'NOK'),
  managerId: 'oslo-manager',
};

export const BLR: Office = {
  id: 'BLR',
  name: 'Bengaluru',
  currency: 'INR',
  timeZone: 'Asia/Kolkata',
  monthlyBudget: money(15000, 'INR'),
  managerId: 'blr-manager',
};

export const VOLUNTEERS: Volunteer[] = [
  { employeeId: 'ola', name: 'Ola', homeOffice: 'OSLO' },
  { employeeId: 'kari', name: 'Kari', homeOffice: 'OSLO' },
  { employeeId: 'asha', name: 'Asha', homeOffice: 'BLR' },
  { employeeId: 'ravi', name: 'Ravi', homeOffice: 'BLR' },
  { employeeId: 'meera', name: 'Meera', homeOffice: 'BLR' },
];

/** Mid-month, mid-day in both time zones. */
export const START = new Date('2026-11-10T08:00:00Z');

export function setup() {
  const clock = new FakeClock(START);
  const chat = new FakeChatTool();
  const hr = new FakeHrSystem();
  const presence = new PresenceRegistry();
  const service = new RefillService({
    offices: [OSLO, BLR],
    volunteers: VOLUNTEERS,
    presence,
    chat,
    hr,
    clock,
  });
  return { clock, chat, hr, presence, service };
}

/** Unwraps a Result in tests, failing loudly if it was an error. */
export function ok<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`Expected ok, got ${result.reason}`);
  return result.value;
}
