import { DAY } from './clock';
import type { PresenceRegistry } from './presence';
import type { OfficeId, Refill, Volunteer } from './types';

export const FAIRNESS_WINDOW_DAYS = 30;

/** Volunteers physically at this office now (visitors included), minus those excluded. */
export function eligibleVolunteers(
  office: OfficeId,
  volunteers: Volunteer[],
  presence: PresenceRegistry,
  exclude: string[] = [],
): Volunteer[] {
  return volunteers.filter((v) => {
    if (exclude.includes(v.employeeId)) return false;
    const p = presence.get(v);
    return p.kind === 'OFFICE' && p.office === office;
  });
}

/**
 * Fairness rule: the eligible volunteer with the fewest purchases in the last
 * 30 days (across both offices). Ties go to whoever bought longest ago, then
 * to employee id so the choice is deterministic and testable.
 */
export function chooseVolunteer(
  office: OfficeId,
  volunteers: Volunteer[],
  presence: PresenceRegistry,
  refills: Refill[],
  now: Date,
  exclude: string[] = [],
): Volunteer | undefined {
  const since = now.getTime() - FAIRNESS_WINDOW_DAYS * DAY;
  const purchases = refills.filter((r) => r.purchase !== undefined).map((r) => r.purchase!);

  const scored = eligibleVolunteers(office, volunteers, presence, exclude).map((v) => {
    const mine = purchases.filter((p) => p.buyerId === v.employeeId);
    const recentCount = mine.filter((p) => p.purchasedAt.getTime() >= since).length;
    const lastBought = Math.max(-Infinity, ...mine.map((p) => p.purchasedAt.getTime()));
    return { v, recentCount, lastBought };
  });

  scored.sort(
    (a, b) =>
      a.recentCount - b.recentCount ||
      a.lastBought - b.lastBought ||
      a.v.employeeId.localeCompare(b.v.employeeId),
  );
  return scored[0]?.v;
}
