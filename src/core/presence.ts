import type { Presence, Volunteer } from './types';

/**
 * Volunteers set their status through chat ("/snack away", "/snack in BLR").
 * If nothing is set we assume they are at their home office; a wrong guess
 * only costs one "decline", which the lifecycle already handles.
 */
export class PresenceRegistry {
  private readonly statuses = new Map<string, Presence>();

  set(employeeId: string, presence: Presence): void {
    this.statuses.set(employeeId, presence);
  }

  clear(employeeId: string): void {
    this.statuses.delete(employeeId);
  }

  get(volunteer: Volunteer): Presence {
    return this.statuses.get(volunteer.employeeId) ?? { kind: 'OFFICE', office: volunteer.homeOffice };
  }
}
