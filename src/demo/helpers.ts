// Small display helpers and shared types for the demo screen. No business rules here.

import type { Office, OfficeId, Refill, Result } from '../core/types';
import { OFFICES, VOLUNTEERS, type Demo } from './demoSetup';

/** Runs a core command and reports the result in the banner. */
export type RunFn = (label: string, action: () => Result<Refill>) => void;

export type Notice = { text: string; tone: 'info' | 'ok' | 'error' };

/** What every role tab receives from App. */
export interface TabProps {
  demo: Demo;
  run: RunFn;
  notify: (notice: Notice) => void;
  refresh: () => void;
}

export const officeById = (id: OfficeId): Office => OFFICES.find((o) => o.id === id)!;

/** Display name for a volunteer or an office manager id. */
export function nameOf(id?: string): string {
  if (!id) return '—';
  const volunteer = VOLUNTEERS.find((v) => v.employeeId === id);
  if (volunteer) return volunteer.name;
  const managed = OFFICES.find((o) => o.managerId === id);
  return managed ? `${managed.name} manager` : id;
}

/** "NEEDS_APPROVAL" -> "Needs approval" (also used for refusal reasons). */
export const humanize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

/** Time in an office's own time zone, e.g. "Wed 18 Nov, 17:01". */
export function officeTime(now: Date, timeZone: string): string {
  return now.toLocaleString('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
