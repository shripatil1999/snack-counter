// Wires the real core (src/core) to the fake adapters for the demo screen.
// Nothing here contains business rules; it only creates sample data.

import { FakeChatTool } from '../adapters/chatTool';
import { FakeHrSystem } from '../adapters/hrSystem';
import { FakeClock } from '../core/clock';
import { money, type RateTable } from '../core/money';
import { PresenceRegistry } from '../core/presence';
import { RefillService } from '../core/refillService';
import type { Office, Volunteer } from '../core/types';

export const OFFICES: Office[] = [
  {
    id: 'OSLO',
    name: 'Oslo',
    currency: 'NOK',
    timeZone: 'Europe/Oslo',
    monthlyBudget: money(6000, 'NOK'),
    managerId: 'oslo-manager',
  },
  {
    id: 'BLR',
    name: 'Bengaluru',
    currency: 'INR',
    timeZone: 'Asia/Kolkata',
    monthlyBudget: money(15000, 'INR'),
    managerId: 'blr-manager',
  },
];

export const VOLUNTEERS: Volunteer[] = [
  { employeeId: 'ola', name: 'Ola', homeOffice: 'OSLO' },
  { employeeId: 'kari', name: 'Kari', homeOffice: 'OSLO' },
  { employeeId: 'ingrid', name: 'Ingrid', homeOffice: 'OSLO' },
  { employeeId: 'asha', name: 'Asha', homeOffice: 'BLR' },
  { employeeId: 'ravi', name: 'Ravi', homeOffice: 'BLR' },
  { employeeId: 'meera', name: 'Meera', homeOffice: 'BLR' },
];

/** Fixed monthly rate supplied by finance (demo value). Report currency: NOK. */
export const REPORT_RATES: RateTable = { NOK: 1, INR: 0.12 };

/** Builds a fresh, empty world. The clock is fake so the demo can jump forward in time. */
export function createDemo() {
  const clock = new FakeClock(new Date());
  const chat = new FakeChatTool();
  const hr = new FakeHrSystem();
  const presence = new PresenceRegistry();
  const service = new RefillService({ offices: OFFICES, volunteers: VOLUNTEERS, presence, chat, hr, clock });
  return { clock, chat, hr, presence, service };
}

export type Demo = ReturnType<typeof createDemo>;
